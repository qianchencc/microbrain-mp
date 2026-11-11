<template>
  <view class="task-detail-host">
    <TaskIssueDetails
      back-in-header
      style="height: 0; min-height: 0; flex: 1; display: flex; flex-direction: column"
      v-if="issue"
      :issue="issue"
      @close="issue = null"
    />
    <scroll-view
      :style="{ display: issue ? 'none' : 'block' }"
      class="task-scroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <view
        v-if="loading && !detailFresh"
        class="task-detail task-skeleton"
        aria-label="正在加载任务"
      >
        <view class="sk-bar sk-title" />
        <view class="sk-bar sk-meta w-40" />
        <view class="sk-bar sk-meta w-64" />
        <view class="sk-owner">
          <view class="sk-avatar" />
          <view class="sk-bar sk-owner-name w-30" />
          <view class="sk-bar sk-tag" />
        </view>
        <view class="sk-bar sk-section w-16" />
        <view
          v-for="row in 3"
          :key="row"
          class="phase sk-phase"
        >
          <view class="sk-node" />
          <view class="sk-phase-main">
            <view class="sk-bar w-36" />
            <view class="sk-bar w-74" />
            <view class="sk-bar w-52" />
          </view>
        </view>
      </view>
      <view
        v-else-if="error"
        class="message"
        ><TaskErrorNotice
          :message="error"
          summary="读取失败"
          @details="showIssue"
        /><button @tap="load()">重新加载</button
        ><button
          v-if="returnPlan"
          class="plan-back"
          @tap="returnToPlan"
          ><uni-icons
            type="back"
            size="13"
            color="var(--agent-text-muted)"
          />
          返回周期安排</button
        ></view
      >
      <view
        v-else-if="detail"
        class="task-detail"
      >
        <button
          v-if="returnPlan"
          class="plan-back"
          @tap="returnToPlan"
          ><uni-icons
            type="back"
            size="13"
            color="var(--agent-text-muted)"
          />
          返回周期安排</button
        >
        <view class="task-heading"
          ><text class="task-name">{{ detail.label }}</text
          ><button
            v-if="taskNeedsDetails(detail.presentationStatus)"
            class="state-tag result-link"
            :class="detail.presentationStatus"
            @tap="showTaskIssue"
            >{{ detail.statusText }}</button
          ><text
            v-else
            class="state-tag"
            :class="detail.presentationStatus"
            >{{ detail.statusText }}</text
          ></view
        >
        <text
          v-if="detail.occurrence?.virtual && detail.occurrenceText"
          class="task-when"
          >{{ detail.occurrenceText }}</text
        >
        <text class="task-when">{{ whenLine }}</text>
        <text class="task-when">创建人：{{ detail.creator?.displayName?.trim() || '未记录' }}</text>
        <text
          v-if="task && detail.source?.type === 'recurring_plan'"
          class="task-when"
          >{{
            returnPlan?.label ? `所属周期：${returnPlan.label}` : `来源：${detail.sourceText}`
          }}</text
        >
        <text
          v-if="loading"
          class="task-when"
          >正在更新…</text
        >
        <view
          v-if="detail.rulesText"
          class="task-rules"
          ><text>{{ detail.rulesText }}</text></view
        >
        <view
          v-if="plan && !sampleTask"
          class="plan-toggle-row"
        >
          <view class="plan-toggle-copy"><text class="plan-toggle-title">周期任务</text></view>
          <PlanStatusSwitch
            :enabled="planIsEnabled(plan)"
            :manageable="planCanToggle(plan)"
            :busy="busy"
            @toggle="togglePlanStatus(plan.planId)"
            @unavailable="explainPlanAccess(plan)"
          />
        </view>
        <TaskErrorNotice
          v-if="actionError"
          :message="actionError"
          summary="这次操作未完成"
          @details="showIssue"
        />
        <view class="records-heading"
          ><text class="section-title">{{
            detail.interval || detail.phases.some((p) => p.readAc) ? '检查记录' : '操作记录'
          }}</text
          ><button
            v-if="detail.phases.length > 3"
            class="records-toggle"
            @tap="allPhases = !allPhases"
            >{{ allPhases ? '收起记录' : `查看全部${detail.phases.length}次` }} ›</button
          ></view
        >
        <view
          v-for="(phase, index) in visiblePhases"
          :key="phase.id"
          class="phase"
        >
          <view class="phase-rail"
            ><view
              class="phase-node"
              :class="[
                'tone-' + phase.tone,
                { ending: !detail.interval && detail.phases.length > 1 && index === 1 },
              ]" /><view
              v-if="index < detail.phases.length - 1"
              class="phase-link"
              ><view
                class="phase-link-fill"
                :style="{ height: phase.link + '%' }" /></view
          ></view>
          <view class="phase-main">
            <view class="phase-head">
              <view class="phase-top"
                ><text class="phase-time">{{ phase.clock }}</text
                ><button
                  v-if="taskNeedsDetails(phase.presentationStatus) || phase.failureReason"
                  class="phase-status result-link"
                  :class="'tone-' + phase.tone"
                  :aria-label="`${phase.clock} ${phase.statusText}，查看原因`"
                  @tap="showPhaseIssue(phase)"
                  >{{ phase.statusText }} ›</button
                ><text
                  v-else
                  class="phase-status"
                  :class="'tone-' + phase.tone"
                  >{{ phase.statusText }}</text
                ></view
              >
              <view class="phase-bottom"
                ><text class="phase-note">{{ phaseNote(phase) }}</text></view
              >
            </view>
            <view
              v-if="phase.observations?.length"
              class="phase-reveal"
              :class="{ open: expandedPhases.includes(phase.id) }"
              :aria-hidden="!expandedPhases.includes(phase.id)"
              ><view class="phase-reveal-inner"
                ><ObservationCard
                  :observation="{
                    observedAt: phase.endedAt || phase.at,
                    blocks: phase.observations,
                  }"
                  :source="source"
                  :show-issue="showIssue"
                  inline-playback
                  read-only
                  hide-execution-status
                  @select-alert="$emit('select-alert', $event)"
                  @browse-alerts="$emit('browse-alerts')" /></view
            ></view>
            <button
              v-if="phase.report && source === 'company'"
              class="phase-report"
              :aria-label="`打开检查报告 ${phase.report.title || ''}`"
              @tap="emit('open-report', phase.report)"
            >
              <uni-icons
                type="compose"
                size="13"
                color="var(--agent-accent-deep)"
              />
              <text class="phase-report-title">{{ phase.report.title || '检查报告' }}</text>
              <text
                v-if="phase.report.status === 'partial'"
                class="phase-report-tag"
                >部分完成</text
              >
              <uni-icons
                type="right"
                size="12"
                color="var(--agent-text-faint)"
              />
            </button>
            <button
              v-if="phase.devices.length > 1 || phase.observations?.length"
              class="phase-devices"
              :class="{ attached: expandedPhases.includes(phase.id) && phase.observations?.length }"
              :aria-label="`${expandedPhases.includes(phase.id) ? '收起' : '展开'} ${phase.devices.length} 台设备`"
              :aria-expanded="expandedPhases.includes(phase.id)"
              @tap="togglePhase(phase.id)"
            >
              <view class="phase-avatars"
                ><view
                  v-for="device in phase.devices.slice(0, 5)"
                  :key="device.id"
                  class="phase-avatar"
                  ><image
                    v-if="device.artwork"
                    :src="device.artwork"
                    mode="aspectFit" /><uni-icons
                    v-else
                    type="gear"
                    size="12"
                    color="var(--agent-text-muted)" /></view
              ></view>
              <text class="phase-device-count">{{
                expandedPhases.includes(phase.id)
                  ? '收起'
                  : phase.observations?.length && phase.devices.length <= 1
                    ? '查看详情'
                    : phase.devices.length + ' 台设备'
              }}</text
              ><uni-icons
                type="down"
                size="13"
                color="var(--agent-text-muted)"
                :class="{ 'caret-flip': expandedPhases.includes(phase.id) }"
              />
            </button>
            <view
              v-if="!phase.observations?.some((block) => block.type === 'ac_inspection')"
              class="phase-reveal"
              :class="{ open: phase.devices.length <= 1 || expandedPhases.includes(phase.id) }"
              ><view class="phase-reveal-inner"
                ><view class="device-list">
                  <view
                    v-for="device in phase.devices"
                    :key="device.id"
                    class="device-row"
                  >
                    <text class="device-name">{{ device.name }}</text
                    ><text
                      v-if="device.kind !== 'energy'"
                      class="target"
                      >{{
                        device.target?.observe ? device.targetText : `目标：${device.targetText}`
                      }}</text
                    ><button
                      v-if="device.resultTone === 'warn' && phase.status !== 'cancelled'"
                      class="result result-link"
                      :aria-label="`${device.name}，查看原因`"
                      :class="device.resultTone"
                      @tap="
                        showIssue({
                          title: `${device.name} · ${device.resultText}`,
                          reason: device.resultReason,
                        })
                      "
                      >查看原因 ›</button
                    >
                  </view>
                </view></view
              ></view
            >
          </view>
        </view>
        <view
          v-if="detail.report"
          class="task-report"
        >
          <button
            v-if="reportLink"
            class="report-cta"
            @tap="emit('open-report', reportLink)"
          >
            <uni-icons
              type="compose"
              size="17"
              color="var(--agent-accent-deep)"
            />
            <view class="report-cta-copy"
              ><text class="report-cta-title">查看本次检查报告</text
              ><text class="report-cta-note"
                >设备与检查点依据 · {{ detail.report.outcomeText }} ·
                {{ detail.report.checkpoints }} 次记录 ·
                {{ detail.report.devicesVisible }} 台设备</text
              ></view
            >
            <uni-icons
              type="right"
              size="14"
              color="var(--agent-accent-deep)"
            />
          </button>
          <view
            v-else
            class="report-summary-block"
          >
            <text class="report-title">执行报告 · {{ detail.report.generatedText }}</text>
            <text class="report-summary"
              >{{ detail.report.outcomeText }} · {{ detail.report.checkpoints }} 次记录 ·
              {{ detail.report.devicesVisible }} 台设备</text
            >
          </view>
          <template v-if="detail.report.summary?.energy">
            <template v-if="detail.report.summary.energy.hero">
              <view
                class="energy-hero"
                :class="{
                  'energy-hero--unavailable': detail.report.summary.energy.kind === 'unavailable',
                }"
              >
                <view class="energy-hero-main">
                  <view class="energy-hero-number"
                    ><text>{{ detail.report.summary.energy.hero.value }}</text
                    ><text
                      v-if="detail.report.summary.energy.hero.unit"
                      class="energy-hero-unit"
                      >{{ detail.report.summary.energy.hero.unit }}</text
                    ></view
                  >
                  <text class="energy-hero-label">{{
                    detail.report.summary.energy.hero.label
                  }}</text>
                </view>
                <view class="energy-hero-side">
                  <text
                    v-if="detail.report.summary.energy.hero.badge"
                    class="energy-hero-badge"
                    >{{ detail.report.summary.energy.hero.badge }}</text
                  >
                  <text class="energy-hero-foot">{{
                    detail.report.summary.energy.hero.footnote
                  }}</text>
                </view>
              </view>
              <view
                v-if="detail.report.summary.energy.facts?.length"
                class="energy-facts"
              >
                <view
                  v-for="fact in detail.report.summary.energy.facts"
                  :key="fact.label"
                  class="energy-fact"
                  ><text class="energy-fact-value">{{ fact.value }}</text
                  ><text class="energy-fact-label">{{ fact.label }}</text></view
                >
              </view>
              <button
                class="records-toggle"
                @tap="energyBasis = !energyBasis"
                >{{ energyBasis ? '收起计算说明' : '查看计算说明' }} ›</button
              >
              <view
                v-if="energyBasis"
                class="energy-basis-card"
              >
                <text class="energy-basis-title">{{
                  detail.report.summary.energy.basisTitle
                }}</text>
                <text
                  v-if="detail.report.summary.energy.formula"
                  class="energy-formula"
                  >{{ detail.report.summary.energy.formula }}</text
                >
                <text
                  v-for="note in detail.report.summary.energy.notes"
                  :key="note"
                  class="energy-basis-note"
                  >{{ note }}</text
                >
              </view>
              <view
                v-if="detail.report.summary.energy.devices?.rows?.length"
                class="energy-devices"
              >
                <view
                  v-for="row in detail.report.summary.energy.devices.rows"
                  :key="row.deviceId"
                  class="energy-device-row"
                >
                  <text class="energy-device-name">{{ row.name }}</text
                  ><text class="energy-device-before">{{ row.before }} →</text
                  ><text
                    class="energy-device-after"
                    :class="'after-' + row.tone"
                    >{{ row.after }}</text
                  >
                </view>
                <text
                  v-if="detail.report.summary.energy.devices.more"
                  class="energy-devices-more"
                  >其余 {{ detail.report.summary.energy.devices.more }} 台见上方检查记录</text
                >
              </view>
            </template>
            <text
              v-else
              class="report-energy"
              :class="'energy-' + detail.report.summary.energy.tone"
              >{{ detail.report.summary.energy.text }}</text
            >
          </template>
        </view>
        <view
          v-if="plan && latestReport"
          class="task-report"
        >
          <text class="report-title">最近一次执行 · {{ latestReport.generatedText }}</text>
          <text class="report-summary"
            >{{ latestReport.outcomeText }} · {{ latestReport.checkpoints }} 次记录 ·
            {{ latestReport.devicesVisible }} 台设备</text
          >
          <button
            class="latest-report-link"
            @tap="openLatestReport"
            >查看最近一次报告</button
          >
        </view>
        <view
          v-if="!sampleTask"
          class="reference-actions"
          ><button
            class="task-reference"
            @tap="referenceCurrent"
            >{{ plan ? '询问这个计划' : '引用任务并询问' }}</button
          ></view
        >
        <button
          v-if="
            !sampleTask &&
            !loading &&
            (detail.canCancel ||
              (task?.occurrence?.virtual && detailMine && task.status !== 'cancelled'))
          "
          class="task-delete"
          :disabled="busy"
          :loading="busy"
          @tap="task?.occurrence?.virtual ? cancelPeriod('occurrence') : deleteTask()"
          >{{ task?.occurrence ? '仅取消本次' : '取消任务' }}</button
        >
        <button
          v-if="!sampleTask && (plan?.canManage || (task?.occurrence && detailMine))"
          class="task-delete"
          :disabled="busy"
          :loading="busy"
          @tap="cancelPeriod('all')"
          >取消整个周期</button
        >
      </view>
    </scroll-view>
  </view>
