<template>
  <view class="inbox-content">
    <TaskIssueDetails
      back-in-header
      style="height: 0; min-height: 0; flex: 1; display: flex; flex-direction: column"
      v-if="issue"
      :issue="issue"
      @close="issue = null"
    />
    <scroll-view
      :style="{ display: selected || issue ? 'none' : 'block' }"
      class="inbox-scroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
      @scrolltolower="load(false)"
    >
      <SlidingSegments
        class="inbox-tabs"
        tone="glass"
        :options="filters"
        :model-value="filter"
        @update:model-value="filter = $event"
      />
      <view class="inbox-tools"
        ><text class="inbox-count">{{ unreadCount }} 条未读</text
        ><button
          v-if="unreadCount || markingAll"
          class="inbox-markall"
          :loading="markingAll"
          :disabled="markingAll"
          @tap="markAllSeen"
          >{{ markingAll ? '正在标记…' : '全部已读' }}</button
        ></view
      >
      <view
        v-if="markAllError"
        class="markall-error"
        ><TaskErrorNotice
          :message="markAllError"
          summary="未能全部标记已读"
          @details="showIssue"
        /><button @tap="retryMarkAllSeen">重试</button></view
      >
      <view
        v-if="loading && !notifications.length"
        class="state-message"
        >加载中…</view
      >
      <view
        v-else-if="error && !notifications.length"
        class="state-message"
        ><TaskErrorNotice
          :message="error"
          summary="读取失败"
          @details="showIssue"
        /><button @tap="load(true)">重试</button></view
      >
      <view
        v-else-if="!visibleNotifications.length"
        class="state-message"
        >{{
          filter === 'unread'
            ? nextCursor
              ? '已加载的消息中没有未读消息'
              : '没有未读消息'
            : filter === 'read'
              ? nextCursor
                ? '已加载的消息中没有已读消息'
                : '没有已读消息'
              : '任务结束后，结果消息会出现在这里'
        }}</view
      >
      <view
        v-for="notification in visibleNotifications"
        :key="notification.id"
        class="notification-card"
        :class="{ seen: notification.readAt }"
        @tap="openReport(notification)"
      >
        <view
          class="ntile"
          :class="'ntile-' + outcomeTone(notification.outcome)"
          ><uni-icons
            :type="tileIcon(notification)"
            size="20"
            :color="tileColor(notification.outcome)"
        /></view>
        <view class="notification-copy">
          <text class="notification-title">{{ notification.label || '任务执行结果' }}</text>
          <button
            v-if="taskNeedsDetails(notification.outcome)"
            class="notification-outcome outcome-link"
            @tap.stop="
              notification.reason
                ? showIssue({ title: notification.label, reason: notification.reason })
                : openReport(notification)
            "
            >{{ outcomeLabel(notification.outcome) }} ›</button
          ><text
            v-else
            class="notification-outcome"
            :class="'tone-' + outcomeTone(notification.outcome)"
            >{{ outcomeLabel(notification.outcome) }}</text
          >
          <text
            v-if="notification.summary"
            class="notification-facts"
            >{{ summaryLine(notification.summary) }}</text
          >
        </view>
        <view class="notification-edge"
          ><text class="notification-time">{{ dateTime(notification.endedAt) }}</text
          ><view
            class="unread-mark"
            :class="{ 'unread-mark--active': !notification.readAt }"
        /></view>
        <uni-icons
          type="right"
          size="13"
          color="var(--agent-text-faint)"
        />
      </view>
      <button
        v-if="nextCursor && !loadingMore"
        class="load-more"
        @tap="load(false)"
        >加载更多消息</button
      >
      <view
        v-if="notifications.length && error"
        class="list-footer list-error"
        ><TaskErrorNotice
          :message="error"
          summary="消息暂未更新"
          @details="showIssue"
        /><button @tap="load(false)">重试</button></view
      >
      <view
        v-else-if="loadingMore"
        class="list-footer"
        >加载更多…</view
      >
      <view
        v-else-if="notifications.length && !nextCursor"
        class="list-footer"
        >已显示全部消息</view
      >
    </scroll-view>
    <view
      v-if="selected && markError"
      class="mark-error"
      ><text>报告已打开，但未读状态未更新</text><button @tap="retryMarkSeen">重试</button></view
    >
    <TaskResultContent
      v-if="selected"
      :style="{ display: issue ? 'none' : 'flex' }"
      ref="content"
      class="task-content-host"
      :active="open && !issue"
      :task-id="selected.taskId"
      :source="source"
      @loaded="onReportLoaded"
      @changed="$emit('changed')"
      @dismiss="backToList"
      @reference="$emit('reference', $event)"
      @navigation="navigation = $event"
    />
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { getAgentStorageScope } from '@/utils/agent-session';
import { useViewReads } from '../../lib/reads.mjs';
import {
  AGENT_NOTIFICATION_PAGE,
  markNotificationSeen,
  markAllNotificationsSeen,
  peekAgentNotifications,
  readAgentNotifications,
} from '@/apis/agent/tasks';
import TaskResultContent from './TaskResultContent.vue';
import TaskIssueDetails from './TaskIssueDetails.vue';
import TaskErrorNotice from './TaskErrorNotice.vue';
import { showAgentError } from '@/utils/agent-error';
import {
  taskStatusText,
  taskStatusTone,
  taskNeedsDetails,
  taskExecutionSummaryView,
} from '../../lib/tasks.mjs';
import SlidingSegments from '../shared/SlidingSegments.vue';
import { fmtShanghaiDateTime } from '../../lib/observations.mjs';

