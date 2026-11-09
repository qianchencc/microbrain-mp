<template>
  <view class="conv-root">
    <view class="conversation-shell">
      <scroll-view
        class="conversation"
        scroll-y
        enhanced
        :show-scrollbar="false"
        :scroll-into-view="scrollIntoView"
        :scroll-top="restoredScrollTop"
        @scroll="handleScroll"
        @scrolltolower="nearBottom = true"
      >
        <view
          class="conversation__inner"
          :class="{ clearing }"
        >
          <view
            v-if="!isCompany && regionsError"
            class="region-notice"
            ><text>区域暂不可用</text><button @tap="reloadRegions">重新读取</button></view
          >
          <view
            v-if="!conversationId && !errorMessage"
            class="welcome connecting"
            ><text>{{ isCompany ? '公司 Agent' : '办公室 Agent' }}</text
            ><view>正在恢复对话…</view></view
          >
          <view
            v-else-if="!turns.length && isCompany"
            class="welcome"
            ><text>公司 Agent</text
            ><view>查询公司环境、能耗和告警，安排定时简报或智慧空调任务。</view>
            <view class="welcome-sugg"
              ><button
                v-for="s in companySuggestions"
                :key="s"
                class="sugg-chip"
                hover-class="sugg-chip--pressed"
                @tap="prefill(s)"
                >{{ s }}</button
              ></view
            ></view
          >
          <view
            v-else-if="!turns.length"
            class="welcome"
            ><text>办公室 Agent</text><view>告诉我位置、设备和需要的操作。</view></view
          >
          <view
            v-for="(turn, turnIndex) in turns"
            :key="turn.id"
            class="turn"
          >
            <view
              v-for="change in (!isCompany &&
                regionChanges.filter((change) => change.before === turnIndex)) ||
              []"
              :key="change.id"
              class="region-divider"
              >关注区域切换为 {{ change.name }}</view
            >
            <view
              v-if="
                !isCompany &&
                !regionChanges.some((change) => change.before === turnIndex) &&
                turn.focusRegion &&
                turn.focusRegion.id !== turns[turnIndex - 1]?.focusRegion?.id
              "
              class="region-divider"
              >关注区域切换为 {{ turn.focusRegion.name }}</view
            >
            <view
              v-if="turn.reference"
              class="turn-reference"
              ><text
                >{{ referenceTitle(turn.reference) }} ·
                {{ turn.reference.label || turn.reference.content || '原记录' }}</text
              ></view
            >
            <view class="user-row"
              ><UserMessage
                class="um-host"
                :content="turn.content"
                :recoverable="canRecoverTurn(turn, turnIndex === turns.length - 1)"
                :disabled="busy"
                :editing="editingTurn === turn"
                @retry="retryTurn(turn)"
                @begin-edit="beginEdit(turn)"
            /></view>
            <AgentReplySurface
              :turn="turn"
              :busy="busy"
              :confirming-task-id="confirmingTaskId"
              :source="source"
              :agent-name="isCompany ? '公司 Agent' : '办公室 Agent'"
              @select-alert="openSafetyEvent"
              @browse-alerts="openSafetyHistory"
              @toggle-trace="turn.traceOpen = !turn.traceOpen"
              @select="selectDraft(turn, $event)"
              @confirm="confirmDraft(turn)"
              @cancel="cancelDraft(turn)"
              @revalidate="revalidateDraft(turn)"
              @updated="Object.assign(turn.draft, $event)"
              @editing="mutating = $event"
              @retry-answer="retryAnswer(turn)"
              @configure="openSheetEditor(turn, $event)"
              @browse="openSheetBrowser(turn)"
              @confirm-task="confirmTaskProposal($event)"
              @discard-task="discardTaskProposal($event)"
              @open-task="openTaskRegion($event)"
              @open-report="openReport"
              @issue="issue = $event"
            />
          </view>
          <view
            v-for="change in (!isCompany &&
              regionChanges.filter((change) => change.before === turns.length)) ||
            []"
            :key="change.id"
            class="region-divider"
            >关注区域切换为 {{ change.name }}</view
          >
          <view
            v-if="recoveryMessage"
            class="region-notice"
            ><text>{{ recoveryMessage }}</text></view
          >
          <view
            v-if="errorMessage"
            class="error"
            ><TaskErrorNotice
              :message="errorMessage"
              summary="这次暂未完成"
              @details="issue = $event"
            /><button
              class="trace-toggle"
              @click="restore"
              >重新连接</button
            ></view
          >
          <view
            id="agent-bottom"
            class="anchor"
          />
        </view>
      </scroll-view>
      <view
        v-if="clearing"
        class="clearing-hint"
        ><text>正在清除会话…</text></view
      >
    </view>
    <view
      class="composer-shell"
      :style="composerShellStyle"
      ><AgentComposer
        ref="composer"
        v-model="input"
        :running="isRunning || taskConfirmationRunning"
        :disabled="!conversationReady || !conversationId || mutating || hasExecution"
        :editing="Boolean(editingTurn)"
        :reference="editingTurn ? editingTurn.reference : composerReference"
        @remove-reference="composerReference = null"
        :placeholder="isCompany ? '查询设备或调整智慧空调' : undefined"
        @send="onComposerSend"
        @voice="sendMessage"
        @stop="stopRun"
        @keyboard="onComposerKeyboard"
        @cancel-edit="cancelEdit"
    /></view>
    <DraftSheetLayer
      v-if="sheetMounted"
      :source="source"
      :draft="sheetDraft"
      :result="sheetTurn?.result ?? null"
      :browser="sheetBrowser"
      :current-action-id="sheetActionId"
      :open-request="sheetOpenRequest"
      :busy="busy"
      :baseline="sheetBaseline"
      :error="sheetError"
      :settle-selection="settleSelection"
      @reconnect="reconnectSheet"
      @close="closeSheet"
      @select="sheetTurn && selectDraft(sheetTurn, $event)"
      @confirm="sheetTurn && confirmDraft(sheetTurn)"
      @restore="sheetTurn && restoreDraft(sheetTurn)"
      @updated="sheetTurn && Object.assign(sheetTurn.draft, $event)"
      @editing="mutating = $event"
      @revalidate="sheetTurn && revalidateDraft(sheetTurn)"
    />
    <DeviceSheet
      v-if="eventMounted"
      :open="eventOpen"
      :back="eventBack"
      tall
      compact-header
      :title="selectedEvent ? '安全台账详情' : '安全事件台账'"
      @close="eventOpen = false"
    >
      <template #header-left
        ><button
          v-if="selectedEvent"
          class="event-back"
          aria-label="返回安全台账"
          @tap="selectedEvent = null"
          ><uni-icons
            type="back"
            size="16"
            color="var(--agent-text-secondary)" /></button
      ></template>
      <SafetyHistoryList
        class="event-host"
        :style="{ display: selectedEvent ? 'none' : 'flex' }"
        :active="eventOpen && !selectedEvent"
        @select="openSafetyEvent"
      />
      <SafetyEventDetail
        v-if="selectedEvent"
        class="event-host"
        :snapshot="selectedEvent"
        :active="eventOpen"
        @reference="referenceEvent"
      />
    </DeviceSheet>
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
    <TaskListSheet
      v-if="tasksMounted"
      :open="tasksOpen"
      :source="source"
      :refresh-key="taskRevision"
      @close="tasksOpen = false"
      @reference="referenceTask"
      @changed="tasksChanged"
      @create="
        tasksOpen = false;
        prefill('帮我安排一个任务');
      "
    />
    <TaskInboxSheet
      v-if="inboxMounted"
      @reference="referenceTask"
      :open="inboxOpen"
      :source="source"
      @close="inboxOpen = false"
      @unread-count="setInboxUnreadCount"
    />
    <TaskDetailSheet
      v-if="companyTaskMounted"
      @reference="referenceTask"
      :open="Boolean(companyTaskId || companyPlanId)"
      :task-id="companyTaskId"
      :plan-id="companyPlanId"
      :source="source"
      @close="closeCompanyTask"
      @changed="tasksChanged"
    />
    <DeviceSheet
      v-if="reportMounted"
      :open="reportOpen"
      :back="reportBack"
      tall
      compact-header
      :title="reportNav.title || reportTitle"
      @close="closeReport"
    >
      <template #header-left
        ><button
          v-if="reportNav.canBack"
          class="event-back"
          aria-label="返回报告"
          @tap="reportPreview?.back()"
          ><uni-icons
            type="back"
            size="16"
            color="var(--agent-text-secondary)" /></button
      ></template>
      <ReportPreviewContent
        v-if="selectedReportId"
        ref="reportPreview"
        class="event-host"
        :report-id="selectedReportId"
        :active="active && reportOpen"
        :source="source"
        @loaded="reportTitle = $event?.title || reportTitle"
        @navigation="reportNav = $event"
        @reference="referenceReport"
      />
    </DeviceSheet>
  </view>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, toRef, watch } from 'vue';
