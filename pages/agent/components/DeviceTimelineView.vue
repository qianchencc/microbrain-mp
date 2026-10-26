<template>
 <view class="device-view">
  <view class="device-hero">
   <view class="hero-art"><image v-if="device.artwork" :src="device.artwork" mode="aspectFit" /><uni-icons v-else type="gear" size="27" color="#8b9a91" /></view>
   <view class="hero-copy"><text class="hero-name">{{ device.name }}</text><text class="hero-location">{{ device.kindLabel }} · {{ device.location }}</text><text class="hero-state">{{ device.detail }}</text>
    <view v-if="nextAction" class="hero-next"><text>{{ nextAction.executing ? '进行中' : '下一次' }} · {{ nextAction.clock }} {{ nextAction.label }} → {{ nextAction.target }}</text></view>
   </view>
  </view>
  <text v-if="sampleMode" class="sample-label">本地演示记录 · 未写入设备或运行库</text>
  <view class="timeline-area">
   <RegionTimeline ref="timeline" :key="selectedDate" calendar compact-calendar focus-items :date="selectedDate" :now="displayNow" :max-date="maxDate" :calendar-marks="marks" :calendar-error="calendarError" :items="items" @date-change="selectedDate = $event" @calendar-month="onMonth" @select="openTask">
    <template #card="{ item }"><view class="record-card"><text class="source" :class="item.sourceText === '即时' ? 'immediate' : 'scheduled'">{{ item.sourceText }}</text><text class="record-target">{{ item.label }}<text class="record-task">{{ item.taskLabel }}</text></text><text class="record-result" :class="item.resultTone">{{ item.resultText }}</text><text class="creator" :class="'cv-' + item.creatorVariant">{{ item.creatorName.slice(0, 1) }}</text></view></template>
    <template #empty>
     <view v-if="loading || error" class="empty"><text v-if="loading">正在读取设备记录</text><TaskErrorNotice v-else :message="error" @details="$emit('issue', $event)" /><button v-if="error" @tap="loadTimeline">重新加载</button></view>
     <view v-else class="empty"><text>这一天没有任务操作记录</text></view>
    </template>
   </RegionTimeline>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { listDeviceCalendar, listDeviceTimeline } from '@/apis/agent'
import { calendarWindow, shiftDate } from '../region-calendar.mjs'
import { localDate } from '../timeline-geometry.mjs'
import { deviceTimelineItems } from '../device-timeline-view.mjs'
import { targetText, taskTime } from '../task-detail-view.mjs'
import { deviceSampleEvents, regionSampleTaskDetail } from '../region-sample-tasks.mjs'
import RegionTimeline from './RegionTimeline.vue'
import TaskErrorNotice from './TaskErrorNotice.vue'

