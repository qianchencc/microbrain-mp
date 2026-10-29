<template>
 <view class="overview">
  <DeviceSheet :open="Boolean(issue)" title="查看原因" tall compact-header @close="issue = null"><TaskIssueDetails style="height:0;min-height:0;flex:1;display:flex;flex-direction:column" v-if="issue" :issue="issue" @close="issue = null" /></DeviceSheet>
  <view class="overview-head"><text class="overview-title">任务管理</text><button class="inbox-link" @tap="open('inbox')"><uni-icons type="email" size="15" color="#176b54" /><text>通知中心</text><text v-if="unread" class="unread">{{ unread > 99 ? '99+' : unread }}</text></button></view>
  <view v-if="loading && !loaded" class="agenda-state">加载中…</view>
  <view v-else-if="error && !previewDays.length" class="agenda-error"><text>任务暂未加载</text><view class="error-actions"><button class="error-detail" @tap="showError">查看原因</button><button class="error-retry" @tap="load(true)">重试</button></view></view>
  <view v-else>
   <view v-for="day in previewDays" :key="day.date" class="agenda-day">
    <view class="agenda-rail"><text class="rail-num">{{ railNum(day.date) }}</text><text class="rail-wd">{{ railText(day.date) }}</text></view>
    <view class="agenda-rows">
     <button v-for="task in day.rows" :key="taskKey(task)" class="agenda-row" @tap="open('all', task)">
      <text class="row-clock">{{ taskDayTime(task, day.date) }}</text>
      <view class="row-copy"><text class="row-name">{{ task.label || '任务安排' }}</text><text v-if="task.repeat || task.occurrence" class="row-rule">{{ repeatText(task.repeat) || '按周期执行' }}</text></view>
      <text class="row-state" :class="'row-state--' + stateTone(task.status)">{{ taskLabel(task.status) }}</text>
     </button>
     <text v-if="day.more" class="row-more">还有 {{ day.more }} 项</text>
    </view>
   </view>
   <view v-if="!loading && !previewDays.length" class="agenda-state">近两个月暂无待执行任务</view>
   <view v-if="error && previewDays.length" class="agenda-error agenda-error--stale"><text>任务暂未更新</text><view class="error-actions"><button class="error-detail" @tap="showError">查看原因</button><button class="error-retry" @tap="load(true)">重试</button></view></view>
  </view>
  <button class="overview-foot" @tap="open('all')">查看所有任务 ›</button>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { peekAgentNotifications, peekAgentTasks, readAgentNotifications, readAgentTasks } from '@/apis/agent/tasks'