import {
  cancelRun,
  createConversation,
  restoreConversation,
  clearConversation,
  discardTurn,
  streamMessage,
} from '@/apis/agent/conversation';
import {
  confirmTask as confirmScheduledTask,
  discardTask as discardScheduledTask,
  confirmTaskChange,
  discardTaskChange,
  confirmTaskCancellation,
  discardTaskCancellation,
  getTaskPlan,
  getTaskDetail,
  readAgentNotifications,
  readAgentPlans,
  readAgentTasks,
} from '@/apis/agent/tasks';
import {
  cancelAction,
  confirmAction,
  updateSelection,
  retrySummary,
  revalidateAction,
  restoreAction,
} from '@/apis/agent/actions';
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session';
import { agentErrorText, showAgentError } from '@/utils/agent-error';
import { provideReadActivity, useViewReads } from '../../lib/reads.mjs';
import { conversationRecovery } from '@/apis/agent/conversation-view';
import {
  createTurn,
  restoreTurns,
  canRecoverTurn,
  restartTurn,
  mergeTaskDetail,
  createConversationOperations,
} from '../../lib/conversation.mjs';
import {
  preserveComposerDraft,
  takeComposerDraft,
  preserveComposerReference,
  takeComposerReference,
  preserveComposerView,
  takeComposerView,
} from '../../lib/conversation.mjs';
import { createDraftBaseline } from '../../lib/actions.mjs';
import { mergeTaskPlan, taskNavigation, taskListRange } from '../../lib/tasks.mjs';
import { markAgentEntry, createContextDelivery } from '../../lib/conversation.mjs';
import { openAgentMenu } from '../../lib/navigation.mjs';
import DeviceSheet from '../shared/DeviceSheet.vue';
import SafetyEventDetail from '../observations/SafetyEventDetail.vue';
import SafetyHistoryList from '../observations/SafetyHistoryList.vue';
import { referenceTitle } from '../../lib/observations.mjs';
import AgentComposer from './AgentComposer.vue';
import AgentReplySurface from './AgentReplySurface.vue';
import DraftSheetLayer from '../tasks/DraftSheetLayer.vue';
import UserMessage from './UserMessage.vue';
import TaskListSheet from '../tasks/TaskListSheet.vue';
import TaskErrorNotice from '../tasks/TaskErrorNotice.vue';
import TaskIssueDetails from '../tasks/TaskIssueDetails.vue';
import TaskInboxSheet from '../tasks/TaskInboxSheet.vue';
import TaskDetailSheet from '../tasks/TaskDetailSheet.vue';
import ReportPreviewContent from '../shared/ReportPreviewContent.vue';
import {
  focusRegion,
  focusRegionId,
  regionsLoading,
  regionsError,
  loadRegionFocus,
  consumeComposePrefill,
} from '../../lib/region-focus.mjs';
// source: 'office' | 'company'；active: 宿主可见性（页面 onShow / 浮层展开），
// false 等价页面 onHide——保留草稿、停轮询，但不中止在途流（收起≠销毁）。
const props = defineProps({ source: { type: String, default: 'office' }, active: Boolean });
provideReadActivity(() => props.active);
const emit = defineEmits([
  'status',
  'running',
  'connected',
  'inbox-count',
  'error',
  'unread',
  'navigating',
  'tasks-changed',
]);
const openingRegion = ref(false);
watch(openingRegion, (value) => emit('navigating', value));
function navigateRegion(url) {
  if (openingRegion.value) return;
  openingRegion.value = true;
  uni.navigateTo({
    url,
    fail: () => {
      openingRegion.value = false;
      uni.showToast({ title: '未能打开工作台，请重试', icon: 'none' });
    },
  });
}
function openRegion(region) {
  navigateRegion('/pages/agent/region?regionId=' + encodeURIComponent(region.id));
}
const conversationId = ref('');
const isCompany = computed(() => props.source === 'company');
const contextSourceScope = () => `${getAgentStorageScope()}:${props.source}`;
// 空会话推荐入口：仅公司 Agent 欢迎区，点击 prefill 进输入框（同工作台「新建任务」），
// 首个 turn 落位后随 welcome 分支一起消失，不占用会话中布局。
const companySuggestions = [
  '统计一下最近能耗情况',
  '帮我看看最近夜间哪个场所耗电异常',
  '帮我设个定时任务',
  '帮我整理一下最近一周的告警并产出报告',
];
const selectedEvent = ref(null),
  eventOpen = ref(false),
  eventMounted = ref(false);
