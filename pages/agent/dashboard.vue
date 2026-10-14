<template>
 <view class="dashboard">
  <AssistantNav title="物联助手" back-label="服务首页" @back="back" />
  <scroll-view class="dashboard-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="content">
    <view class="headline">
     <view>
      <text class="date">{{ dateLine }}</text>
      <text class="hello">你好{{ userName ? '，' + userName : '' }}</text>
     </view>
     <button class="refresh" :disabled="loading" aria-label="刷新公司概览" @tap="load"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="19" color="#567461" /></button>
    </view>
    <view v-if="error" class="notice"><text>{{ error }}</text><button @tap="load">重试</button></view>
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
     <text class="fineprint">{{ environment?.reading?.source === 'shadow' ? '平台影子值 · 可能不是该房间的实测值' : environment?.reading ? '设备观测 · 不代表全公司平均值' : '未取得有效读数' }}</text>
    </view>

    <view class="blk">
     <view class="k"><text>能耗统计</text><button class="more" @tap="openEnergy()">全部 <uni-icons type="right" size="10" color="#176b54" /></button></view>
     <CompanyEnergyStrip v-if="energyStrip.length" ref="energyStripRef" :days="energyStrip" :selected="selectedStripDate" pull-enabled @select="openEnergy" @pull-open="openEnergy()" @reach-left="loadOlderEnergy" />
     <text v-if="energyError" class="fineprint dim">逐日能耗暂不可用 · {{ energyError }}</text>
     <text v-else-if="!energyStrip.length" class="fineprint">{{ energyLoading ? '正在读取逐日能耗…' : '暂无可统计的计量日' }}</text>
     <view v-if="pieCards.length" class="pies">
      <view v-for="card in pieCards" :key="card.key" class="pie">
       <view class="pair"><image class="donut" :src="card.curImage" mode="aspectFit" /><image class="donut" :src="card.baseImage" mode="aspectFit" /></view>
       <view class="pc"><text class="pt">{{ card.label }}</text><text class="pv">{{ card.pv }}</text><text class="pd">{{ card.pd }}</text></view>
      </view>
     </view>
     <view v-if="legendItems.length" class="legend"><text v-for="(item, i) in legendItems" :key="item" class="legend-item"><text class="dot" :style="{ background: PIE_COLORS[i % PIE_COLORS.length] }" />{{ item }}</text><text class="legend-item">左环 = 今日</text></view>
    </view>

    <view class="blk">
     <view class="k"><text>安全台账</text><view class="lchips"><button v-for="chip in ledgerChips" :key="chip.key" :class="{ on: ledgerFilter === chip.key }" @tap="toggleLedger(chip.key)">{{ chip.label }}</button></view></view>
     <text v-if="alertsUnavailable" class="sec-empty">{{ alertsLoading ? '正在更新摘要' : '摘要暂不可用 · 可查看历史' }}</text>
     <template v-else>
      <button v-for="record in alertRows" :key="(record.ledger || '') + ':' + (record.eventId || record.occurredAt)" class="row" @tap="openObservation('alerts')"><text class="d">{{ fmtMDT(record.occurredAt) }}</text><text class="t">{{ record.deviceName }}</text><text class="s">{{ subtypeLabel(record.subtype || record.ledger) }}</text></button>
      <text v-if="!alertRows.length" class="sec-empty">{{ alertsLoading ? '正在更新摘要' : '该类型暂无记录' }}</text>
      <button v-if="snapshot?.alerts" class="list-more" @tap="openObservation('alerts')">全部 {{ snapshot.alerts.total ?? alertRows.length }} 条 ›</button>
     </template>
    </view>

    <view class="blk">
     <view class="k"><text>自动化安排</text><button class="more" @tap="tasksOpen = true">查看安排 <uni-icons type="right" size="10" color="#176b54" /></button></view>
     <template v-if="snapshot?.automation">
      <button v-for="task in automationRows.upcoming" :key="task.id" class="row" @tap="tasksOpen = true"><text class="d">{{ relDay(atTime(task)) }} {{ (atTime(task) || '').slice(11, 16) }}</text><text class="t">{{ task.label }}</text><text class="s">{{ task.repeat ? '周期' : '待执行' }}</text></button>
      <button v-for="task in automationRows.done" :key="task.id" class="row" @tap="tasksOpen = true"><text class="d">{{ fmtMD(task.updatedAt) }}</text><text class="t">{{ task.label }}</text><text class="s" :class="{ ok: task.status === 'completed' }">{{ resultLabel(task.status) }}</text></button>
      <text v-if="!automationRows.upcoming.length && !automationRows.done.length" class="sec-empty">未来一周没有待执行安排</text>
     </template>
     <text v-else class="sec-empty">{{ automationLoading ? '正在更新任务安排' : '任务摘要暂不可用' }}</text>
    </view>

    <button class="ask" :disabled="Boolean(openingAgent)" hover-class="pressed" @tap="openAgent('company')"><text>{{ openingAgent === 'company' ? '正在打开…' : '问公司 Agent' }}</text><text class="arr">→</text></button>
    <button class="office" :disabled="Boolean(openingAgent)" hover-class="pressed" @tap="openAgent('office')"><text>办公室 Agent</text><text class="sub">办公室设备 · 对话与自动化 ›</text></button>
   </view>
  </scroll-view>
  <TaskListSheet v-if="tasksMounted" :open="tasksOpen" source="company" @close="tasksOpen = false" @reference="referenceTask" />
  <DeviceSheet v-if="observationMounted" :open="Boolean(observationType)" :back="observationBack" tall compact-header :title="selectedEvent ? '安全台账详情' : observationTitle" @close="observationType = ''">
   <template #header-left><button v-if="selectedEvent" class="event-back" aria-label="返回安全台账" hover-class="event-back--pressed" @tap="selectedEvent = null"><uni-icons type="back" size="16" color="#62766a" /></button></template>
   <SafetyHistoryList v-if="observationType === 'alerts'" class="event-host" :style="{ display: selectedEvent ? 'none' : 'flex' }" :active="observationType === 'alerts' && !selectedEvent" @select="selectedEvent = $event" />
   <EnvironmentHistoryView v-else-if="observationType === 'environment'" class="event-host" :active="observationType === 'environment'" @question="openEnvironmentAgent" />
   <MeterHistoryView v-else-if="observationType === 'energy'" class="event-host" :active="observationType === 'energy'" @question="openMeterAgent" />
   <scroll-view v-else class="observation-scroll" scroll-y enhanced :show-scrollbar="false"><ObservationCard v-if="observation" :observation="observation" source="company" inline-playback read-only /><text v-else class="sheet-empty">暂无可查看的数据</text></scroll-view>
   <SafetyEventDetail v-if="selectedEvent" class="event-host" :snapshot="selectedEvent" :active="Boolean(observationType)" @reference="referenceEvent" />
  </DeviceSheet>
  <DeviceSheet v-if="energyMounted" :open="energyOpen" tall compact-header title="能耗统计" @close="energyOpen = false">
   <CompanyEnergySheet class="event-host" :active="energyOpen" :focus-date="energyFocusDate" @open-meter-history="openMeterHistory" />
  </DeviceSheet>
  <DeviceSheet v-if="drawerMounted" :open="Boolean(drawerKind)" tall compact-header :title="drawerTitle" :meta="drawerDevices.length + ' 台 · 只读目录'" @close="drawerKind = ''">
   <CompanyDeviceDrawer class="event-host" :devices="drawerDevices" :kind="drawerKind" />
  </DeviceSheet>
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getCompanyDashboard, getCompanyDevices, getCompanyEnergyDaily } from '@/apis/agent'
import { waitForAgentSession, getAgentStorageScope } from '@/utils/agent-session'
import { useUserStoreHook } from '@/store/modules/user'
import AssistantNav from './components/AssistantNav.vue'
import { backToParent } from './navigation.mjs'
import { metricValue } from './dashboard-view.mjs'
import { shiftDate, shanghaiToday, unitOf, round2, comparePct, mergeStripDays, donutImage, compositionFromUsage, PIE_COLORS, STRIP_PAGE_DAYS } from './energy-daily-view.mjs'
import TaskListSheet from './components/TaskListSheet.vue'
import DeviceSheet from './components/DeviceSheet.vue'
import ObservationCard from './components/ObservationCard.vue'
import SafetyEventDetail from './components/SafetyEventDetail.vue'
import SafetyHistoryList from './components/SafetyHistoryList.vue'
import EnvironmentHistoryView from './components/EnvironmentHistoryView.vue'
import MeterHistoryView from './components/MeterHistoryView.vue'
import CompanyEnergyStrip from './components/CompanyEnergyStrip.vue'
import CompanyEnergySheet from './components/CompanyEnergySheet.vue'
import CompanyDeviceDrawer from './components/CompanyDeviceDrawer.vue'

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
const tasksOpen = ref(false)
const snapshot = ref(null), loading = ref(false), error = ref(''), observationType = ref('')
const energyLoading = ref(false), devicesLoading = ref(false)
const alertsLoading = ref(false), automationLoading = ref(false), loadedSections = ref([]), sectionErrors = ref({})
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
const energyUnit = computed(() => unitOf(energyReport.value))
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
function openMeterHistory() { energyOpen.value = false; openObservation('energy') }
const meterNameOf = id => energyReport.value?.meters?.find(m => m.id === id)?.name || id
const pieCards = computed(() => {
 const comparison = energyReport.value?.comparison
 if (typeof comparison?.currentDay?.usage !== 'number') return [] // 今日至今窗口无实测（如边界恰为最新采样点）时不摆“— vs —”空卡
 const unit = energyUnit.value
 return [['previousDay', '今日至今 vs 昨日同期'], ['lastWeekSameDay', '今日至今 vs 上周同日同期']].map(([key, label]) => {
  const base = comparison[key]
  const current = compositionFromUsage(comparison.currentDay.meterUsage, meterNameOf)
  const pct = comparePct(comparison.currentDay.usage, base?.usage)
  const fmt = v => typeof v === 'number' ? String(round2(v)) : '—'
  return { key, label,
   curImage: donutImage(current.map(i => i.value)),
   baseImage: donutImage(compositionFromUsage(base?.meterUsage, meterNameOf).map(i => i.value)),
   pv: `${fmt(comparison.currentDay.usage)} vs ${fmt(base?.usage)}${unit ? ' ' + unit : ''}`,
   pd: pct == null ? '—' : (pct >= 0 ? '+' : '') + pct + '%',
   floors: current.map(i => i.label) }
 })
})
const legendItems = computed(() => pieCards.value[0]?.floors || [])

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
const automationRows = computed(() => ({
 upcoming: (snapshot.value?.automation?.upcoming || []).slice(0, 2),
 done: (snapshot.value?.automation?.latestResults || []).slice(0, 1)
}))
const atTime = task => task?.interval?.startsAt ?? task?.phases?.[0]?.at
const fmtMD = iso => iso ? iso.slice(5, 10) : ''
const fmtMDT = iso => iso ? iso.slice(5, 16).replace('T', ' ') : ''
function relDay(iso) {
 const d = iso?.slice(0, 10)
 if (!d) return ''
 const today = shanghaiToday()
 if (d === today) return '今天'
 if (d === shiftDate(today, 1)) return '明天'
 const diff = Date.parse(d + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')
 if (diff > 0 && diff <= 6 * 864e5) return `周${WEEKDAYS[new Date(d + 'T00:00:00Z').getUTCDay()]}`
 return fmtMD(iso)
}
const observationTitle = computed(() => ({ environment: '环境历史趋势', energy: '计量点原始历史', alerts: '安全事件台账' })[observationType.value] || '')
const observation = computed(() => {
 if (!snapshot.value || !observationType.value || (observationType.value === 'alerts' && alertsUnavailable.value)) return null
 const type = observationType.value
 return { observedAt: snapshot.value[type + 'ObservedAt'], blocks: [type === 'alerts' ? { type, ...snapshot.value.alerts } : { type, devices: snapshot.value[type] || [] }] }
})

function resetForScope() {
 snapshot.value = null; loadedSections.value = []; observationType.value = ''
 catalogDevices.value = []; devicesLoaded.value = false; devicesError.value = ''
 energyReport.value = null; energyStrip.value = []; selectedStripDate.value = ''
 energyOpen.value = false; drawerKind.value = ''; tasksOpen.value = false
}
function allLoaded() { loading.value = false; energyLoading.value = false; alertsLoading.value = false; automationLoading.value = false; devicesLoading.value = false }

let requestId = 0, scope = '', visible = false
async function load() {
 const current = ++requestId
 loading.value = true; energyLoading.value = true; alertsLoading.value = true; automationLoading.value = true; devicesLoading.value = true; error.value = ''; sectionErrors.value = {}
 try {
  await waitForAgentSession()
  const nextScope = getAgentStorageScope()
  if (current !== requestId || !visible) return
  if (nextScope !== scope) { resetForScope(); scope = nextScope }
  await Promise.allSettled(['environment', 'alerts', 'automation', 'devices', 'energyDaily'].map(async section => {
   const active = () => current === requestId && visible && getAgentStorageScope() === nextScope
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
    const devices = section === 'automation' ? previous.devices : [...previous.devices.filter(row => row.kind !== kind), ...result.devices]
    const errors = [...previous.errors.filter(row => row.area !== section), ...result.errors]
    for (const [area, message] of Object.entries(sectionErrors.value)) if (!errors.some(row => row.area === area)) errors.push({ area, message })
    snapshot.value = { ...previous, ...result, devices, [section + 'ObservedAt']: result.observedAt, errors }
    if (section !== 'automation' && !loadedSections.value.includes(section)) loadedSections.value.push(section)
   } catch (cause) {
    if (!active()) return
    if (cause.data?.code === 'UNAUTHORIZED') { resetForScope(); ++requestId; error.value = cause.message; allLoaded(); return }
    if (section === 'devices') devicesError.value = '设备目录暂不可用'
    else if (section === 'energyDaily') energyError.value = cause.message || '暂不可用'
    else {
     sectionErrors.value[section] = cause.message || '暂不可用'
     if (snapshot.value) snapshot.value = { ...snapshot.value, errors: [...snapshot.value.errors.filter(row => row.area !== section), { area: section, message: sectionErrors.value[section] }] }
    }
   } finally {
    if (current === requestId) ({ environment: loading, alerts: alertsLoading, automation: automationLoading, devices: devicesLoading, energyDaily: energyLoading })[section].value = false
   }
  }))
  if (current === requestId && !snapshot.value) error.value = '公司数据暂不可用，请重试'
 } catch (cause) {
  if (current === requestId && visible) {
   ++requestId; allLoaded()
   resetForScope()
   error.value = cause.message === 'request:fail' ? '公司数据暂不可用，请检查网络后重试' : cause.message || '公司数据暂不可用'
  }
 } finally { if (current === requestId) allLoaded() }
}
function openObservation(type) { if (['alerts', 'environment', 'energy'].includes(type) || snapshot.value) observationType.value = type }
function showErrors() { uni.showModal({ title: '部分数据暂不可用', content: snapshot.value.errors.map(row => row.message).join('\n'), showCancel: false }) }
function resultLabel(status) { return ({ completed: '已完成', partial: '部分完成', failed: '失败', missed: '已错过', cancelled: '已取消', unconfirmed: '结果未确认' })[status] || status }
function observationBack() { if (selectedEvent.value) selectedEvent.value = null; else observationType.value = '' }
function referenceEvent(reference) { openAgent('company', reference) }
function referenceTask(reference) { if (openingAgent.value) return; tasksOpen.value = false; openAgent('company', reference) }
const openingAgent = ref('')
function openEnvironmentAgent(window) { openAgent('company', null, window) }
function openMeterAgent(window) { openAgent('company', null, null, window) }
function openAgent(source, reference, environmentWindow, energyWindow) {
 if (openingAgent.value) return
 openingAgent.value = source
 uni.navigateTo({ success: () => { if (reference?.type === 'safety_event') selectedEvent.value = null }, url: `/pages/agent/index?source=${source}&from=dashboard${reference ? (reference.type === 'safety_event' ? '&safetyReference=' : '&taskReference=') + encodeURIComponent(JSON.stringify(reference)) : ''}${environmentWindow ? '&environmentWindow=' + encodeURIComponent(JSON.stringify(environmentWindow)) : ''}${energyWindow ? '&energyWindow=' + encodeURIComponent(JSON.stringify(energyWindow)) : ''}`, fail: () => { openingAgent.value = ''; if (reference && reference.type !== 'safety_event') tasksOpen.value = true; uni.showToast({ title: '未能打开，请重试', icon: 'none' }) } })
}
function back() { backToParent('/pages/index/index') }
onShow(() => {
 visible = true; openingAgent.value = ''
 try { if (scope && scope !== getAgentStorageScope()) resetForScope() }
 catch { resetForScope() }
 load()
})
function hide() { visible = false; ++requestId; allLoaded() }
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

