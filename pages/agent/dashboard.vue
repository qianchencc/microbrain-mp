<template>
 <view class="dashboard">
  <AssistantNav title="物联助手" back-label="服务首页" @back="back">
  <template #title>
   <!-- 具名插槽多根节点在 mp-weixin 会被外包一层普通 view（块级），
        必须收进单一行容器，否则标题与入口竖排 -->
   <view class="title-row">
    <text class="nav-title-text">物联助手</text>
    <view class="nav-sep" />
    <button class="office-entry" :disabled="Boolean(openingAgent)" hover-class="office-entry--pressed" aria-label="打开办公室 Agent" @tap="openAgent('office')"><text class="office-entry-text">办公室</text><uni-icons type="forward" size="10" color="#7d8d82" /></button>
   </view>
  </template>
 </AssistantNav>
  <scroll-view class="dashboard-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="content">
    <view class="headline">
     <view>
      <text class="date">{{ dateLine }}</text>
      <text class="hello">你好{{ userName ? '，' + userName : '' }}</text>
     </view>
     <view class="head-actions">
      <view class="mode-seg">
       <button :class="{ on: mode === 'simple' }" @tap="setMode('simple')">精简</button>
       <button :class="{ on: mode === 'detailed' }" @tap="setMode('detailed')">详细</button>
      </view>
      <button class="refresh" :disabled="loading" aria-label="刷新公司概览" @tap="load(true)"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="19" color="#567461" /></button>
     </view>
    </view>
    <view v-if="error" class="notice"><text>{{ error }}</text><button @tap="load(true)">重试</button></view>
    <view v-else-if="snapshot?.errors?.length" class="notice"><text>部分观测暂不可用</text><button @tap="showErrors">查看</button></view>

    <!-- 精简模式：状态灯 + 2×2 状态块（proto-dashboard-directions E 变体），点块仍进原详情 -->
    <!-- 两种模式常驻、只切可见性：切换模式不重建子树，读取与图表位置都不重来 -->
    <view class="simple" :style="{ display: mode === 'simple' ? 'block' : 'none' }">
     <view class="lamp-hero">
      <view class="lamp" :class="simpleVerdict.state"><view class="lamp-disc">{{ simpleVerdict.mark }}</view></view>
      <text class="verdict">{{ simpleVerdict.text }}</text>
      <text class="verdict-sub">{{ simpleVerdict.sub }}</text>
     </view>
     <view class="zones">
      <button v-for="zone in simpleZones" :key="zone.key" class="zone" hover-class="zone--pressed" :aria-label="zone.name" @tap="zone.go()">
       <view class="zone-top"><view class="zic"><image class="zicon" :src="zone.icon" mode="aspectFit" /></view><text class="zpill" :class="{ warn: zone.warn }">{{ zone.pill }}</text></view>
       <text class="zname">{{ zone.name }}</text>
       <text class="zstatus" :class="{ warn: zone.warn }">{{ zone.status }}</text>
       <text class="zvalue">{{ zone.value }}</text>
      </button>
     </view>

     <button class="agent-cta" hover-class="zone--pressed" @tap="openCompanyAgent()">
      <view class="cta-orb" />
      <view class="cta-copy"><text class="cta-t">直接问助手</text><text class="cta-s">比如「上周哪天用电最多」</text></view>
     </button>
    </view>

    <view v-if="detailMounted" class="detail" :style="{ display: mode === 'simple' ? 'none' : 'block' }">
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
     <CompanyEnergyStrip v-if="energyStrip.length" ref="energyStripRef" :days="energyStrip" :selected="selectedStripDate" pull-enabled @select="openEnergy" @pull-open="openEnergy()" />
     <EnergySkeleton v-else-if="energyLoading && !energyError" />
     <text v-if="energyError" class="fineprint dim">逐日能耗暂不可用 · {{ energyError }}</text>
     <text v-else-if="!energyStrip.length && !energyLoading" class="fineprint">暂无可统计的计量日</text>
     <MonthlyEnergyComparison :active="pageActive && !energyLoading && mode === 'detailed'" :refresh-key="monthlyRefresh" :cutoff="energyReport?.latestSampleTime || ''" />
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
     <CompanyTaskOverview :active="pageActive && !tasksOpen && mode === 'detailed'" :refresh-key="taskRevision" @open="openTaskSchedule" />
    </view>
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
import { pickAgentLaunch, savePendingAgentLaunch, takePendingAgentLaunch } from '@/utils/agent-launch-link.mjs'
import { getCompanyDashboard, getCompanyDevices, clearCompanyReadCache, readCompanyDashboardCache, writeCompanyDashboardCache } from '@/apis/agent/observations'
import { getCompanyEnergyDaily } from '@/apis/agent/energy'
import { peekAgentNotifications, peekAgentTasks, readAgentNotifications, readAgentTasks } from '@/apis/agent/tasks'
import { waitForAgentSession, getAgentStorageScope } from '@/utils/agent-session'
import { useUserStoreHook } from '@/store/modules/user'
import AssistantNav from './components/shared/AssistantNav.vue'
import { backToParent } from './lib/navigation.mjs'
import { shiftDate, shanghaiToday, mergeStripDays, STRIP_PAGE_DAYS } from './lib/energy.mjs'
import { metricValue } from './lib/dashboard.mjs'
import TaskListSheet from './components/tasks/TaskListSheet.vue'
import CompanyTaskOverview from './components/tasks/CompanyTaskOverview.vue'
import DeviceSheet from './components/shared/DeviceSheet.vue'
import ObservationCard from './components/observations/ObservationCard.vue'
import SafetyEventDetail from './components/observations/SafetyEventDetail.vue'
import SafetyHistoryList from './components/observations/SafetyHistoryList.vue'
import EnvironmentHistoryView from './components/observations/EnvironmentHistoryView.vue'
import MeterHistoryView from './components/observations/MeterHistoryView.vue'
import CompanyEnergyStrip from './components/energy/CompanyEnergyStrip.vue'
import EnergySkeleton from './components/energy/EnergySkeleton.vue'
import CompanyEnergySheet from './components/energy/CompanyEnergySheet.vue'
import MonthlyEnergyComparison from './components/energy/MonthlyEnergyComparison.vue'
import CompanyDeviceDrawer from './components/shared/CompanyDeviceDrawer.vue'
import CompanyAgentFloat from './components/shared/CompanyAgentFloat.vue'
import { parseAgentContext, meterHistoryPrompt } from './lib/conversation.mjs'
import { environmentHistoryPrompt, environmentWindowReference } from './lib/observations.mjs'
import { agendaGroups, taskSettled, taskDayTime, taskToday } from './lib/tasks.mjs'

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
// drawerKind 'catalog' 为精简模式的全量目录入口；其余仍是单类设备抽屉。
const drawerDevices = computed(() => drawerKind.value === 'catalog' ? catalogDevices.value : catalogDevices.value.filter(d => d.kind === drawerKind.value))
const drawerTitle = computed(() => drawerKind.value === 'catalog' ? '设备目录' : KIND_CELLS.find(c => c.kind === drawerKind.value)?.label || '设备')
watch(drawerKind, kind => { if (kind) drawerMounted.value = true }, { flush: 'sync' })
function openKind(kind) { if (devicesLoaded.value) drawerKind.value = kind }
function openCatalog() { if (devicesLoaded.value) drawerKind.value = 'catalog' }

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