function openSafetyEvent(snapshot) {
  if (!isCompany.value) return;
  selectedEvent.value = snapshot;
  eventMounted.value = true;
  eventOpen.value = true;
}
function openSafetyHistory() {
  if (!isCompany.value) return;
  selectedEvent.value = null;
  eventMounted.value = true;
  eventOpen.value = true;
}
function eventBack() {
  if (!selectedEvent.value) return false;
  selectedEvent.value = null;
  return true;
}
function referenceEvent(reference) {
  eventOpen.value = false;
  composerReference.value = { ...reference };
  composer.value?.focus?.();
}
const tasksOpen = ref(false),
  taskRevision = ref(0);
function tasksChanged() {
  taskRevision.value++;
  emit('tasks-changed');
}
const inboxOpen = ref(false),
  inboxUnreadCount = ref(0);
const companyTaskId = ref(''),
  companyPlanId = ref('');
const tasksMounted = ref(false),
  inboxMounted = ref(false),
  companyTaskMounted = ref(false);
// 即时/检查点报告附件共用同一 DeviceSheet 预览；仅保存 ID，事实由 ReportPreviewContent 按当前授权重读。
const reportMounted = ref(false),
  reportOpen = ref(false),
  selectedReportId = ref('');
const reportTitle = ref('用电报告'),
  reportNav = ref({ canBack: false });
const reportPreview = ref(null);
watch(
  reportOpen,
  (open) => {
    if (open) reportMounted.value = true;
  },
  { flush: 'sync' }
);
function openReport({ reportId, title } = {}) {
  if (!isCompany.value || !props.active) return;
  if (typeof reportId !== 'string' || !reportId) return;
  reportTitle.value = title || '用电报告';
  reportNav.value = { canBack: false };
  selectedReportId.value = reportId;
  reportOpen.value = true;
}
function reportBack() {
  if (reportPreview.value?.back() === true) return;
  closeReport();
}
function closeReport() {
  reportOpen.value = false;
  selectedReportId.value = '';
  reportNav.value = { canBack: false };
}
function referenceReport(reference) {
  closeReport();
  composerReference.value = { ...reference };
  composer.value?.focus?.();
}
watch(
  tasksOpen,
  (open) => {
    if (open) tasksMounted.value = true;
  },
  { flush: 'sync' }
);
watch(
  inboxOpen,
  (open) => {
    if (open) inboxMounted.value = true;
  },
  { flush: 'sync' }
);
watch(
  () => Boolean(companyTaskId.value || companyPlanId.value),
  (open) => {
    if (open) companyTaskMounted.value = true;
  },
  { flush: 'sync' }
);
function referenceTask(reference) {
  composerReference.value = { ...reference };
  inboxOpen.value = false;
  tasksOpen.value = false;
  closeCompanyTask();
  composer.value?.focus?.();
}
function openInbox() {
  inboxOpen.value = true;
}
function closeCompanyTask() {
  companyTaskId.value = '';
  companyPlanId.value = '';
}
function setInboxUnreadCount(value) {
  inboxUnreadCount.value = Number(value) || 0;
}
async function refreshInboxCount() {
  await viewReads.run(
    'unread',
    (options) => readAgentNotifications({ source: props.source, limit: 1 }, options),
    {
      data: (result) => setInboxUnreadCount(result.unreadCount),
      denied: () => setInboxUnreadCount(0),
    }
  );
}
// 预取：进入 Agent 后把通知、任务首屏与周期安排按序读入同身份快照，打开 Sheet 直接落位。
// 顺序执行避免同时压 Runtime 的授权读取；同键在途读取由快照合并，不会与用户打开的请求重复。
let prewarmKey = '';
async function prewarmLists() {
  let key = '',
    scope = '';
  try {
    scope = getAgentStorageScope();
    key = `${scope}|${props.source}`;
  } catch {
    return;
  }
  if (prewarmKey === key) return;
  prewarmKey = key;
  const source = props.source,
    firstView = source === 'company' ? 'all' : 'upcoming';
  const outcome = await viewReads.run('prewarm', async (options) => {
    await readAgentNotifications({ source }, options);
    if (!options.isActive()) return;
    await readAgentTasks({ source, ...taskListRange(firstView) }, options);
    if (!options.isActive()) return;
    await readAgentPlans({ source }, options);
  });
  if (outcome.status !== 'value') prewarmKey = '';
}
const draftScope = ref('');
const input = ref('');
const composerReference = ref(null);
const editingTurn = ref(null);
let composerStash = '';
let incomingReference,
  incomingHistoryPrompt,
  incomingContext,
  composerHydrated = false;
watch(
  composerReference,
  (value) => {
    if (draftScope.value) preserveComposerReference(draftScope.value, props.source, value);
  },
  { flush: 'sync' }
);
watch(
  input,
  (value) => {
    if (draftScope.value && !editingTurn.value)
      preserveComposerDraft(draftScope.value, props.source, value);
  },
  { flush: 'sync' }
);
const composer = ref(null);
const turns = ref([]);
const conversationReady = ref(false);
let recoveryTicket = null;
const currentConversationView = () => ({
  id: conversationId.value,
  source: props.source,
  turns: turns.value,
  phase: phase.value,
});
const tasksOf = (turn) => (turn.tasks?.length ? turn.tasks : turn.task ? [turn.task] : []);
const issue = ref(null);
const operations = createConversationOperations({
  createState: reactive,
  read: () => ({
    source: props.source,
    scope: getAgentStorageScope(),
    conversationId: conversationId.value,
    turns: turns.value,
    disposed,
    active: props.active,
    blocked: busy.value,
    taskConfirmationRunning: taskConfirmationRunning.value,
  }),
  api: {
    streamMessage,
    cancelRun,
    updateSelection,
    restoreAction,
    confirmAction,
    cancelAction,
    revalidateAction,
    retrySummary,
    confirmTask: confirmScheduledTask,
    discardTask: discardScheduledTask,
    confirmTaskChange,
    discardTaskChange,
    confirmTaskCancellation,
    discardTaskCancellation,
  },
  effects: {
    changed: schedule,
    follow,
    restore,
    unread: () => emit('unread'),
    tasksChanged,
    rememberDraft: (draft) => draftBaselines.set(draft.draftId, createDraftBaseline(draft)),
    notice: (kind, message, draftId) => {
      if (kind === 'toast') uni.showToast({ title: message, icon: 'none' });
      else if (kind === 'confirmation') {
        // 草稿面板内联只留归并后的短文案，原文不再直渲。
        if (sheetDraftId.value === draftId)
          sheetError.value = agentErrorText(message, { fallback: '操作失败，请重试' });
      } else showAgentError(message, { fallback: '操作失败，请重试' });
    },
  },
});
const errorMessage = toRef(operations.state, 'error');
// 错误发生即 toast 一次；页内错误块只留固定短标签与重试，原文只进「查看原因」。
watch(errorMessage, (value) => {
  if (value) showAgentError(value);
});
// turn.error（run.failed / 回答流失败）同样只 toast 一次；气泡内只留短文案。
let lastTurnError = '';
watch(
  () => turns.value.at(-1)?.error,
  (value) => {
    if (value && value !== lastTurnError) {
      lastTurnError = value;
      showAgentError(value, { fallback: '回答未完成，请重试', timeout: '回答超时，请重试' });
    }
  }
);
const recoveryMessage = toRef(operations.state, 'recovery');
const isRunning = toRef(operations.state, 'running');
const confirmingTaskId = toRef(operations.state, 'confirmingTaskId');
const hasTaskConfirmation = computed(() =>
  turns.value.some((turn) =>
    tasksOf(turn).some((task) => task.confirmation?.status === 'recovering')
  )
);
const creatingTask = computed(() =>
  Boolean(
    confirmingTaskId.value &&
      turns.value.some((turn) =>
        tasksOf(turn).some(
          (task) => task.taskId === confirmingTaskId.value && !task.changeId && !task.cancellationId
        )
      )
  )
);
const taskConfirmationRunning = computed(() => creatingTask.value || hasTaskConfirmation.value);
const phase = ref('');
const mutating = ref(false),
  clearing = ref(false);
