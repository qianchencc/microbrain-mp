<template>
 <view class="dashboard">
  <AssistantNav title="物联助手" back-label="服务首页" @back="back">
  <template #title>
   <text class="nav-title-text">物联助手</text>
   <button class="office-entry" :disabled="Boolean(openingAgent)" hover-class="office-entry--pressed" aria-label="打开办公室 Agent" @tap="openAgent('office')"><text class="office-entry-text">办公室</text><uni-icons type="forward" size="11" color="#536b5c" /></button>
  </template>
 </AssistantNav>
  <scroll-view class="dashboard-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="content">
    <view class="headline">
     <view>
      <text class="date">{{ dateLine }}</text>
      <text class="hello">你好{{ userName ? '，' + userName : '' }}</text>
     </view>
     <button class="refresh" :disabled="loading" aria-label="刷新公司概览" @tap="load(true)"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="19" color="#567461" /></button>
    </view>
    <view v-if="error" class="notice"><text>{{ error }}</text><button @tap="load(true)">重试</button></view>
    <view v-else-if="snapshot?.errors?.length" class="notice"><text>部分观测暂不可用</text><button @tap="showErrors">查看</button></view>
    <view class="counts">
     <button v-for="cell in KIND_CELLS" :key="cell.kind" class="crow" @tap="openKind(cell.kind)">
      <text class="cc">{{ devicesLoaded ? (kindCounts[cell.kind] ?? 0) : '—' }}</text>
      <text class="cn">{{ cell.label }}</text>
     </button>
    </view>
    <text v-if="devicesError" class="fineprint dim">{{ devicesError }}</text>

    <view class="blk">
     <view class="k"><text>环境传感器</text><button class="more" @tap="openObservation('environment')">趋势 <uni-icons type="right" size="10" color="#176b54" /></button></view>
     <text class="sensor-name">{{ environment?.name || (loading ? '正在更新环境读数' : loadedSections.includes('environment') ? '暂无环境读数' : '环境读数暂不可用') }}</text>
     <view class="env"><view v-for="cell in environmentCells" :key="cell.key"><text class="v serif">{{ metricValue(environment?.reading?.[cell.key]) }}<text class="u">{{ cell.unit }}</text></text><text class="ul">{{ cell.label }}</text></view></view>
    </view>

    <view class="blk">
     <view class="k"><text>能耗统计</text><button class="more" @tap="openEnergy()">全部 <uni-icons type="right" size="10" color="#176b54" /></button></view>
     <CompanyEnergyStrip v-if="energyStrip.length" ref="energyStripRef" :days="energyStrip" :selected="selectedStripDate" pull-enabled @select="openEnergy" @pull-open="openEnergy()" @reach-left="loadOlderEnergy" />
     <text v-if="energyError" class="fineprint dim">逐日能耗暂不可用 · {{ energyError }}</text>
     <text v-else-if="!energyStrip.length" class="fineprint">{{ energyLoading ? '正在读取逐日能耗…' : '暂无可统计的计量日' }}</text>
     <MonthlyEnergyComparison :active="pageActive && !energyLoading" :refresh-key="monthlyRefresh" :cutoff="energyReport?.latestSampleTime || ''" />
    </view>

    <view class="blk">
     <view class="k"><text>安全台账</text><view class="lchips"><button v-for="chip in ledgerChips" :key="chip.key" :class="{ on: ledgerFilter === chip.key }" @tap="toggleLedger(chip.key)">{{ chip.label }}</button></view></view>
     <text v-if="alertsUnavailable" class="sec-empty">{{ alertsLoading ? '正在更新摘要' : '摘要暂不可用 · 可查看历史' }}</text>
     <template v-else>
      <button v-for="record in alertRows" :key="(record.ledger || '') + ':' + (record.eventId || record.occurredAt)" class="row" @tap="openObservation('alerts')"><text class="d alert-time">告警 {{ fmtMDT(record.occurredAt) }}</text><text class="t">设备名称：{{ record.deviceName }}</text><text class="s">{{ subtypeLabel(record.subtype || record.ledger) }}</text></button>
      <text v-if="!alertRows.length" class="sec-empty">{{ alertsLoading ? '正在更新摘要' : '该类型暂无记录' }}</text>
      <button v-if="snapshot?.alerts" class="list-more" @tap="openObservation('alerts')">全部 {{ snapshot.alerts.total ?? alertRows.length }} 条 ›</button>
     </template>
    </view>

    <view class="blk">
     <CompanyTaskOverview :active="pageActive && !tasksOpen" :refresh-key="taskRevision" @open="openTaskSchedule" />
    </view>

   </view>
  </scroll-view>
  <TaskListSheet v-if="tasksMounted" :open="tasksOpen" source="company" :initial-view="taskEntry.view" :date="taskEntry.date" :initial-task="taskEntry.task" :refresh-key="taskRevision" @close="tasksOpen = false" @reference="referenceTask" @changed="tasksChanged" @create="createTask" />
  <DeviceSheet v-if="observationMounted" :open="Boolean(observationType)" :back="observationBack" tall compact-header :title="selectedEvent ? '安全台账详情' : observationTitle" @close="observationType = ''">
   <template #header-left><button v-if="selectedEvent" class="event-back" aria-label="返回安全台账" hover-class="event-back--pressed" @tap="selectedEvent = null"><uni-icons type="back" size="16" color="#62766a" /></button></template>
   <SafetyHistoryList v-if="observationType === 'alerts'" class="event-host" :style="{ display: selectedEvent ? 'none' : 'flex' }" :active="observationType === 'alerts' && !selectedEvent" @select="selectedEvent = $event" />
   <EnvironmentHistoryView v-else-if="observationType === 'environment'" class="event-host" :active="observationType === 'environment'" @question="openEnvironmentAgent" />
   <MeterHistoryView v-else-if="observationType === 'energy'" class="event-host" :active="observationType === 'energy'" @question="openMeterAgent" />
   <scroll-view v-else class="observation-scroll" scroll-y enhanced :show-scrollbar="false"><ObservationCard v-if="observation" :observation="observation" source="company" inline-playback read-only /><text v-else class="sheet-empty">暂无可查看的数据</text></scroll-view>
   <SafetyEventDetail v-if="selectedEvent" class="event-host" :snapshot="selectedEvent" :active="Boolean(observationType)" @reference="referenceEvent" />
  </DeviceSheet>
  <DeviceSheet v-if="energyMounted" :open="energyOpen" tall compact-header title="能耗统计" @close="energyOpen = false">
   <CompanyEnergySheet class="event-host" :active="energyOpen" :focus-date="energyFocusDate" />
  </DeviceSheet>
  <DeviceSheet v-if="drawerMounted" :open="Boolean(drawerKind)" tall compact-header :title="drawerTitle" :meta="drawerDevices.length + ' 台 · 只读目录'" @close="drawerKind = ''">
   <CompanyDeviceDrawer class="event-host" :devices="drawerDevices" :kind="drawerKind" />
  </DeviceSheet>
  <CompanyAgentFloat ref="agentFloat" :page-active="pageActive" @tasks-changed="tasksChanged" />
 </view>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getCompanyDashboard, getCompanyDevices, getCompanyEnergyDaily, companyOverviewCache } from '@/apis/agent'
