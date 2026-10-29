<template>
  <view class="inbox-content">
   <TaskIssueDetails back-in-header style="height:0;min-height:0;flex:1;display:flex;flex-direction:column" v-if="issue" :issue="issue" @close="issue = null" />
   <scroll-view :style="{ display: selected || issue ? 'none' : 'block' }" class="inbox-scroll" scroll-y enhanced :show-scrollbar="false" @scrolltolower="load(false)">
    <view class="inbox-filters"><button v-for="option in filters" :key="option.value" :class="{ chosen: filter === option.value }" @tap="filter = option.value">{{ option.label }}</button><button v-if="unreadCount || markingAll" class="inbox-markall" :loading="markingAll" :disabled="markingAll" @tap="markAllSeen">{{ markingAll ? '正在标记…' : '全部已读' }}</button><button class="inbox-refresh" :disabled="loading || markingAll" @tap="load(true, true)">刷新</button></view>
    <view class="list-summary"><text>任务结束消息</text><text v-if="markingAll" class="markall-status">正在将通知标为已读…</text><text>{{ unreadCount }} 条未读</text></view>
    <view v-if="markAllError" class="markall-error"><TaskErrorNotice :message="markAllError" @details="showIssue" /><button @tap="retryMarkAllSeen">重试</button></view>
    <view v-if="loading && !notifications.length" class="state-message">加载中…</view>
    <view v-else-if="error && !notifications.length" class="state-message"><TaskErrorNotice :message="error" @details="showIssue" /><button @tap="load(true)">重试</button></view>
    <view v-else-if="!visibleNotifications.length" class="state-message">{{ filter === 'unread' ? nextCursor ? '已加载的消息中没有未读消息' : '没有未读消息' : filter === 'abnormal' ? nextCursor ? '已加载的消息中没有待查看结果' : '没有待查看结果消息' : '任务结束后，结果消息会出现在这里' }}</view>
    <view v-for="notification in visibleNotifications" :key="notification.id" class="notification-row" @tap="openReport(notification)">
     <view class="unread-mark" :class="{ 'unread-mark--active': !notification.readAt }" />
     <view class="notification-copy">
      <text class="notification-title">{{ notification.label || '任务执行结果' }}</text>
      <button v-if="taskNeedsDetails(notification.outcome)" class="notification-outcome outcome-link" @tap.stop="notification.reason ? showIssue({ title: notification.label, reason: notification.reason }) : openReport(notification)">{{ outcomeLabel(notification.outcome) }} ›</button><text v-else class="notification-outcome" :class="'tone-' + outcomeTone(notification.outcome)">{{ outcomeLabel(notification.outcome) }}</text>
      <text v-if="notification.summary" class="notification-facts">{{ summaryLine(notification.summary) }}</text>
      <text class="notification-time">{{ dateTime(notification.endedAt) }}</text>
     </view>
     <uni-icons type="right" size="13" color="#99a59d" />
    </view>
    <button v-if="nextCursor && !loadingMore" class="load-more" @tap="load(false)">加载更多消息</button>
    <view v-if="notifications.length && error" class="list-footer list-error"><TaskErrorNotice :message="error" @details="showIssue" /><button @tap="load(false)">重试</button></view>
    <view v-else-if="loadingMore" class="list-footer">加载更多…</view>
    <view v-else-if="notifications.length && !nextCursor" class="list-footer">已显示全部消息</view>
   </scroll-view>
   <view v-if="selected && markError" class="mark-error"><text>报告已打开，但未读状态未更新</text><button @tap="retryMarkSeen">重试</button></view>
   <TaskResultContent v-if="selected" :style="{ display: issue ? 'none' : 'flex' }" ref="content" class="task-content-host" :active="open && !issue" :task-id="selected.taskId" :source="source" @loaded="onReportLoaded" @changed="$emit('changed')" @dismiss="backToList" @reference="$emit('reference', $event)" @navigation="navigation = $event" />
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { getAgentStorageScope } from '@/utils/agent-session'
import { AGENT_NOTIFICATION_PAGE, markNotificationSeen, markAllNotificationsSeen, peekAgentNotifications, readAgentNotifications } from '@/apis/agent/tasks'
import TaskResultContent from './TaskResultContent.vue'
import TaskIssueDetails from './TaskIssueDetails.vue'
import TaskErrorNotice from './TaskErrorNotice.vue'
import { taskStatusText, taskStatusTone, taskNeedsDetails, taskExecutionSummaryView } from '../lib/tasks.mjs'
import { fmtShanghaiDateTime } from '../lib/observations.mjs'

