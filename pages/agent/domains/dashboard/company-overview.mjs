import { STRIP_PAGE_DAYS, mergeStripDays } from '../energy/energy-daily-view.mjs'

const failureMessage = (cause, fallback) => cause?.data?.cache?.lastError?.message || cause?.data?.message || cause?.message || fallback
const emptyData = () => ({ snapshot: null, loadedSections: [], sectionErrors: {}, sectionCache: {},
  catalogDevices: [], devicesLoaded: false, devicesError: '', energyReport: null, energyStrip: [], energyError: '',
  selectedStripDate: '', simpleUnread: 0, simpleUnreadLoaded: false, simpleUnreadError: '' })

// Independent sections share one identity/request lifetime and one honest cache policy.
export function createCompanyOverview({ api, identity, cache, effects, createState = value => value }) {
  const state = createState({ ...emptyData(), loading: false, energyLoading: false, devicesLoading: false, alertsLoading: false, error: '' })
  let requestId = 0, unreadRequest = 0, scope = '', visible = false
  function allLoaded() {
    Object.assign(state, { loading: false, energyLoading: false, devicesLoading: false, alertsLoading: false })
  }
  function reset() {
    ++unreadRequest
    Object.assign(state, emptyData())
    effects.reset()
  }
  const invalidate = () => cache.clear()
  function identityChanged() {
    if (!scope) return
    try { if (scope === identity()) return } catch { /* Expired identity must not retain a previous account's data. */ }
    invalidate()
    ++requestId
    reset()
    scope = ''
    allLoaded()
    if (visible) return load()
  }
  async function refreshUnread(force = false) {
    if (!visible || !scope) return
    const current = ++unreadRequest, savedScope = scope
    const active = () => current === unreadRequest && visible && savedScope === identity()
    const saved = api.peekUnread({ source: 'company', limit: 1 })
    if (saved) { state.simpleUnread = Number(saved.unreadCount) || 0; state.simpleUnreadError = ''; state.simpleUnreadLoaded = true }
    try {
      const unread = await api.unread({ source: 'company', limit: 1, force })
      if (!active()) return
      state.simpleUnread = Number(unread.unreadCount) || 0
      state.simpleUnreadError = ''
    } catch (cause) {
      if (active()) state.simpleUnreadError = cause?.message || '暂不可用'
    } finally { if (active()) state.simpleUnreadLoaded = true }
  }
  function syncUnread(count) {
    state.simpleUnread = Number(count) || 0
    state.simpleUnreadError = ''
    state.simpleUnreadLoaded = true
  }
  function applyCache(cached) {
    Object.assign(state, { snapshot: cached.snapshot, loadedSections: [...cached.loadedSections],
      sectionErrors: { ...(cached.sectionErrors || {}) }, sectionCache: { ...(cached.sectionCache || {}) },
      catalogDevices: [...cached.catalogDevices], devicesLoaded: cached.devicesLoaded, devicesError: cached.devicesError,
      energyReport: cached.energyReport, energyStrip: [...cached.energyStrip], energyError: cached.energyError })
    if (!state.selectedStripDate) state.selectedStripDate = cached.selectedStripDate
  }
  function saveCache() {
    if (state.error || !state.snapshot || state.snapshot.errors?.length || Object.keys(state.sectionErrors).length
      || !state.devicesLoaded || state.devicesError || !state.energyReport || state.energyReport.truncated || state.energyError) return
    const stale = ['environment', 'alerts', 'devices', 'energyDaily'].some(area => {
      const section = state.sectionCache[area]
      return Boolean(section?.lastError) || Boolean(section?.status && section.status !== 'fresh')
    })
    cache.write({ snapshot: state.snapshot, loadedSections: [...state.loadedSections], sectionErrors: { ...state.sectionErrors },
      sectionCache: { ...state.sectionCache }, cache: { status: stale ? 'stale' : 'fresh' },
      catalogDevices: [...state.catalogDevices], devicesLoaded: state.devicesLoaded, devicesError: state.devicesError,
      energyReport: state.energyReport, energyStrip: [...state.energyStrip], energyError: state.energyError,
      selectedStripDate: state.selectedStripDate })
  }
  function applySection(section, result) {
    const { cache: sectionCache, ...body } = result
    state.sectionCache = { ...state.sectionCache, [section]: sectionCache || null }
    if (section === 'devices') {
      state.catalogDevices = body.devices || []
      state.devicesLoaded = true
      state.devicesError = ''
      return
    }
    if (section === 'energyDaily') {
      state.energyReport = body
      state.energyStrip = mergeStripDays([], body.days || [])
      state.selectedStripDate = body.latestCompleteDay || body.days?.at(-1)?.date || ''
      state.energyError = ''
      return
    }
    const previous = state.snapshot || { devices: [], errors: [] }, previousBody = { ...previous }
    delete previousBody.cache
    const nextErrors = { ...state.sectionErrors }
    delete nextErrors[section]
    state.sectionErrors = nextErrors
    const kind = section === 'alerts' ? 'safety' : section
    const devices = [...previous.devices.filter(row => row.kind !== kind), ...body.devices]
    const errors = [...previous.errors.filter(row => row.area !== section), ...body.errors]
    for (const [area, message] of Object.entries(nextErrors)) if (!errors.some(row => row.area === area)) errors.push({ area, message })
    state.snapshot = { ...previousBody, ...body, devices, [section + 'ObservedAt']: body.observedAt, errors }
    if (!state.loadedSections.includes(section)) state.loadedSections.push(section)
  }
  async function load(force = false) {
    const current = ++requestId
    try {
      await api.ready()
      const nextScope = identity()
      if (current !== requestId || !visible) return
      if (nextScope !== scope) { if (scope) reset(); scope = nextScope }
      if (force === true) { invalidate(); effects.tasksChanged(); state.simpleUnreadError = '' }
      if (!state.simpleUnreadLoaded || force === true) void refreshUnread(force === true)
      const cached = cache.read()
      if (!force && cached) {
        applyCache(cached.value)
        state.error = ''
        allLoaded()
        if (cached.fresh) return
      }
      Object.assign(state, { loading: true, energyLoading: !state.energyReport, alertsLoading: !state.loadedSections.includes('alerts'),
        devicesLoading: !state.devicesLoaded, error: '' })
      let criticalRemaining = 3
      const active = () => {
        if (current !== requestId || !visible) return false
        try { if (identity() === nextScope) return true } catch { /* Scope loss invalidates every section, not just the failed request. */ }
        invalidate(); ++requestId; reset(); allLoaded()
        state.error = '登录身份已变化，请重新读取'
        return false
      }
      await Promise.allSettled(['environment', 'alerts', 'devices', 'energyDaily'].map(async section => {
        try {
          const options = { force: force === true, isActive: active }
          const result = section === 'devices' ? await api.devices(options)
            : section === 'energyDaily' ? await api.energy({ days: STRIP_PAGE_DAYS }, options)
              : await api.dashboard(section, options)
          if (active()) applySection(section, result)
        } catch (cause) {
          if (!active()) return
          if ([401, 403].includes(cause.status) || cause.code === 'AGENT_READ_INVALIDATED' || ['UNAUTHORIZED', 'FORBIDDEN'].includes(cause.data?.code)) {
            invalidate(); reset(); ++requestId; state.error = cause.message; allLoaded(); return
          }
          if (['AGENT_READ_PREPARING', 'ACCOUNT_IDENTITY_PREPARING'].includes(cause.code)) { state.error = cause.message; return }
          if (section === 'devices') state.devicesError = failureMessage(cause, '设备目录暂不可用')
          else if (section === 'energyDaily') state.energyError = failureMessage(cause, '暂不可用')
          else {
            state.sectionErrors[section] = failureMessage(cause, '暂不可用')
            if (state.snapshot) state.snapshot = { ...state.snapshot, errors: [...state.snapshot.errors.filter(row => row.area !== section), { area: section, message: state.sectionErrors[section] }] }
          }
        } finally {
          if (current === requestId && section !== 'energyDaily' && --criticalRemaining === 0) state.loading = false
        }
      }))
      if (current === requestId && visible) saveCache()
      if (current === requestId && !state.snapshot && !state.error) state.error = '公司数据暂不可用，请重试'
    } catch (cause) {
      if (current === requestId && visible) {
        ++requestId; allLoaded(); invalidate(); reset()
        state.error = cause.message === 'request:fail' ? '公司数据暂不可用，请检查网络后重试' : cause.message || '公司数据暂不可用'
      }
    } finally { if (current === requestId) allLoaded() }
  }
  function show() {
    visible = true
    try { if (scope && scope !== identity()) { reset(); scope = '' } }
    catch { reset(); scope = '' }
    return load()
  }
  function hide() { visible = false; ++requestId; ++unreadRequest; allLoaded() }
  return { state, load, show, hide, identityChanged, refreshUnread, syncUnread, invalidate }
}