const props = defineProps({ open: Boolean, source: { type: String, default: 'office' } });
const emit = defineEmits(['unread-count', 'reference', 'navigation', 'changed', 'busy']);
const notifications = ref([]),
  selected = ref(null),
  content = ref(null),
  navigation = ref({ title: '', canBack: false });
const filter = ref('all'),
  issue = ref(null);
function showIssue(value) {
  issue.value = value;
}
const filters = [
  { value: 'all', label: '全部' },
  { value: 'unread', label: '未读' },
  { value: 'read', label: '已读' },
];
const visibleNotifications = computed(() =>
  notifications.value.filter((item) =>
    filter.value === 'unread' ? !item.readAt : filter.value === 'read' ? Boolean(item.readAt) : true
  )
);
watch(
  () => [selected.value, issue.value, navigation.value.title, navigation.value.canBack],
  () =>
    emit('navigation', {
      title: issue.value
        ? '查看原因'
        : navigation.value.title || (selected.value ? '任务详情' : '通知中心'),
      canBack: Boolean(selected.value || issue.value),
    }),
  { immediate: true }
);
const unreadCount = ref(0),
  nextCursor = ref('');
const loading = ref(false),
  loadingMore = ref(false),
  error = ref(''),
  markError = ref(''),
  markAllError = ref(''),
  markingAll = ref(false);
let bulkId = 0,
  loadedScope = '',
  pageVisible = true;
const reads = useViewReads(
  () => props.open && !selected.value && !issue.value,
  () => props.source
);

// 宿主标题栏的刷新图标只反映网络在途：批量已读期间也禁用，避免并发读取打乱批量代次。
watch([loading, markingAll], ([pending, bulk]) => emit('busy', pending || bulk), {
  immediate: true,
});

function safeScope() {
  try {
    return getAgentStorageScope();
  } catch {
    return '';
  }
}
// 批量已读与列表读取使用不同代次：关闭/隐藏/换身份只作废旧批量操作，不让迟到结果卡死按钮或污染新范围。
function invalidateBulk() {
  ++bulkId;
  markingAll.value = false;
}
function resetIdentity() {
  issue.value = null;
  notifications.value = [];
  selected.value = null;
  nextCursor.value = '';
  unreadCount.value = 0;
  markError.value = '';
  markAllError.value = '';
  invalidateBulk();
  marking.clear();
  seenFailed.clear();
  navigation.value = { title: '', canBack: false };
  publishUnreadCount();
}
onHide(() => {
  pageVisible = false;
  reads.invalidate();
  invalidateBulk();
  loading.value = false;
  loadingMore.value = false;
});
onShow(() => {
  pageVisible = true;
  if (props.open) void load(true);
});
const marking = new Set(),
  seenFailed = new Set();

const outcomeLabel = taskStatusText;
const outcomeTone = taskStatusTone;
/* 图标瓦块:无 kind 字段,按 label 关键词启发式定图标,outcome 定底色(参考通知中心卡)。 */
function tileIcon(notification) {
  const label = notification.label || '';
  if (taskNeedsDetails(notification.outcome)) return 'info';
  if (/报告|能耗|用电/.test(label)) return 'paperplane';
  if (/关闭|开启|照明|巡检/.test(label)) return 'checkmarkempty';
  return 'notification';
}
function tileColor(outcome) {
  const tone = taskStatusTone(outcome);
  return tone === 'warn'
    ? 'var(--agent-warning-deep)'
    : tone === 'ok'
      ? 'var(--agent-success)'
      : 'var(--agent-accent-deep)';
}
function summaryLine(summary) {
  return taskExecutionSummaryView(summary)?.devicesText || '';
}
function dateTime(value) {
  const text = fmtShanghaiDateTime(value);
  return text ? `${text.replace(/-/g, '/')}` : '';
}
function publishUnreadCount() {
  emit('unread-count', unreadCount.value);
}

