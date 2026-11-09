<template>
  <view class="task-card">
    <view class="task-head"
      ><text class="task-kicker">{{
        isCancellation ? '取消任务' : task.repeat ? '周期任务' : '定时任务'
      }}</text
      ><text
        class="task-state"
        :class="state"
        >{{ stateText }}</text
      ></view
    >
    <text class="task-name">{{ task.label }}</text>
    <text
      v-if="task.repeat"
      class="task-repeat"
      >{{ repeatText(task.repeat) }}</text
    >
    <text
      v-if="task.repeat && isCreated && (task.nextCheckpointAt || task.nextAt)"
      class="task-interval"
      >{{ nextLabel }} · {{ taskTime(task.nextCheckpointAt || task.nextAt) }}</text
    >
    <text
      v-if="task.interval"
      class="task-interval"
      >{{ intervalText }}</text
    >
    <view
      v-if="(state === 'pending_confirmation' || isCreated) && requirementLines.length"
      class="task-rules"
    >
      <text
        v-for="line in requirementLines"
        :key="line"
        class="task-rule"
        >{{ line }}</text
      >
    </view>
    <view
      v-if="state === 'pending_confirmation' && sharedActions"
      class="shared-devices"
    >
      <view class="shared-head"
        ><text>共用设备 · {{ sharedActions.length }} 台</text
        ><button
          class="names-toggle"
          :aria-expanded="fullNames"
          @tap="fullNames = !fullNames"
          >{{ fullNames ? '简短名称' : '完整名称' }}</button
        ></view
      >
      <text
        v-if="deviceLayout.scopes[0]?.length"
        class="shared-scope"
        >{{ deviceLayout.scopes[0].join('、') }}</text
      >
      <text
        v-if="phasesShown[0].preflight?.excludedScopes?.length"
        class="shared-scope"
        >不操作 · {{ phasesShown[0].preflight.excludedScopes.join('、') }} ·
        {{ phasesShown[0].preflight.excludedCount }} 台</text
      >
      <view
        v-for="action in sharedActions.slice(0, sharedExpanded ? Infinity : ROW_LIMIT)"
        :key="action.deviceId"
        class="task-device shared-device"
      >
        <view class="device-cell"
          ><image
            v-if="artworkOf(action)"
            class="device-art"
            :src="artworkOf(action)"
            mode="aspectFit"
          /><text class="device-name">{{
            fullNames ? action.deviceName : deviceDisplayName(action.deviceName)
          }}</text></view
        >
      </view>
      <button
        v-if="sharedActions.length > ROW_LIMIT"
        class="phase-more"
        :aria-expanded="sharedExpanded"
        @tap="sharedExpanded = !sharedExpanded"
        >{{
          sharedExpanded ? '收起设备' : `还有 ${sharedActions.length - ROW_LIMIT} 台 · 展开`
        }}</button
      >
    </view>
    <view
      v-if="state === 'pending_confirmation'"
      class="task-phases"
    >
      <view
        v-for="(phase, index) in phasesShown"
        :key="phase.at"
        class="task-phase"
      >
        <view class="phase-time"
          ><view
            class="phase-node"
            :class="{ ending: !task.interval && index === 1 }"
          /><text>{{ phaseTitle(index) }} · {{ taskTime(phase.at) }}</text></view
        >
        <text
          v-if="!sharedActions && deviceLayout.scopes[index]?.length"
          class="device-location preflight-line"
          >范围 · {{ deviceLayout.scopes[index].join('、') }}</text
        >
        <text
          v-if="!sharedActions && phase.preflight?.excludedScopes?.length"
          class="device-location preflight-line"
          >不操作 · {{ phase.preflight.excludedScopes.join('、') }} ·
          {{ phase.preflight.excludedCount }} 台</text
        >
        <text
          v-if="sharedActions"
          class="phase-target"
          >{{ targetText(phase.actions[0].kind, phase.actions[0].command) }} · 上述
          {{ sharedActions.length }} 台</text
        >
        <text
          v-if="phase.preflight?.unreadableCount"
          class="preflight-warning"
          >提案时有 {{ phase.preflight.unreadableCount }} 台未读到状态</text
        >
        <view
          v-for="action in actionsOf(phase, index)"
          :key="action.deviceId"
          class="task-device"
        >
          <view class="device-cell"
            ><image
              v-if="artworkOf(action)"
              class="device-art"
              :src="artworkOf(action)"
              mode="aspectFit"
            /><text class="device-name">{{ action.deviceName }}</text></view
          ><text class="device-target">{{ targetText(action.kind, action.command) }}</text>
        </view>
        <view
          v-for="device in readDevicesOf(phase, index)"
          :key="device.id"
          class="task-device read-device"
        >
          <view class="device-cell"
            ><image
              class="device-art"
              :src="artworkOf(device)"
              mode="aspectFit"
            /><text class="device-name">{{ device.name }}</text></view
          ><text class="device-target">{{ readTargetText(device.kind, phase.read) }}</text>
          <text
            v-if="device.location"
            class="device-location"
            >{{ device.location }}</text
          >
        </view>
        <button
          v-if="phaseRest(phase, index) || isExpanded(index)"
          class="phase-more"
          hover-class="phase-more--pressed"
          :aria-expanded="isExpanded(index)"
          @tap="togglePhase(index)"
        >
          <text>{{
            isExpanded(index) ? '收起' : `还有 ${phaseRest(phase, index)} 项 · 展开`
          }}</text>
          <uni-icons
            type="down"
            size="11"
            color="var(--agent-accent-deep)"
            :class="{ 'caret-up': isExpanded(index) }"
          />
        </button>
      </view>
    </view>
    <text
      v-if="isCancellation"
      class="task-note"
      >已做的操作保持原样</text
    >
    <view
      v-if="state === 'pending_confirmation'"
      class="task-actions"
    >
      <button
        class="task-secondary"
        hover-class="task-quiet--pressed"
        :disabled="busy"
        @tap="$emit('discard')"
        >放弃</button
      >
      <button
        class="task-primary"
        :class="{ destructive: isCancellation }"
        hover-class="task-primary--pressed"
        :disabled="busy || isConfirming || needsDecision"
        :loading="isConfirming"
        @tap="$emit('confirm')"
        >{{
          needsDecision
            ? '等待补充'
            : task.confirmation?.status === 'recovering'
              ? '正在核实'
              : isConfirming
                ? '正在创建'
                : isCancellation
                  ? '确认取消'
                  : task.repeat
                    ? '创建周期任务'
                    : '创建任务'
        }}</button
      >
    </view>
    <view
      v-else-if="isCreated"
      class="task-created"
    >
      <button
        class="task-link"
        @tap="$emit('open')"
        >{{
          task.repeat ? '查看周期任务' : source === 'company' ? '查看任务安排' : '在区域面板查看'
        }}
        <uni-icons
          type="right"
          size="13"
          color="var(--agent-accent-deep)"
      /></button>
      <button
        v-if="task.latestTask"
        class="task-link"
        @tap="$emit('open', task.latestTask)"
        >{{ task.latestTask.report ? '查看最近一次报告' : '查看本次任务' }}
        <uni-icons
          type="right"
          size="13"
          color="var(--agent-accent-deep)"
      /></button>
    </view>
    <text
      v-else
      class="task-ended"
      >{{
        state === 'expired'
          ? '提案已过期，请重新提出'
          : state === 'cancelled'
            ? '本次提案已放弃'
            : '本次提案已结束'
      }}</text
    >
    <text
      v-if="isConfirming && state === 'pending_confirmation'"
      class="task-wait"
      role="status"
      aria-live="polite"
      >{{ task.confirmation?.message || '正在核验设备范围并保存安排，请稍候。' }}</text
    >
    <TaskErrorNotice
      v-else-if="
        task.confirmation?.status === 'blocked' &&
        ['pending_confirmation', 'expired'].includes(state)
      "
      :message="task.confirmation.message"
      summary="这次暂未创建"
      @details="$emit('issue', $event)"
    />
    <text
      v-else-if="
        task.confirmation?.status === 'needs_decision' &&
        ['pending_confirmation', 'expired'].includes(state)
      "
      class="task-wait"
      role="status"
      >{{ task.confirmation.message }}</text
    >
  </view>
