<template>
 <view class="task-calendar">
  <RegionCalendar :date="selected" :today="today" :max-date="maxDate" :marks="marks" :compact="compact" @select="selectDate" @month-change="changeMonth" />
  <view class="date-summary"><text>{{ selected === today ? '今天' : selected }} · 任务</text><text>{{ loading && !loaded ? '正在读取' : loaded ? `${dayTasks.length} 项` : '' }}</text></view>
  <view v-if="!loaded && !error" class="calendar-state">正在读取日程…</view>
  <view v-else-if="loaded && !error && !dayTasks.length" class="calendar-state">这一天暂无任务</view>
  <button v-for="task in visibleTasks" :key="task.taskId || task.id" class="calendar-task" @tap="$emit('select-task', task)">
   <view class="task-clock"><text>{{ clock(task) }}</text><text v-if="task.occurrence || task.repeat" class="repeat-tag">周期</text></view>
   <view class="task-copy"><text class="task-name">{{ task.label || '设备任务' }}</text><text class="task-state" :class="{ abnormal: taskAbnormal(task), executing: task.status === 'executing' }">{{ taskLabel(task.status) }}</text></view>
   <uni-icons type="right" size="12" color="#8a9c90" />
  </button>
  <view v-if="error" class="calendar-error" role="status">
   <text>{{ loaded ? '任务暂未更新' : '任务暂未加载' }}</text>
   <view class="error-actions"><button class="error-detail" @tap="showError">查看原因</button><button class="error-retry" @tap="load(true)">重试</button></view>
  </view>
  <button v-if="compact && loaded && dayTasks.length > 2" class="all-tasks" @tap="$emit('open-date', selected)">全部 {{ dayTasks.length }} 项 <uni-icons type="right" size="11" color="#176b54" /></button>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { listAgentTasks } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import RegionCalendar from './RegionCalendar.vue'
import { calendarWindow, shiftDate, validCalendarDate } from '../region-calendar.mjs'
import { taskToday, taskDayTime, taskCalendarMarks, tasksOnDate, taskLabel, taskAbnormal } from '../task-calendar.mjs'
const props = defineProps({ active: Boolean, compact: Boolean, date: String, refreshKey: Number, source: { type: String, default: 'company' } })
const emit = defineEmits(['date-change', 'select-task', 'open-date', 'refreshed'])
const today = ref(taskToday()), selected = ref(validCalendarDate(props.date) ? props.date : today.value)
const month = ref(selected.value.slice(0, 7)), tasks = ref([]), loading = ref(false), loaded = ref(false), error = ref('')
const maxDate = computed(() => shiftDate(today.value, 365))
const window = computed(() => calendarWindow(month.value))
const marks = computed(() => taskCalendarMarks(tasks.value, window.value.from, window.value.to))
const dayTasks = computed(() => tasksOnDate(tasks.value, selected.value, props.compact))
const visibleTasks = computed(() => props.compact ? dayTasks.value.slice(0, 2) : dayTasks.value)
let generation = 0, timer = 0, visible = true, loadedScope = ''
let inFlight = null, loadedAt = 0, loadedKey = ''
function clock(task) { return taskDayTime(task, selected.value) }
function selectDate(date) { selected.value = date; emit('date-change', date) }
function changeMonth(value) { if (month.value !== value) month.value = value }
function showError() { uni.showModal({ title: '任务加载失败', content: error.value, showCancel: false, confirmText: '知道了' }) }
function stop() { ++generation; clearTimeout(timer); loading.value = false }
async function load(force = false) {
 if (!props.active || !visible) return
 clearTimeout(timer)
 const current = ++generation, source = props.source, queryMonth = month.value
 loading.value = true; error.value = ''
 let scope = '', delay = 30000
 try {
  scope = getAgentStorageScope()
  if (scope !== loadedScope) { tasks.value = []; loaded.value = false; loadedScope = scope }
  const range = calendarWindow(queryMonth)
  const key = JSON.stringify([scope, source, queryMonth, props.refreshKey])
  const interval = tasks.value.some(task => task.status === 'executing') ? 5000 : 30000
  delay = interval
  if (!force && loaded.value && loadedKey === key && Date.now() - loadedAt < interval) { delay = Math.max(1, interval - (Date.now() - loadedAt)); return }
  if (inFlight?.key !== key) {
   const promise = listAgentTasks({ source, from: `${range.from}T00:00:00+08:00`, to: `${shiftDate(range.to, 1)}T00:00:00+08:00` })
   inFlight = { key, promise }
   promise.then(() => { if (inFlight?.promise === promise) inFlight = null }, () => { if (inFlight?.promise === promise) inFlight = null })
  }
  const result = await inFlight.promise
  if (current !== generation || source !== props.source || scope !== getAgentStorageScope() || !props.active || !visible) return
  tasks.value = result.tasks || []; loaded.value = true; loadedAt = Date.now(); loadedKey = key
  emit('refreshed')
 } catch (cause) {
  if (current !== generation) return
  let liveScope = ''
  try { liveScope = getAgentStorageScope() } catch { /* 身份失效 */ }
  if (cause.data || !scope || scope !== liveScope) { tasks.value = []; loaded.value = false }
  error.value = cause.message || '日程暂不可用'
 } finally {
  if (current === generation) {
   loading.value = false
   if (props.active && visible) timer = setTimeout(() => load(true), delay)
  }
 }
}
watch(() => props.date, value => { if (validCalendarDate(value)) selected.value = value })
watch(selected, value => { month.value = value.slice(0, 7) })
watch(() => [props.active, props.source, props.refreshKey, month.value], ([active, source, revision, currentMonth], previous) => {
 stop()
 if (previous && (source !== previous[1] || currentMonth !== previous[3])) { tasks.value = []; loaded.value = false }
 if (active) { today.value = taskToday(); void load(Boolean(previous && revision !== previous[2])) }
}, { immediate: true })
onHide(() => { visible = false; stop() })
onShow(() => { visible = true; today.value = taskToday(); if (props.active) void load() })
onBeforeUnmount(stop)
defineExpose({ refresh: () => load(true) })
</script>
<style scoped>
view,text { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.4; }
button::after { border:0; }
.task-calendar { flex-shrink:0; }
.date-summary { padding:10px 16px; display:flex; justify-content:space-between; color:#7b8d80; font-size:11px; border-top:1px solid #e4eae4; }
.calendar-state { padding:22px 16px; color:#859389; font-size:12px; text-align:center; }
.calendar-error { padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; color:#7b8d80; font-size:12px; }
.error-actions { display:flex; align-items:center; gap:12px; flex-shrink:0; }
.error-actions button { display:flex; align-items:center; justify-content:center; min-height:32px; padding:4px; font-size:12px; }
.error-detail { color:#7b8d80; }.error-retry { color:#176b54; }
.error-actions button:active { opacity:.65; }
.calendar-task { width:100%; display:flex; align-items:center; gap:12px; padding:14px 16px; text-align:left; border-top:1px solid #e8ede8; }
.task-clock { width:58px; flex-shrink:0; align-self:flex-start; font-size:11px; color:#466350; display:flex; flex-direction:column; gap:5px; }
.repeat-tag { color:#8b9c90; font-size:10px; }
.task-copy { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
.task-name { white-space:normal; word-break:break-word; font-size:13px; font-weight:600; color:#2b4433; }
.task-state { font-size:11px; color:#839287; }
.task-state.abnormal { color:#a16f28; }.task-state.executing { color:#176b54; }
.all-tasks { padding:12px; text-align:center; color:#176b54; font-size:12px; }
</style>
