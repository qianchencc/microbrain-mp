<template>
 <view class="region-page">
  <RegionChip workbench />
  <view class="day-heading"><text class="day-title">{{ date === today ? '今天' : Number(date.slice(5, 7)) + '月' + Number(date.slice(8)) + '日' }}</text><text>{{ tasks.length }} 条记录</text><button v-if="isDev" class="sample-toggle" @tap="toggleSample">{{ sampleMode ? '返回真实记录' : '查看样例' }}</button></view>
  <text v-if="sampleMode" class="sample-notice">本地演示记录 · 未写入设备或运行库</text>
  <view class="timeline-body">
   <RegionTimeline :key="focusRegionId + '-' + (sampleMode ? 'sample-' : 'real-') + date" calendar :calendar-marks="sampleMode ? sampleCalendarMarks : calendarMarks" :calendar-error="calendarError" :max-date="maxDate" :items="items" :date="date" :now="displayNow" @date-change="date = $event" @calendar-month="onCalendarMonth" @select="openTask">
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
     <view class="owner-mark" :aria-label="item.creatorName">{{ item.creatorName.slice(0, 1) }}</view>
     </view>
    </template>
   </RegionTimeline>
  </view>
  <view class="device-dock"><button class="device-entry" hover-class="device-entry--pressed" @tap="deviceDrawerOpen = true"><uni-icons type="list" size="17" color="#315846" /><text>设备</text><text v-if="deviceCount !== null" class="device-count">{{ deviceCount }}</text></button></view>
  <RegionDeviceDrawer :open="deviceDrawerOpen" :region-id="focusRegionId" :region-name="focusRegion?.name || ''" :region-error="error" :date="date" :now="now" :sample-mode="sampleMode" :sample-date="sampleDate" :sample-tasks="sampleMode ? tasks : []" @close="deviceDrawerOpen = false" @count="deviceCount = $event" @task="openDeviceTask" />
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
import { acknowledgeRegion, focusRegion, focusRegionId, loadRegionFocus, selectFocusRegion } from './region-focus.js'
import { localDate } from './timeline-geometry.mjs'
import { calendarWindow, shiftDate, validCalendarDate } from './region-calendar.mjs'
import { regionTimelineItems } from './region-timeline.mjs'
import { regionSampleTasks, regionSampleTaskDetail } from './region-sample-tasks.mjs'
const emptyArt = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><path d="M30 2c-9 12 9 22 0 38s9 26 0 38" fill="none" stroke="#c9d6ce" stroke-width="1.6"/><circle cx="31" cy="40" r="6" fill="#fff"/><circle cx="31" cy="40" r="4" fill="#ad711b"/></svg>')
const error = ref(''), loading = ref(true), tasks = ref([]), sampleTasks = ref([]), sampleMode = ref(false)
const deviceDrawerOpen = ref(false), deviceCount = ref(null)
const selectedTaskId = ref(''), sampleDetail = ref(null), sampleDate = ref('')
const calendarMarks = ref([]), calendarMonth = ref(''), calendarError = ref(false)
const now = ref(new Date().toISOString()), today = computed(() => localDate(now.value)), date = ref(localDate(now.value))
const maxDate = computed(() => shiftDate(today.value, 7))
const displayNow = computed(() => sampleMode.value ? `${date.value}T14:52:00+08:00` : now.value)
const items = computed(() => regionTimelineItems(tasks.value))
const sampleCalendarMarks = computed(() => {
 const { from, to } = calendarWindow(calendarMonth.value || date.value.slice(0, 7))
 return sampleTasks.value.length && sampleDate.value >= from && sampleDate.value <= to
  ? [{ date: sampleDate.value, abnormal: sampleTasks.value.some(task => ['partial', 'failed', 'missed', 'interrupted'].includes(task.status)) }] : []
})
let initialRegion = '', initialDate = '', initialTaskId = '', requestId = 0, calendarRequest = 0, loadId = 0, visible = false, loadingDirectory = false, refreshTimer
onLoad(query => { initialRegion = query.regionId || ''; initialDate = query.date || ''; initialTaskId = query.taskId || '' })
async function loadTimeline(silent = false) {
 const current = ++requestId, region = focusRegionId.value, selectedDate = date.value, scope = getAgentStorageScope()
 if (!silent) { tasks.value = []; error.value = ''; loading.value = true }
 try {
  if (!region) return
  if (sampleMode.value) {
   sampleTasks.value = []
   const result = await listRegionDevices(region)
   if (current === requestId && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope() && sampleMode.value) {
    sampleTasks.value = regionSampleTasks(sampleDate.value, region, result.devices || [])
    tasks.value = selectedDate === sampleDate.value ? sampleTasks.value : []
   }
   return
  }
  const result = await listRegionTimeline(region, selectedDate)
  if (current === requestId && region === focusRegionId.value && selectedDate === date.value && scope === getAgentStorageScope()) { tasks.value = result.tasks || []; return current }
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
function openDeviceTask({ taskId, sampleTask }) { selectedTaskId.value = taskId; sampleDetail.value = sampleTask || null }
function toggleSample() { sampleMode.value = !sampleMode.value; sampleTasks.value = []; if (sampleMode.value) sampleDate.value = date.value; selectedTaskId.value = ''; void loadVisibleTimeline(); loadCalendar() }
async function load() {
 const currentLoad = ++loadId
 let loadedRegion = '', loadedDate = ''
 loadingDirectory = true; loading.value = true; error.value = ''; tasks.value = []; sampleTasks.value = []; ++requestId
 now.value = new Date().toISOString()
 try {
  await loadRegionFocus()
  if (currentLoad !== loadId || !visible) return
  if (initialRegion) { if (!selectFocusRegion(initialRegion)) initialTaskId = ''; initialRegion = '' }
  if (initialDate) {
   if (validCalendarDate(initialDate) && initialDate <= maxDate.value) date.value = initialDate
   else initialTaskId = ''
  }
  initialDate = ''
  loadedRegion = focusRegionId.value; loadedDate = date.value
  const loadedRequest = await loadVisibleTimeline()
  if (currentLoad !== loadId || !visible) return
  if (loadedRequest && initialTaskId) {
   const item = tasks.value.find(task => task.id === initialTaskId)
   initialTaskId = ''
   if (item) openTask(item)
  }
  loadCalendar()
 }
 catch (cause) { if (currentLoad === loadId) { error.value = cause.message || '区域暂不可用'; loading.value = false } }
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
 visible = true; void load().finally(scheduleRefresh)
})
onHide(() => { visible = false; clearTimeout(refreshTimer); deviceDrawerOpen.value = false; selectedTaskId.value = ''; ++requestId; ++calendarRequest; ++loadId })
onUnload(() => { visible = false; clearTimeout(refreshTimer); deviceDrawerOpen.value = false; selectedTaskId.value = ''; ++requestId; ++calendarRequest; ++loadId })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-page { height:100vh; box-sizing:border-box; padding-top:14px; background:#f4f7f5; color:#526759; display:flex; flex-direction:column; }
.day-heading { padding:18px 23px 12px; display:flex; align-items:baseline; flex-wrap:wrap; gap:9px; color:#89958e; font-size:11px; }
.day-title { color:#45564d; font-size:20px; font-weight:600; }
.sample-toggle { margin:0 0 0 auto; padding:0; background:transparent; color:#176b54; font-size:11px; line-height:1.4; }
.sample-toggle::after { border:0; }
.sample-notice { margin:0 23px 6px; color:#987034; font-size:11px; }
.timeline-body { position:relative; flex:1; min-height:0; margin:0 16px; overflow:hidden; }
.empty { padding:70px 24px 0; text-align:center; font-size:12px; line-height:1.8; color:#89958e; }
.empty-art { display:block; width:60px; height:80px; margin:0 auto 14px; }
.empty text { display:block; }
.empty-title { color:#526759; font-size:14px; font-weight:600; margin-bottom:5px; }
.notice { padding:70px 24px; text-align:center; font-size:13px; color:#89958e; }
.notice button { margin-top:18px; background:transparent; font-size:13px; color:#176b54; }
.notice button::after { border:0; }
.task-row { display:flex; align-items:center; gap:7px; height:32px; min-width:0; }
.avatars { display:flex; align-items:center; flex-shrink:0; }
.device-avatar { width:21px; height:21px; margin-left:-7px; border:1px solid #fff; border-radius:50%; background:#edf2ee; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.device-avatar image { width:21px; height:21px; }
.device-avatar:first-child { margin-left:0; }
.more { font-size:8px; margin-left:2px; color:#7a8d80; }
.task-label { flex:1; min-width:0; font-size:12px; font-weight:600; color:#45564d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.warning-dot { display:inline-block; width:6px; height:6px; margin-right:7px; border-radius:50%; background:#b57932; box-shadow:0 0 0 2px #f7ecd8; vertical-align:1px; }
.failure-mark { margin-right:6px; color:#a15343; font-size:13px; font-weight:700; }
.cancelled-status { flex-shrink:0; color:#7a8b80; font-size:9px; }
.task-separator { width:1px; height:14px; flex-shrink:0; background:#e1e8e2; }
.owner-mark { width:22px; height:22px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,#3a9478,#11553f); color:#fff; font-size:9px; font-weight:700; }
.task-row.cancelled .task-label { text-decoration:line-through; text-decoration-color:#9caaa0; }
.device-dock { flex-shrink:0; height:70px; display:flex; align-items:center; justify-content:center; background:linear-gradient(#f4f7f500,#f4f7f5 36%); }
.device-entry { height:44px; min-width:130px; margin:0; padding:0 20px; border:1px solid #dce5dd; border-radius:22px; display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(#fff,#f2f6f1); box-shadow:0 5px 18px #233a2d1c; color:#315846; font-size:13px; font-weight:600; }
.device-entry::after { border:0; }
.device-entry--pressed { transform:scale(.97); }
.device-count { font-size:11px; color:#7b8d80; }
</style>