/* 精简模式（proto-dashboard-directions E 变体）：状态灯 + 2×2 状态块。
   全部投影自已加载的概览/能耗/目录快照，唯一新增读取是任务议程；
   判断诚实口径：告警是历史台账（只按最近一条是否在近30天内给「有记录」，不暗示实时），
   能耗对比只在上一个完整计量日存在时给差值，缺数显示「—」不估算。 */
const MODE_KEY = 'agent-dashboard-mode'
const mode = ref('simple')
try { mode.value = uni.getStorageSync(MODE_KEY) === 'detailed' ? 'detailed' : 'simple' } catch { /* 存储不可用时保持精简 */ }
// 详细子树首次展示才挂载；此后只切可见性，切模式不重建日柱、月度对比与议程，也不重复读取。
const detailMounted = ref(mode.value === 'detailed')
watch(mode, next => { if (next === 'detailed') detailMounted.value = true })
function setMode(next) {
 mode.value = next
 try { uni.setStorageSync(MODE_KEY, next) } catch { /* 偏好保存失败不阻塞切换 */ }
 if (next === 'simple' && (!simpleTasksLoaded.value || !simpleUnreadLoaded.value)) void loadSimpleAgenda()
}
const simpleTasks = ref([]), simpleTasksLoaded = ref(false), simpleTasksError = ref(''), simpleUnread = ref(0)
const simpleUnreadLoaded = ref(false), simpleUnreadError = ref('')
let agendaRequestId = 0
const agendaRange = () => { const today = taskToday(); return { from: `${today}T00:00:00+08:00`, to: `${shiftDate(today, 62)}T00:00:00+08:00` } }
async function loadSimpleAgenda(force = false) {
 const current = ++agendaRequestId
 const range = agendaRange()
 // 有同身份快照先落位：切换模式/重进不回到「读取中」。
 const saved = peekAgentTasks({ source: 'company', ...range }), savedUnread = peekAgentNotifications({ source: 'company', limit: 1 })
 if (saved) { simpleTasks.value = saved.tasks || []; simpleTasksError.value = ''; simpleTasksLoaded.value = true }
 if (savedUnread) { simpleUnread.value = Number(savedUnread.unreadCount) || 0; simpleUnreadError.value = ''; simpleUnreadLoaded.value = true }
 // 任务窗与未读数并行，各自落位、各自报错：一侧在途或失败都不拖住另一侧。
 const applyTasks = readAgentTasks({ source: 'company', ...range, force }).then(result => {
  if (current !== agendaRequestId || !visible) return
  try { if (getAgentStorageScope() !== scope) return } catch { return }
  simpleTasks.value = result.tasks || []; simpleTasksError.value = ''
 }, cause => { if (current === agendaRequestId) simpleTasksError.value = cause?.message || '暂不可用' })
  .finally(() => { if (current === agendaRequestId) simpleTasksLoaded.value = true })
 const applyUnread = readAgentNotifications({ source: 'company', limit: 1, force }).then(unread => {
  if (current !== agendaRequestId || !visible) return
  try { if (getAgentStorageScope() !== scope) return } catch { return }
  simpleUnread.value = Number(unread.unreadCount) || 0; simpleUnreadError.value = ''
 }, cause => { if (current === agendaRequestId) simpleUnreadError.value = cause?.message || '暂不可用' })
  .finally(() => { if (current === agendaRequestId) simpleUnreadLoaded.value = true })
 await Promise.all([applyTasks, applyUnread])
}
const svgIcon = (body, color) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)
const ZONE_ICONS = {
 environment: svgIcon('<path d="M5 19C5 10.5 9.5 5.5 20 4c-.7 10.5-5.7 15-15 15z"/><path d="M5 19c2.8-4.6 6.2-7.7 10-9.8"/>', '#2e6b52'),
 energy: svgIcon('<path d="M13.2 2.5 5.5 13.2h5.6l-1.3 8.3 8.7-11.7h-5.9l.6-7.3z"/>', '#9a7b2d'),
 safetyOk: svgIcon('<path d="M12 3l7 2.8v5.5c0 4.7-3 7.8-7 9.2-4-1.4-7-4.5-7-9.2V5.8L12 3z"/><path d="M9 11.8l2.2 2.2 4-4.2"/>', '#2e6b52'),
 safetyWarn: svgIcon('<path d="M12 3l7 2.8v5.5c0 4.7-3 7.8-7 9.2-4-1.4-7-4.5-7-9.2V5.8L12 3z"/><path d="M12 8.5v4"/><circle cx="12" cy="15.6" r=".9" fill="#a27128" stroke="none"/>', '#a27128'),
 task: svgIcon('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/>', '#2e6b52'),
 catalog: svgIcon('<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>', '#2e6b52'),
 inbox: svgIcon('<path d="M12 4a5.5 5.5 0 0 1 5.5 5.5c0 3.4.8 4.9 1.7 6.4H4.8c.9-1.5 1.7-3 1.7-6.4A5.5 5.5 0 0 1 12 4z"/><path d="M10 19a2 2 0 0 0 4 0"/>', '#2e6b52')
}
const envError = computed(() => Boolean(sectionErrors.value.environment) || snapshot.value?.errors?.some(row => row.area === 'environment'))
const simpleEnv = computed(() => {
 if (envError.value) return { warn: true, pill: '暂不可用', status: '读取失败', value: '—' }
 const reading = environment.value?.reading
 if (!reading) return loadedSections.value.includes('environment')
  ? { warn: false, pill: '正常', status: '暂无读数', value: '—' }
  : { warn: false, pill: '读取中', status: '更新中', value: '—' }
 const pm25 = typeof reading.pm25 === 'number' ? reading.pm25 : null
 const comfy = pm25 == null || pm25 <= 75
 const parts = [`${metricValue(reading.temp)}°`]
 if (typeof reading.humidity === 'number') parts.push(`湿度 ${reading.humidity}%`)
 return { warn: !comfy, pill: comfy ? '正常' : '注意', status: comfy ? '舒适' : '一般', value: parts.join(' · ') }
})
const simpleEnergy = computed(() => {
 if (energyError.value) return { warn: true, pill: '暂不可用', status: '读取失败', value: '—' }
 const usable = [...(energyReport.value?.days || [])].reverse().filter(day => day.usage != null)
 const latest = usable.find(day => day.complete) || usable[0]
 if (!latest) return energyLoading.value
  ? { warn: false, pill: '读取中', status: '更新中', value: '—' }
  : { warn: false, pill: '正常', status: '暂无数据', value: '—' }
 const prev = usable.find(day => day !== latest && day.complete && day.date < latest.date)
 const delta = prev?.usage ? Math.round((latest.usage - prev.usage) / prev.usage * 100) : null
 const unit = energyReport.value?.basis?.unit === 'kWh' ? ' 度' : ''
 const dayText = latest.date === shiftDate(shanghaiToday(), -1) ? '昨日' : `${Number(latest.date.slice(5, 7))}月${Number(latest.date.slice(8))}日`
 const high = delta != null && delta > 10
 return { warn: high, pill: high ? '注意' : '正常', status: high ? '偏高' : '平稳',
  value: `${dayText} ${Math.round(latest.usage).toLocaleString()}${unit}${delta != null ? ` ${delta >= 0 ? '↑' : '↓'}${Math.abs(delta)}%` : ''}` }
})
const simpleSafety = computed(() => {
 if (alertsUnavailable.value) return { warn: true, pill: '暂不可用', status: '读取失败', value: '—' }
 if (!loadedSections.value.includes('alerts')) return { warn: false, pill: '读取中', status: '更新中', value: '—' }
 const latest = snapshot.value?.alerts?.records?.[0]
 if (!latest || Date.parse(latest.occurredAt) < Date.now() - 30 * 864e5)
  return { warn: false, pill: '正常', status: '无告警', value: '近 30 天' }
 return { warn: true, pill: '注意', status: '有记录', value: `${Number(latest.occurredAt.slice(5, 7))}月${Number(latest.occurredAt.slice(8, 10))}日 · ${subtypeLabel(latest.subtype || latest.ledger) || '告警'}` }
})
const simpleAgenda = computed(() => {
 if (!simpleTasksLoaded.value) return { warn: false, pill: '读取中', status: '更新中', value: '—' }
 if (simpleTasksError.value) return { warn: true, pill: '暂不可用', status: '读取失败', value: '—' }
 const today = taskToday()
 let count = 0, next = null
 for (const day of agendaGroups(simpleTasks.value, today, 62).days) {
  for (const task of day.rows) {
   if (taskSettled(task)) continue
   count += 1
   if (!next) next = { task, date: day.date }
  }
 }
 if (!next) return { warn: false, pill: '空闲', status: '0 项', value: '近期无待执行任务' }
 const dayText = next.date === today ? '今天' : `${Number(next.date.slice(5, 7))}月${Number(next.date.slice(8))}日`
 return { warn: false, pill: '进行中', status: `${count} 项`, value: `${dayText} ${taskDayTime(next.task, next.date)} · ${next.task.label || '任务安排'}` }
})
const simpleVerdict = computed(() => {
 if (loading.value && !loadedSections.value.length && !energyReport.value && !devicesLoaded.value)
  return { state: 'loading', mark: '…', text: '数据读取中', sub: '正在更新园区概览' }
 if (error.value) return { state: 'warn', mark: '!', text: '数据暂不可用', sub: error.value }
 const issues = []
 if (simpleSafety.value.warn) issues.push('有新的安全记录')
 if (simpleEnergy.value.warn) issues.push('用电较前期偏高')
 if (envError.value || alertsUnavailable.value || energyError.value || devicesError.value) issues.push('部分数据暂不可用')
 if (!issues.length) return { state: 'ok', mark: '✓', text: '园区一切正常', sub: '环境 · 用电 · 安全 均正常' }
 return { state: 'warn', mark: '!', text: issues[0], sub: issues.slice(1).join(' · ') || '点下方区块查看详情' }
})
const simpleCatalog = computed(() => {
 if (devicesError.value) return { warn: true, pill: '暂不可用', status: '读取失败', value: '—' }
 if (!devicesLoaded.value) return { warn: false, pill: '读取中', status: '更新中', value: '—' }
 return { warn: false, pill: '正常', status: `${catalogDevices.value.length} 台`, value: `${KIND_CELLS.length} 类设备` }
})
const simpleInbox = computed(() => {
 if (!simpleUnreadLoaded.value) return { warn: false, pill: '读取中', status: '更新中', value: '任务与报告' }
 if (simpleUnreadError.value) return { warn: true, pill: '暂不可用', status: '读取失败', value: '任务与报告' }
 if (simpleUnread.value > 0) return { warn: true, pill: '待查看', status: `${simpleUnread.value > 99 ? '99+' : simpleUnread.value} 条未读`, value: '任务与报告' }
 return { warn: false, pill: '正常', status: '无未读', value: '任务与报告' }
})
const simpleZones = computed(() => [
 { key: 'environment', name: '环 境', icon: ZONE_ICONS.environment, ...simpleEnv.value, go: () => openObservation('environment') },
 { key: 'energy', name: '用 电', icon: ZONE_ICONS.energy, ...simpleEnergy.value, go: () => openEnergy() },
 { key: 'safety', name: '安 全', icon: simpleSafety.value.warn ? ZONE_ICONS.safetyWarn : ZONE_ICONS.safetyOk, ...simpleSafety.value, go: () => openObservation('alerts') },
 { key: 'task', name: '任 务', icon: ZONE_ICONS.task, ...simpleAgenda.value, go: () => openTaskSchedule({ view: 'all', date: taskToday(), task: null }) },
 { key: 'catalog', name: '设 备', icon: ZONE_ICONS.catalog, ...simpleCatalog.value, go: openCatalog },
 { key: 'inbox', name: '通 知', icon: ZONE_ICONS.inbox, ...simpleInbox.value, go: () => openTaskSchedule({ view: 'inbox', date: taskToday(), task: null }) }
])
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
 ++agendaRequestId; simpleTasks.value = []; simpleTasksLoaded.value = false; simpleTasksError.value = ''; simpleUnread.value = 0
 simpleUnreadLoaded.value = false; simpleUnreadError.value = ''
}
function invalidateCompanyDashboard() { clearCompanyReadCache() }
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
 writeCompanyDashboardCache({
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
  if (force === true) { invalidateCompanyDashboard(); monthlyRefresh.value++; taskRevision.value++; simpleTasksLoaded.value = false; simpleTasksError.value = ''; simpleUnreadLoaded.value = false; simpleUnreadError.value = '' }
  if (mode.value === 'simple' && (!simpleTasksLoaded.value || !simpleUnreadLoaded.value || force === true)) void loadSimpleAgenda(force === true)
  const cached = readCompanyDashboardCache()
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
     if (result?.status === 'preparing') { energyError.value = result.message || '电表数据仍在准备中'; return }
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
function openEnvironmentAgent(window) {
 const reference = environmentWindowReference(window)
 if (!reference) return
 observationType.value = ''
 openCompanyAgent({ reference, prompt: environmentHistoryPrompt(window) })
}
function openMeterAgent(window) { observationType.value = ''; openCompanyAgent({ prompt: meterHistoryPrompt(window) }) }
function openAgent(source) {
 if (openingAgent.value) return
 openingAgent.value = source
 uni.navigateTo({ url: `/pages/agent/index?source=${source}&from=dashboard`, fail: () => { openingAgent.value = ''; uni.showToast({ title: '未能打开，请重试', icon: 'none' }) } })
}
// 卡片/深链参数在 onLoad 只写入暂存；真正的消费点只有 onShow（App 的登录恢复、
// 后台热启动都写同一个槽），避免两条路径各开一次浮层。
function openPendingAgentLaunch() {
 if (!pendingAgentOpen || !agentFloat.value) return
 const payload = pendingAgentOpen
 pendingAgentOpen = null
 agentFloat.value.open(payload)
}
onLoad(options => {
 const launch = pickAgentLaunch('pages/agent/dashboard', options || {})
 if (launch) savePendingAgentLaunch(launch)
})
onMounted(openPendingAgentLaunch)
function back() { backToParent('/pages/index/index') }
onShow(() => {
 visible = true; pageActive.value = true; openingAgent.value = ''
 try { if (scope && scope !== getAgentStorageScope()) { resetForScope(); scope = '' } }
 catch { resetForScope(); scope = '' }
 const pending = takePendingAgentLaunch()
 if (pending) pendingAgentOpen = parseAgentContext(pending.query)
 load()
 openPendingAgentLaunch()
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
.head-actions { display:flex; align-items:center; gap:10px; flex-shrink:0; margin-top:4px; }
.head-actions .refresh { margin-top:0; }
.mode-seg { display:flex; background:#e2eae2; border-radius:16px; padding:2px; }
.mode-seg button { font-size:11.5px; color:#5f7060; padding:6px 11px; border-radius:14px; }
.mode-seg button.on { background:linear-gradient(#fbfcfb,#eef3ee); color:#176b54; box-shadow:inset 0 1px 0 #fff, 0 1px 3px rgba(28,57,42,.15); }

/* 精简模式：状态灯 + 2×2 状态块（沿用 orb/面板的渐变 + 发丝内描边材质） */
.lamp-hero { text-align:center; padding:18px 0 20px; border-bottom:1px solid #dce4da; }
.lamp { width:82px; height:82px; border-radius:50%; margin:0 auto; padding:7px; display:flex; background:linear-gradient(160deg,#fefefb,#eef3ef); box-shadow:0 6px 20px rgba(24,60,40,.22), inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 .5px rgba(26,55,43,.12); }
.lamp-disc { flex:1; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; color:#fff; background:radial-gradient(circle at 35% 28%, #58b48c, #176b54 78%); box-shadow:inset 0 1px 0 rgba(255,255,255,.4), inset 0 0 0 .5px rgba(18,80,60,.5), 0 2px 8px rgba(23,107,84,.3); }
.lamp.warn .lamp-disc { background:radial-gradient(circle at 35% 28%, #e0a862, #a27128 78%); box-shadow:inset 0 1px 0 rgba(255,255,255,.4), inset 0 0 0 .5px rgba(140,95,35,.5), 0 2px 8px rgba(162,113,40,.3); }
.lamp.loading .lamp-disc { background:radial-gradient(circle at 35% 28%, #c2cec4, #94a08b 78%); box-shadow:inset 0 1px 0 rgba(255,255,255,.4), inset 0 0 0 .5px rgba(110,122,108,.5), 0 2px 8px rgba(110,122,108,.3); }
.verdict { display:block; margin-top:13px; font-size:22px; font-weight:600; letter-spacing:1px; color:#293f31; }
.verdict-sub { display:block; margin-top:5px; font-size:11.5px; letter-spacing:1px; color:#839287; }
.zones { margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:11px; }
.zone { border-radius:16px; padding:13px 14px 12px; min-height:112px; text-align:left; background:linear-gradient(180deg,#fbfcfb,#f1f5f1); box-shadow:0 4px 14px rgba(28,57,42,.09), inset 0 1px 0 rgba(255,255,255,.95), inset 0 0 0 .5px rgba(26,55,43,.11); }
.zone--pressed { opacity:.72; }
.zone-top { display:flex; align-items:center; justify-content:space-between; }
.zic { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:linear-gradient(160deg,#f2f6f0,#e4ece3); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.1), inset 0 1px 0 rgba(255,255,255,.8); flex-shrink:0; }
.zicon { width:17px; height:17px; }
.zpill { font-size:10px; letter-spacing:1px; padding:3px 9px; border-radius:9px; color:#3c8c6b; background:#e9f1ea; }
.zpill.warn { color:#9a784a; background:#f4ecd9; }
.zname { display:block; margin-top:10px; font-size:10.5px; letter-spacing:2.5px; color:#94a08b; }
.zstatus { display:block; margin-top:4px; font-size:19px; font-weight:650; color:#293f31; }
.zstatus.warn { color:#9a784a; }
.zvalue { display:block; margin-top:3px; font-family:Georgia,"Songti SC",serif; font-size:14.5px; color:#5f7060; font-variant-numeric:tabular-nums; }

.agent-cta { margin-top:14px; display:flex; align-items:center; gap:12px; width:100%; padding:13px 16px; border-radius:18px; background:linear-gradient(180deg,#fbfcfb,#f1f5f1); box-shadow:0 6px 18px rgba(28,57,42,.12), inset 0 1px 0 rgba(255,255,255,.95), inset 0 0 0 .5px rgba(26,55,43,.12); text-align:left; }
.cta-orb { width:38px; height:38px; border-radius:50%; flex-shrink:0; background:radial-gradient(circle at 35% 28%, #58b48c, #176b54 78%); box-shadow:inset 0 1px 0 rgba(255,255,255,.4), 0 3px 9px rgba(23,107,84,.32); }
.cta-t { display:block; font-size:16px; font-weight:650; color:#176b54; }
.cta-s { display:block; font-size:11.5px; color:#839287; margin-top:1px; }

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

/* 标题旁办公室入口：细分隔线 + 次要色文字链接（AssistantNav #title 插槽内容用本文件样式）。
   具名插槽会被 uni-app 包一层 <view slot="title">（普通块级、无 data-v，
   scoped 命中不到它）——内容必须收进单一 flex 行容器自保横排。 */
.title-row { display:flex; align-items:center; }
.nav-title-text { font-size:15px; font-weight:600; color:#293f31; }
.nav-sep { width:1px; height:13px; margin:0 11px; flex-shrink:0; background:rgba(41,63,49,.16); }
.office-entry { display:flex; align-items:center; gap:1px; padding:8px 0; }
.office-entry::after { border:0; }
.office-entry[disabled] { opacity:.6; }
.office-entry--pressed { opacity:.65; }
.office-entry-text { font-size:12.5px; color:#7d8d82; }
.pressed { opacity:.65; }

.notice { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:12px; color:#9a784a; font-size:10px; }.notice button { min-height:30px; color:#8b693c; text-decoration:underline; flex-shrink:0; }
.observation-scroll { flex:1; height:0; min-height:0; padding:5px 18px 25px; box-sizing:border-box; }.sheet-empty { display:block; margin:45px 0; text-align:center; color:#839189; font-size:13px; }
.spinning { animation:spin 900ms linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; } }
</style>