async function load(reset, force = false) {
  if (!props.open || !pageVisible || markingAll.value) return;
  if (!reset && (loading.value || loadingMore.value || !nextCursor.value)) return;
  await reads.run(
    'list',
    (options) => {
      const scope = getAgentStorageScope(),
        source = props.source;
      if (scope !== loadedScope) {
        resetIdentity();
        loadedScope = scope;
      }
      const before = reset ? '' : nextCursor.value;
      if (reset) {
        const saved = peekAgentNotifications({ source, limit: AGENT_NOTIFICATION_PAGE });
        if (saved) {
          notifications.value = saved.notifications || [];
          unreadCount.value = Number(saved.unreadCount) || 0;
          nextCursor.value = saved.nextCursor || '';
          loading.value = false;
          publishUnreadCount();
        }
      }
      return readAgentNotifications(
        { source, limit: AGENT_NOTIFICATION_PAGE, before, force },
        options
      );
    },
    {
      start: () => {
        loading.value = reset;
        loadingMore.value = !reset;
        error.value = '';
      },
      data: (result) => {
        const incoming = result.notifications || [];
        if (reset) notifications.value = incoming;
        else {
          const combined = new Map(notifications.value.map((item) => [item.id, item]));
          for (const item of incoming) combined.set(item.id, item);
          notifications.value = [...combined.values()];
        }
        unreadCount.value = Number(result.unreadCount) || 0;
        nextCursor.value = result.nextCursor || '';
        publishUnreadCount();
      },
      denied: resetIdentity,
      error: (cause) => {
        error.value = cause.message || '通知中心暂不可用';
        showAgentError(cause, { fallback: '通知中心暂不可用' });
      },
      finish: () => {
        loading.value = false;
        loadingMore.value = false;
      },
    }
  );
}

function openReport(notification) {
  selected.value = notification;
  markError.value = '';
  seenFailed.delete(notification.id);
}
function backToList() {
  selected.value = null;
  markError.value = '';
  navigation.value = { title: '', canBack: false };
  if (props.open && pageVisible) void load(true);
}
function back() {
  if (issue.value) {
    issue.value = null;
    return true;
  }
  if (content.value?.back()) return true;
  if (selected.value) {
    backToList();
    return true;
  }
  return false;
}
defineExpose({ back, refresh: () => load(true, true) });

async function onReportLoaded(taskId) {
  const notification = selected.value;
  if (
    !notification ||
    notification.taskId !== taskId ||
    notification.readAt ||
    marking.has(notification.id) ||
    seenFailed.has(notification.id)
  )
    return;
  marking.add(notification.id);
  markError.value = '';
  try {
    const scope = getAgentStorageScope(),
      source = props.source;
    const result = await markNotificationSeen(notification.id, props.source);
    if (scope !== getAgentStorageScope() || source !== props.source) return;
    const item = notifications.value.find((value) => value.id === notification.id);
    if (item && !item.readAt) {
      item.readAt = result.readAt;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
      publishUnreadCount();
    }
    if (selected.value?.id === notification.id)
      selected.value = { ...selected.value, readAt: result.readAt };
  } catch {
    seenFailed.add(notification.id);
    if (selected.value?.id === notification.id) markError.value = '未读状态更新失败';
  } finally {
    marking.delete(notification.id);
  }
}
function retryMarkSeen() {
  const notification = selected.value;
  if (!notification) return;
  seenFailed.delete(notification.id);
  markError.value = '';
  void onReportLoaded(notification.taskId);
}
async function markAllSeen() {
  if (markingAll.value || !unreadCount.value || !props.open || !pageVisible) return;
  // 点击前会话已切换或身份失效：丢弃旧范围的列表与计数，按当前身份重新加载，绝不带旧范围发出已读请求。
  let scope = '';
  try {
    scope = getAgentStorageScope();
  } catch {
    scope = '';
  }
  if (!scope || scope !== loadedScope) {
    resetIdentity();
    if (scope) void load(true);
    else error.value = '当前登录状态不可用，请稍后重试';
    return;
  }
  const current = ++bulkId;
  // 批量操作开始即作废旧列表读取并清掉悬挂的加载标记，避免迟到的列表结果覆盖已读结果。
  reads.invalidate('list');
  loading.value = false;
  loadingMore.value = false;
  markingAll.value = true;
  markAllError.value = '';
  const source = props.source;
  try {
    const result = await markAllNotificationsSeen(source);
    if (
      current !== bulkId ||
      !props.open ||
      !pageVisible ||
      source !== props.source ||
      scope !== safeScope()
    )
      return;
    notifications.value = notifications.value.map((item) =>
      item.readAt ? item : { ...item, readAt: result.readAt }
    );
    if (selected.value && !selected.value.readAt)
      selected.value = { ...selected.value, readAt: result.readAt };
    unreadCount.value = 0;
    publishUnreadCount();
  } catch (cause) {
    if (
      current === bulkId &&
      props.open &&
      pageVisible &&
      source === props.source &&
      scope === safeScope()
    ) {
      markAllError.value = cause.message || '暂时没能标记已读，请重试';
      showAgentError(cause, { fallback: '暂时没能标记已读' });
    }
  } finally {
    if (current === bulkId) {
      markingAll.value = false;
      // 请求途中身份/范围已切换：旧身份列表不能残留，按当前可用身份重新加载。
      if (scope !== safeScope()) {
        resetIdentity();
        if (props.open && pageVisible) void load(true);
      }
    }
    // 旧批量操作在关闭/重开后迟到完成：同范围仍在展示且没有更新的批量操作时，用一次新列表请求对齐实际已读状态。
    else if (
      scope &&
      props.open &&
      pageVisible &&
      source === props.source &&
      scope === safeScope() &&
      !markingAll.value
    )
      void load(true);
  }
}
function retryMarkAllSeen() {
  markAllError.value = '';
  void markAllSeen();
}

