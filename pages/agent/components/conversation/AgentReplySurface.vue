<template>
  <view
    class="reply-surface"
    :class="{ 'reply-surface--failed': Boolean(turn.error) }"
  >
    <view class="reply-identity">
      <AgentAvatar :running="turn.running" />
      <view class="reply-identity__meta">
        <text class="reply-identity__name">{{ agentName }}</text>
        <ThinkingOrb
          :running="turn.running"
          :failed="Boolean(turn.error)"
          :seconds="turn.seconds"
        />
      </view>
    </view>

    <view class="reply-content">
      <view
        v-if="turn.activities.length"
        class="trace"
        :class="{ 'trace--open': turn.traceOpen }"
      >
        <button
          class="trace__toggle"
          hover-class="trace__toggle--pressed"
          @tap="$emit('toggle-trace')"
        >
          <view class="trace__label"
            ><uni-icons
              type="list"
              size="14"
              color="var(--agent-text-secondary)"
            /><text>处理记录</text></view
          >
          <uni-icons
            class="trace__chevron"
            :class="{ 'trace__chevron--open': turn.traceOpen }"
            type="down"
            size="13"
            color="var(--agent-text-muted)"
          />
        </button>
        <view class="trace__expand"
          ><view class="trace__clip"><ToolActivity :items="turn.activities" /></view
        ></view>
      </view>

      <template
        v-for="item in turn.items"
        :key="item.id"
      >
        <AssistantMarkdown
          v-if="item.kind === 'text'"
          :content="item.text ?? turn.text"
        />
        <view
          v-else-if="item.kind === 'draftText'"
          class="reply-draft"
          :class="{ 'reply-draft--settled': item.settled }"
          ><AssistantMarkdown :content="item.settled ? (item.text ?? turn.text) : item.text"
        /></view>
        <ObservationCard
          v-else-if="item.kind === 'obs'"
          :observation="item.obs"
          :running="turn.running"
          :source="source"
          @select-alert="$emit('select-alert', $event)"
          @browse-alerts="$emit('browse-alerts')"
          @open-report="$emit('open-report', $event)"
          :read-only="readOnly || source === 'company'"
        />
        <template v-else-if="item.kind === 'panel' && !readOnly">
          <ActionPanel
            :source="source"
            v-if="turn.draft"
            :draft="turn.draft"
            :roster="turn.roster"
            :result="turn.result"
            :busy="busy"
            @select="$emit('select', $event)"
            @confirm="$emit('confirm')"
            @cancel="$emit('cancel')"
            @revalidate="$emit('revalidate')"
            @updated="$emit('updated', $event)"
            @editing="$emit('editing', $event)"
            @configure="$emit('configure', $event)"
            @browse="$emit('browse')"
          />
        </template>
        <template v-else-if="item.kind === 'task' && !readOnly">
          <TaskChangeCard
            v-if="item.task.kind === 'change'"
            :change="item.task"
            :busy="busy"
            @confirm="$emit('confirm-task', item.task)"
            @discard="$emit('discard-task', item.task)"
          />
          <TaskProposalCard
            v-else
            :task="item.task"
            :source="source"
            :busy="busy"
            :confirming="!item.task.cancellationId && confirmingTaskId === item.task.taskId"
            @confirm="$emit('confirm-task', item.task)"
            @discard="$emit('discard-task', item.task)"
            @open="$emit('open-task', $event || item.task)"
            @issue="$emit('issue', $event)"
          />
        </template>
      </template>
      <view
        v-if="readOnly && (turn.draft || turn.tasks?.length || turn.task || turn.result)"
        class="read-only-boundary"
        >此来源当前仅开放只读查询，操作能力尚未接入。</view
      >
      <view
        v-if="!readOnly && turn.result && turn.result.summary"
        class="execution-summary"
        aria-live="polite"
      >
        <text
          v-if="turn.result.summary.status === 'completed'"
          class="execution-answer"
          >{{ turn.result.summary.text }}</text
        >
        <view
          v-else-if="turn.result.summary.status === 'running'"
          class="execution-progress"
          ><view class="execution-spinner" /><text>正在整理执行结果</text></view
        >
        <view v-else-if="turn.result.summary.status === 'failed'"
          ><text class="reply-error">{{
            turn.result.summary.reason || '执行总结未完成：未取得具体原因'
          }}</text
          ><button
            class="execution-retry"
            :disabled="busy"
            hover-class="execution-retry--pressed"
            @tap="$emit('retry-answer')"
            ><uni-icons
              type="refreshempty"
              size="14"
              color="var(--agent-text-muted)"
            /><text>重试回答</text></button
          ></view
        >
      </view>
      <TaskErrorNotice
        v-if="turn.error && turn.items.some((item) => item.kind === 'task')"
        :message="turn.error"
        summary="这次暂未完成"
        @details="$emit('issue', $event)"
      /><text
        v-else-if="turn.error"
        class="reply-error"
        >{{ turn.error }}</text
      >
    </view>
  </view>