const scrollIntoView = ref(''),
  restoredScrollTop = ref(0);
let currentScrollTop = 0,
  readingHydrated = false;
const nearBottom = ref(true);
// 执行中的唯一权威是草案权威状态；总结生成只是答复整理，不是执行——不得据此锁定输入，
// 也不得把回执渲染成「正在执行」。轮询单独保留：总结完成仍需回读收口。
const hasExecution = computed(() => turns.value.some((turn) => turn.draft?.status === 'EXECUTING'));
const hasRunningSummary = computed(() =>
  turns.value.some((turn) => turn.result?.summary?.status === 'running')
);
const busy = computed(
  () =>
    !conversationReady.value ||
    !conversationRecovery.canMutate(recoveryTicket) ||
    isRunning.value ||
    mutating.value ||
    operations.state.busy ||
    hasExecution.value ||
    hasTaskConfirmation.value
);
const statusText = computed(() =>
  !conversationReady.value
    ? '正在恢复对话'
    : clearing.value
      ? '正在清除'
      : busy.value
        ? '正在处理'
        : '服务在线'
);
// 宿主状态播报：页面导航头/浮层面板头、浮标运行态都由这组事件驱动
watch(statusText, (value) => emit('status', value), { immediate: true });
watch(
  () => isRunning.value || taskConfirmationRunning.value,
  (value) => emit('running', value),
  { immediate: true }
);
watch(
  () => Boolean(conversationId.value && conversationReady.value),
  (value) => emit('connected', value),
  { immediate: true }
);
watch(inboxUnreadCount, (value) => emit('inbox-count', value), { immediate: true });
watch(errorMessage, (value) => emit('error', Boolean(value)), { immediate: true });
// 收起期间到达的新内容 → 浮标未读角标（服务端续跑经 restore 整表回读也覆盖）
watch(
  () => turns.value.length,
  (now, before = 0) => {
    if (now > before && !props.active) emit('unread');
  }
);
function clearIdentityView() {
  conversationRecovery.forget(recoveryTicket);
  recoveryTicket = null;
  conversationReady.value = false;
  selectedEvent.value = null;
  eventOpen.value = false;
  closeReport();
  operations.reset();
  conversationId.value = '';
  turns.value = [];
  regionChanges.value = [];
  draftBaselines.clear();
  sheetDraftId.value = '';
  sheetError.value = '';
  isRunning.value = false;
  phase.value = '';
  editingTurn.value = null;
  composerStash = '';
  input.value = '';
  composerReference.value = null;
  incomingContext = null;
  contextDelivery.invalidate();
  composerHydrated = false;
  readingHydrated = false;
  nearBottom.value = true;
  restoredScrollTop.value = 0;
  currentScrollTop = 0;
  inboxOpen.value = false;
  tasksOpen.value = false;
  closeCompanyTask();
  viewReads.invalidate();
  inboxUnreadCount.value = 0;
}
function preserveCurrentComposerDraft() {
  conversationRecovery.retain(recoveryTicket, currentConversationView());
  if (draftScope.value)
    preserveComposerDraft(
      draftScope.value,
      props.source,
      editingTurn.value ? composerStash : input.value
    );
  if (draftScope.value) {
    preserveComposerReference(draftScope.value, props.source, composerReference.value);
    preserveComposerView(draftScope.value, props.source, {
      conversationId: conversationId.value,
      scrollTop: currentScrollTop,
      nearBottom: nearBottom.value,
      edit: editingTurn.value
        ? { turnId: editingTurn.value.id, content: input.value, stash: composerStash }
        : null,
    });
  }
}
const sheetMounted = ref(false),
  sheetError = ref('');
const sheetDraftId = ref(''),
  sheetBrowser = ref(false),
  sheetActionId = ref(''),
  sheetOpenRequest = ref(0);
const sheetTurn = computed(
  () => turns.value.find((turn) => turn.draft?.draftId === sheetDraftId.value) ?? null
);
// 面板跟随轮次上的草案对象本身（含过期态）：过期不再踢掉面板，转只读 + 面板内重新核验；
// 仅当草案被新提案取代（draftId 消失）或轮次被清理时自动关闭。
const sheetDraft = computed(() => sheetTurn.value?.draft ?? null);
// 草案发布时刻的基线（勾选+指令）：面板「还原」按钮据此判断是否出现；权威还原在服务端。
const draftBaselines = new Map();
const sheetBaseline = computed(() =>
  sheetTurn.value?.draft ? (draftBaselines.get(sheetTurn.value.draft.draftId) ?? null) : null
);
function openSheetEditor(turn, action) {
  if (!action || action.kind !== 'ac' || !turn.draft) return;
  sheetMounted.value = true;
  sheetError.value = '';
  sheetDraftId.value = turn.draft.draftId;
  sheetBrowser.value = false;
  sheetActionId.value = action.id;
  sheetOpenRequest.value++;
  uni.hideKeyboard();
}
// 更多设备浏览不受草案状态限制：过期/取消/已完成都可展开（只读）；仅要求草案存在
function openSheetBrowser(turn) {
  if (!turn.draft) return;
  sheetMounted.value = true;
  sheetError.value = '';
  sheetDraftId.value = turn.draft.draftId;
  sheetBrowser.value = true;
  sheetActionId.value = '';
  sheetOpenRequest.value++;
  uni.hideKeyboard();
}
async function reconnectSheet() {
  await restore();
  sheetError.value = agentErrorText(errorMessage.value, { fallback: '操作失败，请重试' });
}
function closeSheet() {
  sheetDraftId.value = '';
}
let pollTimer, expiryTimer, taskPollTimer;
let disposed = false,
  visible = false,
  restoring = false,
  sequence = 0;
