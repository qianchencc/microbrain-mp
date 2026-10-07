<template>
 <DeviceSheet :open="open" :back="nativeBack" tall compact-header :title="selected ? '任务报告' : '任务收件箱'" @close="closeSheet">
  <template #header-left>
   <button v-if="selected" class="back-button" aria-label="返回收件箱" @tap="backToList"><uni-icons type="back" size="15" color="#63776a" /></button>
  </template>
  <template #header-right>
   <button v-if="!selected" class="refresh-button" aria-label="刷新收件箱" :disabled="loading" @tap="load(true)"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="16" color="#176b54" /></button>
  </template>
  <view class="inbox-content">
   <scroll-view v-show="!selected" class="inbox-scroll" scroll-y enhanced :show-scrollbar="false" @scrolltolower="load(false)">
    <view class="list-summary"><text>任务结束消息</text><text>{{ unreadCount }} 条未读</text></view>
    <view v-if="loading && !notifications.length" class="state-message">正在读取收件箱</view>
    <view v-else-if="error && !notifications.length" class="state-message"><text>{{ error }}</text><button @tap="load(true)">重试</button></view>
    <view v-else-if="!notifications.length" class="state-message">暂无任务消息</view>
    <button v-for="notification in notifications" :key="notification.id" class="notification-row" @tap="openReport(notification)">
     <view class="unread-mark" :class="{ 'unread-mark--active': !notification.readAt }" />
     <view class="notification-copy">
      <text class="notification-title">{{ notification.label || '任务执行结果' }}</text>
      <text class="notification-outcome" :class="'tone-' + outcomeTone(notification.outcome)">{{ outcomeLabel(notification.outcome) }}</text>
      <text class="notification-time">{{ dateTime(notification.endedAt) }}</text>
     </view>
     <uni-icons type="right" size="13" color="#99a59d" />
    </button>
    <view v-if="notifications.length && error" class="list-footer list-error"><text>{{ error }}</text><button @tap="load(false)">重试</button></view>
    <view v-else-if="loadingMore" class="list-footer">正在读取更多消息</view>
    <view v-else-if="notifications.length && !nextCursor" class="list-footer">已显示全部消息</view>
   </scroll-view>
   <view v-if="selected && markError" class="mark-error"><text>报告已打开，但未读状态未更新</text><button @tap="retryMarkSeen">重试</button></view>
   <TaskDetailContent v-if="selected" class="task-content-host" :active="open" :task-id="selected.taskId" :source="source" @loaded="onReportLoaded" @reference="$emit('reference', $event)" />
  </view>
 </DeviceSheet>
</template>

<script setup>
import { ref, watch } from 'vue'
import { listNotifications, markNotificationSeen } from '@/apis/agent'
import DeviceSheet from './DeviceSheet.vue'
import TaskDetailContent from './TaskDetailContent.vue'

const props = defineProps({ open: Boolean, source: { type: String, default: 'office' } })
const emit = defineEmits(['close', 'unread-count', 'reference'])
const notifications = ref([]), selected = ref(null)
const unreadCount = ref(0), nextCursor = ref('')
const loading = ref(false), loadingMore = ref(false), error = ref(''), markError = ref('')
let requestId = 0
const marking = new Set(), seenFailed = new Set()

