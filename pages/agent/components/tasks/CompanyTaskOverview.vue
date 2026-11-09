<template>
  <view class="overview">
    <DeviceSheet
      :open="Boolean(issue)"
      title="查看原因"
      tall
      compact-header
      @close="issue = null"
      ><TaskIssueDetails
        style="height: 0; min-height: 0; flex: 1; display: flex; flex-direction: column"
        v-if="issue"
        :issue="issue"
        @close="issue = null"
    /></DeviceSheet>
    <view class="overview-head"
      ><text class="overview-title">任务管理</text
      ><button
        class="inbox-link"
        @tap="open('inbox')"
        ><uni-icons
          type="email"
          size="15"
          color="var(--agent-accent)"
        /><text>通知中心</text
        ><text
          v-if="unread"
          class="unread"
          >{{ unread > 99 ? '99+' : unread }}</text
        ></button
      ></view
    >
    <view
      v-if="loading && !loaded"
      class="agenda-state"
      >加载中…</view
    >
    <view
      v-else-if="error && !previewDays.length"
      class="agenda-error"
      ><text>任务暂未加载</text
      ><view class="error-actions"
        ><button
          class="error-detail"
          @tap="showError"
          >查看原因</button
        ><button
          class="error-retry"
          @tap="load(true)"
          >重试</button
        ></view
      ></view
    >
    <view v-else>
      <view
        v-for="day in previewDays"
        :key="day.finished ? day.date + ':done' : day.date"
        class="agenda-day"
      >
        <view
          class="agenda-rail"
          :class="{ 'rail-today': day.date === today }"
          ><text class="rail-num">{{ railNum(day.date) }}</text
          ><text class="rail-wd">{{ railText(day.date) }}</text></view
        >
        <view class="agenda-rows">
          <button
            v-for="task in day.rows"
            :key="taskKey(task)"
            class="agenda-row"
            @tap="open('all', task)"
          >
            <text class="row-clock">{{ taskDayTime(task, day.date) }}</text>
            <view class="row-copy"
              ><text class="row-name">{{ task.label || '任务安排' }}</text
              ><text
                v-if="taskProgressNote(task)"
                class="row-progress"
                >{{ taskProgressNote(task) }}</text
              ><text
                v-if="task.repeat || task.occurrence"
                class="row-rule"
                >{{ repeatText(task.repeat) || '按周期执行' }}</text
              ></view
            >
            <text
              class="row-state"
              :class="'row-state--' + (task.stateTone || stateTone(task.status))"
              >{{ task.stateLabel || taskLabel(task.status) }}</text
            >
          </button>
          <text
            v-if="day.more"
            class="row-more"
            >还有 {{ day.more }} 项</text
          >
        </view>
      </view>
      <view
        v-if="!loading && !previewDays.length"
        class="agenda-state"
        >近两个月暂无任务安排</view
      >
      <view
        v-if="error && previewDays.length"
        class="agenda-error agenda-error--stale"
        ><text>任务暂未更新</text
        ><view class="error-actions"
          ><button
            class="error-detail"
            @tap="showError"
            >查看原因</button
          ><button
            class="error-retry"
            @tap="load(true)"
            >重试</button
          ></view
        ></view
      >
    </view>
    <button
      class="overview-foot"
      @tap="open('all')"
      >查看所有任务 ›</button
    >
  </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import DeviceSheet from '../shared/DeviceSheet.vue';
import TaskIssueDetails from './TaskIssueDetails.vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import {
  peekAgentNotifications,
  peekAgentTasks,
  readAgentNotifications,
  readAgentTasks,
} from '@/apis/agent/tasks';
import { getAgentStorageScope } from '@/utils/agent-session';
import { showAgentError } from '@/utils/agent-error';
import { useViewReads } from '../../lib/reads.mjs';
import {
  shiftDate,
  agendaPreview,
  taskPollDelay,
  taskDayTime,
  taskLabel,
  taskProgressNote,
  taskToday,
  taskStatusTone,
  repeatText,
  TASK_POLL_IDLE_MS,
} from '../../lib/tasks.mjs';
const props = defineProps({ active: Boolean, refreshKey: Number });
const emit = defineEmits(['open', 'unread']);
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const issue = ref(null);
const tasks = ref([]),
  unread = ref(0),
  loading = ref(false),
  loaded = ref(false),
  error = ref(''),
  today = ref(taskToday());
const previewDays = computed(() => agendaPreview(tasks.value, today.value, 62));
let timer = 0,
  visible = true,
  loadedScope = '';