import { waitForAgentSession, getAgentStorageScope } from '@/utils/agent-session'
import { useUserStoreHook } from '@/store/modules/user'
import AssistantNav from './components/AssistantNav.vue'
import { backToParent } from './navigation.mjs'
import { metricValue } from './dashboard-view.mjs'
import { shiftDate, shanghaiToday, mergeStripDays, STRIP_PAGE_DAYS } from './energy-daily-view.mjs'
import TaskListSheet from './components/TaskListSheet.vue'
import CompanyTaskOverview from './components/CompanyTaskOverview.vue'
import DeviceSheet from './components/DeviceSheet.vue'
import ObservationCard from './components/ObservationCard.vue'
import SafetyEventDetail from './components/SafetyEventDetail.vue'
import SafetyHistoryList from './components/SafetyHistoryList.vue'
import EnvironmentHistoryView from './components/EnvironmentHistoryView.vue'
import MeterHistoryView from './components/MeterHistoryView.vue'
import CompanyEnergyStrip from './components/CompanyEnergyStrip.vue'
import CompanyEnergySheet from './components/CompanyEnergySheet.vue'
import MonthlyEnergyComparison from './components/MonthlyEnergyComparison.vue'
import CompanyDeviceDrawer from './components/CompanyDeviceDrawer.vue'
import CompanyAgentFloat from './components/CompanyAgentFloat.vue'
import { parseAgentContext, environmentHistoryPrompt, meterHistoryPrompt } from './context-link.mjs'