</template>
<script setup>
import { computed, ref } from 'vue';
import TaskErrorNotice from './TaskErrorNotice.vue';
import {
  readAcView,
  readTargetText,
  repeatText,
  taskRequirementLines,
  taskTime,
  targetText,
  taskStatusText,
  proposalDeviceLayout,
} from '../../lib/tasks.mjs';
import { resolveDeviceArtwork, deviceDisplayName } from '../../device-art/catalog.js';

// 单 phase 动作与待读设备共用 4 行预算；公司级任务的长清单默认收成尾巴可展开。
const ROW_LIMIT = 4;
const expandedPhases = ref([]);
const sharedExpanded = ref(false);
const fullNames = ref(false);
const isExpanded = (index) => expandedPhases.value.includes(index);
function togglePhase(index) {
  expandedPhases.value = isExpanded(index)
    ? expandedPhases.value.filter((value) => value !== index)
    : [...expandedPhases.value, index];
}
function actionsOf(phase, index) {
  return sharedActions.value
    ? []
    : (phase.actions || []).slice(0, isExpanded(index) ? Infinity : ROW_LIMIT);
}
function readDevicesOf(phase, index) {
  const budget = isExpanded(index)
    ? Infinity
    : ROW_LIMIT - Math.min((phase.actions || []).length, ROW_LIMIT);
  return (props.source === 'company' ? phase.read?.devices || [] : []).slice(
    0,
    Math.max(0, budget)
  );
}
function phaseRest(phase, index) {
  if (isExpanded(index)) return 0;
  const total =
    (sharedActions.value ? 0 : phase.actions?.length || 0) +
    (props.source === 'company' ? phase.read?.devices?.length || 0 : 0);
  return Math.max(0, total - ROW_LIMIT);
}