</template>
<script setup>
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue';
import {
  cancelTask,
  cancelTaskPlan,
  getTaskDetail,
  getTaskPlan,
  setTaskPlanStatus,
} from '@/apis/agent/tasks';
import {
  taskDetailView,
  taskPlanSnapshot,
  taskTime,
  taskNeedsDetails,
  planPresentation,
  createPlanManagement,
} from '../../lib/tasks.mjs';
import { onShow, onHide } from '@dcloudio/uni-app';
import { getAgentStorageScope } from '@/utils/agent-session';
import { useViewReads } from '../../lib/reads.mjs';
import { showAgentError } from '@/utils/agent-error';
import ObservationCard from '../observations/ObservationCard.vue';
import TaskIssueDetails from './TaskIssueDetails.vue';
import TaskErrorNotice from './TaskErrorNotice.vue';
import PlanStatusSwitch from './PlanStatusSwitch.vue';
import { AGENT_COLORS } from '../../styles/colors.js';

const props = defineProps({
  active: Boolean,
  taskId: String,
  planId: String,
  sampleTask: Object,
  initialTask: Object,
  snapshotScope: String,
  source: { type: String, default: 'office' },
});
const emit = defineEmits([
  'cancelled',
  'changed',
  'loaded',
  'report-open',
  'open-report',
  'plan-return',
  'reference',
  'dismiss',
  'select-alert',
  'browse-alerts',
  'navigation',
]);
const task = ref(null),
  plan = ref(null),
  returnPlan = ref(null);
