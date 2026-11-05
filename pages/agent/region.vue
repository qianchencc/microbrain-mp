<template>
 <view class="region-page">
  <AssistantNav :back-label="backLabel" @back="goBack"><template #title><RegionChip workbench nav /></template></AssistantNav>
  <view class="day-heading"><text class="day-title">{{ date === today ? '今天' : Number(date.slice(5, 7)) + '月' + Number(date.slice(8)) + '日' }}</text><text class="record-status">{{ sampleMode ? (error ? '演示记录未加载' : tasks.length + ' 条记录') : (!hasDaySnapshot ? (error ? '加载失败' : '任务加载中…') : tasks.length + ' 条记录') }}</text><button v-if="isDev" class="sample-toggle" @tap="toggleSample">{{ sampleMode ? '返回真实记录' : '查看样例' }}</button></view>
  <text v-if="sampleMode && !error" class="sample-notice">本地演示记录 · 未写入设备或运行库</text>
  <view class="timeline-body">
   <RegionTimeline :key="focusRegionId + '-' + (sampleMode ? 'sample' : 'real')" calendar :bottom-pad="78" :calendar-marks="sampleMode ? sampleCalendarMarks : calendarMarks" :calendar-error="calendarError" :max-date="maxDate" :items="items" :date="date" :start="windowStart || date" :days="windowDays" :now="displayNow" @date-change="date = $event" @visible-date="onVisibleDate" @reach-start="extendTop" @reach-end="extendBottom" @calendar-month="onCalendarMonth" @select="openTask">
    <template #card="{ item }">
     <view class="task-row" :class="{ cancelled: item.status === 'cancelled' }">
     <text class="task-label"><text v-if="item.warning || item.failure" class="warning-dot" />{{ item.label }}</text>
     <text v-if="item.status === 'cancelled'" class="cancelled-status">已取消</text>
     <view class="avatars"><view v-for="avatar in item.avatars" :key="avatar.id" class="device-avatar"><image v-if="avatar.src" :src="avatar.src" mode="aspectFit" /><uni-icons v-else type="gear" size="13" color="var(--agent-text-muted)" /></view><text v-if="item.more" class="more">+{{ item.more }}</text></view>
     <view class="task-separator" />
     <view class="owner-mark" :class="'cv-' + item.creatorVariant" :aria-label="item.creatorName">{{ item.creatorMark }}</view>
     </view>
    </template>
   </RegionTimeline>
   <view v-if="loading || error" class="notice-layer"><view class="notice"><view v-if="loading" class="loading-status"><view class="loading-spinner" /><text>正在加载任务…</text></view><TaskErrorNotice v-else :message="error" @details="issue = $event" /><button v-if="error" @tap="load">重新加载</button></view></view>
  </view>
  <DeviceSheet :open="Boolean(issue)" title="查看原因" tall compact-header @close="issue = null"><TaskIssueDetails style="height:0;min-height:0;flex:1;display:flex;flex-direction:column" v-if="issue" :issue="issue" @close="issue = null" /></DeviceSheet>
 <view class="device-dock"><view class="dock-bar"><button class="dock-seg" hover-class="dock-seg--pressed" @tap="deviceDrawerOpen = true"><uni-icons type="list" size="17" color="var(--agent-text-secondary)" /><text>设备</text><text v-if="deviceCount !== null" class="device-count">{{ deviceCount }}</text></button><button class="dock-seg primary" hover-class="dock-seg--pressed" aria-label="回到对话创建任务" @tap="composeTask"><text class="primary-plus">＋</text><text>新建任务</text></button></view></view>
  <RegionDeviceDrawer v-if="deviceDrawerMounted" @reference="referenceTask" :open="deviceDrawerOpen" :region-id="focusRegionId" :region-name="focusRegion?.name || ''" :region-error="error" :date="date" :now="now" :refresh-signal="deviceRefreshSignal" :sample-mode="sampleMode" :sample-date="sampleDate" :sample-tasks="sampleMode ? tasks : emptySampleTasks" @close="deviceDrawerOpen = false" @count="deviceCount = $event" @cancelled="reloadWindow(); loadCalendar(calendarMonth || date.slice(0, 7), true)" />
  <TaskDetailSheet v-if="taskDetailMounted" @reference="referenceTask" :open="Boolean(selectedTaskId)" :task-id="selectedTaskId" :sample-task="sampleDetail" :region-name="focusRegion?.name || ''" @close="selectedTaskId = ''" @cancelled="reloadWindow(); loadCalendar(calendarMonth || date.slice(0, 7), true)" />
 </view>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { listRegionTimeline, listRegionCalendar, listRegionDevices } from '@/apis/agent/observations'