watch(
  () => [props.open, props.source],
  ([value, source], previous) => {
    if (previous && source !== previous[1]) resetIdentity();
    if (value) void load(true);
    else {
      issue.value = null;
      reads.invalidate();
      invalidateBulk();
      loading.value = false;
      loadingMore.value = false;
      backToList();
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
@import '../../styles/tokens';
.outcome-link {
  min-height: 44px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  color: $agent-color-warning-deep;
  background: transparent;
}
.outcome-link::after {
  border: 0;
}
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1.2;
}
button::after {
  border: 0;
}
.inbox-content {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.inbox-scroll {
  height: 0;
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 0 18px 12px;
}
.inbox-tabs {
  margin: 2px 0 12px;
}
.inbox-tools {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 2px 12px;
}
.inbox-count {
  color: $agent-color-text-muted;
  font-size: 11px;
}
.inbox-markall {
  margin-left: auto;
  padding: 4px 2px;
  color: $agent-color-accent;
  font-size: 12px;
}
.notification-card {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  min-height: 76px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding: 14px 14px;
  border: 1px solid $agent-color-line;
  border-radius: 16px;
  background: $agent-color-surface;
  text-align: left;
  box-shadow: 0 2px 8px -6px rgba(var(--agent-shadow-rgb), 0.18);
}
.notification-card:active {
  background: $agent-color-surface-page;
}
.notification-card.seen {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
.ntile {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: $agent-color-accent-faint;
}
.ntile-warn {
  background: $agent-color-warning-faint;
}
.ntile-ok {
  background: $agent-color-success-faint;
}
.notification-edge {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.notification-time {
  color: $agent-color-text-muted;
  font-size: 10px;
  white-space: nowrap;
}
.unread-mark {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: transparent;
}
.unread-mark--active {
  background: $agent-color-badge;
  box-shadow: 0 0 0 3px $agent-color-warning-faint;
}
.notification-copy {
  min-width: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 4px;
}
.notification-title {
  min-width: 0;
  overflow: hidden;
  white-space: normal;
  word-break: break-word;
  color: $agent-color-text-secondary;
  font-size: 13px;
  font-weight: 600;
}
.seen .notification-title {
  color: $agent-color-text-muted;
  font-weight: 500;
}
.notification-outcome {
  font-size: 11px;
}
.notification-facts {
  color: $agent-color-text-muted;
  font-size: 10px;
  line-height: 1.35;
}
.state-message {
  padding: 48px 16px;
  text-align: center;
  color: $agent-color-text-muted;
  font-size: 13px;
}
.state-message text {
  display: block;
}
.state-message button,
.list-footer button,
.mark-error button {
  margin: 10px auto 0;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
.list-footer {
  padding: 16px 0 22px;
  text-align: center;
  color: $agent-color-text-faint;
  font-size: 11px;
}
.list-error {
  color: $agent-color-error;
}
.mark-error {
  flex-shrink: 0;
  padding: 7px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: $agent-color-warning-faint;
  color: $agent-color-warning-deep;
  font-size: 11px;
}
.mark-error button {
  margin: 0 0 0 auto;
  flex-shrink: 0;
}
.markall-status {
  color: $agent-color-accent;
}
.markall-error {
  padding: 4px 2px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: $agent-color-error;
  font-size: 11px;
}
.markall-error button {
  margin: 0 0 0 auto;
  flex-shrink: 0;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
.task-content-host {
  height: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.load-more {
  margin: 12px auto;
  padding: 10px;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
</style>
