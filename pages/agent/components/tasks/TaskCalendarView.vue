<template>
  <view class="task-calendar">
    <RegionCalendar
      :date="selected"
      :today="today"
      :max-date="maxDate"
      :marks="marks"
      :compact="compact"
      @select="selectDate"
      @month-change="changeMonth"
    />
    <view class="date-summary"
      ><text class="date-title">{{ dateHead }}</text
      ><text class="date-count">{{
        loading && !loaded ? '正在读取' : loaded ? `${dayTasks.length} 项` : ''
      }}</text></view
    >
    <view
      v-if="!loaded && !error"
      class="calendar-state"
      >正在读取日程…</view
    >
    <view
      v-else-if="loaded && !error && !dayTasks.length"
      class="calendar-state"
      >这一天暂无任务</view
    >
    <button
      v-for="task in visibleTasks"
      :key="task.taskId || task.id"
      class="calendar-task"
      @tap="$emit('select-task', task)"
    >
      <view class="task-clock"
        ><text>{{ clock(task) }}</text
        ><text
          v-if="task.occurrence || task.repeat"
          class="repeat-tag"
          >周期</text
        ></view
      >
      <view class="task-copy"
        ><text class="task-name">{{ task.label || '设备任务' }}</text
        ><text
          class="task-state"
          :class="{ abnormal: taskAbnormal(task), executing: task.status === 'executing' }"
          >{{ taskLabel(task.status) }}</text
        ></view
      >
      <uni-icons
        type="right"
        size="12"
        color="var(--agent-text-muted)"
      />
    </button>
    <view
      v-if="error"
      class="calendar-error"
      role="status"
    >
      <text>{{ loaded ? '任务暂未更新' : '任务暂未加载' }}</text>
      <view class="error-actions"
        ><button
          class="error-detail"
          @tap="showError"
          >查看原因</button
        ><button
          class="error-retry"
          @tap="load(true)"
          >重试</button
        ></view
      >
    </view>
    <button
      v-if="compact && loaded && dayTasks.length > 2"
      class="all-tasks"
      @tap="$emit('open-date', selected)"
      >全部 {{ dayTasks.length }} 项
      <uni-icons
        type="right"
        size="11"
        color="var(--agent-accent)"
    /></button>
  </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { peekAgentCalendar, readAgentCalendar, readAgentCalendarDay } from '@/apis/agent/tasks';
import { getAgentStorageScope } from '@/utils/agent-session';
import { showAgentError } from '@/utils/agent-error';
import RegionCalendar from '../regions/RegionCalendar.vue';
import { calendarWindow, shiftDate, validCalendarDate } from '../../lib/region.mjs';
import {
  taskToday,
  taskDayTime,
  taskCalendarMarks,
  tasksOnDate,
  calendarVisibleTasks,
  taskLabel,
  taskAbnormal,
  mergeDayTasks,
  calendarPollDelay,
  taskSettled,
} from '../../lib/tasks.mjs';
import { useViewReads } from '../../lib/reads.mjs';
const props = defineProps({
  active: Boolean,
  compact: Boolean,
  date: String,
  refreshKey: Number,
  source: { type: String, default: 'company' },
});
const emit = defineEmits(['date-change', 'select-task', 'open-date', 'refreshed', 'issue']);
const today = ref(taskToday()),
  selected = ref(validCalendarDate(props.date) ? props.date : today.value);
const month = ref(selected.value.slice(0, 7)),
  tasks = ref([]),
  loading = ref(false),
  loaded = ref(false),
  error = ref('');
const maxDate = computed(() => shiftDate(today.value, 365));
const window = computed(() => calendarWindow(month.value));
const marks = computed(() => taskCalendarMarks(tasks.value, window.value.from, window.value.to));
const dayTasks = computed(() => tasksOnDate(tasks.value, selected.value, props.compact));
const visibleTasks = computed(() => calendarVisibleTasks(dayTasks.value, props.compact));
const dateHead = computed(() => {
  const date = selected.value,
    [m, d] = [Number(date.slice(5, 7)), Number(date.slice(8))];
  if (date === today.value) return `今天 · ${m}月${d}日`;
  if (date === shiftDate(today.value, 1)) return `明天 · ${m}月${d}日`;
  return `周${'日一二三四五六'[new Date(`${date}T00:00:00+08:00`).getDay()]} · ${m}月${d}日`;
});
let timer = 0,
  visible = true,
  loadedScope = '';