const KIND_CELLS = [
 { kind: 'environment', label: '环境传感器' },
 { kind: 'energy', label: '电表' },
 { kind: 'safety', label: '消防安全' },
 { kind: 'ac', label: '智慧空调' },
 { kind: 'lighting', label: '照明' },
 { kind: 'access', label: '门禁' },
 { kind: 'video', label: '视频监控' }]
const LEDGER_LABEL = { gas: '燃气', smoke: '烟感', water: '水浸', flooding: '水浸' }
const ledgerChips = [{ key: 'gas', label: '燃气' }, { key: 'smoke', label: '烟感' }, { key: 'water', label: '水浸' }]
const WEEKDAYS = '日一二三四五六'

const selectedEvent = ref(null)
const tasksOpen = ref(false), taskRevision = ref(0), taskEntry = ref({ view: 'schedule', date: '', task: null })
function openTaskSchedule(entry) { taskEntry.value = entry; tasksOpen.value = true }
function createTask() { tasksOpen.value = false; openCompanyAgent({ prompt: '帮我安排一个任务' }) }
const snapshot = ref(null), loading = ref(false), error = ref(''), observationType = ref('')
const energyLoading = ref(false), devicesLoading = ref(false)
const alertsLoading = ref(false), loadedSections = ref([]), sectionErrors = ref({})
const tasksMounted = ref(false), observationMounted = ref(false), energyMounted = ref(false), drawerMounted = ref(false)
watch(tasksOpen, open => { if (open) tasksMounted.value = true }, { flush: 'sync' })
watch(observationType, type => { selectedEvent.value = null; if (type) observationMounted.value = true }, { flush: 'sync' })

const dateLine = computed(() => {
 const today = shanghaiToday()
 return `${Number(today.slice(5, 7))}月${Number(today.slice(8))}日 · 周${WEEKDAYS[new Date(today + 'T00:00:00Z').getUTCDay()]}`
})
// /account/me 无 name 字段：真实姓名在 personalName，code 是 openid 不能展示；
// 姓名全空时退回脱敏手机号，再空就只显示“你好”。
const userName = computed(() => {
 const info = useUserStoreHook().getUserInfo || {}
 const mobile = String(info.mobileNumber || '')
 const masked = /^1\d{10}$/.test(mobile) ? mobile.slice(0, 3) + '****' + mobile.slice(-4) : ''
 return info.personalName || info.name || info.nickname || masked || ''
})

/* 设备目录计数 + 单类设备抽屉 */
const catalogDevices = ref([]), devicesLoaded = ref(false), devicesError = ref('')
const drawerKind = ref('')
const kindCounts = computed(() => {
 const map = {}
 for (const device of catalogDevices.value) map[device.kind] = (map[device.kind] || 0) + 1
 return map
})
const drawerDevices = computed(() => catalogDevices.value.filter(d => d.kind === drawerKind.value))
const drawerTitle = computed(() => KIND_CELLS.find(c => c.kind === drawerKind.value)?.label || '设备')
watch(drawerKind, kind => { if (kind) drawerMounted.value = true }, { flush: 'sync' })
function openKind(kind) { if (devicesLoaded.value) drawerKind.value = kind }