import { isDev } from '@/config/settings'
import { getAgentStorageScope } from '@/utils/agent-session'
import RegionChip from './components/regions/RegionChip.vue'
import RegionTimeline from './components/regions/RegionTimeline.vue'
import DeviceSheet from './components/shared/DeviceSheet.vue'
import TaskErrorNotice from './components/tasks/TaskErrorNotice.vue'
import TaskIssueDetails from './components/tasks/TaskIssueDetails.vue'
const issue = ref(null)
import RegionDeviceDrawer from './components/regions/RegionDeviceDrawer.vue'
import { preserveComposerReference } from './lib/conversation.mjs'
import TaskDetailSheet from './components/tasks/TaskDetailSheet.vue'
import { acknowledgeRegion, focusRegion, focusRegionId, loadRegionFocus, selectFocusRegion, queueComposePrefill } from './lib/region-focus.mjs'
import { localDate } from './lib/region.mjs'
import { taskNeedsDetails } from './lib/tasks.mjs'
import { calendarWindow, shiftDate, validCalendarDate, regionTimelineItems } from './lib/region.mjs'
import AssistantNav from './components/shared/AssistantNav.vue'
import { backToParent, previousPageLabel, returnToOfficeConversation } from './lib/navigation.mjs'
const backLabel = ref('办公室 Agent')
const error = ref(''), loading = ref(true), sampleTasks = ref([]), sampleMode = ref(false)
// 任务按天缓存、按窗口渲染：滚动跨天时窗口向两侧扩展，选中日跟随视口。
const WINDOW_LEAD = 2, WINDOW_TRAIL = 3, DAY_STALE_MS = 30000
const windowStart = ref(''), windowDays = ref(1)
const dayTasks = ref({}), dayDone = new Set(), dayReq = {}, dayLoadedAt = {}
const windowDates = computed(() => windowStart.value ? Array.from({ length: windowDays.value }, (_, i) => shiftDate(windowStart.value, i)) : [date.value])
const tasks = computed(() => sampleMode.value ? (date.value === sampleDate.value ? sampleTasks.value : []) : (dayTasks.value[date.value] || []).filter(task => task.status !== 'cancelled'))
const hasDaySnapshot = computed(() => Object.hasOwn(dayTasks.value, date.value))
const deviceDrawerOpen = ref(false), deviceCount = ref(null)
const deviceRefreshSignal = ref(0)
const emptySampleTasks = Object.freeze([])
const selectedTaskId = ref(''), sampleDetail = ref(null), sampleDate = ref('')
const deviceDrawerMounted = ref(false), taskDetailMounted = ref(false)
watch(deviceDrawerOpen, open => { if (open) deviceDrawerMounted.value = true }, { flush: 'sync' })
watch(selectedTaskId, id => { if (id) taskDetailMounted.value = true }, { flush: 'sync' })
const calendarMarks = ref([]), calendarMonth = ref(''), calendarError = ref('')
const now = ref(new Date().toISOString()), today = computed(() => localDate(now.value)), date = ref(localDate(now.value))
const maxDate = computed(() => shiftDate(today.value, 7))
const displayNow = computed(() => sampleMode.value ? `${date.value}T14:52:00+08:00` : now.value)
const items = computed(() => regionTimelineItems(sampleMode.value ? (windowDates.value.includes(sampleDate.value) ? sampleTasks.value : []) : windowDates.value.flatMap(d => dayTasks.value[d] || [])))
const sampleCalendarMarks = computed(() => {
 const { from, to } = calendarWindow(calendarMonth.value || date.value.slice(0, 7))
 return sampleTasks.value.length && sampleDate.value >= from && sampleDate.value <= to
  ? [{ date: sampleDate.value, abnormal: sampleTasks.value.some(task => taskNeedsDetails(task.status)) }] : []
})
let viewScope = ''
let initialRegion = '', initialDate = '', initialTaskId = '', requestId = 0, calendarRequest = 0, loadId = 0, visible = false, loadingDirectory = false, refreshTimer
onLoad(query => { backLabel.value = previousPageLabel(getCurrentPages(), '办公室 Agent'); initialRegion = query.regionId || ''; initialDate = query.date || ''; initialTaskId = decodeURIComponent(query.taskId || '') })
function ensureWindow() {
 const end = windowStart.value ? shiftDate(windowStart.value, windowDays.value - 1) : ''
 if (!windowStart.value || date.value < windowStart.value || date.value > end) {
  windowStart.value = shiftDate(date.value, -WINDOW_LEAD)
  let days = WINDOW_LEAD + 1 + WINDOW_TRAIL
  while (days > 1 && shiftDate(windowStart.value, days - 1) > maxDate.value) days--
  windowDays.value = days
  const keep = new Set(windowDates.value)
  dayTasks.value = Object.fromEntries(Object.entries(dayTasks.value).filter(([d]) => keep.has(d)))
  for (const d of dayDone) if (!keep.has(d)) dayDone.delete(d)
 }
}
async function loadDay(d, { silent = false, force = false } = {}) {
 const region = focusRegionId.value, scope = getAgentStorageScope()
 if (!region || sampleMode.value) return false
 if (!force && dayDone.has(d) && Date.now() - (dayLoadedAt[d] || 0) < DAY_STALE_MS) { if (d === date.value) loading.value = false; return true }
 const token = (dayReq[d] = (dayReq[d] || 0) + 1)
 const selected = d === date.value
 if (selected && !silent) { error.value = ''; loading.value = true }
 try {
  const result = await listRegionTimeline(region, d)
  if (token !== dayReq[d] || region !== focusRegionId.value || scope !== getAgentStorageScope()) return false
  const next = result.tasks || []
  if (selected) {
   const previous = new Map((dayTasks.value[d] || []).flatMap(task => task.phases.map(phase => [phase.id, phase.status])))
   if (next.some(task => task.phases.some(phase => ['pending', 'executing'].includes(previous.get(phase.id)) && !['pending', 'executing'].includes(phase.status)))) deviceRefreshSignal.value++
   error.value = ''
  }
  dayTasks.value = { ...dayTasks.value, [d]: next }
  dayDone.add(d)
  dayLoadedAt[d] = Date.now()
  return true
 } catch (cause) {
  if (token === dayReq[d] && region === focusRegionId.value && scope === getAgentStorageScope() && d === date.value) error.value = cause.message || '任务记录暂不可用'
  return false
 } finally { if (d === date.value && region === focusRegionId.value && scope === getAgentStorageScope() && token === dayReq[d]) loading.value = false }
}
async function loadSample() {
 const region = focusRegionId.value, scope = getAgentStorageScope(), current = ++requestId
 loading.value = true; error.value = ''; sampleTasks.value = []
 try {
  if (!region) return false
  const result = await listRegionDevices(region, { isActive: () => current === requestId && visible && sampleMode.value && region === focusRegionId.value })
  if (current !== requestId || region !== focusRegionId.value || scope !== getAgentStorageScope() || !sampleMode.value) return false
  sampleTasks.value = regionSampleTasks(sampleDate.value, region, result.devices || [])
  return true
 } catch (cause) {
  if (current !== requestId || scope !== getAgentStorageScope()) return false
  // 设备目录挂了不出错误卡:样例是纯本地展示,用通用设备兜底照常渲染。
  sampleTasks.value = regionSampleTasks(sampleDate.value, region, [])
  return true
 } finally { if (current === requestId) loading.value = false }
}
async function loadVisibleTimeline() {
 const region = focusRegionId.value, selectedDate = date.value, scope = getAgentStorageScope()
 ensureWindow()
 let loaded = false
 if (sampleMode.value) loaded = await loadSample()
 else {
  loaded = await loadDay(selectedDate)
  if (visible && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope()) {
   windowDates.value.filter(d => d !== selectedDate).forEach(d => { void loadDay(d, { silent: true }) })
  }
 }
 if (!loaded) return
 await nextTick()
 if (visible && !sampleMode.value && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope()) {
  void acknowledgeRegion(region).catch(() => {})
  return true
 }
 return loaded
}
function reloadWindow() {
 windowDates.value.forEach(d => { if (dayDone.has(d) || d === date.value) void loadDay(d, { silent: true, force: true }) })
}
function onVisibleDate(value) { if (value && value !== date.value) date.value = value }
function extendTop() {
 if (!windowStart.value) return
 const prev = shiftDate(windowStart.value, -1)
 windowStart.value = prev
 windowDays.value++
 void loadDay(prev, { silent: true })
}
function extendBottom() {
 if (!windowStart.value) return
 const next = shiftDate(windowStart.value, windowDays.value)
 if (next > maxDate.value) return
 windowDays.value++
 void loadDay(next, { silent: true })
}
function loadCalendar(month = calendarMonth.value || date.value.slice(0, 7), silent = false) {
 const current = ++calendarRequest, region = focusRegionId.value, scope = getAgentStorageScope()
 if (!silent) { calendarMarks.value = []; calendarError.value = '' }
 if (!region) return
 const { from, to } = calendarWindow(month)
 if (sampleMode.value) return
 listRegionCalendar(region, from, to).then(result => {
  if (current === calendarRequest && region === focusRegionId.value && scope === getAgentStorageScope()) { calendarError.value = ''; calendarMarks.value = result.days || [] }
 }).catch(cause => { if (current === calendarRequest && region === focusRegionId.value && scope === getAgentStorageScope()) { if (!silent) calendarMarks.value = []; calendarError.value = cause.message || '日历读取失败：未取得具体原因' } })
}
function onCalendarMonth(month) { calendarMonth.value = month; if (visible && !loadingDirectory) loadCalendar(month) }
function openTask(item) {
 const sample = sampleMode.value ? regionSampleTaskDetail(tasks.value.find(task => task.id === item.id)) : null
 if (sampleMode.value && !sample) return
 selectedTaskId.value = item.id
 sampleDetail.value = sample
}
function referenceTask(reference) { preserveComposerReference(getAgentStorageScope(), 'office', reference); selectedTaskId.value = ''; deviceDrawerOpen.value = false; returnToOfficeConversation() }
function goBack() { backToParent('/pages/agent/index?source=office') }
// 新建任务入口=回到对话：把当前区域固定为关注区域并预填含区域名的输入开头，真实创建仍走 Agent 确认流。
function composeTask() {
 if (focusRegion.value) {
  selectFocusRegion(focusRegion.value.id)
  queueComposePrefill(`在 ${focusRegion.value.name} 新建任务：`)
 }
 returnToOfficeConversation()
}
function toggleSample() { sampleMode.value = !sampleMode.value; sampleTasks.value = []; if (sampleMode.value) sampleDate.value = date.value; selectedTaskId.value = ''; void loadVisibleTimeline(); loadCalendar() }
async function load() {
 const currentLoad = ++loadId
 let loadedRegion = '', loadedDate = ''
 loadingDirectory = true; loading.value = !tasks.value.length; error.value = ''; ++requestId
 now.value = new Date().toISOString()
 try {
  await loadRegionFocus({ isActive: () => currentLoad === loadId && visible })
  if (currentLoad !== loadId || !visible) return
  if (initialRegion) { if (!selectFocusRegion(initialRegion)) initialTaskId = ''; initialRegion = '' }
  if (initialDate) {
   if (validCalendarDate(initialDate) && initialDate <= maxDate.value) date.value = initialDate
   else { initialTaskId = ''; uni.showToast({ title: '此安排超出当前可查看日期', icon: 'none' }) }
  }
  initialDate = ''
  loadedRegion = focusRegionId.value; loadedDate = date.value
  dayDone.clear()
  loadCalendar()
  const loadedRequest = await loadVisibleTimeline()
  if (currentLoad !== loadId || !visible) return
  if (loadedRequest && initialTaskId) {
   const item = tasks.value.find(task => task.id === initialTaskId || (task.occurrence && `occurrence:${task.occurrence.planId}:${task.occurrence.date}` === initialTaskId))
   initialTaskId = ''
   if (item) openTask(item)
   else uni.showToast({ title: '记录已变化或当前无权查看', icon: 'none' })
  }
 }
 catch (cause) { if (currentLoad === loadId) { error.value = cause.message === 'request:fail' ? '区域暂不可用，请检查网络后重试' : cause.message || '区域暂不可用'; loading.value = false } }
 finally {
  if (currentLoad === loadId) {
   loadingDirectory = false
   if (visible && loadedRegion && (loadedRegion !== focusRegionId.value || loadedDate !== date.value)) {
    initialTaskId = ''
    void loadVisibleTimeline()
    loadCalendar()
   }
  }
 }
}
watch(focusRegionId, () => { deviceCount.value = null; sampleTasks.value = []; dayTasks.value = {}; dayDone.clear(); windowStart.value = ''; selectedTaskId.value = ''; if (visible && !loadingDirectory) { initialTaskId = ''; void loadVisibleTimeline(); loadCalendar() } })
watch(date, () => { selectedTaskId.value = ''; if (visible && !loadingDirectory) { initialTaskId = ''; void loadVisibleTimeline() } })
function scheduleRefresh() {
 clearTimeout(refreshTimer)
 if (!visible) return
 refreshTimer = setTimeout(async () => {
  if (!visible) return
  if (!sampleMode.value && !loadingDirectory) {
   now.value = new Date().toISOString()
   await loadDay(date.value, { silent: true, force: true })
   loadCalendar(calendarMonth.value || date.value.slice(0, 7), true)
  }
  scheduleRefresh()
 }, tasks.value.some(task => task.status === 'executing') ? 5000 : 30000)
}
watch(() => tasks.value.some(task => task.status === 'executing'), scheduleRefresh)
onShow(() => {
 let scope = ''
 try { scope = getAgentStorageScope() } catch { /* 失效会话由 load 显示恢复入口 */ }
 if (viewScope && scope !== viewScope) { dayTasks.value = {}; dayDone.clear(); windowStart.value = ''; sampleTasks.value = []; sampleMode.value = false; selectedTaskId.value = ''; sampleDetail.value = null; deviceDrawerOpen.value = false; calendarMarks.value = []; deviceCount.value = null }
 viewScope = scope
 visible = true; void load().finally(scheduleRefresh)
})
onHide(() => { visible = false; clearTimeout(refreshTimer); ++requestId; ++calendarRequest; ++loadId })
onUnload(() => { visible = false; clearTimeout(refreshTimer); deviceDrawerOpen.value = false; selectedTaskId.value = ''; ++requestId; ++calendarRequest; ++loadId })
</script>
<style scoped lang="scss">
@import "./styles/tokens";
view,text,input { font-size:inherit; line-height:inherit; }
.region-page { height:100vh; box-sizing:border-box; background:$agent-color-surface-page; color:$agent-color-text-secondary; display:flex; flex-direction:column; position:relative; }

