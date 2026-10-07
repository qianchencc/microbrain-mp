<template>
 <view class="region-page">
  <AssistantNav title="区域工作台" :back-label="backLabel" context @back="goBack"><RegionChip workbench nav /></AssistantNav>
  <view class="day-heading"><text class="day-title">{{ date === today ? '今天' : Number(date.slice(5, 7)) + '月' + Number(date.slice(8)) + '日' }}</text><text>{{ tasks.length }} 条记录</text><button v-if="isDev" class="sample-toggle" @tap="toggleSample">{{ sampleMode ? '返回真实记录' : '查看样例' }}</button></view>
  <text v-if="sampleMode" class="sample-notice">本地演示记录 · 未写入设备或运行库</text>
  <view class="timeline-body">
   <RegionTimeline :key="focusRegionId + '-' + (sampleMode ? 'sample-' : 'real-') + date" calendar :bottom-pad="78" :calendar-marks="sampleMode ? sampleCalendarMarks : calendarMarks" :calendar-error="calendarError" :max-date="maxDate" :items="items" :date="date" :now="displayNow" @date-change="date = $event" @calendar-month="onCalendarMonth" @select="openTask">
    <template #empty>
     <view v-if="loading || error" class="notice"><text>{{ loading ? '正在读取任务记录' : error }}</text><button v-if="error" @tap="load">重新加载</button></view>
     <view v-else class="empty"><image class="empty-art" :src="emptyArt" mode="aspectFit" /><text class="empty-title">这一天还没有任务记录</text><text>在物联 Agent 中确认设备操作后，</text><text>结果会显示在这里。</text></view>
    </template>
    <template #card="{ item }">
     <view class="task-row" :class="{ cancelled: item.status === 'cancelled' }">
     <text class="task-label"><text v-if="item.warning" class="warning-dot" /><text v-if="item.failure" class="failure-mark">×</text>{{ item.label }}</text>
     <text v-if="item.status === 'cancelled'" class="cancelled-status">已取消</text>
     <view class="avatars"><view v-for="avatar in item.avatars" :key="avatar.id" class="device-avatar"><image v-if="avatar.src" :src="avatar.src" mode="aspectFit" /><uni-icons v-else type="gear" size="13" color="#7c8d82" /></view><text v-if="item.more" class="more">+{{ item.more }}</text></view>
     <view class="task-separator" />
     <view class="owner-mark" :class="'cv-' + item.creatorVariant" :aria-label="item.creatorName">{{ item.creatorMark }}</view>
     </view>
    </template>
   </RegionTimeline>
  </view>
  <view class="device-dock"><view class="dock-bar"><button class="dock-seg" hover-class="dock-seg--pressed" @tap="deviceDrawerOpen = true"><uni-icons type="list" size="17" color="#315846" /><text>设备</text><text v-if="deviceCount !== null" class="device-count">{{ deviceCount }}</text></button><button class="dock-seg primary" hover-class="dock-seg--pressed" aria-label="回到对话创建任务" @tap="composeTask"><text class="primary-plus">＋</text><text>新建任务</text></button></view></view>
  <RegionDeviceDrawer :open="deviceDrawerOpen" :region-id="focusRegionId" :region-name="focusRegion?.name || ''" :region-error="error" :date="date" :now="now" :refresh-signal="deviceRefreshSignal" :sample-mode="sampleMode" :sample-date="sampleDate" :sample-tasks="sampleMode ? tasks : emptySampleTasks" @close="deviceDrawerOpen = false" @count="deviceCount = $event" @cancelled="loadTimeline(true); loadCalendar(calendarMonth || date.slice(0, 7), true)" />
  <TaskDetailSheet :open="Boolean(selectedTaskId)" :task-id="selectedTaskId" :sample-task="sampleDetail" :region-name="focusRegion?.name || ''" @close="selectedTaskId = ''" @cancelled="loadTimeline(true); loadCalendar(calendarMonth || date.slice(0, 7), true)" />
 </view>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { listRegionTimeline, listRegionCalendar, listRegionDevices } from '@/apis/agent'
