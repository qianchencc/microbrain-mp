<template>
 <view class="change-card">
  <view class="change-head">
   <view class="change-heading">
    <text class="change-kicker">{{ operationText }}</text>
    <text class="change-scope">{{ scopeText }}</text>
   </view>
   <text class="change-status" :class="state">{{ statusText }}</text>
  </view>
  <text class="change-title">{{ change.label || change.after?.label || change.before?.label || '任务安排' }}</text>

  <view class="change-versions">
   <view v-for="version in versions" :key="version.key" class="change-version" :class="'change-version--' + version.key">
    <text class="version-label">{{ version.label }}</text>
    <text class="version-title">{{ version.template?.label || '未命名安排' }}</text>
    <text class="version-line">{{ scheduleText(version.template) }}</text>
    <text class="version-line">{{ repeatText(version.template?.repeat) || '不重复' }}</text>
    <view class="target-list">
     <text v-for="target in version.targets.items" :key="target" class="target-item">{{ target }}</text>
     <text v-if="version.targets.omitted" class="target-more">另有 {{ version.targets.omitted }} 项</text>
    </view>
    <view v-if="version.key === 'before' && change.operation === 'edit'" class="change-arrow"><uni-icons type="down" size="13" color="var(--agent-text-faint)" /></view>
   </view>
  </view>

  <text v-if="operationEffect" class="change-effect">{{ operationEffect }}</text>
  <text v-if="changesFutureOnly" class="change-note">仅影响未来周期安排；已生成任务与历史记录不变。</text>
  <text v-else-if="change.operation === 'delete' && scopeText === '本任务'" class="change-note">已完成的阶段和历史结果保持原样。</text>
  <view v-if="pending" class="change-actions">
   <button class="change-discard" hover-class="change-discard--pressed" :disabled="busy" @tap="$emit('discard')">放弃</button>
   <button class="change-confirm" :class="{ destructive: change.operation === 'delete' }" hover-class="change-confirm--pressed" :disabled="busy" @tap="$emit('confirm')">{{ confirmText }}</button>
  </view>
  <text v-else class="change-receipt">{{ receiptText }}</text>
 </view>
</template>

<script setup>
import { computed } from 'vue'
import { readTargetText, repeatText, taskTime, targetText } from '../../lib/tasks.mjs'

const props = defineProps({ change: { type: Object, required: true }, busy: Boolean })
defineEmits(['confirm', 'discard'])

const state = computed(() => String(props.change.status || '').toLowerCase())
const pending = computed(() => state.value === 'pending_confirmation')
const scopeText = computed(() => {
 if (props.change.target?.type === 'task_plan') return '整个周期'
 if (props.change.operation === 'skip' || String(props.change.target?.taskId || '').startsWith('occurrence:') || props.change.before?.repeat || props.change.after?.repeat) return '仅本次'
 return '本任务'
})
const operationText = computed(() => {
 if (props.change.operation === 'delete') return props.change.target?.type === 'task_plan' ? '删除重复安排' : '删除任务'
 return ({ edit: '调整安排', pause: '暂停重复安排', resume: '恢复重复安排', skip: '跳过本次安排' })[props.change.operation] || '任务变更'
})
const confirmText = computed(() => ({ edit: '确认修改', pause: '确认暂停', resume: '确认恢复', delete: '确认删除', skip: '确认跳过' })[props.change.operation] || '确认变更')
const statusText = computed(() => ({ pending_confirmation: '待确认', confirmed: '已确认', cancelled: '已放弃', expired: '已过期' })[state.value] || '已结束')
const receiptText = computed(() => ({ confirmed: '变更已确认', cancelled: '本次提案已放弃', expired: '本次提案已过期' })[state.value] || '本次提案已结束')
const changesFutureOnly = computed(() => props.change.operation === 'edit' && scopeText.value === '整个周期')
const operationEffect = computed(() => ({
 pause: '确认后暂停重复，以后不再执行；已经生成的任务继续。',
 resume: '确认后从下一次安排继续；不补做过去的安排。',
 delete: '确认后删除重复安排，以后不再执行；已经生成的任务与历史报告保留。',
 skip: '确认后仅跳过这一次安排，其他日期与周期规则保持不变。',
})[props.change.operation] || '')
const versions = computed(() => [
 { key: 'before', label: '当前安排', template: props.change.before, targets: targetSummary(props.change.before) },
 ...(props.change.operation === 'edit' ? [{ key: 'after', label: '提案安排', template: props.change.after, targets: targetSummary(props.change.after) }] : []),
])

function scheduleText(template) {
 if (!template) return '时间未提供'
 if (template.interval?.startsAt && template.interval?.endsAt) {
  return `时间 · ${taskTime(template.interval.startsAt)} 至 ${taskTime(template.interval.endsAt)}`
 }
 const times = (template.phases || []).map(phase => taskTime(phase.at)).filter(Boolean)
 return times.length ? `时间 · ${times.join('、')}` : '时间未提供'
}