const props = defineProps({ device: Object, date: String, now: String, sampleMode: Boolean, sampleDate: String, sampleTasks: { type: Array, default: () => [] } })
const emit = defineEmits(['task', 'issue'])
const timeline = ref(null)
defineExpose({ dismissCalendar: () => timeline.value?.dismissCalendar() || false })
const selectedDate = ref(props.date), month = ref(props.date.slice(0, 7))
const maxDate = computed(() => shiftDate(localDate(props.now), 7))
const displayNow = computed(() => props.sampleMode ? `${selectedDate.value}T14:52:00+08:00` : props.now)
const events = ref([]), marks = ref([]), loading = ref(false), error = ref(''), calendarError = ref('')
const items = computed(() => deviceTimelineItems(events.value))
// “下一次/进行中”取当前选中日内第一条执行中或未到的待执行阶段；事件按 at 升序。
const nextAction = computed(() => {
 const nowMs = Date.parse(displayNow.value)
 const event = events.value.filter(item => item.phaseStatus === 'executing'
  || (item.phaseStatus === 'pending' && Date.parse(item.at) > nowMs))
  .sort((a, b) => a.at.localeCompare(b.at))[0]
 if (!event) return null
 return { executing: event.phaseStatus === 'executing', clock: taskTime(event.at).slice(-5),
  label: event.taskLabel, target: targetText(event.device?.kind, event.target) }
})
let timelineRequest = 0, calendarRequest = 0
async function loadTimeline() {
 const current = ++timelineRequest, deviceId = props.device.id, date = selectedDate.value
 events.value = []; error.value = ''; loading.value = true
 if (props.sampleMode) {
  events.value = date === props.sampleDate ? deviceSampleEvents(props.sampleTasks, deviceId) : []
  loading.value = false
  return
 }
 try {
  const result = await listDeviceTimeline(deviceId, date)
  if (current === timelineRequest) events.value = result.events || []
 } catch (cause) { if (current === timelineRequest) error.value = cause.message || '设备记录读取失败：网络层未提供具体原因' }
 finally { if (current === timelineRequest) loading.value = false }
}
async function loadCalendar() {
 const current = ++calendarRequest, deviceId = props.device.id
 marks.value = []; calendarError.value = ''
 const { from, to } = calendarWindow(month.value)
 if (props.sampleMode) {
  const sampleEvents = deviceSampleEvents(props.sampleTasks, deviceId)
  marks.value = props.sampleDate >= from && props.sampleDate <= to && sampleEvents.length
   ? [{ date: props.sampleDate, abnormal: sampleEvents.some(event => !['verified', 'satisfied', 'pending'].includes(event.outcome)) }] : []
  return
 }
 try {
  const result = await listDeviceCalendar(deviceId, from, to)
  if (current === calendarRequest) marks.value = result.days || []
 } catch (cause) { if (current === calendarRequest) calendarError.value = cause.message || '设备日期标记读取失败：网络层未提供具体原因' }
}
watch(() => [props.device.id, selectedDate.value, props.sampleMode, props.sampleTasks], loadTimeline, { immediate: true })
watch(() => [props.device.id, month.value, props.sampleMode, props.sampleTasks], loadCalendar, { immediate: true })
function onMonth(value) { if (month.value === value) loadCalendar(); else month.value = value }
function openTask(item) {
 const sampleTask = props.sampleMode ? regionSampleTaskDetail(props.sampleTasks.find(task => task.id === item.taskId)) : null
 if (props.sampleMode && !sampleTask) return
 emit('task', { taskId: item.taskId, sampleTask })
}
onBeforeUnmount(() => { ++timelineRequest; ++calendarRequest })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:10px auto 0; padding:0; background:transparent; color:#176b54; font-size:12px; }
button::after { border:0; }
.device-view { height:100%; min-height:0; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.device-hero { display:flex; gap:12px; padding:10px 20px 14px; align-items:center; }
.sample-label { padding:0 20px 8px; color:#ad711b; font-size:10px; }
.hero-art { width:76px; height:70px; flex-shrink:0; border-radius:8px; display:flex; align-items:center; justify-content:center; background:linear-gradient(155deg,#e1e7df,#f3f5f0); box-shadow:inset 0 1px 0 #ffffffb3,0 4px 12px -8px rgba(31,52,42,.3); }
.hero-art image { width:90%; height:90%; }
.hero-copy { min-width:0; flex:1; }
.hero-name,.hero-location,.hero-state { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.hero-name { color:#274231; font-size:13px; font-weight:700; }
.hero-location { margin-top:4px; color:#73877a; font-size:10px; }
.hero-state { margin-top:7px; color:#536f5b; font-size:11px; }
.hero-next { margin-top:8px; display:inline-flex; align-items:center; max-width:100%; padding:3px 8px; border-radius:6px; background:#eef4ee; color:#3f6a51; font-size:10px; }
.hero-next text { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.timeline-area { height:0; min-height:0; flex:1; }
.record-card { display:flex; align-items:center; gap:5px; height:32px; min-width:0; }
.source { flex-shrink:0; padding:2px 5px; border-radius:4px; font-size:9px; font-weight:700; }
.source.immediate { color:#3f5a66; background:#e4ecef; }.source.scheduled { color:#176b54; background:#e4f2ea; }
.record-target { min-width:0; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#45564d; font-size:11px; font-weight:600; }
.record-task { margin-left:5px; color:#95a49a; font-size:9px; font-weight:400; }
.record-result { flex-shrink:0; font-size:9px; }
.record-result.ok,.record-result.active { color:#408064; }.record-result.warn { color:#a27128; }.record-result.wait { color:#839189; }.record-result.fail { color:#a15343; }
.creator { width:18px; height:18px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,#3a9478,#11553f); color:#fff; font-size:9px; }
.creator.cv-brass { background:linear-gradient(145deg,#d9b06c,#a87c33); }
.creator.cv-slate { background:linear-gradient(145deg,#8fa7b8,#5d7484); }
.creator.cv-grey { background:linear-gradient(145deg,#a9b0aa,#7a817b); }
.empty { padding:70px 20px; text-align:center; color:#86978a; font-size:12px; }
.empty text { display:block; margin-bottom:5px; }
.empty text:first-child { color:#526759; font-size:13px; font-weight:600; }
</style>