</template>

<script setup>
import ActionPanel from '../tasks/ActionPanel.vue';
import AgentAvatar from '../shared/AgentAvatar.vue';
import AssistantMarkdown from './AssistantMarkdown.vue';
import ObservationCard from '../observations/ObservationCard.vue';
import ThinkingOrb from './ThinkingOrb.vue';
import ToolActivity from './ToolActivity.vue';
import TaskProposalCard from '../tasks/TaskProposalCard.vue';
import TaskChangeCard from '../tasks/TaskChangeCard.vue';
import TaskErrorNotice from '../tasks/TaskErrorNotice.vue';

defineProps({
  turn: { type: Object, required: true },
  source: { type: String, default: 'office' },
  busy: Boolean,
  confirmingTaskId: { type: String, default: '' },
  readOnly: Boolean,
  agentName: { type: String, default: '物联 Agent' },
});
defineEmits([
  'toggle-trace',
  'select',
  'confirm',
  'cancel',
  'revalidate',
  'updated',
  'editing',
  'retry-answer',
  'configure',
  'browse',
  'confirm-task',
  'discard-task',
  'open-task',
  'select-alert',
  'browse-alerts',
  'open-report',
  'issue',
]);
</script>

<style scoped lang="scss">
@import '../../styles/tokens';

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
.reply-surface {
  width: 100%;
  min-width: 0;
}
.reply-identity {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  min-height: 30px;
}
.reply-identity__meta {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  min-width: 0;
}
.reply-identity__name {
  flex-shrink: 0;
  color: $agent-color-text-primary;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.1px;
}
.reply-content {
  min-width: 0;
  margin-top: 8px;
}
.trace {
  margin: 0 0 8px;
  border-radius: $agent-radius-medium;
  background: $agent-color-accent-faint;
  transition: background-color 180ms ease;
}
.trace--open {
  background: $agent-color-tint;
}
.trace__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 40px;
  margin: 0;
  padding: 0 11px;
  border-radius: $agent-radius-medium;
  background: transparent;
  color: $agent-color-text-secondary;
  font-size: $agent-font-size-compact;
  line-height: 1;
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 140ms ease;
}
.trace__toggle::after,
.execution-retry::after {
  border: 0;
}
.trace__toggle--pressed {
  transform: scale(0.985);
  opacity: 0.72;
}
.trace__label {
  display: flex;
  align-items: center;
  gap: 7px;
}
.trace__chevron {
  transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
}
.trace__chevron--open {
  transform: rotate(180deg);
}
/* max-height 收展：盒子高度始终贴合内容，无测量、无 auto 切换跳变。
   上限 640px 覆盖轨迹列表的合理长度；展开视觉为渐进揭示，收起尾部略有减速感，可接受。 */
.trace__expand {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition:
    max-height 300ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 200ms ease;
}
.trace--open .trace__expand {
  max-height: 640px;
  opacity: 1;
}
.trace__clip {
  padding: 0 11px;
}
.trace :deep(.activity) {
  margin: 2px 0 10px;
}
/* 未定稿正文：与答复同位、以过程权重呈现；reclassified 折叠进处理记录，completed 原地沉淀为终稿色（同一元素过渡，不换节点）。 */
.reply-draft {
  color: $agent-color-text-secondary;
  transition: color 0.45s ease;
}
.reply-draft--settled {
  color: $agent-color-text-primary;
}
.execution-summary {
  margin-top: 16px;
}
.read-only-boundary {
  margin-top: 12px;
  padding: 8px 10px;
  border-left: 2px solid $agent-color-warning-deep;
  background: $agent-color-warning-faint;
  color: $agent-color-warning-deep;
  font-size: $agent-font-size-compact;
  line-height: 1.55;
}
.execution-answer {
  display: block;
  color: $agent-color-text-primary;
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.execution-progress,
.execution-retry {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
}
.execution-retry {
  min-height: 40px;
  margin: 0;
  padding: 0 8px;
  border-radius: 10px;
  background: transparent;
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    background-color 140ms ease;
}
.execution-retry--pressed {
  transform: scale(0.97);
  background: $agent-color-tint;
}
.execution-spinner {
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  flex-shrink: 0;
  border: 1.5px solid $agent-color-line;
  border-top-color: $agent-color-text-muted;
  border-radius: 50%;
  animation: execution-spin 0.8s linear infinite;
}
.reply-error {
  display: inline-block;
  margin-top: 12px;
  padding: 7px 10px;
  border-radius: 10px;
  background: $agent-color-error-faint;
  color: $agent-color-error;
  font-size: $agent-font-size-compact;
  line-height: 1.5;
}
@keyframes execution-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .trace,
  .trace__toggle,
  .trace__expand,
  .trace__chevron,
  .execution-retry {
    transition: none;
  }
  .execution-spinner {
    animation: none;
  }
}
</style>