// Clearing invalidates snapshots independently of confirmation and transport activity.
let clearEpoch = 0;
// 键盘停靠：adjust-position=false 页面不平移，键盘高度转为 composer-shell 底 padding
//（键盘高 + 8px 缝），对话区 flex 自动收缩；弹起时仅当用户本在底部才跟到底部锚点。
const kbHeight = ref(0),
  kbMs = ref(0);
const composerShellStyle = computed(() => ({
  paddingBottom: kbHeight.value ? `${kbHeight.value + 8}px` : '',
  transitionDuration: `${kbMs.value}ms`,
}));
function onComposerKeyboard({ height, durationMs }) {
  kbHeight.value = height;
  kbMs.value = durationMs;
  if (height) follow();
}
function follow(force = false) {
  if (!force && !nearBottom.value) return;
  scrollIntoView.value = '';
  nextTick(() => {
    if (!disposed) scrollIntoView.value = 'agent-bottom';
  });
}
function handleScroll(event) {
  const top = event.detail.scrollTop || 0;
  if (top < currentScrollTop - 5 || event.detail.deltaY > 5) nearBottom.value = false;
  currentScrollTop = top;
}
function schedule() {
  clearTimeout(pollTimer);
  if (
    visible &&
    !disposed &&
    (hasExecution.value ||
      hasRunningSummary.value ||
      taskConfirmationRunning.value ||
      (isRunning.value && !operations.hasRequest()))
  )
    pollTimer = setTimeout(restore, 1500);
  clearTimeout(taskPollTimer);
  if (
    visible &&
    !disposed &&
    turns.value.some((turn) =>
      tasksOf(turn).some((task) =>
        ['scheduled', 'executing'].includes(String(task.status || '').toLowerCase())
      )
    )
  )
    taskPollTimer = setTimeout(refreshScheduledTasks, 10000);
  clearTimeout(expiryTimer);
  const pending = turns.value.filter((turn) => turn.draft?.status === 'PENDING_CONFIRMATION');
  const pendingTasks = turns.value
    .flatMap((turn) => tasksOf(turn))
    .filter((task) => task.status === 'PENDING_CONFIRMATION');
  const deadline = Math.min(
    ...pending.map((turn) => Date.parse(turn.draft.expiresAt)),
    ...pendingTasks.map((task) => Date.parse(task.expiresAt))
  );
  if (Number.isFinite(deadline))
    expiryTimer = setTimeout(
      () => {
        if (mutating.value || operations.state.busy) return;
        for (const turn of pending)
          if (
            turn.draft.status === 'PENDING_CONFIRMATION' &&
            Date.parse(turn.draft.expiresAt) <= Date.now()
          )
            turn.draft.status = 'EXPIRED';
        for (const task of pendingTasks)
          if (task.status === 'PENDING_CONFIRMATION' && Date.parse(task.expiresAt) <= Date.now())
            task.status = 'EXPIRED';
        schedule();
      },
      Math.max(0, deadline - Date.now())
    );
}
async function refreshScheduledTasks() {
  const active = turns.value
    .flatMap((turn) => tasksOf(turn))
    .filter((task) => ['scheduled', 'executing'].includes(String(task.status || '').toLowerCase()));
  await Promise.all(
    active.map((task) => {
      const id = task.repeat ? task.planId : task.taskId;
      if (!id) return;
      return viewReads.run(
        `task:${id}`,
        (options) =>
          task.repeat
            ? getTaskPlan(id, props.source, options)
            : getTaskDetail(id, props.source, options),
        {
          data: (result) => {
            const live = turns.value
              .flatMap((turn) => tasksOf(turn))
              .find(
                (item) =>
                  (task.repeat ? item.planId === id : item.taskId === id) &&
                  !item.cancellationId &&
                  !item.changeId
              );
            if (live && result.plan) mergeTaskPlan(live, result.plan);
            if (live && result.task) mergeTaskDetail(live, result.task);
          },
          denied: clearIdentityView,
        }
      );
    })
  );
  schedule();
}
watch(() => mutating.value || operations.state.busy, schedule);
watch(
  () =>
    turns.value
      .map((turn) =>
        [
          turn.draft?.draftId,
          turn.draft?.status,
          ...tasksOf(turn).map(
            (task) => `${task.changeId || task.cancellationId || task.taskId}:${task.status}`
          ),
        ].join(':')
      )
      .join('|'),
  () => schedule()
);
// 外部注入的引用/预填：hydration 前暂存到 incoming*，由 restore 的消费块统一落地；
// 已 hydration 则直接进输入区（浮层打开携带上下文的路径）。
const contextDelivery = createContextDelivery({
  read: () => ({
    text: input.value,
    reference: composerReference.value,
    editing: Boolean(editingTurn.value),
    scope: contextSourceScope(),
  }),
  write: (value) => {
    cancelEdit();
    input.value = value.text;
    composerReference.value = value.reference;
    nextTick(() => composer.value?.focus?.());
  },
  confirm: () =>
    new Promise((resolve) =>
      uni.showModal({
        title: '已有未发送内容',
        content: '是否一起替换为这条告警及预置问题？取消会保留原草稿和引用。',
        confirmText: '替换',
        cancelText: '保留草稿',
        success: (result) => resolve(result.confirm),
        fail: () => resolve(false),
      })
    ),
  isActive: (scope) => !disposed && scope === contextSourceScope(),
});
function applyContext(payload) {
  if (!composerHydrated) incomingContext = payload;
  else void contextDelivery.receive(payload);
}
function setReference(reference) {
  if (!reference) return;
  if (!composerHydrated) incomingReference = reference;
  else {
    composerReference.value = { ...reference };
    nextTick(() => composer.value?.focus?.());
  }
}
function applyHistoryPrompt(prompt) {
  if (!input.value.trim() && !editingTurn.value) input.value = prompt;
  else
    uni.showModal({
      title: '已有未发送内容',
      content: '是否改用所选历史查询问题？取消会保留原草稿。',
      confirmText: '使用此问题',
      cancelText: '保留草稿',
      success: (result) => {
        if (result.confirm && !disposed && draftScope.value === getAgentStorageScope()) {
          cancelEdit();
          input.value = prompt;
        }
      },
    });
}
function prefill(prompt) {
  if (!prompt) return;
  if (!composerHydrated) incomingHistoryPrompt = prompt;
  else applyHistoryPrompt(prompt);
}
async function restore() {
  if (restoring || !operations.canRestore(creatingTask.value) || disposed || clearing.value) return;
  restoring = true;
  const clearMark = clearEpoch;
  let ticket = recoveryTicket;
  try {
    await waitForAgentSession();
    markAgentEntry(props.source, 'session-ready');
    const scope = getAgentStorageScope();
    if (draftScope.value && draftScope.value !== scope) clearIdentityView();
    draftScope.value = scope;
    if (!conversationRecovery.current(ticket)) {
      ticket = recoveryTicket = conversationRecovery.open(props.source);
      conversationReady.value = false;
    }
    if (!composerHydrated) {
      const savedDraft = takeComposerDraft(scope, props.source);
      if (savedDraft !== null && !editingTurn.value) input.value = savedDraft;
      const savedReference = takeComposerReference(scope, props.source);
      if (savedReference !== undefined) composerReference.value = savedReference;
      const paired = incomingContext;
      incomingContext = null;
      if (paired) {
        incomingReference = null;
        incomingHistoryPrompt = '';
      }
      if (incomingReference) {
        composerReference.value = incomingReference;
        incomingReference = null;
      }
      if (incomingHistoryPrompt) {
        const prompt = incomingHistoryPrompt;
        incomingHistoryPrompt = '';
        if (!input.value.trim() && !editingTurn.value) input.value = prompt;
        else
          uni.showModal({
            title: '已有未发送内容',
            content: '是否改用所选历史查询问题？取消会保留原草稿。',
            confirmText: '使用此问题',
            cancelText: '保留草稿',
            success: (result) => {
              if (result.confirm && !disposed && scope === getAgentStorageScope()) {
                cancelEdit();
                input.value = prompt;
              }
            },
          });
      }
      composerHydrated = true;
      if (paired) void contextDelivery.receive(paired);
    }
    markAgentEntry(props.source, 'restore-requested');
    const fence = operations.snapshotFence();
    const restored = await restoreConversation(props.source);
    markAgentEntry(props.source, 'restore-received');
    if (disposed || !conversationRecovery.current(ticket) || clearMark !== clearEpoch) return;
    const conversation = restored.conversation || (await createConversation(props.source));
    const returnedSource = restored.source ?? conversation.source ?? conversation.agent_source;
    if (returnedSource && returnedSource !== props.source)
      throw new Error('会话来源与当前入口不一致');
    if (
      disposed ||
      !conversationRecovery.current(ticket) ||
      getAgentStorageScope() !== scope ||
      clearMark !== clearEpoch
    )
      return;
    // 快照可能取于确认请求到达服务端之前（EXECUTING 提交前的待确认旧态）：
    // 跨越确认起点的快照整表丢弃，由确认结果写回或下一轮轮询收口。
    if (!operations.snapshotCurrent(fence)) {
      schedule();
      return;
    }
    conversationId.value = conversation.id;
    phase.value = conversation.phase || 'idle';
    turns.value = restoreTurns(conversation.turns);
    for (const turn of turns.value)
      if (turn.draft && !draftBaselines.has(turn.draft.draftId)) {
        draftBaselines.set(turn.draft.draftId, createDraftBaseline(turn.draft));
        operations.rememberDraft(turn.draft);
      }
    // 相位已持久化为服务端权威（含启动自愈），前端不再做僵死 running 的本地解锁。
    isRunning.value = Boolean(conversation.running);
    if (!isRunning.value)
      turns.value.forEach((turn) => {
        turn.running = false;
      });
    errorMessage.value = '';
    conversationReady.value = conversationRecovery.accept(ticket, currentConversationView());
    markAgentEntry(props.source, 'hydrated');
    nextTick(() => {
      if (!disposed && conversationRecovery.current(ticket))
        markAgentEntry(props.source, 'rendered');
    });
    recoveryMessage.value = '';
    if (!readingHydrated) {
      const view = takeComposerView(draftScope.value, props.source);
      readingHydrated = true;
      if (view?.conversationId === conversationId.value) {
        nearBottom.value = view.nearBottom;
        nextTick(() => {
          restoredScrollTop.value = view.scrollTop || 0;
        });
        const turn = view.edit && turns.value.find((item) => item.id === view.edit.turnId);
        if (turn && canRecoverTurn(turn, turn === turns.value.at(-1))) {
          composerStash = view.edit.stash;
          editingTurn.value = turn;
          input.value = view.edit.content;
        }
      }
    }
    follow();
    schedule();
    if (turns.value.some((turn) => tasksOf(turn).some((task) => task.repeat && task.created)))
      void refreshScheduledTasks();
    void refreshInboxCount();
    void prewarmLists();
  } catch (error) {
    if (!disposed && ticket === recoveryTicket && clearMark === clearEpoch) {
      conversationReady.value = false;
      if (error.status === 401 || error.status === 403 || error.code === 'AGENT_SESSION_EXPIRED')
        clearIdentityView();
      errorMessage.value = error.message || '未取得网络响应，网络层未提供具体原因';
      schedule();
    }
  } finally {
    restoring = false;
    if (
      !disposed &&
      visible &&
      props.active &&
      ticket !== recoveryTicket &&
      conversationRecovery.current(recoveryTicket) &&
      !conversationReady.value &&
      !operations.hasRequest()
    )
      void restore();
  }
}
// 消息编辑收编进主输入框（全页面单一键盘链路）：进入编辑暂存 composer 草稿并预填原文，
// 取消/提交后还原草稿；编辑期间轮次被整表回读替换或失格时自动退出编辑态。
function beginEdit(turn) {
  if (busy.value || !canRecoverTurn(turn, turns.value.at(-1) === turn)) return;
  composerStash = input.value;
  editingTurn.value = turn;
  input.value = turn.content;
}
function cancelEdit() {
  if (!editingTurn.value) return;
  editingTurn.value = null;
  input.value = composerStash;
  composerStash = '';
}
function onComposerSend() {
  if (busy.value) return;
  const turn = editingTurn.value;
  if (!turn) return sendMessage();
  const content = input.value.trim();
  editingTurn.value = null;
  input.value = composerStash;
  composerStash = '';
  const live = turns.value.find((item) => item.id === turn.id);
  if (content && live && canRecoverTurn(live, turns.value.at(-1) === live))
    return editTurn(live, content);
}
watch(turns, () => {
  const turn = editingTurn.value;
  if (!turn) return;
  const live = turns.value.find((item) => item.id === turn.id);
  if (!live || !canRecoverTurn(live, turns.value.at(-1) === live)) return cancelEdit();
  editingTurn.value = live; // 整表回读后重新钉到活对象，气泡高亮才不丢
});
function readyRegion() {
  if (regionsLoading.value || !focusRegion.value) {
    uni.showToast({
      title: regionsLoading.value ? '正在读取区域' : '请先选择可用区域',
      icon: 'none',
    });
    return null;
  }
  return { ...focusRegion.value };
}
const regionChanges = ref([]);
watch(focusRegionId, (id, previous) => {
  if (id && previous && id !== previous && focusRegion.value)
    regionChanges.value.push({
      id: Date.now() + '-' + sequence++,
      before: turns.value.length,
      name: focusRegion.value.name,
    });
});
async function sendMessage(voiceText) {
  const content = (typeof voiceText === 'string' ? voiceText : input.value).trim();
  if (!content || busy.value || !conversationId.value) return;
  const region = isCompany.value ? null : readyRegion();
  if (!isCompany.value && !region) return;
  turns.value.push(createTurn('local-' + Date.now() + '-' + sequence++, content));
  const current = turns.value[turns.value.length - 1];
  if (region) current.focusRegion = region;
  if (composerReference.value) current.reference = { ...composerReference.value };
  composerReference.value = null;
  if (typeof voiceText !== 'string') input.value = '';
  await runTurn(current, content);
}
function runTurn(current, content) {
  return operations.run(current, content);
}
async function recoverTurn(turn, content) {
  if (busy.value || !canRecoverTurn(turn, turns.value.at(-1) === turn)) return;
  const region = isCompany.value ? null : readyRegion();
  if (!isCompany.value && !region) return;
  mutating.value = true;
  // 未达服务端的失败轮没有 serverId，也没有可退役的服务端条目，直接重发即可。
  if (turn.serverId) {
    try {
      await discardTurn(conversationId.value, turn.serverId, props.source);
    } catch (error) {
      errorMessage.value = error.message;
      mutating.value = false;
      return;
    }
  }
  mutating.value = false;
  restartTurn(turn, content);
  if (region) turn.focusRegion = region;
  await runTurn(turn, content);
}
function retryTurn(turn) {
  return recoverTurn(turn, turn.content);
}
function editTurn(turn, content) {
  return recoverTurn(turn, content);
}
function selectDraft(turn, selected) {
  return operations.select(turn, selected);
}
function restoreDraft(turn) {
  return operations.restoreDraft(turn);
}
function confirmDraft(turn) {
  sheetError.value = '';
  return operations.confirmDraft(turn);
}
function confirmTaskProposal(task) {
  issue.value = null;
  return operations.confirmTask(task);
}
function discardTaskProposal(task) {
  return operations.discardTask(task);
}
function openTaskRegion(task) {
  const periodic =
    task?.planId || (task?.repeat && !task?.occurrence ? task?.taskId || task?.id : '');
  if (periodic && !task.occurrence) {
    companyTaskId.value = '';
    companyPlanId.value = periodic;
    return;
  }
  if (isCompany.value) {
    const planId =
      task?.planId || (task?.repeat && !task?.occurrence ? task?.taskId || task?.id : '');
    if (planId && !task.occurrence) {
      companyTaskId.value = '';
      companyPlanId.value = planId;
      return;
    }
    const taskId = task?.taskId || task?.id;
    if (!taskId) return;
    companyPlanId.value = '';
    companyTaskId.value = taskId;
    return;
  }
  const target = taskNavigation(task);
  if (!target) return;
  navigateRegion(
    `/pages/agent/region?regionId=${encodeURIComponent(target.regionId)}&date=${encodeURIComponent(target.date)}&taskId=${encodeURIComponent(target.taskId)}`
  );
}