const props = defineProps({ open: Boolean, source: { type: String, default: 'office' } })
const emit = defineEmits(['unread-count', 'reference', 'navigation', 'changed'])
const notifications = ref([]), selected = ref(null), content = ref(null), navigation = ref({ title: '', canBack: false })
const filter = ref('all'), issue = ref(null)
function showIssue(value) { issue.value = value }
const filters = [{ value: 'all', label: '全部' }, { value: 'unread', label: '未读' }, { value: 'abnormal', label: '待查看' }]
const visibleNotifications = computed(() => notifications.value.filter(item => filter.value === 'unread' ? !item.readAt : filter.value === 'abnormal' ? taskNeedsDetails(item.outcome) : true))
watch(() => [selected.value, issue.value, navigation.value.title, navigation.value.canBack], () => emit('navigation', { title: issue.value ? '查看原因' : navigation.value.title || (selected.value ? '任务详情' : '通知中心'), canBack: Boolean(selected.value || issue.value) }), { immediate: true })
const unreadCount = ref(0), nextCursor = ref('')
const loading = ref(false), loadingMore = ref(false), error = ref(''), markError = ref(''), markAllError = ref(''), markingAll = ref(false)
let requestId = 0, bulkId = 0, loadedScope = '', pageVisible = true

function safeScope() { try { return getAgentStorageScope() } catch { return '' } }
// 批量已读与列表读取使用不同代次：关闭/隐藏/换身份只作废旧批量操作，不让迟到结果卡死按钮或污染新范围。
function invalidateBulk() { ++bulkId; markingAll.value = false }
function resetIdentity() { issue.value = null; notifications.value = []; selected.value = null; nextCursor.value = ''; unreadCount.value = 0; markError.value = ''; markAllError.value = ''; invalidateBulk(); marking.clear(); seenFailed.clear(); navigation.value = { title: '', canBack: false }; publishUnreadCount() }
onHide(() => { pageVisible = false; ++requestId; invalidateBulk(); loading.value = false; loadingMore.value = false })
onShow(() => { pageVisible = true; if (props.open) void load(true) })
const marking = new Set(), seenFailed = new Set()

const outcomeLabel = taskStatusText
const outcomeTone = taskStatusTone
function summaryLine(summary) { return taskExecutionSummaryView(summary)?.devicesText || '' }
function dateTime(value) {
 const text = fmtShanghaiDateTime(value)
 return text ? `${text.replace(/-/g, '/')}` : ''
}
function publishUnreadCount() { emit('unread-count', unreadCount.value) }

async function load(reset, force = false) {
 if (!props.open || !pageVisible || markingAll.value) return
 if (!reset && (loading.value || loadingMore.value || !nextCursor.value)) return
 const current = reset ? ++requestId : requestId
 if (reset) { loading.value = true; loadingMore.value = false; error.value = '' }
 else { loadingMore.value = true; error.value = '' }
 let scope = ''
 try {
  scope = getAgentStorageScope()
  const source = props.source
  if (scope !== loadedScope) { resetIdentity(); loadedScope = scope }
  const before = reset ? '' : nextCursor.value
  // 同身份快照先落位：通知中心重开不再空等 Runtime，随后按同一缓存口径对齐。
  if (reset) {
   const saved = peekAgentNotifications({ source, limit: AGENT_NOTIFICATION_PAGE })
   if (saved) {
    notifications.value = saved.notifications || []
    unreadCount.value = Number(saved.unreadCount) || 0
    nextCursor.value = saved.nextCursor || ''
    loading.value = false
    publishUnreadCount()
   }
  }
  const result = await readAgentNotifications({ source, limit: AGENT_NOTIFICATION_PAGE, before, force })
  if (current !== requestId || !props.open || !pageVisible || source !== props.source || scope !== getAgentStorageScope()) return
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
  if (current === requestId) {
   let currentScope = ''
   try { currentScope = getAgentStorageScope() } catch { /* 失效身份不得保留旧列表 */ }
   if (cause.data || !scope || scope !== currentScope) resetIdentity()
   error.value = cause.message || '通知中心暂不可用'
  }
 } finally {
  if (current === requestId) { loading.value = false; loadingMore.value = false }
 }
}

function openReport(notification) {
 selected.value = notification
 markError.value = ''
 seenFailed.delete(notification.id)
}
function backToList() { selected.value = null; markError.value = ''; navigation.value = { title: '', canBack: false } }
function back() { if (issue.value) { issue.value = null; return true } if (content.value?.back()) return true; if (selected.value) { backToList(); return true } return false }
defineExpose({ back, refresh: () => load(true, true) })