const activeTaskId = ref(''),
  activePlanId = ref('');
const loading = ref(false),
  error = ref(''),
  ownActionError = ref(''),
  cancelling = ref(false);
const detailFresh = ref(false);
const planControls = createPlanManagement({
  createState: reactive,
  readContext: () => ({
    active: props.active && pageVisible,
    source: props.source,
    scope: getAgentStorageScope(),
    key: activePlanId.value || activeTaskId.value,
    plans: plan.value ? [plan.value] : [],
  }),
  updatePlan: (next) => {
    if (plan.value?.planId === next.planId) plan.value = next;
  },
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
  changed: () => emit('changed'),
});
const busy = computed(() => cancelling.value || planControls.state.busy);
const actionError = computed({
  get: () => ownActionError.value || planControls.state.error,
  set: (value) => {
    ownActionError.value = value;
    if (!value) planControls.clearError();
  },
});
const expandedPhases = ref([]),
  allPhases = ref(false),
  energyBasis = ref(false),
  issue = ref(null);
const visiblePhases = computed(() =>
  allPhases.value ? detail.value?.phases : detail.value?.previewPhases
);

function showIssue(value) {
  issue.value = value;
}
// 只有真实失败才给“查看原因”；已下发等无回传状态不追加说明，避免展示多余内容。
function showPhaseIssue(phase) {
  const reason = [
    phase.failureReason,
    ...phase.devices
      .filter((d) => d.resultTone === 'warn')
      .map((d) => `${d.name}：${d.resultReason}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  if (reason) showIssue({ title: `${phase.clock} · ${phase.statusText}`, reason });
}
function showTaskIssue() {
  const reason = detail.value.phases
    .filter((p) => taskNeedsDetails(p.presentationStatus) || p.failureReason)
    .map((p) =>
      [
        `${p.time} · ${p.statusText}`,
        p.failureReason ||
          p.devices
            .filter((d) => d.resultTone === 'warn')
            .map((d) => `${d.name}：${d.resultReason}`)
            .join('\n'),
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');
  if (reason) showIssue({ title: detail.value.statusText, reason });
}
const detailSubtitle = computed(() => {
  if (!detail.value) return '';
  const date = (detail.value.phases?.[0]?.time || detail.value.createdText || '').slice(0, 10);
  const label = props.source === 'company' ? '公司 Agent' : '办公室 Agent';
  return date ? `${label} · ${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : label;
});
const detail = computed(() => {
  const view = taskDetailView(task.value || taskPlanSnapshot(plan.value));
  if (plan.value && view) return { ...view, statusText: planPresentation(plan.value).statusText };
  return view;
});
watch(
  [issue, detailSubtitle],
  () =>
    emit('navigation', {
      title: issue.value ? '查看原因' : '',
      canBack: Boolean(issue.value),
      subtitle: issue.value ? '' : detailSubtitle.value,
    }),
  { immediate: true }
);
function referenceCurrent() {
  if (plan.value)
    emit('reference', { type: 'task_plan', planId: plan.value.planId, label: plan.value.label });
  else if (task.value)
    emit('reference', { type: 'task', taskId: task.value.id, label: task.value.label });
}
const planIsEnabled = (value) => planPresentation(value).enabled;
const planCanToggle = (value) => planPresentation(value).canToggle;
function explainPlanAccess(value) {
  if (!value || ['ended', 'deleted'].includes(value.status)) return;
  uni.showToast({ title: '需使用创建者账号，且当前范围覆盖全部设备才能管理', icon: 'none' });
}
function togglePlanStatus(planId) {
  if (!cancelling.value) return planControls.toggle(planId);
}
async function cancelPeriod(scope) {
  if (cancelling.value) return;
  const target = plan.value || { planId: task.value?.occurrence?.planId };
  if (
    await planControls.cancel(target, { scope, date: task.value?.occurrence?.date, refresh: true })
  ) {
    emit('cancelled');
    emit('dismiss');
  }
}
const latestReport = computed(() => taskDetailView(plan.value?.latestTask)?.report || null);
const whenLine = computed(() => {
  if (!detail.value) return '';
  // 同日区间只留时刻（日期已在 Sheet 副标题）；跨日保留完整起止。
  const when = detail.value.whenText.replace(
    /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2}) 至 (\d{2}:\d{2})$/,
    '$1 至 $2'
  );
  return [when, detail.value.repeatText].filter(Boolean).join(' · ');
});
const reportLink = computed(() =>
  props.source === 'company'
    ? (detail.value?.phases || []).filter((phase) => phase.report?.reportId).at(-1)?.report || null
    : null
);
function phaseNote(phase) {
  return phase.devices.length ? `${phase.devices.length} 台` : phase.title;
}
// 来源 draft/conversation id 只对创建者返回；等价于“我创建的任务”，用于保留原取消权限。
const detailMine = computed(() =>
  Boolean(detail.value?.source?.draftId || detail.value?.source?.conversationId)
);
let refreshTimer,
  pageVisible = true,
  wasHidden = false,
  detailScope = '';