.pies { display:flex; gap:10px; margin-top:16px; }
.pie { flex:1; min-width:0; display:flex; align-items:center; gap:10px; }
.pair { display:flex; gap:5px; flex-shrink:0; }
.donut { width:46px; height:46px; flex-shrink:0; }
.pc { min-width:0; }
.pt { display:block; font-size:9.5px; color:#97917e; line-height:1.5; }
.pv { display:block; font-size:15px; font-weight:600; color:#2e4a38; font-variant-numeric:tabular-nums; margin-top:2px; }
.pd { display:block; font-size:9.5px; color:#a47b35; margin-top:2px; }
.legend { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:10px; }
.legend-item { display:flex; align-items:center; font-size:9px; color:#8fa08c; }
.dot { display:inline-block; width:6px; height:6px; border-radius:2px; margin-right:4px; }

.row { display:flex; align-items:baseline; gap:10px; width:100%; padding:9px 0; border-bottom:1px solid #ece8d9; text-align:left; font-size:12px; color:#3c4a3e; }
.row .d { font-size:10.5px; color:#97917e; font-variant-numeric:tabular-nums; flex-shrink:0; width:78px; }
.row .t { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.row .s { flex-shrink:0; font-size:9.5px; color:#97917e; }
.row .s.ok { color:#176b54; }
.sec-empty { display:block; padding:14px 0; font-size:11px; color:#a0ab95; }
.lchips { display:flex; gap:4px; }
.lchips button { font-size:9.5px; letter-spacing:0; padding:3px 8px; border-radius:8px; color:#809181; background:#edf3e8; }
.lchips button.on { background:#176b54; color:#fff; }
.list-more { display:block; width:100%; padding:10px 0 2px; text-align:left; font-size:10.5px; color:#176b54; }

.ask { display:flex; align-items:center; gap:8px; width:100%; margin-top:28px; padding:15px 0; border-top:1px solid #293f31; font-size:13.5px; font-weight:600; text-align:left; }
.ask .arr { margin-left:auto; font-weight:400; }
.office { display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:8px; padding:10px 0; font-size:11.5px; font-weight:600; color:#41564a; text-align:left; }
.office .sub { font-weight:400; color:#98a49b; font-size:9.5px; }
.pressed { opacity:.65; }

.notice { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:12px; color:#9a784a; font-size:10px; }.notice button { min-height:30px; color:#8b693c; text-decoration:underline; flex-shrink:0; }
.observation-scroll { flex:1; height:0; min-height:0; padding:5px 18px 25px; box-sizing:border-box; }.sheet-empty { display:block; margin:45px 0; text-align:center; color:#839189; font-size:13px; }
.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; } }
</style>