function targetSummary(template) {
 const items = []
 for (const phase of template?.phases || []) {
  for (const action of phase.actions || []) {
   const name = action.deviceName || action.name || action.deviceId || '设备'
   items.push(`${name} · ${targetText(action.kind, action.command || action.target)}`)
  }
  for (const device of phase.read?.devices || []) {
   items.push(`${device.name || device.id || '设备'} · ${readTargetText(device.kind, phase.read)}`)
  }
  if (phase.read?.alertWindow === 'previous_day') items.push('安全台账 · 阶段计划日期的前一自然日（上海时间）')
  else if (phase.read?.alertWindow === 'previous_week') items.push('安全台账 · 上一自然周，周一至周日（上海时间）')
  else if (phase.read?.alertDays) items.push(`安全台账 · 近 ${phase.read.alertDays} 天`)
 }
 const unique = [...new Set(items)]
 return { items: unique.length ? unique.slice(0, 4) : ['无设备目标'], omitted: Math.max(0, unique.length - 4) }
}
</script>

<style scoped lang="scss">
@import "../../styles/tokens";
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; }
button::after { border:0; }
.change-card { box-sizing:border-box; width:100%; margin-top:14px; padding:12px; border-radius:14px; background:linear-gradient(var(--agent-surface),var(--agent-surface-page)); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 0 .5px rgba(var(--agent-shadow-rgb),.10),0 1px 2px rgba(var(--agent-shadow-rgb),.07),0 8px 20px rgba(var(--agent-shadow-rgb),.06); color:$agent-color-text-primary; }
.change-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.change-heading { display:flex; align-items:center; gap:$agent-space-small; min-width:0; }
.change-kicker { color:$agent-color-text-secondary; font-size:$agent-font-size-compact; font-weight:650; }
.change-scope { flex-shrink:0; padding:3px 7px; border-radius:8px; background:$agent-color-warning-faint; color:$agent-color-warning-deep; font-size:10px; }
.change-status { flex-shrink:0; color:$agent-color-warning-deep; font-size:10px; font-weight:600; }
.change-status.confirmed { color:$agent-color-success; }.change-status.cancelled,.change-status.expired { color:$agent-color-text-muted; }
.change-title { display:block; margin-top:6px; color:$agent-color-text-primary; font-size:15px; font-weight:700; line-height:1.4; overflow-wrap:anywhere; }
.change-versions { margin-top:10px; border-top:1px solid $agent-color-line; }
.change-version { padding:10px 4px 8px; }
.change-version--after { border-left:2px solid $agent-color-accent; padding-left:9px; }
.version-label { display:block; color:$agent-color-text-muted; font-size:10px; font-weight:600; }
.version-title { display:block; margin-top:3px; color:$agent-color-text-primary; font-size:$agent-font-size-compact; font-weight:650; overflow-wrap:anywhere; }
.version-line { display:block; margin-top:4px; color:$agent-color-text-muted; font-size:10px; line-height:1.5; overflow-wrap:anywhere; }
.target-list { display:flex; flex-direction:column; gap:3px; margin-top:6px; }
.target-item,.target-more { color:$agent-color-text-secondary; font-size:10px; line-height:1.45; overflow-wrap:anywhere; }
.target-more { color:$agent-color-text-muted; }
.change-arrow { height:14px; display:flex; align-items:center; justify-content:center; }
.change-note { display:block; padding:8px 9px; border-left:2px solid $agent-color-warning; background:$agent-color-warning-faint; color:$agent-color-warning-deep; font-size:10px; line-height:1.5; }
.change-effect { display:block; padding:10px; border-left:2px solid $agent-color-accent; background:$agent-color-tint; color:$agent-color-text-secondary; font-size:$agent-font-size-compact; line-height:1.5; }
.change-receipt { display:block; padding:9px 3px 1px; border-top:1px solid $agent-color-line; color:$agent-color-text-muted; font-size:11px; }
.change-actions { display:flex; justify-content:flex-end; align-items:center; gap:$agent-space-small; margin-top:7px; padding:11px 3px 1px; border-top:1px solid $agent-color-line; }
.change-actions button { min-height:42px; padding:0 12px; border-radius:9px; font-size:$agent-font-size-compact; line-height:42px; transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 150ms ease,opacity 150ms ease; }
.change-discard { color:$agent-color-text-muted; }
.change-confirm { min-width:100px; border:1px solid $agent-color-accent-deep; background:$agent-color-accent-deep; color:#fff; box-shadow:0 3px 8px rgba(var(--agent-shadow-rgb),.13); }
.change-confirm.destructive { border-color:$agent-color-error; background:$agent-color-error; box-shadow:0 3px 8px rgba(var(--agent-shadow-rgb),.13); }
.change-discard--pressed,.change-confirm--pressed { transform:scale(.975); }
.change-discard--pressed { background:$agent-color-tint; }
.change-confirm--pressed { background:$agent-color-accent-deep; }
.change-confirm.destructive.change-confirm--pressed { background:$agent-color-error; }
.change-actions button[disabled] { opacity:.52; }
@media(prefers-reduced-motion:reduce) { .change-actions button { transition:none; } }
</style>