function cancelDraft(turn) {
  return operations.cancelDraft(turn);
}
function revalidateDraft(turn) {
  return operations.revalidateDraft(turn);
}
function retryAnswer(turn) {
  return operations.retryAnswer(turn);
}
function stopRun() {
  if (conversationReady.value && conversationRecovery.canMutate(recoveryTicket))
    return operations.stop();
}
function clearHistory() {
  if (!conversationId.value || clearing.value) return;
  // 在途回答/执行中草案服务端同样按 409 拒绝；先本地拦截，省一轮等待。
  if (busy.value || operations.hasRequest()) {
    uni.showToast({ title: '请等待当前请求结束后清除', icon: 'none' });
    return;
  }
  uni.showModal({
    title: isCompany.value ? '清除公司会话' : '清除会话',
    content: isCompany.value ? '清除当前公司 Agent 对话记录？' : '清除当前对话和草案记录？',
    success: async (response) => {
      if (
        !response.confirm ||
        clearing.value ||
        !conversationReady.value ||
        !conversationRecovery.canMutate(recoveryTicket)
      )
        return;
      const staleId = conversationId.value;
      ++clearEpoch;
      conversationRecovery.forget(recoveryTicket);
      recoveryTicket = null;
      conversationReady.value = false;
      mutating.value = true;
      clearing.value = true;
      // 退役旧会话与创建新会话互不依赖，并行发出，与淡出动画同时进行；
      // 失败时保留原轮次回显，不会先清空再恢复。
      const requests = Promise.allSettled([
        clearConversation(staleId, props.source),
        createConversation(props.source),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 220));
      const [cleared, created] = await requests;
      if (cleared.status === 'rejected') {
        // 并行的新建可能已成功：补删这个空会话，避免它取代旧会话成为可恢复的当前会话。
        if (created.status === 'fulfilled')
          clearConversation(created.value.id, props.source).catch(() => {});
        if (!disposed) errorMessage.value = cleared.reason?.message || '清除会话失败，请重试';
      } else if (!disposed) {
        turns.value = [];
        regionChanges.value = [];
        closeReport();
        draftBaselines.clear();
        operations.reset();
        if (editingTurn.value) cancelEdit();
        if (created.status === 'fulfilled') {
          conversationId.value = created.value.id;
          errorMessage.value = '';
          follow(true);
        } else {
          // 旧会话已清除但新会话未建成：补建一次，仍失败则显示错误由用户重新连接。
          conversationId.value = '';
          try {
            const fresh = await createConversation(props.source);
            if (!disposed) {
              conversationId.value = fresh.id;
              errorMessage.value = '';
              follow(true);
            }
          } catch (error) {
            if (!disposed) errorMessage.value = error.message;
          }
        }
      }
      if (!disposed && cleared.status === 'fulfilled' && conversationId.value) {
        recoveryTicket = conversationRecovery.open(props.source);
        conversationReady.value = conversationRecovery.accept(
          recoveryTicket,
          currentConversationView()
        );
      }
      clearing.value = false;
      mutating.value = false;
      if (!disposed && !conversationReady.value) void restore();
    },
  });
}
// 宿主驱动生命周期：active=true ↔ 页面 onShow / 浮层展开，false ↔ onHide / 收起。
// 收起只停轮询保草稿，不碰在途流——流继续跑，回开时 restore 对齐。
const viewReads = useViewReads(
  () => props.active,
  () => props.source
);
function reloadRegions() {
  return viewReads.run('regions', loadRegionFocus, {
    error: (cause) => showAgentError(cause, { fallback: '区域暂不可用' }),
  });
}
function activate() {
  visible = true;
  markAgentEntry(props.source, 'activated');
  openingRegion.value = false;
  if (!isCompany.value) void reloadRegions();
  let scope = '';
  try {
    scope = getAgentStorageScope();
  } catch {
    /* 会话准备完成后由 restore 重新分区 */
  }
  if (draftScope.value && draftScope.value !== scope) clearIdentityView();
  draftScope.value = scope;
  if (!operations.hasRequest()) {
    try {
      recoveryTicket = conversationRecovery.open(props.source);
      conversationReady.value = false;
      const preview = recoveryTicket.preview;
      if (!conversationId.value && preview) {
        conversationId.value = preview.id;
        turns.value = preview.turns;
        isRunning.value = false;
        phase.value = 'restoring';
        markAgentEntry(props.source, 'preview-restored');
      }
      if (conversationId.value) recoveryMessage.value = '正在同步对话，完成后可继续操作';
    } catch {
      clearIdentityView();
    }
    void restore();
  }
  const savedDraft = takeComposerDraft(scope, props.source);
  if (savedDraft !== null && !editingTurn.value) input.value = savedDraft;
  const savedReference = takeComposerReference(scope, props.source);
  if (savedReference !== undefined) composerReference.value = savedReference;
  const prefillText = isCompany.value ? '' : consumeComposePrefill();
  if (prefillText) {
    if (!input.value.trim() && !editingTurn.value) input.value = prefillText;
    else
      uni.showModal({
        title: '已有未发送内容',
        content: '是否用当前区域的新建任务引导替换输入？原草稿可选择保留。',
        confirmText: '替换输入',
        cancelText: '保留草稿',
        success: (result) => {
          if (result.confirm) {
            cancelEdit();
            input.value = prefillText;
          }
        },
      });
  }
}
function deactivate() {
  preserveCurrentComposerDraft();
  closeReport();
  visible = false;
  composer.value?.interrupt();
  clearTimeout(pollTimer);
  clearTimeout(taskPollTimer);
}
watch(
  () => props.active,
  (on) => {
    if (on) activate();
    else deactivate();
  },
  { immediate: true }
);
watch(
  () => props.source,
  () => {
    issue.value = null;
    closeReport();
  }
);
onBeforeUnmount(() => {
  preserveCurrentComposerDraft();
  disposed = true;
  clearTimeout(pollTimer);
  clearTimeout(taskPollTimer);
  clearTimeout(expiryTimer);
  operations.reset();
});
// 面板头「⋯」按钮走同一套会话菜单（公司面板无工作台项）。
function openMenu() {
  openAgentMenu(
    {
      disabled: !conversationId.value,
      tasksEnabled: true,
      inboxEnabled: true,
      inboxUnreadCount: inboxUnreadCount.value,
    },
    (event) => {
      if (event === 'clear') clearHistory();
      else if (event === 'open-tasks') tasksOpen.value = true;
      else if (event === 'open-inbox') openInbox();
    }
  );
}
defineExpose({
  openMenu,
  openInbox,
  clearHistory,
  openRegion,
  setReference,
  prefill,
  applyContext,
  openTasks: () => {
    tasksOpen.value = true;
  },
});
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
.event-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.event-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.region-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: $agent-color-warning-deep;
  font-size: $agent-font-size-compact;
  padding: 8px 0;
}
.region-notice text {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}
.region-notice button {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 12px;
  margin: 0;
  background: transparent;
  color: $agent-color-text-secondary;
  font-size: $agent-font-size-compact;
}
.region-notice button::after {
  border: 0;
}
/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.conv-root {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: $agent-color-text-primary;
}
/* scroll-view 禁止直接用 flex:1/height:0 撑高（微信 webview 已知塌陷：盒子 0 高、
   内容被 enhanced 层画出但命中盒全灭——2026-09-17 预览"看得见点不中"根因）。
   确定性高度链：flex 包裹层 min-height:0 + 内层 scroll-view height:100%。 */