import { getAgentStorageScope } from '@/utils/agent-session'
import { shiftDate, agendaGroups, taskDayTime, taskLabel, taskSettled, taskToday, taskStatusTone, repeatText } from '../lib/tasks.mjs'
const props = defineProps({ active: Boolean, refreshKey: Number })
const emit = defineEmits(['open'])
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const issue = ref(null)
const tasks = ref([]), unread = ref(0), loading = ref(false), loaded = ref(false), error = ref(''), today = ref(taskToday())
const previewDays = computed(() => {
 const days = []
 let total = 0
 for (const day of agendaGroups(tasks.value, today.value, 62).days) {
  if (total >= 4) break
  const rows = day.rows.filter(task => !taskSettled(task))
  if (!rows.length) continue
  const shown = rows.slice(0, Math.min(3, 4 - total))
  total += shown.length
  days.push({ date: day.date, rows: shown, more: rows.length - shown.length })
 }
 return days
})
let generation = 0, timer = 0, visible = true, loadedScope = ''
function open(view, task) { emit('open', { view, date: today.value, task }) }
function taskKey(task) { return task.taskId || task.id || task.occurrence?.id || task.label }
const stateTone = taskStatusTone
function railNum(date) { return date.slice(5, 7) === today.value.slice(5, 7) ? String(Number(date.slice(8))) : date.slice(5) }
function railText(date) { return date === today.value ? '今天' : `周${WEEKDAYS[new Date(`${date}T00:00:00+08:00`).getDay()]}` }
function showError() { issue.value = { title: '任务暂未加载', reason: error.value } }
function stop() { ++generation; clearTimeout(timer); loading.value = false }
const agendaRange = () => ({ from: `${today.value}T00:00:00+08:00`, to: `${shiftDate(today.value, 62)}T00:00:00+08:00` })
async function load(force = false) {
 if (!props.active || !visible) return
 clearTimeout(timer)
 const current = ++generation
 loading.value = true; error.value = ''
 let scope = '', delay = 30000
 try {
  scope = getAgentStorageScope()
  if (scope !== loadedScope) { tasks.value = []; loaded.value = false; loadedScope = scope }
  const range = agendaRange()
  // 同身份议程快照先落位：重挂载、切模式与短时返回都不闪「加载中…」，随后按同一缓存口径对齐。
  const saved = peekAgentTasks({ source: 'company', ...range }), savedUnread = peekAgentNotifications({ source: 'company', limit: 1 })
  if (saved && !loaded.value) { tasks.value = saved.tasks || []; loaded.value = true }
  if (savedUnread) unread.value = Number(savedUnread.unreadCount) || 0
  const executing = tasks.value.some(task => task.status === 'executing')
  delay = executing ? 5000 : 30000
  const result = await readAgentTasks({ source: 'company', ...range, force })
  if (current !== generation || scope !== getAgentStorageScope() || !props.active || !visible) return
  tasks.value = result.tasks || []; loaded.value = true
  void refreshUnread(force)
 } catch (cause) {
  if (current !== generation) return
  let liveScope = ''
  try { liveScope = getAgentStorageScope() } catch { /* 身份失效 */ }
  if (cause.data || !scope || scope !== liveScope) { tasks.value = []; loaded.value = false }
  error.value = cause.message || '任务暂不可用'
 } finally {
  if (current === generation) {
   loading.value = false
   if (props.active && visible) timer = setTimeout(() => load(true), delay)
  }
 }
}
async function refreshUnread(force = false) {
 const current = generation
 try {
  const scope = getAgentStorageScope()
  if (scope !== loadedScope) return
  const result = await readAgentNotifications({ source: 'company', limit: 1, force })
  if (current === generation && props.active && scope === getAgentStorageScope()) unread.value = Number(result.unreadCount) || 0
 } catch { /* 未读数失败不影响任务预览 */ }
}
watch(() => [props.active, props.refreshKey], ([active, revision], previous) => {
 if (!active) { issue.value = null; stop(); return }
 today.value = taskToday()
 void load(Boolean(previous && previous[1] !== revision))
}, { immediate: true })
onHide(() => { visible = false; stop() })
onShow(() => { visible = true; today.value = taskToday(); if (props.active) void load() })
onBeforeUnmount(stop)
</script>
<style scoped>
view,text { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.4; }
button::after { border:0; }
.overview { padding:5px 0 0; }
.overview-head { display:flex; align-items:center; justify-content:space-between; padding:0 4px 6px; }
.overview-title { font-size:12px; font-weight:600; color:#6e8375; }
.inbox-link { min-height:36px; display:flex; align-items:center; gap:5px; color:#176b54; font-size:12px; }
.unread { min-width:17px; padding:2px 4px; border-radius:10px; background:#176b54; color:#fff; font-size:10px; }
.agenda-state { padding:20px 4px 12px; text-align:center; color:#839389; font-size:12px; }
.agenda-error { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 4px; color:#7b8d80; font-size:12px; }
.agenda-error--stale { border-top:1px solid #e4eae4; padding-bottom:4px; }
.error-actions { display:flex; align-items:center; gap:12px; flex-shrink:0; }
.error-actions button { display:flex; align-items:center; justify-content:center; min-height:32px; padding:4px; font-size:12px; }
.error-detail { color:#7b8d80; }.error-retry { color:#176b54; }
.error-actions button:active { opacity:.65; }
.agenda-day { display:flex; gap:10px; padding:10px 0 0; }
.agenda-rail { width:30px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; padding-top:2px; }
.rail-num { font-size:15px; font-weight:700; color:#33503d; line-height:1.2; }
.rail-wd { font-size:10px; color:#8b9a90; }
.agenda-rows { min-width:0; flex:1; display:flex; flex-direction:column; }
.agenda-row { width:100%; display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px solid #e8ede8; text-align:left; }
.agenda-row:active { opacity:.65; }
.row-clock { width:48px; flex-shrink:0; font-size:11px; color:#466350; }
.row-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }
.row-name { white-space:normal; word-break:break-word; font-size:13px; font-weight:600; color:#2b4433; }
.row-rule { font-size:10px; color:#8b9c90; }
.row-state { flex-shrink:0; font-size:11px; color:#839287; }
.row-state--active { color:#176b54; }.row-state--warn { color:#a16f28; }
.row-more { padding:5px 0 3px; color:#99a59d; font-size:10px; }
.overview-foot { min-height:44px; margin-top:8px; display:flex; align-items:center; justify-content:center; border-top:1px solid #e0e8e0; color:#176b54; font-size:12px; }
</style>
