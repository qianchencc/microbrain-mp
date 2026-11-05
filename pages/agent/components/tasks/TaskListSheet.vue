<template>
  <DeviceSheet
    :open="open"
    :back="nativeBack"
    tall
    compact-header
    :title="
      issue
        ? '查看原因'
        : (view === 'inbox' ? inboxNavigation.title : navigation.title) || sheetTitle
    "
    :subtitle="sheetSubtitle"
    @close="closeSheet"
  >
    <template #header-left>
      <button
        v-if="issue || selectedTask || selectedPlan || inboxNavigation.canBack || stackedView"
        class="back-button"
        aria-label="返回上一级"
        @tap="goBack"
        ><uni-icons
          type="back"
          size="15"
          color="var(--agent-text-muted)"
      /></button>
    </template>
    <template #header-right>
      <view class="header-actions">
        <button
          v-if="!selectedTask && !selectedPlan && view !== 'inbox'"
          class="refresh-button"
          aria-label="刷新安排"
          :disabled="loading"
          @tap="load(true)"
          ><uni-icons
            :class="{ spinning: loading }"
            type="refreshempty"
            size="16"
            color="var(--agent-accent-deep)"
        /></button>
        <view
          v-if="source === 'company' && !selectedTask && !selectedPlan && view !== 'inbox'"
          class="inbox-entry"
          ><button
            class="refresh-button"
            aria-label="通知中心"
            @tap="view = 'inbox'"
            ><uni-icons
              type="email"
              size="16"
              color="var(--agent-accent-deep)" /></button
          ><view
            v-if="inboxUnread"
            class="inbox-badge"
            ><text>{{ inboxUnread > 99 ? '99+' : inboxUnread }}</text></view
          ></view
        >
      </view>
    </template>
    <TaskIssueDetails
      back-in-header
      style="height: 0; min-height: 0; flex: 1; display: flex; flex-direction: column"
      v-if="issue"
      :issue="issue"
      @close="issue = null"
    />
    <view
      class="arrangements-content"
      :style="{ display: issue ? 'none' : 'flex' }"
    >
      <TaskErrorNotice
        v-if="operationError"
        :message="operationError"
        summary="部分操作未完成"
        @details="showIssue"
      />
      <view
        class="list-pane"
        :style="{ display: selectedTask || selectedPlan ? 'none' : 'flex' }"
      >
        <view
          v-if="!inboxNavigation.canBack && !stackedView"
          class="view-switch"
          ><SlidingSegments
            v-model="view"
            tone="glass"
            :options="views"
        /></view>
        <TaskInboxContent
          v-if="source === 'company' && view === 'inbox'"
          ref="inbox"
          class="task-content-host"
          :open="open && view === 'inbox' && !selectedTask && !selectedPlan"
          :source="source"
          @navigation="inboxNavigation = $event"
          @reference="emit('reference', $event)"
          @unread-count="
            inboxUnread = $event;
            emit('unread-count', $event);
          "
          @changed="emit('changed')"
        />
        <scroll-view
          v-else
          class="arrangements-scroll"
          scroll-y
          enhanced
          :show-scrollbar="false"
        >
          <TaskCalendarView
            v-if="source === 'company' && view === 'calendar'"
            ref="calendar"
            @issue="showIssue"
            :active="open && view === 'calendar' && !selectedTask && !selectedPlan"
            :date="selectedDate"
            :refresh-key="refreshKey"
            source="company"
            @date-change="selectedDate = $event"
            @select-task="openTask"
          />
          <template v-else>
            <button
              v-if="view === 'all' && source === 'company'"
              class="plan-strip"
              hover-class="plan-strip--pressed"
              @tap="view = 'plans'"
            >
              <view class="strip-icon"
                ><uni-icons
                  type="reload"
                  size="15"
                  color="var(--agent-accent-deep)"
              /></view>
              <view class="strip-copy">
                <text class="strip-title">周期任务</text>
                <text
                  v-if="plansError"
                  class="strip-meta strip-meta--fail"
                  >未能加载</text
                >
                <text
                  v-else-if="plansLoaded"
                  class="strip-meta"
                  >{{ plans.length }} 项 · 已开启 {{ enabledPlansCount }}</text
                >
                <text
                  v-else
                  class="strip-meta"
                  >读取中…</text
                >
              </view>
              <uni-icons
                type="right"
                size="13"
                color="var(--agent-text-faint)"
              />
            </button>
            <view
              v-if="view === 'plans'"
              class="plans-head"
              ><text class="plans-title">周期任务</text
              ><button
                v-if="pausablePlans.length"
                class="plans-pause-all"
                :disabled="planBusy"
                @tap="pauseAllPlans"
                >全部暂停</button
              ></view
            >
            <view
              v-else-if="view !== 'all'"
              class="list-summary"
              ><text>{{ listSummary }}</text
              ><view class="summary-side"
                ><text>{{ listLoaded ? `${visibleRows.length} 项` : '正在读取' }}</text></view
              ></view
            >
            <view
              v-if="loading && !listLoaded"
              class="state-message"
              >加载中…</view
            >
            <view
              v-else-if="error && !visibleRows.length"
              class="state-message"
              ><TaskErrorNotice
                :message="error"
                @details="showIssue"
              /><button @tap="load">重试</button></view
            >
            <view
              v-else-if="!visibleRows.length && view !== 'all'"
              class="state-message"
              >{{ emptyText }}</view
            >

            <template v-else-if="view === 'all'">
              <view
                v-if="!agendaHasDays && !agenda.later.length"
                class="state-message"
                >{{ emptyText }}</view
              >
              <template v-else>
                <view
                  v-if="!agendaHasDays"
                  class="day-empty"
                  >近 10 天暂无任务</view
                >
                <template
                  v-for="day in agendaHasDays ? agenda.days : []"
                  :key="day.date"
                >
                  <view
                    v-if="day.rows.length"
                    class="day-head"
                    ><text class="day-title">{{ dayHead(day.date) }}</text
                    ><text class="day-count">{{ day.rows.length }} 项</text></view
                  >
                  <button
                    v-for="task in day.rows"
                    :key="taskKey(task)"
                    class="task-card"
                    @tap="openTask(task)"
                  >
                    <text class="card-clock">{{ taskDayTime(task, day.date) }}</text>
                    <view class="row-copy">
                      <view class="row-heading"
                        ><text class="row-title">{{ task.label || '任务安排' }}</text></view
                      >
                      <text
                        v-if="agendaSubtitle(task)"
                        class="row-subtitle"
                        >{{ agendaSubtitle(task) }}</text
                      >
                      <text
                        class="task-chip"
                        :class="'chip-' + taskTone(task.status)"
                        >{{ taskStatus(task.status) }}</text
                      >
                    </view>
                    <uni-icons
                      type="right"
                      size="13"
                      color="var(--agent-text-faint)"
                    />
                  </button>
                </template>
                <template v-if="agenda.later.length">
                  <view class="day-head"
                    ><text class="day-title">更晚</text
                    ><text class="day-count">{{ agenda.later.length }} 项</text></view
                  >
                  <button
                    v-for="item in agenda.later"
                    :key="taskKey(item.task)"
                    class="task-card"
                    @tap="openTask(item.task)"
                  >
                    <view class="card-clock card-clock--later"
                      ><text>{{ item.date.slice(5) }}</text
                      ><text>{{ taskDayTime(item.task, item.date) }}</text></view
                    >
                    <view class="row-copy">
                      <view class="row-heading"
                        ><text class="row-title">{{ item.task.label || '任务安排' }}</text></view
                      >
                      <text
                        v-if="agendaSubtitle(item.task)"
                        class="row-subtitle"
                        >{{ agendaSubtitle(item.task) }}</text
                      >
                      <text
                        class="task-chip"
                        :class="'chip-' + taskTone(item.task.status)"
                        >{{ taskStatus(item.task.status) }}</text
                      >
                    </view>
                    <uni-icons
                      type="right"
                      size="13"
                      color="var(--agent-text-faint)"
                    />
                  </button>
                </template>
                <view
                  v-if="moreLoading || moreError || hasMore"
                  class="list-footer"
                  ><TaskErrorNotice
                    v-if="moreError"
                    :message="moreError"
                    summary="更晚的任务暂未加载"
                    @details="showIssue"
                  /><button
                    v-if="moreError"
                    @tap="loadMore"
                    >重试</button
                  ><button
                    v-else-if="!moreLoading"
                    @tap="loadMore"
                    >加载更晚任务</button
                  ><text v-else>加载中…</text></view
                >
              </template>
            </template>

            <template v-else-if="view === 'plans'">
              <view
                v-for="plan in plans"
                :key="plan.planId"
                class="plan-card"
              >
                <button
                  class="plan-main"
                  @tap="openPlan(plan)"
                >
                  <view class="row-copy">
                    <view class="row-heading"
                      ><text class="row-title">{{ plan.label || '未命名周期任务' }}</text
                      ><text
                        v-if="!planCanToggle(plan) && ['enabled', 'paused'].includes(plan.status)"
                        class="plan-access-tag"
                        >仅可查看</text
                      ></view
                    >
                    <text class="row-subtitle">{{
                      repeatText(plan.repeat) || '重复规则未提供'
                    }}</text>
                    <text
                      v-if="source === 'company' && taskRequirementsText(plan)"
                      class="row-subtitle"
                      >{{ taskRequirementsText(plan) }}</text
                    >
                    <text class="plan-next">{{ planNextLine(plan) }}</text>
                  </view>
                  <uni-icons
                    type="right"
                    size="13"
                    color="var(--agent-text-faint)"
                  />
                </button>
                <view
                  v-if="!planCanToggle(plan)"
                  class="plan-switch-wrap plan-switch-wrap--disabled"
                  @tap.stop="explainPlanAccess(plan)"
                >
                  <switch
                    :key="`${planSwitchRevision}:${plan.planId}:${planIsEnabled(plan)}`"
                    class="plan-switch"
                    :checked="planIsEnabled(plan)"
                    :color="AGENT_COLORS.accentDeep"
                    disabled
                  />
                </view>
                <switch
                  v-else
                  :key="`${planSwitchRevision}:${plan.planId}:${planIsEnabled(plan)}`"
                  class="plan-switch"
                  :checked="planIsEnabled(plan)"
                  :color="AGENT_COLORS.accentDeep"
                  :disabled="planBusy"
                  @change.stop="togglePlanStatus(plan, $event.detail.value)"
                />
              </view>
              <text
                v-if="plans.length"
                class="plans-foot"
                >暂停只影响未来安排，保留已有执行记录</text
              >
            </template>

            <template v-else>
              <button
                v-for="task in tasks"
                :key="taskKey(task)"
                class="task-card"
                @tap="openTask(task)"
              >
                <text class="card-clock">{{ rowClock(task) }}</text>
                <view class="row-copy">
                  <view class="row-heading"
                    ><text class="row-title">{{ task.label || '任务安排' }}</text></view
                  >
                  <text
                    v-if="agendaSubtitle(task)"
                    class="row-subtitle"
                    >{{ agendaSubtitle(task) }}</text
                  >
                  <text
                    class="task-chip"
                    :class="'chip-' + taskTone(task.status)"
                    >{{ taskStatus(task.status) }}</text
                  >
                </view>
                <uni-icons
                  type="right"
                  size="13"
                  color="var(--agent-text-faint)"
                />
              </button>
            </template>

            <view
              v-if="error && visibleRows.length"
              class="list-footer list-error"
              ><TaskErrorNotice
                :message="error"
                @details="showIssue"
              /><button @tap="load">重试</button></view
            >
          </template>
        </scroll-view>
        <button
          v-if="source === 'company' && !inboxNavigation.canBack && !stackedView"
          class="create-task"
          @tap="emit('create')"
          >让 Agent 安排任务
          <uni-icons
            type="chatbubble"
            size="14"
            color="var(--agent-accent-deep)"
        /></button>
      </view>

      <view
        v-if="selectedPlan"
        class="detail-pane"
        ><text
          v-if="planLoading"
          class="list-footer"
          >正在更新…</text
        ><TaskErrorNotice
          v-if="planDetailError"
          :message="planDetailError"
          @details="showIssue"
        />
        <scroll-view
          class="detail-scroll"
          scroll-y
          enhanced
          :show-scrollbar="false"
        >
          <view class="plan-summary">
            <view class="summary-heading"
              ><view
                class="status-mark"
                :class="planIsEnabled(selectedPlan) ? 'status-mark--active' : 'status-mark--paused'"
              /><text class="plan-label">{{ selectedPlan.label || '未命名周期任务' }}</text></view
            >
            <text
              class="summary-status"
              :class="planIsEnabled(selectedPlan) ? 'tone-active' : 'tone-muted'"
              >{{ planStatus(selectedPlan) }}</text
            >
            <view class="summary-line"
              ><text>重复规则</text
              ><text>{{ repeatText(selectedPlan.repeat) || '未提供' }}</text></view
            >
            <view
              v-if="source === 'company' && taskRequirementsText(selectedPlan)"
              class="summary-line"
              ><text>执行要求</text><text>{{ taskRequirementsText(selectedPlan) }}</text></view
            >
            <view class="summary-line"
              ><text>{{ planNextLabel(selectedPlan) }}</text
              ><text>{{
                planNextTime(selectedPlan) ? taskTime(planNextTime(selectedPlan)) : '暂无'
              }}</text></view
            >
            <view class="summary-line"
              ><text>创建人</text
              ><text>{{ selectedPlan.creator?.displayName || '成员' }}</text></view
            >
            <text class="summary-note">{{ planAccessSummary(selectedPlan) }}</text>
            <TaskErrorNotice
              v-if="selectedPlan.pauseReason"
              :message="selectedPlan.pauseReason"
              summary="安排已暂停"
              @details="showIssue"
            />
            <view class="plan-toggle-row">
              <view class="plan-toggle-copy"
                ><text class="plan-toggle-title">周期任务</text
                ><text class="plan-toggle-note">{{
                  planIsEnabled(selectedPlan) ? '暂停后只影响以后的安排' : '继续前会检查设备权限'
                }}</text></view
              >
              <view
                v-if="!planCanToggle(selectedPlan)"
                class="plan-switch-wrap plan-switch-wrap--disabled"
                @tap.stop="explainPlanAccess(selectedPlan)"
              >
                <switch
                  :key="`${planSwitchRevision}:${selectedPlan.planId}:${planIsEnabled(selectedPlan)}`"
                  :checked="planIsEnabled(selectedPlan)"
                  :color="AGENT_COLORS.accentDeep"
                  disabled
                />
              </view>
              <switch
                v-else
                :key="`${planSwitchRevision}:${selectedPlan.planId}:${planIsEnabled(selectedPlan)}`"
                :checked="planIsEnabled(selectedPlan)"
                :color="AGENT_COLORS.accentDeep"
                :disabled="planBusy"
                @change="togglePlanStatus(selectedPlan, $event.detail.value)"
              />
            </view>
            <view
              v-if="selectedPlan.latestTask"
              class="latest-result"
            >
              <view class="latest-result-copy"
                ><text class="latest-result-title">最近一次结果</text
                ><text
                  >{{
                    taskTime(taskTimeValue(selectedPlan.latestTask, 'results')) || '时间未提供'
                  }}
                  · {{ taskStatus(selectedPlan.latestTask.status) }}</text
                ></view
              >
              <button
                v-if="selectedPlan.latestTask.id || selectedPlan.latestTask.taskId"
                class="latest-result-link"
                @tap="openLatestReport"
                >查看报告
                <uni-icons
                  type="right"
                  size="12"
                  color="var(--agent-accent-deep)"
              /></button>
            </view>
          </view>
        </scroll-view>
        <view class="detail-actions"
          ><button
            class="reference-button"
            @tap="referencePlan"
            ><uni-icons
              type="chatbubble"
              size="15"
              color="#fff"
            /><text>询问这个计划</text></button
          ><view
            v-if="selectedPlan.canManage"
            class="cancel-actions"
            ><button
              v-if="selectedPlan.nextDate"
              class="cancel-button"
              :disabled="planBusy"
              @tap="cancelWholePlan('occurrence')"
              >取消本次</button
            ><button
              class="cancel-button"
              :disabled="planBusy"
              @tap="cancelWholePlan('all')"
              >取消全部</button
            ></view
          ></view
        >
      </view>

      <view
        v-if="selectedTask"
        class="detail-pane"
      >
        <TaskResultContent
          ref="content"
          class="task-content-host"
          :active="open"
          :task-id="selectedTaskId"
          :initial-task="selectedTask"
          :snapshot-scope="loadedScope"
          :source="source"
          @reference="emit('reference', $event)"
          @cancelled="onTaskCancelled"
          @changed="emit('changed')"
          @dismiss="backToList"
          @navigation="navigation = $event"
        />
      </view>
    </view>
  </DeviceSheet>