/* 能耗统计：横滑日柱 + 拉环开面板 + 同期对比环 */
const energyReport = ref(null), energyStrip = ref([]), energyError = ref('')
const energyStripRef = ref(null), selectedStripDate = ref('')
const energyOpen = ref(false), energyFocusDate = ref('')
watch(energyOpen, open => { if (open) energyMounted.value = true }, { flush: 'sync' })
const latestCompleteDay = computed(() => energyReport.value?.latestCompleteDay || '')
function mergeDailyReport(next) {
 energyReport.value = next
 energyStrip.value = mergeStripDays(energyStrip.value, next.days || [])
}
async function loadOlderEnergy(firstDate) {
 if (!firstDate) return
 const current = requestId
 try {
  const next = await getCompanyEnergyDaily({ days: STRIP_PAGE_DAYS, end: shiftDate(firstDate, -1) })
  if (current !== requestId) return // 已被刷新/换身份作废，不合并旧报告
  const before = energyStrip.value.length
  mergeDailyReport(next)
  const added = energyStrip.value.length - before
  if (added) energyStripRef.value?.didPrepend(added)
 } catch { /* 旧窗口读取失败不破坏当前条带 */ }
}
function openEnergy(date) {
 energyFocusDate.value = date || latestCompleteDay.value || ''
 if (date) selectedStripDate.value = date
 energyOpen.value = true
}
/* 环境 / 台账 / 自动化 */
const environment = computed(() => snapshot.value?.environment?.find(row => row.reading) || snapshot.value?.environment?.[0])
const environmentCells = [{ key: 'temp', label: '温度', unit: '°C' }, { key: 'humidity', label: '湿度', unit: '%' }, { key: 'pm25', label: 'PM2.5', unit: '' }]
const alertsUnavailable = computed(() => Boolean(sectionErrors.value.alerts) || snapshot.value?.errors?.some(row => row.area === 'alerts'))
const ledgerFilter = ref('')
const alertRows = computed(() => {
 const records = snapshot.value?.alerts?.records || []
 const filtered = ledgerFilter.value ? records.filter(r => r.ledger === ledgerFilter.value || (ledgerFilter.value === 'water' && r.ledger === 'flooding')) : records
 return filtered.slice(0, 3)
})
function toggleLedger(key) { ledgerFilter.value = ledgerFilter.value === key ? '' : key }
function subtypeLabel(value) { return LEDGER_LABEL[value] || '' }
const fmtMDT = iso => iso ? iso.slice(5, 16).replace('T', ' ') : ''
const observationTitle = computed(() => ({ environment: '环境历史趋势', energy: '电表统计', alerts: '安全事件台账' })[observationType.value] || '')
const observation = computed(() => {
 if (!snapshot.value || !observationType.value || (observationType.value === 'alerts' && alertsUnavailable.value)) return null
 const type = observationType.value
 return { observedAt: snapshot.value[type + 'ObservedAt'], blocks: [type === 'alerts' ? { type, ...snapshot.value.alerts } : { type, devices: snapshot.value[type] || [] }] }
})

function resetForScope() {
 taskRevision.value++
 snapshot.value = null; loadedSections.value = []; observationType.value = ''
 catalogDevices.value = []; devicesLoaded.value = false; devicesError.value = ''
 energyReport.value = null; energyStrip.value = []; selectedStripDate.value = ''
 energyOpen.value = false; drawerKind.value = ''; tasksOpen.value = false
}
function invalidateCompanyDashboard() { companyOverviewCache.clear() }
function applyCompanyDashboardCache(cached) {
 snapshot.value = cached.snapshot
 loadedSections.value = [...cached.loadedSections]
 sectionErrors.value = { ...cached.sectionErrors }
 catalogDevices.value = [...cached.catalogDevices]
 devicesLoaded.value = cached.devicesLoaded
 devicesError.value = cached.devicesError
 energyReport.value = cached.energyReport
 energyStrip.value = [...cached.energyStrip]
 energyError.value = cached.energyError
 if (!selectedStripDate.value) selectedStripDate.value = cached.selectedStripDate
}
function saveCompanyDashboardCache() {
 if (!snapshot.value || snapshot.value.errors?.length || Object.keys(sectionErrors.value).length || !devicesLoaded.value || devicesError.value || !energyReport.value || energyReport.value.truncated || energyError.value) return
 companyOverviewCache.put('dashboard-snapshot', {
  snapshot: snapshot.value, loadedSections: [...loadedSections.value], sectionErrors: { ...sectionErrors.value },
  catalogDevices: [...catalogDevices.value], devicesLoaded: devicesLoaded.value, devicesError: devicesError.value,
  energyReport: energyReport.value, energyStrip: [...energyStrip.value], energyError: energyError.value, selectedStripDate: selectedStripDate.value,
 })
}
function allLoaded() { loading.value = false; energyLoading.value = false; alertsLoading.value = false; devicesLoading.value = false }