const reads = useViewReads(() => props.active);
function open(view, task) {
  emit('open', { view, date: today.value, task });
}
function taskKey(task) {
  return task.taskId || task.id || task.occurrence?.id || task.label;
}
const stateTone = taskStatusTone;
function railNum(date) {
  return date.slice(5, 7) === today.value.slice(5, 7)
    ? String(Number(date.slice(8)))
    : date.slice(5);
}
function railText(date) {
  return date === today.value
    ? '今天'
    : `周${WEEKDAYS[new Date(`${date}T00:00:00+08:00`).getDay()]}`;
}
function showError() {
  issue.value = { title: '任务暂未加载', reason: error.value };
}
function stop() {
  reads.invalidate();
  clearTimeout(timer);
  loading.value = false;
}
const agendaRange = () => ({
  from: `${today.value}T00:00:00+08:00`,
  to: `${shiftDate(today.value, 62)}T00:00:00+08:00`,
});
async function load(force = false) {
  if (!props.active || !visible) return;
  clearTimeout(timer);
  let delay = TASK_POLL_IDLE_MS;
  await reads.run(
    'agenda',
    async (options) => {
      const scope = getAgentStorageScope();
      if (scope !== loadedScope) {
        tasks.value = [];
        loaded.value = false;
        loadedScope = scope;
      }
      const range = agendaRange();
      const saved = peekAgentTasks({ source: 'company', ...range }),
        savedUnread = peekAgentNotifications({ source: 'company', limit: 1 });
      if (saved && !loaded.value) {
        tasks.value = saved.tasks || [];
        loaded.value = true;
      }
      if (savedUnread) {
        unread.value = Number(savedUnread.unreadCount) || 0;
        emit('unread', unread.value);
      }
      return readAgentTasks({ source: 'company', ...range, force }, options);
    },
    {
      start: () => {
        loading.value = true;
        error.value = '';
      },
      data: (result) => {
        tasks.value = result.tasks || [];
        loaded.value = true;
        delay = taskPollDelay(tasks.value, Date.now());
      },
      denied: () => {
        tasks.value = [];
        loaded.value = false;
        unread.value = 0;
      },
      error: (cause) => {
        error.value = cause.message || '任务暂不可用';
        showAgentError(cause, { fallback: '任务暂不可用' });
      },
      finish: () => {
        loading.value = false;
        void refreshUnread(force);
        timer = setTimeout(() => load(true), delay);
      },
    }
  );
}
async function refreshUnread(force = false) {
  await reads.run(
    'unread',
    (options) => readAgentNotifications({ source: 'company', limit: 1, force }, options),
    {
      data: (result) => {
        unread.value = Number(result.unreadCount) || 0;
        emit('unread', unread.value);
      },
      denied: () => {
        unread.value = 0;
      },
    }
  );
}
watch(
  () => [props.active, props.refreshKey],
  ([active, revision], previous) => {
    if (!active) {
      issue.value = null;
      stop();
      return;
    }
    today.value = taskToday();
    void load(Boolean(previous && previous[1] !== revision));
  },
  { immediate: true }
);
onHide(() => {
  visible = false;
  stop();
});
onShow(() => {
  visible = true;
  today.value = taskToday();
  if (props.active) void load();
});
onBeforeUnmount(stop);
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text {
  font-size: inherit;
  line-height: inherit;
}
button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1.4;
}
button::after {
  border: 0;
}
.overview {
  padding: 5px 0 0;
}
.overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 6px;
}
.overview-title {
  font-size: $agent-font-size-compact;
  font-weight: 600;
  color: $agent-color-text-muted;
}
.inbox-link {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 5px;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
.unread {
  min-width: 17px;
  padding: 2px 4px;
  border-radius: 10px;
  background: $agent-color-accent;
  color: #fff;
  font-size: 10px;
}
.agenda-state {
  padding: 20px 4px 12px;
  text-align: center;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
}
.agenda-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 4px;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
}
.agenda-error--stale {
  border-top: 1px solid $agent-color-line;
  padding-bottom: 4px;
}
.error-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.error-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 4px;
  font-size: $agent-font-size-compact;
}
.error-detail {
  color: $agent-color-text-muted;
}
.error-retry {
  color: $agent-color-accent;
}
.error-actions button:active {
  opacity: 0.65;
}
.agenda-day {
  display: flex;
  gap: 10px;
  padding: 10px 0 0;
}
.agenda-rail {
  width: 38px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 日期徽章：在整组任务行间垂直居中，作为日期锚点而非贴顶贴纸 */
  align-self: center;
  padding: 7px 0 6px;
  border-radius: 10px;
  background: $agent-color-tint;
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.agenda-rail.rail-today {
  background: linear-gradient(155deg, $agent-color-accent, $agent-color-accent-deep);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 3px 8px rgba(var(--agent-shadow-rgb), 0.18);
}
.rail-num {
  font-size: 15px;
  font-weight: 700;
  color: $agent-color-accent-deep;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.rail-wd {
  font-size: 9px;
  color: $agent-color-text-muted;
  margin-top: 1px;
}
.agenda-rail.rail-today .rail-num,
.agenda-rail.rail-today .rail-wd {
  color: #fff;
}
.agenda-rows {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.agenda-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid $agent-color-line;
  text-align: left;
}
.agenda-row:active {
  opacity: 0.65;
}
.row-clock {
  width: 48px;
  flex-shrink: 0;
  font-size: 11px;
  color: $agent-color-text-secondary;
}
.row-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.row-name {
  white-space: normal;
  word-break: break-word;
  font-size: 13px;
  font-weight: 600;
  color: $agent-color-text-primary;
}
.row-progress {
  font-size: 10px;
  color: $agent-color-text-secondary;
}
.row-rule {
  font-size: 10px;
  color: $agent-color-text-muted;
}
.row-state--ok {
  color: $agent-color-success;
}
.row-state {
  flex-shrink: 0;
  font-size: 11px;
  color: $agent-color-text-muted;
}
.row-state--active {
  color: $agent-color-accent;
}
.row-state--warn {
  color: $agent-color-warning-deep;
}
.row-more {
  padding: 5px 0 3px;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.overview-foot {
  min-height: 44px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid $agent-color-line;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
</style>