const labels = { completed: '执行完成', partial: '部分完成', failed: '执行失败', unconfirmed: '结果待核验', interrupted: '执行中断', missed: '执行错过', cancelled: '已取消', verified: '已核验', satisfied: '无需执行' }
function outcomeLabel(value) { return labels[value] || value || '结果已保存' }
function outcomeTone(value) {
 if (['failed', 'missed', 'interrupted'].includes(value)) return 'fail'
 if (['partial', 'unconfirmed'].includes(value)) return 'warn'
 if (value === 'cancelled') return 'muted'
 return 'ok'
}
function dateTime(value) {
 const date = new Date(value)
 if (!Number.isFinite(date.getTime())) return ''
 const pad = part => String(part).padStart(2, '0')
 return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function publishUnreadCount() { emit('unread-count', unreadCount.value) }

async function load(reset) {
 if (!props.open) return
 if (!reset && (loading.value || loadingMore.value || !nextCursor.value)) return
 const current = reset ? ++requestId : requestId
 if (reset) { loading.value = true; loadingMore.value = false; error.value = '' }
 else { loadingMore.value = true; error.value = '' }
 try {
  const result = await listNotifications({ source: props.source, limit: 30, ...(reset || !nextCursor.value ? {} : { before: nextCursor.value }) })
  if (current !== requestId || !props.open) return
  const incoming = result.notifications || []
  if (reset) notifications.value = incoming
  else {
   const combined = new Map(notifications.value.map(item => [item.id, item]))
   for (const item of incoming) combined.set(item.id, item)
   notifications.value = [...combined.values()]
  }
  unreadCount.value = Number(result.unreadCount) || 0
  nextCursor.value = result.nextCursor || ''
  publishUnreadCount()
 } catch (cause) {
  if (current === requestId) error.value = cause.message || '收件箱暂不可用'
 } finally {
  if (current === requestId) { loading.value = false; loadingMore.value = false }
 }
}

function openReport(notification) {
 selected.value = notification
 markError.value = ''
 seenFailed.delete(notification.id)
}
function backToList() { selected.value = null; markError.value = '' }
function nativeBack() { if (selected.value) backToList(); else closeSheet() }
function closeSheet() { backToList(); emit('close') }

async function onReportLoaded(taskId) {
 const notification = selected.value
 if (!notification || notification.taskId !== taskId || notification.readAt || marking.has(notification.id) || seenFailed.has(notification.id)) return
 marking.add(notification.id)
 markError.value = ''
 try {
  const result = await markNotificationSeen(notification.id, props.source)
  const item = notifications.value.find(value => value.id === notification.id)
  if (item && !item.readAt) {
   item.readAt = result.readAt
   unreadCount.value = Math.max(0, unreadCount.value - 1)
   publishUnreadCount()
  }
  if (selected.value?.id === notification.id) selected.value = { ...selected.value, readAt: result.readAt }
 } catch {
  seenFailed.add(notification.id)
  if (selected.value?.id === notification.id) markError.value = '未读状态更新失败'
 } finally { marking.delete(notification.id) }
}
function retryMarkSeen() {
 const notification = selected.value
 if (!notification) return
 seenFailed.delete(notification.id)
 markError.value = ''
 void onReportLoaded(notification.taskId)
}

watch(() => props.open, value => {
 if (value) void load(true)
 else { ++requestId; loading.value = false; loadingMore.value = false }
})
</script>

<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.2; }
button::after { border:0; }
.inbox-content { min-height:0; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.inbox-scroll { height:0; min-height:0; flex:1; box-sizing:border-box; padding:0 18px 12px; }
.list-summary { display:flex; align-items:center; justify-content:space-between; padding:8px 2px 10px; border-bottom:1px solid #e5ebe6; color:#75877b; font-size:11px; }
.notification-row { width:100%; min-height:76px; display:flex; align-items:center; gap:11px; padding:12px 2px; border-bottom:1px solid #e8ede9; text-align:left; }
.notification-row:active { background:#f5f8f5; }
.unread-mark { width:7px; height:7px; flex-shrink:0; border-radius:50%; background:transparent; }
.unread-mark--active { background:#b0833c; box-shadow:0 0 0 3px #f5eddf; }
.notification-copy { min-width:0; flex:1; display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:10px; row-gap:4px; align-items:baseline; }
.notification-title { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#304739; font-size:13px; font-weight:600; }
.notification-outcome { grid-column:1; font-size:11px; }
.notification-time { grid-column:2; grid-row:1 / span 2; color:#87958c; font-size:10px; white-space:nowrap; }
.tone-ok { color:#397b61; }.tone-warn { color:#a27128; }.tone-fail { color:#a15343; }.tone-muted { color:#7e8982; }
.state-message { padding:48px 16px; text-align:center; color:#839189; font-size:13px; }
.state-message text { display:block; }
.state-message button,.list-footer button,.mark-error button { margin:10px auto 0; color:#176b54; font-size:12px; }
.list-footer { padding:16px 0 22px; text-align:center; color:#99a39d; font-size:11px; }
.list-error { color:#a15343; }
.back-button,.refresh-button { width:32px; height:32px; margin-right:8px; border-radius:16px; display:flex; align-items:center; justify-content:center; background:#eff3ef; }
.refresh-button { margin:0 14px 0 0; }
.refresh-button[disabled] { opacity:.5; }
.spinning { animation:inbox-spin 900ms linear infinite; }
@keyframes inbox-spin { to { transform:rotate(360deg); } }
.mark-error { flex-shrink:0; padding:7px 16px; display:flex; align-items:center; gap:10px; background:#fbf2e6; color:#936827; font-size:11px; }
.mark-error button { margin:0 0 0 auto; flex-shrink:0; }
.task-content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; } }
</style>