const props = defineProps({
  task: { type: Object, required: true },
  source: { type: String, default: 'office' },
  busy: Boolean,
  confirming: Boolean,
});
defineEmits(['confirm', 'discard', 'open', 'issue']);
const readAcOf = (phase) => readAcView(phase.read?.ac);
// 频率展开后的检查点共享同一窗口与设备；提案只展示一份窗口事实，避免把 18–48 次检查铺成重复卡片。
const acWindow = computed(() => {
  const phases = props.task.phases || [];
  if (phases.length < 2 || !phases.every((phase) => phase.read?.ac)) return null;
  return { ...readAcOf(phases[0]), count: phases.length };
});
const phasesShown = computed(() =>
  acWindow.value ? [props.task.phases[0]] : props.task.phases || []
);
const deviceLayout = computed(() => proposalDeviceLayout(phasesShown.value));
const sharedActions = computed(() => deviceLayout.value.sharedActions);
const isCancellation = computed(() => props.task.kind === 'cancellation');
const needsDecision = computed(() => props.task.confirmation?.status === 'needs_decision');
const isConfirming = computed(
  () => props.confirming || props.task.confirmation?.status === 'recovering'
);
const state = computed(() => String(props.task.status || '').toLowerCase());
const requirementLines = computed(() => taskRequirementLines(props.task));
const nextLabel = computed(() =>
  (props.task.phases || []).some((phase) => phase?.read?.ac?.cadenceMinutes)
    ? '下一次检查'
    : '下一次执行'
);
const isCreated = computed(() =>
  isCancellation.value
    ? state.value === 'confirmed'
    : Boolean(props.task.created) ||
      [
        'scheduled',
        'executing',
        'completed',
        'partial',
        'failed',
        'unconfirmed',
        'missed',
        'interrupted',
      ].includes(state.value)
);
const stateText = computed(() =>
  isCancellation.value
    ? {
        pending_confirmation: '待确认',
        confirmed: '已取消',
        cancelled: '已放弃',
        expired: '已过期',
      }[state.value] || '已结束'
    : props.task.repeat && isCreated.value
      ? props.task.planStatus === 'paused'
        ? '已暂停'
        : props.task.planStatus === 'deleted'
          ? '已删除'
          : props.task.nextAt === undefined
            ? '已创建'
            : props.task.nextAt
              ? '已开启'
              : props.task.latestTask?.status === 'executing'
                ? '本次进行中'
                : props.task.latestTask?.status === 'scheduled'
                  ? '本次未开始'
                  : '已结束'
      : taskStatusText(state.value)
);