const reads = useViewReads(
  () => props.active,
  () => [props.source, month.value]
);
function clock(task) {
  return taskDayTime(task, selected.value);
}
function selectDate(date) {
  selected.value = date;
  emit('date-change', date);
}
function changeMonth(value) {
  if (month.value !== value) month.value = value;
}
function showError() {
  emit('issue', { title: '任务暂未加载', reason: error.value });
}
function stop() {
  reads.invalidate();
  clearTimeout(timer);
  loading.value = false;
}
function schedule() {
  clearTimeout(timer);
  // 节拍取自刚读取的状态：未完任务（含跨日/历史月）才定时，边界到点 1 秒内唤醒。
  const delay = calendarPollDelay(tasks.value, window.value.from, window.value.to);
  if (delay) timer = setTimeout(pollTick, delay);
}
const calendarRange = (queryMonth) => {
  const range = calendarWindow(queryMonth);
  return { from: `${range.from}T00:00:00+08:00`, to: `${shiftDate(range.to, 1)}T00:00:00+08:00` };
};
async function load(force = false) {
  if (!props.active || !visible) return;
  clearTimeout(timer);
  const source = props.source,
    range = calendarRange(month.value);
  await reads.run(
    'calendar',
    async (options) => {
      const scope = getAgentStorageScope();
      if (scope !== loadedScope) {
        tasks.value = [];
        loaded.value = false;
        loadedScope = scope;
      }
      const saved = peekAgentCalendar({ source, ...range });
      if (saved) {
        tasks.value = saved.tasks || [];
        loaded.value = true;
        loading.value = false;
      }
      return readAgentCalendar({ source, ...range, force }, options);
    },
    {
      start: () => {
        loading.value = true;
        error.value = '';
      },
      data: (result) => {
        tasks.value = result.tasks || [];
        loaded.value = true;
        emit('refreshed');
      },
      denied: () => {
        tasks.value = [];
        loaded.value = false;
      },
      error: (cause) => {
        error.value = cause.message || '日程暂不可用';
        showAgentError(cause, { fallback: '日程暂不可用' });
      },
      finish: () => {
        loading.value = false;
        schedule();
      },
    }
  );
}
// 今天以外也有未完任务时直接刷新月窗；否则只读今天。每次轮询只发一个请求。
async function pollTick() {
  if (!props.active || !visible) return;
  const source = props.source,
    queryMonth = month.value;
  const range = calendarRange(queryMonth),
    grid = calendarWindow(queryMonth);
  const todayIn = today.value >= grid.from && today.value <= grid.to;
  const offToday =
    !todayIn ||
    tasks.value.some((row) => !taskSettled(row) && !tasksOnDate([row], today.value).length);
  const date = today.value;
  await reads.run(
    'calendar',
    (options) =>
      offToday
        ? readAgentCalendar({ source, ...range, force: true }, options)
        : readAgentCalendarDay(
            {
              source,
              from: `${date}T00:00:00+08:00`,
              to: `${shiftDate(date, 1)}T00:00:00+08:00`,
              force: true,
            },
            options
          ),
    {
      data: (result) => {
        tasks.value = offToday
          ? result.tasks || []
          : mergeDayTasks(tasks.value, result.tasks || [], date);
        loaded.value = true;
        error.value = '';
      },
      denied: () => {
        tasks.value = [];
        loaded.value = false;
      },
      error: (cause) => {
        error.value = cause.message || '日程暂不可用';
        showAgentError(cause, { fallback: '日程暂不可用' });
      },
      finish: schedule,
    }
  );
}
watch(
  () => props.date,
  (value) => {
    if (validCalendarDate(value)) selected.value = value;
  }
);
watch(selected, (value) => {
  month.value = value.slice(0, 7);
});
watch(
  () => [props.active, props.source, props.refreshKey, month.value],
  ([active, source, revision, currentMonth], previous) => {
    stop();
    if (previous && (source !== previous[1] || currentMonth !== previous[3])) {
      tasks.value = [];
      loaded.value = false;
    }
    if (active) {
      today.value = taskToday();
      void load(Boolean(previous && revision !== previous[2]));
    }
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
defineExpose({ refresh: () => load(true) });
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
.task-calendar {
  flex-shrink: 0;
}
.date-summary {
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-top: 1px solid $agent-color-line;
}
.date-title {
  color: $agent-color-text-primary;
  font-size: 15px;
  font-weight: 600;
}
.date-count {
  color: $agent-color-text-muted;
  font-size: 11px;
}
.calendar-state {
  padding: 22px 16px;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
  text-align: center;
}
.calendar-error {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
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
.calendar-task {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 16px 0;
  padding: 14px;
  text-align: left;
  border: 1px solid $agent-color-line;
  border-radius: 14px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
}
.calendar-task:active {
  background: $agent-color-surface-page;
}
.task-clock {
  width: 46px;
  flex-shrink: 0;
  align-self: flex-start;
  font-size: 15px;
  font-weight: 600;
  color: $agent-color-accent-deep;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.repeat-tag {
  color: $agent-color-text-muted;
  font-size: 10px;
  font-weight: 400;
}
.task-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.task-name {
  white-space: normal;
  word-break: break-word;
  font-size: 13px;
  font-weight: 600;
  color: $agent-color-text-primary;
}
.task-state {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-top: 1px;
  padding: 3px 10px;
  border-radius: 999px;
  background: $agent-color-tint;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.task-state.abnormal {
  background: $agent-color-warning-faint;
  color: $agent-color-warning-deep;
}
.task-state.executing {
  background: $agent-color-accent-faint;
  color: $agent-color-accent-deep;
}
.all-tasks {
  padding: 12px;
  text-align: center;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
</style>