const reads = useViewReads(
  () => props.active,
  () => [props.source, activeTaskId.value, activePlanId.value]
);
function clearReadData() {
  task.value = null;
  plan.value = null;
  returnPlan.value = null;
  detailFresh.value = false;
}
function startPolling() {
  clearInterval(refreshTimer);
  if (props.active && pageVisible && !props.sampleTask)
    refreshTimer = setInterval(() => {
      if (activePlanId.value || ['scheduled', 'executing'].includes(task.value?.status)) load(true);
    }, 10000);
}
onHide(() => {
  pageVisible = false;
  wasHidden = true;
  clearInterval(refreshTimer);
  reads.invalidate();
  loading.value = false;
  cancelling.value = false;
  planControls.invalidate();
});
onShow(() => {
  pageVisible = true;
  let scope = '';
  try {
    scope = getAgentStorageScope();
  } catch {
    /* 失效身份不保留上一人的报告 */
  }
  if (scope !== detailScope) {
    planControls.invalidate();
    task.value = null;
    plan.value = null;
    returnPlan.value = null;
    expandedPhases.value = [];
    allPhases.value = false;
    energyBasis.value = false;
    issue.value = null;
    cancelling.value = false;
  }
  if (wasHidden && props.active) {
    load(true);
    startPolling();
  }
  wasHidden = false;
});
function togglePhase(id) {
  expandedPhases.value = expandedPhases.value.includes(id)
    ? expandedPhases.value.filter((value) => value !== id)
    : [...expandedPhases.value, id];
}
async function load(silent = false) {
  const taskId = activeTaskId.value,
    planId = activePlanId.value;
  let scope = '';
  try {
    scope = getAgentStorageScope();
  } catch {
    /* 接口仍负责展示身份错误 */
  }
  if (scope !== detailScope) {
    task.value = null;
    plan.value = null;
    returnPlan.value = null;
    expandedPhases.value = [];
    allPhases.value = false;
    energyBasis.value = false;
    issue.value = null;
  }
  detailScope = scope;
  if (!pageVisible || !props.active || (!taskId && !planId)) return;
  if (!silent) {
    const snapshot = props.initialTask;
    task.value =
      snapshot?.id === taskId &&
      snapshot.agentSource === props.source &&
      props.snapshotScope === scope &&
      scope
        ? snapshot
        : null;
    plan.value = null;
    error.value = '';
    loading.value = false;
    detailFresh.value = false;
  }
  if (props.sampleTask) {
    task.value = props.sampleTask;
    return;
  }
  if (!silent) loading.value = true;
  await reads.run(
    'detail',
    async (options) => ({
      ...(planId
        ? await getTaskPlan(planId, props.source, options)
        : await getTaskDetail(taskId, props.source, options)),
      publish: options.publish,
    }),
    {
      data: async (result) => {
        if (planId) {
          plan.value = result?.plan || null;
          error.value = result?.plan ? '' : '周期任务不存在或没有查看权限';
          return;
        }
        if (!result?.task) {
          task.value = null;
          error.value = '任务不存在或没有查看权限';
          return;
        }
        error.value = '';
        task.value = result.task;
        detailFresh.value = true;
        await nextTick();
        result.publish(() => emit('loaded', taskId));
      },
      denied: clearReadData,
      error: (cause) => {
        error.value =
          cause.message ||
          (planId ? '周期任务读取失败：未取得具体原因' : '任务读取失败：未取得具体原因');
        showAgentError(cause, { fallback: planId ? '周期任务读取失败' : '任务读取失败' });
      },
      finish: () => {
        loading.value = false;
      },
    }
  );
}
function openLatestReport() {
  if (!plan.value?.latestTask?.id) return;
  returnPlan.value = plan.value;
  activePlanId.value = '';
  activeTaskId.value = plan.value.latestTask.id;
  emit('report-open');
  void load();
}
function returnToPlan() {
  if (!returnPlan.value) return;
  reads.invalidate('detail');
  plan.value = returnPlan.value;
  returnPlan.value = null;
  task.value = null;
  activeTaskId.value = '';
  activePlanId.value = plan.value.planId;
  error.value = '';
  loading.value = false;
  emit('plan-return');
}
async function deleteTask() {
  if (!detail.value?.canCancel || busy.value) return;
  const taskId = activeTaskId.value,
    version = task.value.version;
  const phases = detail.value.phases;
  const meterTask =
    phases.length > 0 &&
    phases.every(
      (phase) =>
        phase.readAgent ||
        (phase.devices.length > 0 && phase.devices.every((device) => device.kind === 'energy'))
    );
  const notStarted = ['pending', 'scheduled'].includes(task.value.status);
  const title = task.value.occurrence ? '取消本次任务？' : '取消这项任务？';
  let content = notStarted
    ? meterTask
      ? '该任务尚未开始。取消后，将不再执行本次电表统计。'
      : '该任务尚未开始。取消后，将不再执行这项任务。'
    : meterTask
      ? '取消后，将停止本次任务尚未执行的电表统计，已生成的结果保留。'
      : '取消后，将停止这项任务尚未执行的安排；已下发的动作不会撤销。';
  if (task.value.occurrence) content += '后续周期照常执行。';
  const confirmed = await new Promise((resolve) =>
    uni.showModal({
      title,
      content,
      cancelText: '保留任务',
      confirmText: task.value.occurrence ? '取消本次' : '确认取消',
      confirmColor: AGENT_COLORS.error,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    })
  );
  if (!confirmed || !props.active || activeTaskId.value !== taskId) return;
  cancelling.value = true;
  actionError.value = '';
  try {
    await cancelTask(taskId, version, props.source);
    await load(true);
    emit('cancelled');
    emit('dismiss');
  } catch (cause) {
    actionError.value = cause.message || '取消失败，请刷新后重试';
    showAgentError(cause, { fallback: '取消失败' });
    await load(true);
  } finally {
    cancelling.value = false;
  }
}
watch(
  () => [props.active, props.taskId, props.planId, props.sampleTask, props.source],
  () => {
    planControls.invalidate();
    clearInterval(refreshTimer);
    activeTaskId.value = props.taskId || '';
    activePlanId.value = props.planId || '';
    returnPlan.value = null;
    actionError.value = '';
    expandedPhases.value = [];
    allPhases.value = false;
    energyBasis.value = false;
    issue.value = null;
    if (props.active) {
      load();
      startPolling();
    } else {
      reads.invalidate();
      loading.value = false;
      cancelling.value = false;
    } // 保留关闭动画的结果快照；下次打开由 load 重新读取。
  },
  { immediate: true }
);
onUnmounted(() => {
  clearInterval(refreshTimer);
  reads.invalidate();
  planControls.invalidate();
});
function back() {
  if (!issue.value) return false;
  issue.value = null;
  return true;
}
defineExpose({ returnToPlan, back });
</script>
<style scoped>
.task-detail-host {
  height: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.task-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.task-heading .task-name {
  min-width: 0;
  flex: 1;
}
.task-heading .state-tag {
  margin: 0;
}
.task-rules {
  margin-top: 14px;
  padding: 12px 13px;
  border: 1px solid var(--agent-line);
  border-radius: 12px;
  color: var(--agent-text-secondary);
  font-size: 12px;
  line-height: 1.65;
}
.records-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}
.records-heading .section-title {
  margin: 0;
}
.records-toggle {
  min-height: 44px;
  margin: 0;
  color: var(--agent-text-muted);
  font-size: 12px;
}
.result-link {
  min-height: 44px;
  margin: 0;
  padding: 0 4px;
  display: flex;
  align-items: center;
  color: var(--agent-warning-deep);
}
.phase-head .result-link {
  margin-inline-start: auto;
}
.task-heading .result-link {
  flex-shrink: 0;
  min-height: 0;
  margin: 0;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 600;
}