const monthlyRefresh = ref(0)
let requestId = 0, scope = '', visible = false
const dashboardUser = useUserStoreHook()
watch(() => [dashboardUser.token, dashboardUser.getDistrict?.id, dashboardUser.authorized], () => {
 if (!scope) return
 try { if (scope === getAgentStorageScope()) return } catch { /* 登录失效，清理旧快照。 */ }
 invalidateCompanyDashboard(); ++requestId; resetForScope(); scope = ''; allLoaded()
 if (visible) void load()
})
async function load(force = false) {
 const current = ++requestId
 try {
  await waitForAgentSession()
  const nextScope = getAgentStorageScope()
  if (current !== requestId || !visible) return
  if (nextScope !== scope) { if (scope) resetForScope(); scope = nextScope }
  if (force === true) { invalidateCompanyDashboard(); monthlyRefresh.value++; taskRevision.value++ }
  const cached = companyOverviewCache.peek('dashboard-snapshot')
  if (!force && cached) {
   applyCompanyDashboardCache(cached.value)
   error.value = ''
   allLoaded()
   if (cached.fresh) return
  }
  loading.value = true; energyLoading.value = !energyReport.value; alertsLoading.value = !loadedSections.value.includes('alerts'); devicesLoading.value = !devicesLoaded.value; error.value = ''; sectionErrors.value = {}
  await Promise.allSettled(['environment', 'alerts', 'devices', 'energyDaily'].map(async section => {
   const active = () => {
    if (current !== requestId || !visible) return false
    try { if (getAgentStorageScope() === nextScope) return true } catch { /* 身份失效时旧概览不能继续可见。 */ }
    invalidateCompanyDashboard(); ++requestId; resetForScope(); allLoaded()
    error.value = '登录身份已变化，请重新读取'
    return false
   }
   try {
    if (section === 'devices') {
     const result = await getCompanyDevices()
     if (!active()) return
     catalogDevices.value = result.devices || []
     devicesLoaded.value = true; devicesError.value = ''
     return
    }
    if (section === 'energyDaily') {
     const result = await getCompanyEnergyDaily({ days: STRIP_PAGE_DAYS })
     if (!active()) return
     energyStrip.value = []
     mergeDailyReport(result)
     selectedStripDate.value = result.latestCompleteDay || result.days?.at(-1)?.date || ''
     energyError.value = ''
     return
    }
    const result = await getCompanyDashboard(section)
    if (!active()) return
    const previous = snapshot.value || { devices: [], errors: [] }
    const kind = section === 'alerts' ? 'safety' : section
    const devices = [...previous.devices.filter(row => row.kind !== kind), ...result.devices]
    const errors = [...previous.errors.filter(row => row.area !== section), ...result.errors]
    for (const [area, message] of Object.entries(sectionErrors.value)) if (!errors.some(row => row.area === area)) errors.push({ area, message })
    snapshot.value = { ...previous, ...result, devices, [section + 'ObservedAt']: result.observedAt, errors }
    if (!loadedSections.value.includes(section)) loadedSections.value.push(section)
   } catch (cause) {
    if (!active()) return
    if ([401, 403].includes(cause.status) || cause.code === 'AGENT_READ_INVALIDATED' || ['UNAUTHORIZED', 'FORBIDDEN'].includes(cause.data?.code)) { invalidateCompanyDashboard(); resetForScope(); ++requestId; error.value = cause.message; allLoaded(); return }
    if (section === 'devices') devicesError.value = '设备目录暂不可用'
    else if (section === 'energyDaily') energyError.value = cause.message || '暂不可用'
    else {
     sectionErrors.value[section] = cause.message || '暂不可用'
     if (snapshot.value) snapshot.value = { ...snapshot.value, errors: [...snapshot.value.errors.filter(row => row.area !== section), { area: section, message: sectionErrors.value[section] }] }
    }
   } finally {
    if (current === requestId && section !== 'environment') ({ alerts: alertsLoading, devices: devicesLoading, energyDaily: energyLoading })[section].value = false
   }
  }))
  if (current === requestId && visible) saveCompanyDashboardCache()
  if (current === requestId && !snapshot.value) error.value = '公司数据暂不可用，请重试'
 } catch (cause) {
  if (current === requestId && visible) {
   ++requestId; allLoaded()
   invalidateCompanyDashboard()
   resetForScope()
   error.value = cause.message === 'request:fail' ? '公司数据暂不可用，请检查网络后重试' : cause.message || '公司数据暂不可用'
  }
 } finally { if (current === requestId) allLoaded() }
}
function openObservation(type) { if (['alerts', 'environment', 'energy'].includes(type) || snapshot.value) observationType.value = type }
function showErrors() { uni.showModal({ title: '部分数据暂不可用', content: snapshot.value.errors.map(row => row.message).join('\n'), showCancel: false }) }
function observationBack() { if (selectedEvent.value) selectedEvent.value = null; else observationType.value = '' }
/* 公司 Agent 改为右下角浮层（CompanyAgentFloat），办公室 Agent 仍走独立页面。
   引用/观察窗口直传浮层对象，不再过 URL。 */
