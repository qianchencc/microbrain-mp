<template>
 <view class="device-view">
  <view class="device-hero">
   <view class="hero-art"><image v-if="device.artwork" :src="device.artwork" mode="aspectFit" /><uni-icons v-else type="gear" size="27" color="#8b9a91" /></view>
   <view class="hero-copy"><text class="hero-name">{{ device.name }}</text><text class="hero-location">{{ device.kindLabel }} · {{ device.location }}</text><text class="hero-state">{{ device.detail }} · {{ device.age }}</text></view>
  </view>
  <text v-if="sampleMode" class="sample-label">本地演示记录 · 未写入设备或运行库</text>
  <view class="timeline-area">
   <RegionTimeline :key="selectedDate + '-' + items.length" calendar compact-calendar focus-items :date="selectedDate" :now="now" :max-date="maxDate" :calendar-marks="marks" :calendar-error="calendarError" :items="items" @date-change="selectedDate = $event" @calendar-month="onMonth" @select="openTask">
    <template #card="{ item }"><view class="record-card"><text class="source" :class="item.sourceText === '即时' ? 'immediate' : 'scheduled'">{{ item.sourceText }}</text><text class="record-target">{{ item.label }}<text class="record-task">{{ item.taskLabel }}</text></text><text class="record-result" :class="item.resultTone">{{ item.resultText }}</text><text class="creator">{{ item.creatorName.slice(0, 1) }}</text></view></template>
    <template #empty>
     <view v-if="loading || error" class="empty"><text>{{ loading ? '正在读取设备记录' : error }}</text><button v-if="error" @tap="loadTimeline">重新加载</button></view>
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
import { deviceSampleTask } from '../region-sample-tasks.mjs'
import RegionTimeline from './RegionTimeline.vue'

const props = defineProps({ device: Object, date: String, now: String, sampleMode: Boolean, sampleDate: String })
const emit = defineEmits(['task'])
const selectedDate = ref(props.date), month = ref(props.date.slice(0, 7))
const maxDate = computed(() => shiftDate(localDate(props.now), 7))
const events = ref([]), marks = ref([]), loading = ref(false), error = ref(''), calendarError = ref(false)
const items = computed(() => deviceTimelineItems(events.value))
let timelineRequest = 0, calendarRequest = 0
async function loadTimeline() {
 const current = ++timelineRequest, deviceId = props.device.id, date = selectedDate.value
 events.value = []; error.value = ''; loading.value = true
 if (props.sampleMode) {
  const task = date === props.sampleDate ? deviceSampleTask(props.device, date) : null
  events.value = task ? task.phases.map(phase => ({ taskId: task.id, taskLabel: task.label, taskStatus: task.status,
   sourceType: 'sample', creatorName: task.creator.displayName, phaseId: phase.id, at: phase.at,
   device: phase.devices[0], target: phase.devices[0].target, outcome: phase.devices[0].outcome })) : []
  loading.value = false
  return
 }
 try {
  const result = await listDeviceTimeline(deviceId, date)
  if (current === timelineRequest) events.value = result.events || []
 } catch (cause) { if (current === timelineRequest) error.value = cause.message || '设备记录暂不可用' }
 finally { if (current === timelineRequest) loading.value = false }
}
async function loadCalendar() {
 const current = ++calendarRequest, deviceId = props.device.id
 marks.value = []; calendarError.value = false
 const { from, to } = calendarWindow(month.value)
 if (props.sampleMode) {
  marks.value = props.sampleDate >= from && props.sampleDate <= to && deviceSampleTask(props.device, props.sampleDate)
   ? [{ date: props.sampleDate, abnormal: false }] : []
  return
 }
 try {
  const result = await listDeviceCalendar(deviceId, from, to)
  if (current === calendarRequest) marks.value = result.days || []
 } catch { if (current === calendarRequest) calendarError.value = true }
}
watch(() => [props.device.id, selectedDate.value, props.sampleMode], loadTimeline, { immediate: true })
watch(() => [props.device.id, month.value, props.sampleMode], loadCalendar, { immediate: true })
function onMonth(value) { if (month.value === value) loadCalendar(); else month.value = value }
function openTask(item) { emit('task', { taskId: item.taskId, sampleTask: props.sampleMode ? deviceSampleTask(props.device, props.sampleDate) : null }) }
onBeforeUnmount(() => { ++timelineRequest; ++calendarRequest })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:10px auto 0; padding:0; background:transparent; color:#176b54; font-size:12px; }
button::after { border:0; }
.device-view { height:100%; min-height:0; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.device-hero { display:flex; gap:12px; padding:10px 20px 14px; align-items:center; }
.sample-label { padding:0 20px 8px; color:#9a7133; font-size:10px; }
.hero-art { width:76px; height:70px; flex-shrink:0; border-radius:8px; display:flex; align-items:center; justify-content:center; background:linear-gradient(155deg,#e1e7df,#f3f5f0); }
.hero-art image { width:90%; height:90%; }
.hero-copy { min-width:0; flex:1; }
.hero-name,.hero-location,.hero-state { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.hero-name { color:#274231; font-size:13px; font-weight:700; }
.hero-location { margin-top:4px; color:#73877a; font-size:10px; }
.hero-state { margin-top:7px; color:#536f5b; font-size:11px; }
.timeline-area { height:0; min-height:0; flex:1; }
.record-card { display:flex; align-items:center; gap:5px; height:32px; min-width:0; }
.source { flex-shrink:0; padding:2px 5px; border-radius:4px; font-size:9px; font-weight:700; }
.source.immediate { color:#3f5a66; background:#e4ecef; }.source.scheduled { color:#176b54; background:#e4f2ea; }
.record-target { min-width:0; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#45564d; font-size:11px; font-weight:600; }
.record-task { margin-left:5px; color:#95a49a; font-size:9px; font-weight:400; }
.record-result { flex-shrink:0; font-size:9px; }
.record-result.ok { color:#408064; }.record-result.warn { color:#a76e27; }.record-result.wait { color:#839189; }.record-result.fail { color:#a15343; }
.creator { width:18px; height:18px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#497b66; color:#fff; font-size:9px; }
.empty { padding:70px 20px; text-align:center; color:#86978a; font-size:12px; }
.empty text { display:block; margin-bottom:5px; }
.empty text:first-child { color:#526759; font-size:13px; font-weight:600; }
</style>