const intervalText = computed(() => {
  if (!props.task.interval) return '';
  const start = taskTime(props.task.interval.startsAt),
    end = taskTime(props.task.interval.endsAt);
  const span =
    start.slice(0, 10) === end.slice(0, 10) ? `${start} 至 ${end.slice(-5)}` : `${start} 至 ${end}`;
  return `${span} · ${props.task.phases?.length || 0} 次检查`;
});
const artworkOf = (device) =>
  resolveDeviceArtwork({ ...device, deviceName: device.deviceName || device.name }).src;
function phaseTitle(index) {
  if (isCancellation.value) return state.value === 'confirmed' ? '已取消' : '将取消';
  const actualTitle = props.task.phases[index]?.title;
  if (actualTitle) return actualTitle;
  if (props.task.interval) return `第${index + 1}次检查`;
  if (props.task.phases[index]?.preflight) return `第${index + 1}次操作`;
  return props.task.phases.length === 1 ? '执行' : index === 0 ? '开始' : '结束';
}
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.task-card {
  width: 100%;
  box-sizing: border-box;
  margin-top: 14px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.1),
    0 1px 2px rgba(var(--agent-shadow-rgb), 0.07),
    0 10px 24px rgba(var(--agent-shadow-rgb), 0.07);
  overflow: hidden;
  color: $agent-color-text-secondary;
}
.task-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 3px 0;
}
.task-kicker {
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
  font-weight: 600;
}
.task-state {
  color: $agent-color-accent;
  font-size: 11px;
  font-weight: 600;
}
.task-wait {
  display: block;
  margin: 8px 3px 0;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
  line-height: 1.5;
}
.task-state.partial,
.task-state.unconfirmed,
.task-state.expired,
.task-state.cancelled,
.task-state.failed {
  color: $agent-color-warning-deep;
}
.task-name {
  display: block;
  margin: 5px 3px 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.task-repeat {
  display: block;
  margin: 7px 3px 0;
  color: $agent-color-text-secondary;
  font-size: $agent-font-size-compact;
  line-height: 1.5;
}
.task-interval {
  display: block;
  margin: 6px 3px 10px;
  color: $agent-color-text-muted;
  font-size: 11px;
}
.task-rules {
  margin: 12px 3px 2px;
  padding: 12px 13px;
  border: 1px solid $agent-color-line;
  border-radius: 12px;
  color: $agent-color-text-secondary;
  font-size: 12px;
  line-height: 1.65;
}
.task-rule {
  display: block;
}
.task-rule + .task-rule {
  margin-top: 3px;
}
.task-name + .task-phases,
.task-interval + .task-phases {
  margin-top: 10px;
}
.task-phases {
  border-top: 0.5px solid $agent-color-line;
}
.task-phase {
  padding: 11px 3px 9px;
}
.task-phase + .task-phase {
  border-top: 0.5px solid $agent-color-line;
}
.phase-time {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
  color: $agent-color-text-secondary;
  font-size: 11px;
  font-weight: 600;
}
.phase-node {
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  flex-shrink: 0;
  border-radius: 50%;
  background: $agent-color-accent-deep;
}
.phase-node.ending {
  border: 2px solid $agent-color-accent-deep;
  background: #fff;
}
.task-device {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 4px 0 4px 16px;
  font-size: $agent-font-size-compact;
  line-height: 1.4;
}
.device-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.device-art {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.device-name {
  flex: 1;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.device-target {
  flex-shrink: 0;
  max-width: 100%;
  color: $agent-color-text-secondary;
}
.device-location {
  width: 100%;
  margin-left: 16px;
  color: $agent-color-text-muted;
  font-size: 10px;
}
.preflight-line {
  display: block;
  width: auto;
  margin: 3px 0 3px 16px;
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.shared-devices {
  margin-top: 10px;
  padding: 9px 3px;
}
.shared-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
}
.names-toggle {
  margin: 0;
  padding: 6px;
  background: transparent;
  color: $agent-color-accent;
  font-size: 11px;
}
.names-toggle::after {
  border: 0;
}
.shared-scope {
  display: block;
  margin: 4px 0;
  font-size: 11px;
  line-height: 1.5;
}
.shared-device {
  padding-left: 0;
}
.phase-target {
  display: block;
  margin-left: 16px;
  font-size: 13px;
  font-weight: 600;
}
.preflight-warning {
  display: block;
  margin: 5px 0 0 16px;
  color: $agent-color-warning-deep;
  font-size: 11px;
}
.phase-more {
  width: 100%;
  min-height: 34px;
  margin-top: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: $agent-color-accent;
  font-size: 11px;
  font-weight: 600;
  border-radius: 0;
}
.phase-more--pressed {
  background: $agent-color-tint;
}
.caret-up {
  transform: rotate(180deg);
}
.task-note {
  display: block;
  padding: 0 3px 10px;
  color: $agent-color-warning-deep;
  font-size: 11px;
}
.task-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $agent-space-small;
  padding: 13px 3px 3px;
  border-top: 0.5px solid $agent-color-line;
}
.task-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  border-radius: 10px;
  font-size: $agent-font-size-compact;
  line-height: 44px;
  transition:
    transform 120ms cubic-bezier(0.23, 1, 0.32, 1),
    background-color 160ms ease,
    box-shadow 160ms ease,
    opacity 160ms ease;
}
.task-actions button::after,
.task-link::after {
  border: 0;
}
.task-secondary {
  min-width: 48px;
  border: 0;
  background: transparent;
  color: $agent-color-text-muted;
}
.task-primary {
  min-width: 112px;
  border: 1px solid $agent-color-accent;
  background: $agent-color-accent;
  color: #fff;
  box-shadow: 0 4px 10px rgba(var(--agent-shadow-rgb), 0.13);
}
.task-primary.destructive {
  border-color: $agent-color-error;
  background: $agent-color-error;
  box-shadow: 0 4px 10px rgba(var(--agent-shadow-rgb), 0.13);
}
.task-quiet--pressed {
  transform: scale(0.975);
  background: $agent-color-tint;
}
.task-primary--pressed {
  transform: scale(0.975);
  background: $agent-color-accent-deep;
  box-shadow: 0 2px 6px rgba(var(--agent-shadow-rgb), 0.11);
}
.task-primary.destructive.task-primary--pressed {
  background: $agent-color-error;
}
.task-actions button[disabled] {
  opacity: 0.52;
  box-shadow: none;
}
.task-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 43px;
  margin: 10px 0 0;
  border-top: 0.5px solid $agent-color-line;
  border-radius: 0;
  background: transparent;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
.task-ended {
  display: block;
  padding: 12px 3px 2px;
  border-top: 0.5px solid $agent-color-line;
  color: $agent-color-text-muted;
  font-size: 11px;
}
@media (prefers-reduced-motion: reduce) {
  .task-actions button {
    transition: none;
  }
}
</style>