import { isDev } from '@/config/settings'
import { getAgentStorageScope } from '@/utils/agent-session'
import RegionChip from './components/RegionChip.vue'
import RegionTimeline from './components/RegionTimeline.vue'
import RegionDeviceDrawer from './components/RegionDeviceDrawer.vue'
import TaskDetailSheet from './components/TaskDetailSheet.vue'
import { acknowledgeRegion, focusRegion, focusRegionId, loadRegionFocus, selectFocusRegion, queueComposePrefill } from './region-focus.js'
import { localDate } from './timeline-geometry.mjs'
import { calendarWindow, shiftDate, validCalendarDate } from './region-calendar.mjs'
import { regionTimelineItems } from './region-timeline.mjs'
import { regionSampleTasks, regionSampleTaskDetail } from './region-sample-tasks.mjs'
import AssistantNav from './components/AssistantNav.vue'
import { backToParent, previousPageLabel, returnToOfficeConversation } from './navigation.mjs'
const emptyArt = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><path d="M30 2c-9 12 9 22 0 38s9 26 0 38" fill="none" stroke="#c9d6ce" stroke-width="1.6"/><circle cx="31" cy="40" r="6" fill="#fff"/><circle cx="31" cy="40" r="4" fill="#ad711b"/></svg>')
const backLabel = ref('办公室 Agent')
const error = ref(''), loading = ref(true), tasks = ref([]), sampleTasks = ref([]), sampleMode = ref(false)
const deviceDrawerOpen = ref(false), deviceCount = ref(null)
const deviceRefreshSignal = ref(0)
const emptySampleTasks = Object.freeze([])
const selectedTaskId = ref(''), sampleDetail = ref(null), sampleDate = ref('')
const calendarMarks = ref([]), calendarMonth = ref(''), calendarError = ref(false)
const now = ref(new Date().toISOString()), today = computed(() => localDate(now.value)), date = ref(localDate(now.value))
const maxDate = computed(() => shiftDate(today.value, 7))
const displayNow = computed(() => sampleMode.value ? `${date.value}T14:52:00+08:00` : now.value)
const items = computed(() => regionTimelineItems(tasks.value))
const sampleCalendarMarks = computed(() => {
 const { from, to } = calendarWindow(calendarMonth.value || date.value.slice(0, 7))
 return sampleTasks.value.length && sampleDate.value >= from && sampleDate.value <= to
  ? [{ date: sampleDate.value, abnormal: sampleTasks.value.some(task => ['partial', 'failed', 'unconfirmed', 'missed', 'interrupted'].includes(task.status)) }] : []
})
let viewScope = ''
let initialRegion = '', initialDate = '', initialTaskId = '', requestId = 0, calendarRequest = 0, loadId = 0, visible = false, loadingDirectory = false, refreshTimer, shownTimelineKey = ''
onLoad(query => { backLabel.value = previousPageLabel(getCurrentPages(), '办公室 Agent'); initialRegion = query.regionId || ''; initialDate = query.date || ''; initialTaskId = decodeURIComponent(query.taskId || '') })
async function loadTimeline(silent = false) {
 const current = ++requestId, region = focusRegionId.value, selectedDate = date.value, scope = getAgentStorageScope()
 const key = `${scope}:${region}:${selectedDate}:${sampleMode.value}`
 if (!silent) { if (key !== shownTimelineKey) tasks.value = []; error.value = ''; loading.value = true }
 try {
  if (!region) return
  if (sampleMode.value) {
   sampleTasks.value = []
   const result = await listRegionDevices(region)
   if (current === requestId && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope() && sampleMode.value) {
    sampleTasks.value = regionSampleTasks(sampleDate.value, region, result.devices || [])
    tasks.value = selectedDate === sampleDate.value ? sampleTasks.value : []
    shownTimelineKey = key
   }
   return
  }
  const result = await listRegionTimeline(region, selectedDate)
  if (current === requestId && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope()) {
   const previous = new Map(tasks.value.flatMap(task => task.phases.map(phase => [phase.id, phase.status])))
   const next = result.tasks || []
   if (next.some(task => task.phases.some(phase => ['pending', 'executing'].includes(previous.get(phase.id)) && !['pending', 'executing'].includes(phase.status)))) deviceRefreshSignal.value++
   tasks.value = next
   shownTimelineKey = key
   return current
  }
 } catch (cause) { if (!silent && current === requestId && scope === getAgentStorageScope()) error.value = cause.message || (sampleMode.value ? '演示设备目录暂不可用' : '任务记录暂不可用') }
 finally { if (!silent && current === requestId) loading.value = false }
}
async function loadVisibleTimeline() {
 const region = focusRegionId.value, selectedDate = date.value, scope = getAgentStorageScope()
 const loadedRequest = await loadTimeline()
 if (!loadedRequest) return
 await nextTick()
 if (visible && !sampleMode.value && loadedRequest === requestId && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope()) {
  void acknowledgeRegion(region).catch(() => {})
  return loadedRequest
 }
}
function loadCalendar(month = calendarMonth.value || date.value.slice(0, 7), silent = false) {
 const current = ++calendarRequest, region = focusRegionId.value, scope = getAgentStorageScope()
 if (!silent) { calendarMarks.value = []; calendarError.value = false }
 if (!region) return
 const { from, to } = calendarWindow(month)
 if (sampleMode.value) return
 listRegionCalendar(region, from, to).then(result => {
  if (current === calendarRequest && region === focusRegionId.value && scope === getAgentStorageScope()) calendarMarks.value = result.days || []
 }).catch(() => { if (!silent && current === calendarRequest) { calendarMarks.value = []; calendarError.value = true } })
}
function onCalendarMonth(month) { calendarMonth.value = month; if (visible && !loadingDirectory) loadCalendar(month) }
function openTask(item) {
 const sample = sampleMode.value ? regionSampleTaskDetail(tasks.value.find(task => task.id === item.id)) : null
 if (sampleMode.value && !sample) return
 selectedTaskId.value = item.id
 sampleDetail.value = sample
}
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
  await loadRegionFocus()
  if (currentLoad !== loadId || !visible) return
  if (initialRegion) { if (!selectFocusRegion(initialRegion)) initialTaskId = ''; initialRegion = '' }
  if (initialDate) {
   if (validCalendarDate(initialDate) && initialDate <= maxDate.value) date.value = initialDate
   else { initialTaskId = ''; uni.showToast({ title: '此安排超出当前可查看日期', icon: 'none' }) }
  }
  initialDate = ''
  loadedRegion = focusRegionId.value; loadedDate = date.value
  const loadedRequest = await loadVisibleTimeline()
  if (currentLoad !== loadId || !visible) return
  if (loadedRequest && initialTaskId) {
   const item = tasks.value.find(task => task.id === initialTaskId || (task.occurrence && `occurrence:${task.occurrence.planId}:${task.occurrence.date}` === initialTaskId))
   initialTaskId = ''
   if (item) openTask(item)
   else uni.showToast({ title: '记录已变化或当前无权查看', icon: 'none' })
  }
  loadCalendar()
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
watch(focusRegionId, () => { deviceCount.value = null; sampleTasks.value = []; selectedTaskId.value = ''; if (visible && !loadingDirectory) { initialTaskId = ''; void loadVisibleTimeline(); loadCalendar() } })
watch(date, () => { selectedTaskId.value = ''; if (visible && !loadingDirectory) { initialTaskId = ''; void loadVisibleTimeline() } })
function scheduleRefresh() {
 clearTimeout(refreshTimer)
 if (!visible) return
 refreshTimer = setTimeout(async () => {
  if (!visible) return
  if (!sampleMode.value && !loadingDirectory) {
   now.value = new Date().toISOString()
   await loadTimeline(true)
   loadCalendar(calendarMonth.value || date.value.slice(0, 7), true)
  }
  scheduleRefresh()
 }, tasks.value.some(task => task.status === 'executing') ? 5000 : 30000)
}
watch(() => tasks.value.some(task => task.status === 'executing'), scheduleRefresh)
onShow(() => {
 let scope = ''
 try { scope = getAgentStorageScope() } catch { /* 失效会话由 load 显示恢复入口 */ }
 if (viewScope && scope !== viewScope) { tasks.value = []; sampleTasks.value = []; sampleMode.value = false; selectedTaskId.value = ''; sampleDetail.value = null; deviceDrawerOpen.value = false; calendarMarks.value = []; deviceCount.value = null }
 viewScope = scope
 visible = true; void load().finally(scheduleRefresh)
})
onHide(() => { visible = false; clearTimeout(refreshTimer); ++requestId; ++calendarRequest; ++loadId })
onUnload(() => { visible = false; clearTimeout(refreshTimer); deviceDrawerOpen.value = false; selectedTaskId.value = ''; ++requestId; ++calendarRequest; ++loadId })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-page { height:100vh; box-sizing:border-box; background:#f4f7f5; color:#526759; display:flex; flex-direction:column; position:relative; }

.day-heading { padding:14px 23px 12px; display:flex; align-items:baseline; flex-wrap:wrap; gap:9px; color:#89958e; font-size:11px; }
.day-title { color:#45564d; font-size:20px; font-weight:600; }
.sample-toggle { margin:0 0 0 auto; padding:0; background:transparent; color:#176b54; font-size:11px; line-height:1.4; }
.sample-toggle::after { border:0; }
.sample-notice { margin:0 23px 6px; color:#ad711b; font-size:11px; }
.timeline-body { position:relative; flex:1; min-height:0; margin:0 16px; overflow:hidden; }
.empty { padding:70px 24px 0; text-align:center; font-size:12px; line-height:1.8; color:#89958e; animation:fadeIn 160ms ease-out backwards; }
@keyframes fadeIn { from { opacity:0; } }
.empty-art { display:block; width:60px; height:80px; margin:0 auto 14px; }
.empty text { display:block; }
.empty-title { color:#526759; font-size:14px; font-weight:600; margin-bottom:5px; }
.notice { padding:70px 24px; text-align:center; font-size:13px; color:#89958e; animation:fadeIn 160ms ease-out backwards; }
.notice button { margin-top:18px; background:transparent; font-size:13px; color:#176b54; }
.notice button::after { border:0; }
.task-row { display:flex; align-items:center; gap:7px; height:32px; min-width:0; }
.avatars { display:flex; align-items:center; flex-shrink:0; }
.device-avatar { width:21px; height:21px; margin-left:-7px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#ffffff,#dfe7e1 72%); box-shadow:0 0 0 1.5px #fff,0 2px 5px rgba(31,52,42,.12); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.device-avatar image { width:21px; height:21px; }
.device-avatar:first-child { margin-left:0; }
.more { font-size:8px; margin-left:2px; color:#7a8d80; }
.task-label { flex:1; min-width:0; font-size:12px; font-weight:600; color:#45564d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.warning-dot { display:inline-block; width:6px; height:6px; margin-right:7px; border-radius:50%; background:#ad711b; box-shadow:0 0 0 2px #f7ecd8; vertical-align:1px; }
.failure-mark { margin-right:6px; color:#a15343; font-size:13px; font-weight:700; }
.cancelled-status { flex-shrink:0; color:#7a8b80; font-size:9px; }
.task-separator { width:1px; height:14px; flex-shrink:0; background:#e1e8e2; }
.owner-mark { width:22px; height:22px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,#3a9478,#11553f); color:#fff; font-size:9px; font-weight:700; }
.owner-mark.cv-brass { background:linear-gradient(145deg,#d9b06c,#a87c33); }
.owner-mark.cv-slate { background:linear-gradient(145deg,#8fa7b8,#5d7484); }
.owner-mark.cv-grey { background:linear-gradient(145deg,#a9b0aa,#7a817b); }
.task-row.cancelled .task-label { text-decoration:line-through; text-decoration-color:#9caaa0; }
.device-dock { position:absolute; left:0; right:0; bottom:0; z-index:6; box-sizing:border-box; padding-top:30px; padding-bottom:calc(10px + env(safe-area-inset-bottom)); display:flex; justify-content:center; background:linear-gradient(#f4f7f500,#f4f7f5 55%); pointer-events:none; }
.dock-bar { pointer-events:auto; height:44px; padding:4px; border-radius:22px; display:flex; align-items:center; background:linear-gradient(#fefffe,#f1f5f2); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.16),inset 0 1px 0 #fff,0 10px 26px rgba(28,57,42,.18); }
.dock-seg { height:36px; margin:0; padding:0 16px; border-radius:18px; display:flex; align-items:center; justify-content:center; gap:6px; background:transparent; color:#315846; font-size:12.5px; font-weight:650; line-height:1; white-space:nowrap; transition:transform 140ms cubic-bezier(.23,1,.32,1); }
.dock-seg::after { border:0; }
.dock-seg.primary { background:linear-gradient(145deg,#308b70,#1d5c45); color:#fff; box-shadow:0 3px 9px rgba(23,74,55,.25),inset 0 1px 0 rgba(255,255,255,.18); }
.dock-seg--pressed { transform:scale(.96); }
.primary-plus { font-size:15px; font-weight:500; line-height:1; }
.device-count { font-size:11px; color:#7b8d80; font-weight:600; }
@media (prefers-reduced-motion:reduce) { .empty,.notice,.nav-back,.dock-seg { transition:none; animation:none; } }
</style>