</template>

<script setup>
import { computed, reactive, ref, toRef, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { getAgentStorageScope } from '@/utils/agent-session';
import {
  getTaskPlan,
  cancelTaskPlan,
  peekAgentPlans,
  peekAgentTasks,
  readAgentNotifications,
  readAgentPlans,
  readAgentTasks,
  setTaskPlanStatus,
} from '@/apis/agent/tasks';
import {
  taskStatusTone,
  repeatText,
  taskRequirementsText,
  taskTime,
  agendaGroups,
  taskDayTime,
  taskListRange,
  taskToday,
  taskSettled,
  taskLabel as taskStatus,
  TASK_ALL_CHUNK_DAYS,
  TASK_ALL_MAX_DAYS,
  shiftDate,
  planPresentation,
  createPlanManagement,
} from '../../lib/tasks.mjs';
import DeviceSheet from '../shared/DeviceSheet.vue';
import TaskIssueDetails from './TaskIssueDetails.vue';
import TaskErrorNotice from './TaskErrorNotice.vue';
import SlidingSegments from '../shared/SlidingSegments.vue';
import TaskResultContent from './TaskResultContent.vue';
import TaskCalendarView from './TaskCalendarView.vue';
import TaskInboxContent from './TaskInboxContent.vue';
import { AGENT_COLORS } from '../../styles/colors.js';

const props = defineProps({
  open: Boolean,
  source: { type: String, default: 'office' },
  initialView: String,
  date: String,
  initialTask: Object,
  refreshKey: Number,
});
const emit = defineEmits(['close', 'reference', 'create', 'changed', 'unread-count']);
const calendar = ref(null),
  inbox = ref(null),
  inboxNavigation = ref({ title: '', canBack: false }),
  selectedDate = ref(props.date || taskToday());
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const views = computed(() =>
  props.source === 'company'
    ? [
        { value: 'calendar', label: '日历' },
        { value: 'all', label: '全部任务' },
        { value: 'plans', label: '周期任务' },
      ]
    : [
        { value: 'upcoming', label: '待执行' },
        { value: 'results', label: '执行结果' },
        { value: 'plans', label: '周期任务' },
      ]
);
const view = ref(props.source === 'company' ? 'all' : 'upcoming');
const tasks = ref([]),
  plans = ref([]),
  issue = ref(null);
function showIssue(value) {
  issue.value = value;
}
const loading = ref(false),
  error = ref(''),
  planLoading = ref(false);
const plansError = ref(''),
  plansLoading = ref(false),
  inboxUnread = ref(0);
const allLoadedTo = ref(0),
  moreLoading = ref(false),
  moreError = ref('');
const hasMore = computed(
  () =>
    props.source === 'company' &&
    view.value === 'all' &&
    listLoaded.value &&
    allLoadedTo.value > 0 &&
    allLoadedTo.value < TASK_ALL_MAX_DAYS
);
const listLoaded = ref(false);
const taskRows = new Map();
const plansLoaded = ref(false);
const selectedTask = ref(null),
  selectedPlan = ref(null),
  planDetailError = ref(''),
  returnPlan = ref(null),
  content = ref(null),
  navigation = ref({ title: '', canBack: false });
const selectedTaskId = computed(() => selectedTask.value?.taskId || selectedTask.value?.id || '');
const planControls = createPlanManagement({
  createState: reactive,
  readContext: () => ({
    active: props.open && pageVisible,
    source: props.source,
    scope: getAgentStorageScope(),
    key: selectedTaskId.value || selectedPlan.value?.planId || view.value,
    plans: selectedPlan.value
      ? [
          ...plans.value.filter((plan) => plan.planId !== selectedPlan.value.planId),
          selectedPlan.value,
        ]
      : plans.value,
  }),
  updatePlan: replacePlan,
  api: { setStatus: setTaskPlanStatus, getPlan: getTaskPlan, cancelPlan: cancelTaskPlan },
  confirm: (dialog) =>
    new Promise((resolve) =>
      uni.showModal({
        ...dialog,
        confirmColor: dialog.destructive ? AGENT_COLORS.error : AGENT_COLORS.accentDeep,
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false),
      })
    ),
  notify: (title) => uni.showToast({ title, icon: 'none' }),
  changed: (operation) => {
    emit('changed');
    if (operation === 'pause-all') void loadPlans(true);
  },
});
const operationError = toRef(planControls.state, 'error');
const planSwitchRevision = toRef(planControls.state, 'revision');
const planBusy = computed(() => planLoading.value || planControls.state.busy);
const stackedView = computed(() => props.source === 'company' && view.value === 'inbox');
const sheetTitle = computed(() =>
  selectedTask.value
    ? '任务详情'
    : selectedPlan.value
      ? '周期任务'
      : props.source === 'company'
        ? '任务安排'
        : '我的安排'
);
const sheetSubtitle = computed(() => {
  const agent = props.source === 'company' ? '公司 Agent' : '办公室 Agent';
  if (!selectedTask.value) return agent;
  const at = taskTimeValue(selectedTask.value, view.value);
  if (!Number.isFinite(Date.parse(at))) return agent;
  const d = new Date(Date.parse(at) + 8 * 3600000).toISOString().slice(0, 10);
  return `${agent} · ${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
});
const visibleRows = computed(() => (view.value === 'plans' ? plans.value : tasks.value));
const agenda = computed(() => agendaGroups(tasks.value, taskToday(), 10));
const agendaHasDays = computed(() => agenda.value.days.some((day) => day.rows.length));
const pausablePlans = computed(() =>
  plans.value.filter((plan) => plan?.status === 'enabled' && plan.canPause)
);
const enabledPlansCount = computed(() => plans.value.filter((plan) => planIsEnabled(plan)).length);
const listSummary = computed(() =>
  view.value === 'upcoming'
    ? '未来 30 天'
    : view.value === 'results'
      ? '最近 30 天'
      : view.value === 'all'
        ? '任务安排'
        : '周期任务'
);
const emptyText = computed(() =>
  view.value === 'upcoming'
    ? '未来 30 天没有待执行安排'
    : view.value === 'results'
      ? '最近 30 天没有执行结果'
      : view.value === 'all'
        ? '暂无任务安排'
        : '暂无周期任务'
);
function dayHead(date) {
  const today = taskToday();
  return date === today
    ? `今天 · ${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`
    : date === shiftDate(today, 1)
      ? `明天 · ${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`
      : `周${WEEKDAYS[new Date(`${date}T00:00:00+08:00`).getDay()]} · ${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
}
function rowClock(task) {
  const at = taskTimeValue(task, view.value);
  return Number.isFinite(Date.parse(at))
    ? new Date(Date.parse(at) + 8 * 3600000).toISOString().slice(11, 16)
    : '—';
}
function agendaSubtitle(task) {
  const requirements = taskRequirementsText(task);
  return (
    requirements || (task.repeat || task.occurrence ? repeatText(task.repeat) || '按周期执行' : '')
  );
}
let requestId = 0,
  planRequest = 0,
  plansRequest = 0,
  unreadRequest = 0,
  moreRequest = 0,
  loadedScope = '',
  pageVisible = true;

function resetPlanSwitch() {
  planControls.invalidate();
}
function resetIdentity() {
  issue.value = null;
  operationError.value = '';
  ++plansRequest;
  ++moreRequest;
  tasks.value = [];
  plans.value = [];
  taskRows.clear();
  plansLoaded.value = false;
  allLoadedTo.value = 0;
  moreLoading.value = false;
  moreError.value = '';
  listLoaded.value = false;
  selectedTask.value = null;
  selectedPlan.value = null;
  returnPlan.value = null;
  navigation.value = { title: '', canBack: false };
  planLoading.value = false;
  plansLoading.value = false;
  plansError.value = '';
  inboxUnread.value = 0;
  resetPlanSwitch();
}
onHide(() => {
  pageVisible = false;
  ++requestId;
  ++planRequest;
  ++plansRequest;
  ++moreRequest;
  loading.value = false;
  planLoading.value = false;
  plansLoading.value = false;
  moreLoading.value = false;
  resetPlanSwitch();
});
onShow(() => {
  pageVisible = true;
  if (props.open) void load(false);
});

function taskKey(task) {
  return task.taskId || task.id || task.occurrence?.id || task.label;
}
function taskTimeValue(task, kind) {
  if (kind === 'results')
    return (
      task.reportAt ||
      task.interval?.endsAt ||
      task.phases?.at(-1)?.endedAt ||
      task.phases?.at(-1)?.at ||
      task.createdAt
    );
  return task.interval?.startsAt || task.phases?.[0]?.at || task.createdAt;
}
const taskTone = taskStatusTone;
const planIsEnabled = (plan) => planPresentation(plan).enabled;
const planNextTime = (plan) => planPresentation(plan).nextAt;
const planNextLabel = (plan) => planPresentation(plan).nextLabel;
function planNextLine(plan) {
  const presentation = planPresentation(plan);
  return (
    presentation.nextNote ||
    (presentation.nextAt ? `下次：${taskTime(presentation.nextAt)}` : '暂无下一次执行')
  );
}
const planStatus = (plan) => planPresentation(plan).statusText;
const planCanToggle = (plan) => planPresentation(plan).canToggle;
const planAccessSummary = (plan) => planPresentation(plan).accessSummary;
function explainPlanAccess(plan) {
  if (!plan || ['ended', 'deleted'].includes(plan.status)) return;
  uni.showToast({ title: '需使用创建者账号，且当前范围覆盖全部设备才能管理', icon: 'none' });
}
function replacePlan(next) {
  if (!next?.planId) return;
  plans.value = plans.value.map((plan) => (plan.planId === next.planId ? next : plan));
  if (selectedPlan.value?.planId === next.planId) selectedPlan.value = next;
}
function togglePlanStatus(plan, enabled) {
  if (!planLoading.value) return planControls.toggle(plan, enabled);
}
function pauseAllPlans() {
  if (!planLoading.value) return planControls.pauseAll();
}
function selectTaskRows(values, kind) {
  const rows = Array.isArray(values) ? values : [];
  return rows
    .filter(
      (task) =>
        kind === 'all' ||
        (kind === 'upcoming'
          ? ['scheduled', 'executing', 'pending'].includes(task.status)
          : taskSettled(task) || Boolean(task.hasReport))
    )
    .sort((a, b) => {
      const difference =
        Date.parse(taskTimeValue(a, kind) || '') - Date.parse(taskTimeValue(b, kind) || '');
      return kind === 'results' ? -difference : difference;
    });
}

async function loadPlans(force = true) {
  if (!props.open || !pageVisible) return;
  const current = ++plansRequest;
  let scope = '';
  try {
    scope = getAgentStorageScope();
    const source = props.source;
    if (scope !== loadedScope) return;
    const saved = peekAgentPlans({ source });
    if (saved?.plans) {
      plans.value = saved.plans;
      plansLoaded.value = true;
      plansError.value = '';
    }
    plansLoading.value = true;
    plansError.value = '';
    const result = await readAgentPlans({ source, force });
    if (
      current === plansRequest &&
      pageVisible &&
      props.open &&
      source === props.source &&
      scope === getAgentStorageScope()
    ) {
      plans.value = Array.isArray(result?.plans) ? result.plans : [];
      plansLoaded.value = true;
      plansError.value = '';
    }
  } catch (cause) {
    if (current === plansRequest && props.open)
      plansError.value = cause.message || '周期任务暂不可用';
  } finally {
    if (current === plansRequest) plansLoading.value = false;
  }
}

async function refreshUnread(force = false) {
  if (props.source !== 'company' || !props.open) return;
  const current = ++unreadRequest;
  try {
    const scope = getAgentStorageScope();
    const result = await readAgentNotifications({ source: 'company', limit: 1, force });
    if (current === unreadRequest && props.open && scope === getAgentStorageScope())
      inboxUnread.value = Number(result?.unreadCount) || 0;
  } catch {
    /* 未读角标失败不阻塞列表 */
  }
}

async function load(force = true) {
  if (!props.open || !pageVisible) return;
  if (view.value === 'calendar') {
    calendar.value?.refresh();
    return;
  }
  if (view.value === 'inbox') {
    inbox.value?.refresh();
    return;
  }
  const current = ++requestId,
    kind = view.value;
  loading.value = true;
  error.value = '';
  let scope = '';
  try {
    scope = getAgentStorageScope();
    const source = props.source;
    if (scope !== loadedScope) {
      resetIdentity();
      loadedScope = scope;
    }
    tasks.value = taskRows.get(kind) || [];
    listLoaded.value = kind === 'plans' ? plansLoaded.value : taskRows.has(kind);
    if (kind === 'plans') {
      await loadPlans(force);
      if (current === requestId && view.value === 'plans') {
        listLoaded.value = plansLoaded.value;
        error.value = plansError.value;
      }
      return;
    }
    if (kind === 'all' && props.source === 'company') void loadPlans(force);
    const range = taskListRange(kind);
    // 同身份快照先落位：重新打开不再空等 Runtime，随后按同一缓存口径对齐。
    const saved = peekAgentTasks({ source, ...range });
    if (saved?.tasks?.length) {
      tasks.value = selectTaskRows(saved.tasks, kind);
      taskRows.set(kind, tasks.value);
      listLoaded.value = true;
      loading.value = false;
      if (kind === 'all') {
        allLoadedTo.value = TASK_ALL_CHUNK_DAYS;
        moreError.value = '';
      }
    }
    const result = await readAgentTasks({ source, ...range, force });
    if (
      current === requestId &&
      pageVisible &&
      props.open &&
      view.value === kind &&
      source === props.source &&
      scope === getAgentStorageScope()
    ) {
      tasks.value = selectTaskRows(result?.tasks, kind);
      taskRows.set(kind, tasks.value);
      listLoaded.value = true;
      if (kind === 'all') {
        allLoadedTo.value = TASK_ALL_CHUNK_DAYS;
        moreError.value = '';
      }
    }
  } catch (cause) {
    if (current === requestId && props.open && view.value === kind) {
      let currentScope = '';
      try {
        currentScope = getAgentStorageScope();
      } catch {
        /* 失效身份不得保留旧列表 */
      }
      if (cause.data || !scope || scope !== currentScope) resetIdentity();
      error.value = cause.message || '安排暂不可用';
    }
  } finally {
    if (current === requestId) loading.value = false;
  }
}
async function loadMore() {
  if (view.value !== 'all' || moreLoading.value || !hasMore.value || !props.open || !pageVisible)
    return;
  const current = ++moreRequest;
  moreLoading.value = true;
  moreError.value = '';
  try {
    const scope = getAgentStorageScope(),
      source = props.source;
    const today = taskToday();
    const from = `${shiftDate(today, allLoadedTo.value)}T00:00:00+08:00`;
    const to = `${shiftDate(today, Math.min(allLoadedTo.value + TASK_ALL_CHUNK_DAYS, TASK_ALL_MAX_DAYS))}T00:00:00+08:00`;
    const result = await readAgentTasks({ source, from, to });
    if (
      current !== moreRequest ||
      !pageVisible ||
      !props.open ||
      view.value !== 'all' ||
      source !== props.source ||
      scope !== getAgentStorageScope()
    )
      return;
    const seen = new Set(tasks.value.map(taskKey));
    tasks.value = [
      ...tasks.value,
      ...(result?.tasks || []).filter((task) => !seen.has(taskKey(task))),
    ];
    taskRows.set('all', tasks.value);
    allLoadedTo.value = Math.min(allLoadedTo.value + TASK_ALL_CHUNK_DAYS, TASK_ALL_MAX_DAYS);
  } catch (cause) {
    if (current === moreRequest) moreError.value = cause.message || '加载失败';
  } finally {
    if (current === moreRequest) moreLoading.value = false;
  }
}
function openTask(task) {
  if (!taskKey(task)) return;
  selectedTask.value = props.source === 'company' ? { id: taskKey(task) } : task;
  selectedPlan.value = null;
}
async function openPlan(plan) {
  resetPlanSwitch();
  const current = ++planRequest,
    source = props.source,
    scope = getAgentStorageScope();
  selectedPlan.value = plan;
  selectedTask.value = null;
  planDetailError.value = '';
  returnPlan.value = null;
  planLoading.value = true;
  try {
    const result = await getTaskPlan(plan.planId, source);
    if (
      current === planRequest &&
      pageVisible &&
      props.open &&
      scope === getAgentStorageScope() &&
      props.source === source &&
      selectedPlan.value?.planId === plan.planId
    ) {
      if (!result.plan) throw new Error('计划不存在或已无权查看');
      selectedPlan.value = result.plan;
    }
  } catch (cause) {
    if (current === planRequest && props.open) {
      planDetailError.value = cause.message || '周期任务读取失败，请刷新后重试';
      uni.showToast({ title: planDetailError.value, icon: 'none' });
    }
  } finally {
    if (current === planRequest) planLoading.value = false;
  }
}
function openLatestReport() {
  const task = selectedPlan.value?.latestTask;
  if (!task?.id && !task?.taskId) return;
  returnPlan.value = selectedPlan.value;
  openTask(task);
}
function backToList() {
  ++planRequest;
  planLoading.value = false;
  resetPlanSwitch();
  navigation.value = { title: '', canBack: false };
  if (returnPlan.value) {
    selectedPlan.value = returnPlan.value;
    returnPlan.value = null;
    selectedTask.value = null;
    return;
  }
  selectedTask.value = null;
  selectedPlan.value = null;
}
function goBack() {
  if (issue.value) {
    issue.value = null;
    return;
  }
  if (view.value === 'inbox' && inbox.value?.back()) return;
  if (content.value?.back()) return;
  if (selectedTask.value || selectedPlan.value || !stackedView.value) {
    backToList();
    return;
  }
  view.value = 'all';
}
function nativeBack() {
  if (issue.value) {
    issue.value = null;
    return;
  }
  if (view.value === 'inbox' && inbox.value?.back()) return;
  if (content.value?.back()) return;
  if (selectedTask.value || selectedPlan.value) {
    backToList();
    return;
  }
  if (stackedView.value) {
    view.value = 'all';
    return;
  }
  closeSheet();
}
function closeSheet() {
  issue.value = null;
  operationError.value = '';
  ++planRequest;
  planLoading.value = false;
  resetPlanSwitch();
  selectedTask.value = null;
  selectedPlan.value = null;
  planDetailError.value = '';
  returnPlan.value = null;
  navigation.value = { title: '', canBack: false };
  emit('close');
}
function onTaskCancelled() {
  emit('changed');
  returnPlan.value = null;
  selectedPlan.value = null;
  selectedTask.value = null;
  navigation.value = { title: '', canBack: false };
  void load();
}
async function cancelWholePlan(scopeType) {
  const plan = selectedPlan.value;
  if (planLoading.value || !plan?.canManage) return;
  if (
    await planControls.cancel(plan, {
      scope: scopeType,
      date: scopeType === 'occurrence' ? plan.nextDate : undefined,
    })
  ) {
    backToList();
    emit('changed');
    void load();
  }
}
function referencePlan() {
  if (!selectedPlan.value?.planId) return;
  emit('reference', {
    type: 'task_plan',
    planId: selectedPlan.value.planId,
    label: selectedPlan.value.label || '',
  });
}

watch(
  () => props.open,
  (open, previous) => {
    if (open && !previous) {
      try {
        const scope = getAgentStorageScope();
        if (scope !== loadedScope) {
          resetIdentity();
          loadedScope = scope;
        }
      } catch {
        resetIdentity();
      }
      ++planRequest;
      planLoading.value = false;
      selectedTask.value = null;
      selectedPlan.value = null;
      returnPlan.value = null;
      navigation.value = { title: '', canBack: false };
      inboxNavigation.value = { title: '', canBack: false };
      const initial = props.initialView === 'schedule' ? 'all' : props.initialView;
      view.value = props.source === 'company' ? initial || 'all' : 'upcoming';
      selectedDate.value = props.date || taskToday();
      void refreshUnread();
      if (props.initialTask) openTask(props.initialTask);
    }
  },
  { immediate: true }
);
watch(
  () => props.refreshKey,
  () => {
    if (props.open) void load();
  }
);
watch(
  () => props.source,
  () => {
    resetIdentity();
  }
);
watch(
  () => [props.open, props.source, view.value],
  ([isOpen, source, currentView], previous) => {
    if (currentView !== 'inbox') inboxNavigation.value = { title: '', canBack: false };
    if (isOpen) void load(Boolean(previous && previous[1] !== source));
    else {
      ++requestId;
      loading.value = false;
      planLoading.value = false;
      resetPlanSwitch();
      navigation.value = { title: '', canBack: false };
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
@import '../../styles/tokens';
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
.arrangements-content,
.list-pane,
.detail-pane {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.view-switch {
  flex-shrink: 0;
  padding: 4px 18px 8px;
}
.arrangements-scroll,
.detail-scroll {
  height: 0;
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 0 18px 14px;
}
.list-summary {
  display: flex;
  justify-content: space-between;
  padding: 7px 2px 10px;
  border-bottom: 1px solid $agent-color-line;
  color: $agent-color-text-muted;
  font-size: 11px;
}
.summary-side {
  display: flex;
  align-items: center;
  gap: 10px;
}
.plans-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 2px 4px;
}
.plans-title {
  color: $agent-color-text-primary;
  font-size: 15px;
  font-weight: 600;
}
.plans-pause-all {
  margin: 0;
  padding: 0;
  color: $agent-color-accent;
  font-size: 11px;
}
.plans-pause-all[disabled] {
  opacity: 0.55;
}
.plan-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 14px;
  border: 1px solid $agent-color-line;
  border-radius: 14px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  box-sizing: border-box;
  text-align: left;
}
.plan-card:active {
  background: $agent-color-surface-page;
}
.plan-main {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 11px;
  text-align: left;
}
.plan-next {
  display: block;
  margin-top: 1px;
  color: $agent-color-text-muted;
  font-size: 11px;
  line-height: 1.45;
}
.plans-foot {
  display: block;
  padding: 14px 0 4px;
  text-align: center;
  color: $agent-color-text-faint;
  font-size: 11px;
}
.plan-switch {
  flex-shrink: 0;
}
.plan-switch-wrap {
  flex-shrink: 0;
  min-width: 52px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.plan-switch-wrap--disabled {
  opacity: 0.72;
}
.row-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 9px;
}
.row-title {
  min-width: 0;
  white-space: normal;
  word-break: break-word;
  color: $agent-color-text-secondary;
  font-size: 13px;
  font-weight: 600;
}
.plan-access-tag {
  flex-shrink: 0;
  color: $agent-color-warning-deep;
  font-size: 10px;
}
.tone-active,
.tone-ok {
  color: $agent-color-success;
}
.tone-muted {
  color: $agent-color-text-muted;
}
.tone-warn {
  color: $agent-color-warning;
}
.tone-fail {
  color: $agent-color-error;
}
.row-subtitle {
  color: $agent-color-text-muted;
  font-size: 11px;
  line-height: 1.45;
}
.status-mark {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: $agent-color-badge;
  box-shadow: 0 0 0 3px $agent-color-warning-faint;
}
.status-mark--paused {
  background: $agent-color-text-faint;
  box-shadow: 0 0 0 3px $agent-color-tint;
}
.state-message {
  padding: 48px 16px;
  text-align: center;
  color: $agent-color-text-muted;
  font-size: 13px;
}
.state-message text {
  display: block;
  overflow-wrap: anywhere;
}
.state-message button,
.list-footer button {
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
.detail-error {
  display: block;
  flex-shrink: 0;
  padding: 8px 18px 0;
  color: $agent-color-error;
  font-size: 11px;
  text-align: center;
}
.plan-strip {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 8px;
  padding: 10px 12px;
  border-radius: $agent-radius-medium;
  background: $agent-color-tint;
  text-align: left;
}
.plan-strip::after {
  border: 0;
}
.plan-strip--pressed {
  background: $agent-color-line;
}
.strip-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: $agent-color-line;
}
.strip-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.strip-title {
  color: $agent-color-text-secondary;
  font-size: 13px;
  font-weight: 600;
}
.strip-meta {
  color: $agent-color-text-muted;
  font-size: 11px;
}
.strip-meta--fail {
  color: $agent-color-error;
}
.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 2px 2px;
}
.day-title {
  color: $agent-color-text-primary;
  font-size: 15px;
  font-weight: 600;
}
.day-count {
  color: $agent-color-text-muted;
  font-size: 11px;
}
.day-empty {
  display: block;
  padding: 14px 0;
  border-bottom: 1px solid $agent-color-line;
  color: $agent-color-text-faint;
  font-size: 11px;
}
.task-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 14px;
  border: 1px solid $agent-color-line;
  border-radius: 14px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  box-sizing: border-box;
  text-align: left;
}
.task-card:active {
  background: $agent-color-surface-page;
}
.card-clock {
  width: 46px;
  flex-shrink: 0;
  align-self: flex-start;
  padding-top: 2px;
  color: $agent-color-accent-deep;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.card-clock--later {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: $agent-font-size-compact;
  color: $agent-color-text-secondary;
  font-weight: 400;
}
.card-clock--later text:first-child {
  font-weight: 600;
}
.task-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-top: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: $agent-color-tint;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.task-chip.chip-ok {
  background: $agent-color-success-faint;
  color: $agent-color-success;
}
.task-chip.chip-active {
  background: $agent-color-accent-faint;
  color: $agent-color-accent-deep;
}
.task-chip.chip-warn {
  background: $agent-color-warning-faint;
  color: $agent-color-warning-deep;
}
.task-chip.chip-fail {
  background: $agent-color-error-faint;
  color: $agent-color-error;
}
.inbox-entry {
  position: relative;
  flex-shrink: 0;
}
.inbox-badge {
  position: absolute;
  top: -4px;
  right: -3px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $agent-color-badge;
  color: #fff;
  font-size: 9px;
  line-height: 1;
  pointer-events: none;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  flex-shrink: 0;
}
.back-button,
.refresh-button {
  width: 32px;
  height: 32px;
  margin-right: 8px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $agent-color-tint;
}
.header-actions .refresh-button {
  margin-right: 0;
}
.refresh-button[disabled] {
  opacity: 0.5;
}
.spinning {
  animation: arrangements-spin 900ms linear infinite;
}
.detail-scroll {
  padding-top: 4px;
}
.plan-summary {
  padding: 12px 3px 18px;
}
.summary-heading {
  display: flex;
  align-items: center;
  gap: 11px;
}
.plan-label {
  min-width: 0;
  color: $agent-color-text-primary;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.summary-status {
  display: block;
  margin: 8px 0 17px 18px;
  font-size: 11px;
}
.summary-line {
  min-height: 38px;
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border-top: 1px solid $agent-color-line;
  font-size: $agent-font-size-compact;
}
.summary-line text:first-child {
  color: $agent-color-text-muted;
}
.summary-line text:last-child {
  color: $agent-color-text-secondary;
  overflow-wrap: anywhere;
  text-align: right;
}
.summary-note {
  display: block;
  padding: 11px 0 3px;
  color: $agent-color-text-muted;
  font-size: 11px;
}
.pause-reason {
  display: block;
  padding-top: 4px;
  color: $agent-color-warning;
  font-size: 11px;
}
.plan-toggle-row {
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid $agent-color-line;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.plan-toggle-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.plan-toggle-title {
  color: $agent-color-text-secondary;
  font-size: $agent-font-size-compact;
  font-weight: 600;
}
.plan-toggle-note {
  color: $agent-color-text-muted;
  font-size: 10px;
}
.latest-result {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid $agent-color-line;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.latest-result-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.latest-result-title {
  color: $agent-color-text-secondary;
  font-size: 11px;
  font-weight: 700;
}
.latest-result-link {
  min-height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  color: $agent-color-accent;
  font-size: 11px;
}
.task-content-host {
  height: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.detail-actions {
  flex-shrink: 0;
  padding: 10px 18px 12px;
  border-top: 1px solid $agent-color-line;
  background: $agent-color-surface-page;
}
.reference-button {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $agent-space-small;
  border-radius: 6px;
  background: linear-gradient(180deg, $agent-color-accent, $agent-color-accent-deep);
  color: #fff;
  font-size: $agent-font-size-compact;
  font-weight: 600;
  box-shadow:
    0 2px 5px rgba(var(--agent-shadow-rgb), 0.09),
    inset 0 1px 0 #ffffff30;
}
.cancel-actions {
  display: flex;
  gap: $agent-space-small;
  margin-top: 10px;
}
.cancel-button {
  flex: 1;
  min-width: 0;
  margin: 0;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $agent-color-error-faint;
  border-radius: 6px;
  background: #fff;
  color: $agent-color-error;
  font-size: $agent-font-size-compact;
}
.cancel-button[disabled] {
  opacity: 0.55;
}
.reference-button:active {
  background: $agent-color-accent-deep;
}
@keyframes arrangements-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
.create-task {
  min-height: 44px;
  margin: 6px 18px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $agent-space-small;
  color: $agent-color-accent;
  background: $agent-color-accent-faint;
  border-radius: 8px;
  font-size: $agent-font-size-compact;
  flex-shrink: 0;
}
</style>