const agentFloat = ref(null)
const openingAgent = ref('')
const pageActive = ref(false)
let pendingAgentOpen = null
function openCompanyAgent(payload = {}) { agentFloat.value?.open(payload) }
function referenceEvent(reference) { selectedEvent.value = null; observationType.value = ''; openCompanyAgent({ reference }) }
function referenceTask(reference) { tasksOpen.value = false; openCompanyAgent({ reference }) }
function tasksChanged() { taskRevision.value++; invalidateCompanyDashboard() }
function openEnvironmentAgent(window) { observationType.value = ''; openCompanyAgent({ prompt: environmentHistoryPrompt(window) }) }
function openMeterAgent(window) { observationType.value = ''; openCompanyAgent({ prompt: meterHistoryPrompt(window) }) }
function openAgent(source) {
 if (openingAgent.value) return
 openingAgent.value = source
 uni.navigateTo({ url: `/pages/agent/index?source=${source}&from=dashboard`, fail: () => { openingAgent.value = ''; uni.showToast({ title: '未能打开，请重试', icon: 'none' }) } })
}
onLoad(options => {
 const o = options || {}
 // 公司深链（含 index 兼容重定向、客户告警跳转）：浮层带上下文直接展开
 if (o.source === 'company' || o.taskReference || o.alertPrompt !== undefined || o.safetyReference !== undefined || o.environmentWindow !== undefined || o.energyWindow !== undefined) pendingAgentOpen = parseAgentContext(o)
})
onMounted(() => { if (pendingAgentOpen) agentFloat.value?.open(pendingAgentOpen) })
function back() { backToParent('/pages/index/index') }
onShow(() => {
 visible = true; pageActive.value = true; openingAgent.value = ''
 try { if (scope && scope !== getAgentStorageScope()) { resetForScope(); scope = '' } }
 catch { resetForScope(); scope = '' }
 load()
})
function hide() { visible = false; pageActive.value = false; ++requestId; allLoaded() }
onHide(hide); onUnload(hide)
</script>
<style scoped>
.event-host { flex:1;min-height:0;display:flex;flex-direction:column; }.event-back { display:flex;align-items:center;justify-content:center;width:44px;height:44px;flex-shrink:0; }.event-back--pressed { opacity:.65; }