.day-heading { padding:14px 23px 12px; display:flex; align-items:baseline; flex-wrap:wrap; gap:9px; color:$agent-color-text-muted; font-size:11px; }
.day-title { color:$agent-color-text-secondary; font-size:20px; font-weight:600; }
.sample-toggle { margin:0 0 0 auto; padding:0; background:transparent; color:$agent-color-accent; font-size:11px; line-height:1.4; }
.sample-toggle::after { border:0; }
.sample-notice { margin:0 23px 6px; color:$agent-color-warning; font-size:11px; }
.timeline-body { position:relative; flex:1; min-height:0; margin:0 16px; overflow:hidden; }
@keyframes fadeIn { from { opacity:0; } }
.notice-layer { position:absolute; left:0; right:0; top:0; bottom:0; pointer-events:none; }
.notice-layer button { pointer-events:auto; }
.notice { margin:130px auto 0; width:fit-content; max-width:calc(100% - 48px); box-sizing:border-box; padding:12px 18px; border-radius:18px; background:rgba(255,255,255,.96); box-shadow:0 3px 14px rgba(var(--agent-shadow-rgb),.07); text-align:center; font-size:13px; color:$agent-color-text-muted; animation:fadeIn 160ms ease-out backwards; }
.loading-status { display:flex; align-items:center; gap:$agent-space-small; }
.loading-spinner { width:12px; height:12px; border:2px solid $agent-color-line; border-top-color:$agent-color-accent-deep; border-radius:50%; animation:loadingSpin 800ms linear infinite; }
@keyframes loadingSpin { to { transform:rotate(360deg); } }
.notice button { margin-top:18px; background:transparent; font-size:13px; color:$agent-color-accent; }
.notice button::after { border:0; }
.task-row { display:flex; align-items:center; gap:7px; height:32px; min-width:0; }
.avatars { display:flex; align-items:center; flex-shrink:0; }
.device-avatar { width:21px; height:21px; margin-left:-7px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#ffffff,$agent-color-tint 72%); box-shadow:0 0 0 1.5px #fff,0 2px 5px rgba(var(--agent-shadow-rgb),.12); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.device-avatar image { width:21px; height:21px; }
.device-avatar:first-child { margin-left:0; }
.more { font-size:8px; margin-left:2px; color:$agent-color-text-muted; }
.task-label { flex:1; min-width:0; font-size:$agent-font-size-compact; font-weight:600; color:$agent-color-text-secondary; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.warning-dot { display:inline-block; width:6px; height:6px; margin-right:7px; border-radius:50%; background:$agent-color-warning; box-shadow:0 0 0 2px $agent-color-warning-faint; vertical-align:1px; }
.failure-mark { margin-right:6px; color:$agent-color-error; font-size:13px; font-weight:700; }
.cancelled-status { flex-shrink:0; color:$agent-color-text-muted; font-size:9px; }
.task-separator { width:1px; height:14px; flex-shrink:0; background:$agent-color-line; }
.owner-mark { width:22px; height:22px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,$agent-color-accent,$agent-color-accent-deep); color:#fff; font-size:9px; font-weight:700; }
.owner-mark.cv-brass { background:linear-gradient(145deg,$agent-color-warning,$agent-color-warning-deep); }
.owner-mark.cv-slate { background:linear-gradient(145deg,$agent-color-chart-deep,$agent-color-text-secondary); }
.owner-mark.cv-grey { background:linear-gradient(145deg,$agent-color-text-faint,$agent-color-text-muted); }
.task-row.cancelled .task-label { text-decoration:line-through; text-decoration-color:$agent-color-text-faint; }
.device-dock { position:absolute; left:0; right:0; bottom:0; z-index:6; box-sizing:border-box; padding-top:30px; padding-bottom:calc(10px + env(safe-area-inset-bottom)); display:flex; justify-content:center; background:linear-gradient(rgba(var(--agent-surface-rgb),0),$agent-color-surface-page 55%); pointer-events:none; }
.dock-bar { pointer-events:auto; height:44px; padding:4px; border-radius:22px; display:flex; align-items:center; background:linear-gradient($agent-color-surface,$agent-color-surface-page); box-shadow:inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.16),inset 0 1px 0 #fff,0 10px 26px rgba(var(--agent-shadow-rgb),.18); }
.dock-seg { height:36px; margin:0; padding:0 16px; border-radius:18px; display:flex; align-items:center; justify-content:center; gap:6px; background:transparent; color:$agent-color-text-secondary; font-size:12.5px; font-weight:650; line-height:1; white-space:nowrap; transition:transform 140ms cubic-bezier(.23,1,.32,1); }
.dock-seg::after { border:0; }
.dock-seg.primary { background:linear-gradient(145deg,$agent-color-accent,$agent-color-accent-deep); color:#fff; box-shadow:0 3px 9px rgba(var(--agent-shadow-rgb),.25),inset 0 1px 0 rgba(255,255,255,.18); }
.dock-seg--pressed { transform:scale(.96); }
.primary-plus { font-size:15px; font-weight:500; line-height:1; }
.device-count { font-size:11px; color:$agent-color-text-muted; font-weight:600; }
@media (prefers-reduced-motion:reduce) { .loading-spinner,.notice,.nav-back,.dock-seg { transition:none; animation:none; } }
</style>