async function onReportLoaded(taskId) {
 const notification = selected.value
 if (!notification || notification.taskId !== taskId || notification.readAt || marking.has(notification.id) || seenFailed.has(notification.id)) return
 marking.add(notification.id)
 markError.value = ''
 try {
  const scope = getAgentStorageScope(), source = props.source
  const result = await markNotificationSeen(notification.id, props.source)
  if (scope !== getAgentStorageScope() || source !== props.source) return
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
async function markAllSeen() {
 if (markingAll.value || !unreadCount.value || !props.open || !pageVisible) return
 // 点击前会话已切换或身份失效：丢弃旧范围的列表与计数，按当前身份重新加载，绝不带旧范围发出已读请求。
 let scope = ''
 try { scope = getAgentStorageScope() } catch { scope = '' }
 if (!scope || scope !== loadedScope) {
  resetIdentity()
  if (scope) void load(true)
  else error.value = '当前登录状态不可用，请稍后重试'
  return
 }
 const current = ++bulkId
 // 批量操作开始即作废旧列表读取并清掉悬挂的加载标记，避免迟到的列表结果覆盖已读结果。
 ++requestId
 loading.value = false
 loadingMore.value = false
 markingAll.value = true
 markAllError.value = ''
 const source = props.source
 try {
  const result = await markAllNotificationsSeen(source)
  if (current !== bulkId || !props.open || !pageVisible || source !== props.source || scope !== safeScope()) return
  notifications.value = notifications.value.map(item => item.readAt ? item : { ...item, readAt: result.readAt })
  if (selected.value && !selected.value.readAt) selected.value = { ...selected.value, readAt: result.readAt }
  unreadCount.value = 0
  publishUnreadCount()
 } catch (cause) {
  if (current === bulkId && props.open && pageVisible && source === props.source && scope === safeScope()) markAllError.value = cause.message || '暂时没能标记已读，请重试'
 } finally {
  if (current === bulkId) {
   markingAll.value = false
   // 请求途中身份/范围已切换：旧身份列表不能残留，按当前可用身份重新加载。
   if (scope !== safeScope()) { resetIdentity(); if (props.open && pageVisible) void load(true) }
  }
  // 旧批量操作在关闭/重开后迟到完成：同范围仍在展示且没有更新的批量操作时，用一次新列表请求对齐实际已读状态。
  else if (scope && props.open && pageVisible && source === props.source && scope === safeScope() && !markingAll.value) void load(true)
 }
}
function retryMarkAllSeen() { markAllError.value = ''; void markAllSeen() }

watch(() => [props.open, props.source], ([value, source], previous) => {
 if (previous && source !== previous[1]) resetIdentity()
 if (value) void load(true)
 else { issue.value = null; ++requestId; invalidateBulk(); loading.value = false; loadingMore.value = false; backToList() }
}, { immediate: true })
</script>

<style scoped>
.outcome-link { min-height:44px; margin:0; padding:0; display:flex; align-items:center; color:#806f50; background:transparent; }
.outcome-link::after { border:0; }
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
.notification-title { min-width:0; overflow:hidden; white-space:normal; word-break:break-word; color:#304739; font-size:13px; font-weight:600; }
.notification-outcome { grid-column:1; font-size:11px; }
.notification-time { grid-column:2; grid-row:1 / span 3; color:#87958c; font-size:10px; white-space:nowrap; }
.notification-reason { grid-column:1; color:#a27128; font-size:10px; line-height:1.35; }.tone-ok { color:#397b61; }.tone-warn { color:#a27128; }.tone-fail { color:#a15343; }.tone-muted { color:#7e8982; }
.notification-facts { grid-column:1; color:#6d7f73; font-size:10px; line-height:1.35; }
.state-message { padding:48px 16px; text-align:center; color:#839189; font-size:13px; }
.state-message text { display:block; }
.state-message button,.list-footer button,.mark-error button { margin:10px auto 0; color:#176b54; font-size:12px; }
.list-footer { padding:16px 0 22px; text-align:center; color:#99a39d; font-size:11px; }
.list-error { color:#a15343; }
.mark-error { flex-shrink:0; padding:7px 16px; display:flex; align-items:center; gap:10px; background:#fbf2e6; color:#936827; font-size:11px; }
.mark-error button { margin:0 0 0 auto; flex-shrink:0; }
.markall-status { color:#176b54; }
.markall-error { padding:4px 2px 8px; display:flex; align-items:center; gap:10px; color:#a15343; font-size:11px; }
.markall-error button { margin:0 0 0 auto; flex-shrink:0; color:#176b54; font-size:12px; }
.task-content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
.inbox-filters { display:flex; gap:8px; padding:6px 0 12px; }
.inbox-filters button { padding:7px 12px; border-radius:16px; font-size:11px; color:#7e9083; }
.inbox-filters .chosen { background:#e7f0e9; color:#176b54; }
.inbox-filters .inbox-refresh { margin-left:auto; }
.inbox-filters .inbox-markall { margin-left:auto; color:#176b54; }
.inbox-filters .inbox-markall + .inbox-refresh { margin-left:0; }
.load-more { margin:12px auto; padding:10px; color:#176b54; font-size:12px; }
</style>