.reference-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-reference {
  min-height: 42px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--agent-line);
  border-radius: 9px;
  background: linear-gradient(var(--agent-surface), var(--agent-tint));
  color: var(--agent-accent-deep);
  font-size: 12px;
}
.task-reference.secondary {
  background: transparent;
  color: var(--agent-text-muted);
}
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
button {
  margin: 12px auto 0;
  padding: 0;
  background: transparent;
  color: var(--agent-accent-deep);
  font-size: 12px;
}
button::after {
  border: 0;
}
.task-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}
.message {
  padding: 56px 24px;
  text-align: center;
  color: var(--agent-text-muted);
  font-size: 13px;
}
.message text {
  display: block;
}
.task-skeleton {
  padding-top: 16px;
}
.sk-bar {
  height: 10px;
  border-radius: 6px;
  background: var(--agent-tint);
  animation: sk-pulse 1.25s ease-in-out infinite;
}
.sk-title {
  height: 20px;
  width: 62%;
  background: var(--agent-tint);
}
.sk-meta {
  margin-top: 9px;
  height: 9px;
}
.sk-owner {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sk-avatar {
  width: 25px;
  height: 25px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--agent-tint);
  animation: sk-pulse 1.25s ease-in-out infinite;
}
.sk-owner-name {
  flex: 0 0 auto;
}
.sk-tag {
  width: 44px;
  height: 20px;
  border-radius: 8px;
  background: var(--agent-tint);
}
.sk-section {
  margin-top: 20px;
  height: 9px;
}
.sk-phase {
  margin-top: 14px;
}
.sk-node {
  width: 14px;
  height: 14px;
  margin-top: 3px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--agent-tint);
  animation: sk-pulse 1.25s ease-in-out infinite;
}
.sk-phase-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.w-16 {
  width: 16%;
}
.w-30 {
  width: 30%;
}
.w-36 {
  width: 36%;
}
.w-40 {
  width: 40%;
}
.w-52 {
  width: 52%;
}
.w-64 {
  width: 64%;
}
.w-74 {
  width: 74%;
}
@keyframes sk-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk-bar,
  .sk-avatar,
  .sk-node {
    animation: none;
    opacity: 0.8;
  }
}
.task-detail {
  padding: 10px 20px 34px;
}
.task-name {
  display: block;
  color: var(--agent-text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.plan-back {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  margin: 0 0 8px;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.task-when {
  display: block;
  margin-top: 5px;
  color: var(--agent-text-muted);
  font-size: 12px;
}
.owner-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 13px;
}
.owner-mark {
  width: 25px;
  height: 25px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--agent-accent), var(--agent-accent-deep));
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}
.owner-mark.cv-brass {
  background: linear-gradient(145deg, var(--agent-warning), var(--agent-warning-deep));
}
.owner-mark.cv-slate {
  background: linear-gradient(145deg, var(--agent-chart-deep), var(--agent-text-secondary));
}
.owner-mark.cv-grey {
  background: linear-gradient(145deg, var(--agent-text-faint), var(--agent-text-muted));
}
.owner-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.state-tag {
  flex-shrink: 0;
  padding: 5px 11px;
  border-radius: 999px;
  color: var(--agent-success);
  background: var(--agent-success-faint);
  font-size: 12px;
  font-weight: 600;
}
.state-tag.dispatched,
.state-tag.partial,
.state-tag.unconfirmed,
.state-tag.unknown,
.state-tag.unavailable {
  color: var(--agent-warning-deep);
  background: var(--agent-warning-faint);
}
.state-tag.failed,
.state-tag.interrupted,
.state-tag.missed {
  color: var(--agent-warning-deep);
  background: var(--agent-warning-faint);
}
.state-tag.cancelled {
  color: var(--agent-text-muted);
  background: var(--agent-tint);
}
.plan-toggle-row {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--agent-line);
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
  color: var(--agent-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.plan-pause-reason {
  display: block;
  margin-top: 6px;
  color: var(--agent-warning);
  font-size: 11px;
}
.section-title {
  display: block;
  margin: 18px 0 9px;
  font-size: 11px;
  font-weight: 700;
  color: var(--agent-text-muted);
}
.phase {
  display: flex;
  gap: 11px;
}
.phase-rail {
  width: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.phase-node {
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border: 2px solid var(--agent-text-muted);
  box-sizing: border-box;
  border-radius: 50%;
  background: #fff;
}
.phase-node.tone-ok {
  background: var(--agent-success);
  border-color: var(--agent-success);
  box-shadow: inset 0 0 0 3px white;
}
.phase-node.tone-warn {
  background: var(--agent-warning);
  border-color: var(--agent-warning);
  box-shadow: inset 0 0 0 3px white;
}
.phase-node.tone-fail {
  background: var(--agent-error);
  border-color: var(--agent-error);
  box-shadow: inset 0 0 0 3px white;
}
.phase-node.tone-active {
  border-color: var(--agent-accent-deep);
  background: #fff;
}
.phase-node.tone-off {
  border-color: var(--agent-text-faint);
}
.phase-node.ending {
  background: #fff;
}
.phase-link {
  width: 3px;
  min-height: 25px;
  flex: 1;
  border-radius: 2px;
  background: var(--agent-line);
  overflow: hidden;
}
.phase-link-fill {
  width: 100%;
  background: linear-gradient(var(--agent-accent-deep), var(--agent-chart));
}
.phase-main {
  flex: 1;
  min-width: 0;
  padding-bottom: 18px;
}
.phase-head {
  min-width: 0;
}
.phase-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.phase-bottom {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-top: 3px;
}
.phase-time {
  color: var(--agent-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.phase-note {
  color: var(--agent-text-muted);
  font-size: 11px;
}
.phase-status {
  flex-shrink: 0;
  color: var(--agent-text-secondary);
  font-size: 14px;
  font-weight: 600;
}
.phase-status.tone-ok {
  color: var(--agent-success);
}
.phase-status.tone-warn {
  color: var(--agent-warning);
}
.phase-status.tone-fail {
  color: var(--agent-error);
}
.phase-status.tone-active {
  color: var(--agent-accent-deep);
}
.phase-status.tone-off {
  color: var(--agent-text-muted);
}
.phase-reason {
  display: block;
  margin-top: 5px;
  color: var(--agent-warning);
  font-size: 11px;
}
.phase-report {
  width: 100%;
  min-height: 44px;
  margin: 9px 0 0;
  padding: 6px 10px;
  border: 1px solid var(--agent-line);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  text-align: left;
}
.phase-report:active {
  background: var(--agent-tint);
}
.phase-report-title {
  flex: 1;
  min-width: 0;
  color: var(--agent-text-secondary);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.phase-report-tag {
  flex-shrink: 0;
  color: var(--agent-warning);
  font-size: 10px;
}
.phase-devices {
  width: 100%;
  min-height: 38px;
  margin: 9px 0 0;
  padding: 5px 9px;
  border: 1px solid var(--agent-line);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--agent-surface-page);
  text-align: left;
}
.phase-devices.attached {
  margin-top: -1px;
  border-top: 1px dashed var(--agent-line);
  border-radius: 0 0 8px 8px;
}
.phase-reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 240ms cubic-bezier(0.23, 1, 0.32, 1);
}
.phase-reveal.open {
  grid-template-rows: 1fr;
}
.phase-reveal-inner {
  min-height: 0;
  overflow: hidden;
}
.phase-devices .caret-flip {
  transform: rotate(180deg);
}
.phase-devices uni-icons {
  transition: transform 240ms cubic-bezier(0.23, 1, 0.32, 1);
}
@media (prefers-reduced-motion: reduce) {
  .phase-reveal,
  .phase-devices uni-icons {
    transition: none;
  }
}
.phase-avatars {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-left: 5px;
}
.phase-avatar {
  width: 22px;
  height: 22px;
  margin-left: -5px;
  border: 1px solid #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--agent-tint);
}
.phase-avatar image {
  width: 22px;
  height: 22px;
}
.phase-device-count {
  flex: 1;
  min-width: 0;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.device-list {
  margin-top: 9px;
  border-top: 1px solid var(--agent-line);
  animation: listIn 160ms cubic-bezier(0.23, 1, 0.32, 1) backwards;
}
@keyframes listIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
.device-row {
  padding: 9px 0;
  border-bottom: 1px solid var(--agent-line);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 8px;
  row-gap: 3px;
}
.device-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--agent-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.target {
  color: var(--agent-text-muted);
  font-size: 11px;
  text-align: right;
}
.result {
  grid-column: 1/-1;
  font-size: 12px;
}
.result.ok {
  color: var(--agent-success);
}
.result.warn {
  color: var(--agent-warning);
}
.result.fail {
  color: var(--agent-error);
}
.result.wait {
  color: var(--agent-text-muted);
}
.task-report {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--agent-line);
  border-radius: 10px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(var(--agent-shadow-rgb), 0.05);
}
.report-cta {
  width: 100%;
  margin: 0;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--agent-line);
  border-radius: 12px;
  background: var(--agent-tint);
  text-align: left;
}
.report-cta:active {
  background: var(--agent-line);
}
.report-cta-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.report-cta-title {
  color: var(--agent-accent-deep);
  font-size: 13px;
  font-weight: 600;
}
.report-cta-note {
  color: var(--agent-text-muted);
  font-size: 10px;
}
.report-summary-block {
  display: block;
}
.latest-report-link {
  width: 100%;
  margin: 8px 0 0;
  color: var(--agent-accent-deep);
  font-size: 11px;
  text-align: left;
}
.report-title {
  display: block;
  color: var(--agent-text-secondary);
  font-size: 11px;
  font-weight: 700;
}
.report-summary {
  display: block;
  margin-top: 5px;
  color: var(--agent-text-primary);
  font-size: 12px;
  font-weight: 600;
}
.report-energy {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.4;
}
.report-energy.energy-ok {
  color: var(--agent-success);
}
.report-energy.energy-warn {
  color: var(--agent-warning);
}
.report-energy.energy-muted {
  color: var(--agent-text-muted);
}
.energy-hero {
  margin-top: 9px;
  padding: 12px;
  border: 1px solid var(--agent-line);
  border-radius: 12px;
  background: linear-gradient(145deg, var(--agent-surface-page), var(--agent-tint));
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.energy-hero--unavailable {
  border-color: var(--agent-warning-faint);
  background: linear-gradient(145deg, var(--agent-surface), var(--agent-warning-faint));
}
.energy-hero-main {
  min-width: 0;
  flex: 1;
}
.energy-hero-number {
  color: var(--agent-accent-deep);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.5px;
}
.energy-hero--unavailable .energy-hero-number {
  color: var(--agent-warning-deep);
  font-size: 15px;
  line-height: 1.35;
  letter-spacing: 0;
}
.energy-hero-unit {
  margin-left: 3px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
}
.energy-hero-label {
  display: block;
  margin-top: 5px;
  color: var(--agent-text-secondary);
  font-size: 10px;
}
.energy-hero--unavailable .energy-hero-label {
  color: var(--agent-warning-deep);
}
.energy-hero-side {
  flex-shrink: 0;
  max-width: 132px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
}
.energy-hero-badge {
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--agent-text-secondary);
  font-size: 9px;
}
.energy-hero--unavailable .energy-hero-badge {
  color: var(--agent-warning-deep);
}
.energy-hero-foot {
  color: var(--agent-text-secondary);
  font-size: 9px;
  line-height: 1.45;
  text-align: right;
}
.energy-hero--unavailable .energy-hero-foot {
  color: var(--agent-warning-deep);
}
.energy-facts {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.energy-fact {
  padding: 8px;
  border: 1px solid var(--agent-line);
  border-radius: 9px;
  background: #fff;
}
.energy-fact-value {
  display: block;
  color: var(--agent-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.energy-fact-label {
  display: block;
  margin-top: 3px;
  color: var(--agent-text-muted);
  font-size: 9px;
}
.energy-basis-card {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--agent-line);
  border-radius: 10px;
  background: #fff;
}
.energy-basis-title {
  display: block;
  color: var(--agent-text-secondary);
  font-size: 10px;
  font-weight: 600;
}
.energy-formula {
  display: block;
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 7px;
  background: var(--agent-surface-page);
  color: var(--agent-text-secondary);
  font-size: 10px;
  line-height: 1.5;
}
.energy-basis-note {
  display: block;
  margin-top: 6px;
  color: var(--agent-text-muted);
  font-size: 9px;
  line-height: 1.45;
}
.energy-devices {
  margin-top: 8px;
  border-top: 1px solid var(--agent-line);
}
.energy-device-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 7px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--agent-line);
}
.energy-device-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--agent-text-secondary);
  font-size: 11px;
}
.energy-device-before {
  color: var(--agent-text-muted);
  font-size: 10px;
}
.energy-device-after {
  font-size: 10px;
}
.energy-device-after.after-ok {
  color: var(--agent-success);
  font-weight: 600;
}
.energy-device-after.after-muted {
  color: var(--agent-warning-deep);
}
.energy-devices-more {
  display: block;
  padding: 7px 0 0;
  color: var(--agent-text-muted);
  font-size: 9px;
}
.report-note {
  display: block;
  margin-top: 5px;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.task-delete {
  width: 100%;
  height: 38px;
  margin: 18px 0 0;
  border: 1px solid var(--agent-error-faint);
  border-radius: 8px;
  background: #fff;
  color: var(--agent-error);
  font-size: 12px;
  line-height: 36px;
}
.task-delete[disabled] {
  opacity: 0.55;
}
.action-error {
  display: block;
  margin-top: 10px;
  color: var(--agent-error);
  font-size: 11px;
}
@media (prefers-reduced-motion: reduce) {
  .device-list {
    animation: none;
  }
}
</style>