.conversation-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.conversation {
  height: 100%;
}
.conversation__inner {
  padding: 24px 16px 32px;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.conversation__inner.clearing {
  opacity: 0;
  transform: translateY(16rpx);
  pointer-events: none;
}
.clearing-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $agent-color-text-muted;
  font-size: 24rpx;
  animation: clearing-hint-in 0.24s ease 0.1s backwards;
}
@keyframes clearing-hint-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.welcome {
  margin: 80rpx 0;
  font-size: 36rpx;
  font-weight: 600;
}
.welcome view {
  margin-top: 20rpx;
  font-size: 26rpx;
  font-weight: 400;
  color: $agent-color-text-muted;
}
/* 推荐入口复用 region-chip 纸材；.welcome view 会命中容器，需提高优先级覆盖其行距/字号。 */
.welcome .welcome-sugg {
  display: flex;
  flex-wrap: wrap;
  gap: $agent-space-small;
  margin-top: 16px;
}
.sugg-chip {
  display: flex;
  align-items: center;
  height: 32px;
  margin: 0;
  padding: 0 14px;
  border-radius: 16px;
  background: linear-gradient($agent-color-surface, $agent-color-tint);
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.14),
    0 3px 8px -6px rgba(var(--agent-ink-rgb), 0.4);
  font-size: $agent-font-size-compact;
  line-height: 1;
  color: $agent-color-text-secondary;
  white-space: nowrap;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