view,text,input { font-size:inherit; line-height:inherit; }
.dashboard { height:100vh; display:flex; flex-direction:column; position:relative; overflow:hidden; background:#eef2ee; color:#293f31; font-size:12px; line-height:1.45; }
button { margin:0; padding:0; background:transparent; font-size:inherit; line-height:inherit; } button::after { border:0; }
.serif { font-family:Georgia,"Songti SC",serif; }

.dashboard-scroll { flex:1; height:0; min-height:0; }.content { padding:15px 18px calc(40px + env(safe-area-inset-bottom)); }
.headline { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
.date { display:block; font-size:10.5px; letter-spacing:2.5px; color:#93a08c; }
.hello { display:block; margin-top:9px; font-size:26px; font-weight:600; letter-spacing:-.5px; line-height:1.3; }
.refresh { width:38px; height:38px; display:flex; align-items:center; justify-content:center; border:1px solid #d9e2d7; border-radius:50%; background:linear-gradient(#f9fbf7,#e8eee5); box-shadow:inset 0 1px 0 #fff; flex-shrink:0; margin-top:4px; }.refresh[disabled] { opacity:.6; }

.counts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
.crow { display:block; padding:11px 0 9px; border-bottom:1px solid #ece8d9; text-align:left; }
.cc { display:block; font-family:Georgia,"Songti SC",serif; font-size:23px; color:#2e4a38; font-variant-numeric:tabular-nums; letter-spacing:-.5px; }
.cn { display:block; margin-top:2px; font-size:10px; color:#839287; }

.blk { margin-top:26px; }
.k { display:flex; align-items:baseline; justify-content:space-between; gap:8px; font-size:10px; letter-spacing:2px; color:#94a08b; padding-bottom:9px; border-bottom:1px solid #dce4da; }
.more { display:flex; align-items:center; gap:3px; color:#176b54; font-size:10px; letter-spacing:0; min-height:24px; }
.sensor-name { display:block; margin-top:8px; color:#91a08f; font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fineprint { display:block; font-size:9px; line-height:1.5; color:#869780; margin-top:8px; }
.fineprint.dim { color:#a08a58; }

.env { display:flex; gap:26px; margin-top:14px; }
.env .v { font-size:30px; letter-spacing:-.5px; font-variant-numeric:tabular-nums; color:#2e4a38; }
.env .u { font-size:11px; color:#8a947f; margin-left:2px; }
.env .ul { display:block; margin-top:3px; font-size:9.5px; color:#97917e; }


.row { display:flex; align-items:baseline; gap:10px; width:100%; padding:9px 0; border-bottom:1px solid #ece8d9; text-align:left; font-size:12px; color:#3c4a3e; }
.row .d { font-size:10.5px; color:#97917e; font-variant-numeric:tabular-nums; flex-shrink:0; width:78px; }
.row .alert-time { width:auto; white-space:nowrap; }
.row .t { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.row .s { flex-shrink:0; font-size:9.5px; color:#97917e; }
.sec-empty { display:block; padding:14px 0; font-size:11px; color:#a0ab95; }
.lchips { display:flex; gap:4px; }
.lchips button { font-size:9.5px; letter-spacing:0; padding:3px 8px; border-radius:8px; color:#809181; background:#edf3e8; }
.lchips button.on { background:#176b54; color:#fff; }
.list-more { display:block; width:100%; padding:10px 0 2px; text-align:left; font-size:10.5px; color:#176b54; }

/* 标题旁办公室入口：AssistantNav #title 插槽内容用本文件样式（scoped 只吃宿主侧） */
.nav-title-text { font-size:15px; font-weight:600; color:#293f31; }
.office-entry { display:flex; align-items:center; gap:3px; margin-left:10px; padding:4px 10px; border-radius:12px; background:linear-gradient(#fefffe,#eef3ef); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.16), 0 1px 2px rgba(28,57,42,.08); }
.office-entry::after { border:0; }
.office-entry[disabled] { opacity:.6; }
.office-entry--pressed { opacity:.65; }
.office-entry-text { font-size:11px; color:#536b5c; }
.pressed { opacity:.65; }

.notice { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:12px; color:#9a784a; font-size:10px; }.notice button { min-height:30px; color:#8b693c; text-decoration:underline; flex-shrink:0; }
.observation-scroll { flex:1; height:0; min-height:0; padding:5px 18px 25px; box-sizing:border-box; }.sheet-empty { display:block; margin:45px 0; text-align:center; color:#839189; font-size:13px; }
.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; } }
</style>