.sugg-chip::after {
  border: 0;
}
.sugg-chip--pressed {
  transform: scale(0.96);
  opacity: 0.85;
}
.region-divider {
  margin: 12px 0 22px;
  text-align: center;
  font-size: 11px;
  color: $agent-color-text-muted;
}
.turn-reference {
  margin-bottom: 8px;
  padding: 6px 10px;
  border-left: 2px solid $agent-color-warning-deep;
  background: $agent-color-warning-faint;
  color: $agent-color-text-muted;
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.turn {
  margin-bottom: 42px;
}
.user-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 22px;
}
/* 宿主必须定宽：组件宿主是 flex item、宽度靠内容反推，会让整条 fit-content 链塌到
   min-content（短消息每行一字）；定宽后气泡用 inline-block 收缩即可安全测量。 */
.user-row .um-host {
  width: 100%;
}
.trace-toggle {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0;
  margin: 12rpx 0;
  min-height: 56rpx;
  line-height: 56rpx;
  background: transparent;
  color: $agent-color-text-muted;
  font-size: 24rpx;
}
.trace-toggle::after {
  border: 0;
}
.error {
  display: block;
  margin-top: 20rpx;
  color: $agent-color-error;
  font-size: 25rpx;
}
.composer-shell {
  position: relative;
  z-index: 4;
  padding: 8px 18px calc(14px + env(safe-area-inset-bottom));
  background: transparent;
  flex-shrink: 0;
  transition: padding-bottom 0.25s ease;
}
.anchor {
  height: 2rpx;
}
@media (prefers-reduced-motion: reduce) {
  .composer-shell {
    transition: none;
  }
  .conversation__inner {
    transition: none;
  }
  .clearing-hint {
    animation: none;
  }
}
</style>
