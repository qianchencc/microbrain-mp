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
    <view v-if="version.key === 'before' && change.operation === 'edit'" class="change-arrow"><uni-icons type="down" size="13" color="#98a59d" /></view>
   </view>
  </view>

  <text v-if="operationEffect" class="change-effect">{{ operationEffect }}</text>
  <text v-if="changesFutureOnly" class="change-note">仅影响未来周期安排；已生成任务与历史记录不变。</text>
  <text v-else-if="change.operation === 'delete' && scopeText === '本任务'" class="change-note">已完成的阶段和历史结果不会回滚。</text>
  <view v-if="pending" class="change-actions">
   <button class="change-discard" hover-class="change-discard--pressed" :disabled="busy" @tap="$emit('discard')">放弃</button>
   <button class="change-confirm" :class="{ destructive: change.operation === 'delete' }" hover-class="change-confirm--pressed" :disabled="busy" @tap="$emit('confirm')">{{ confirmText }}</button>
  </view>
  <text v-else class="change-receipt">{{ receiptText }}</text>
 </view>
</template>

<script setup>
import { computed } from 'vue'
import { readTargetText, repeatText, taskTime, targetText } from '../task-detail-view.mjs'

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
 if (props.change.operation === 'delete') return props.change.target?.type === 'task_plan' ? '删除周期计划' : '删除任务'
 return ({ edit: '调整安排', pause: '暂停周期计划', resume: '恢复周期计划', skip: '跳过本次安排' })[props.change.operation] || '任务变更'
})
const confirmText = computed(() => ({ edit: '确认修改', pause: '确认暂停', resume: '确认恢复', delete: '确认删除', skip: '确认跳过' })[props.change.operation] || '确认变更')
const statusText = computed(() => ({ pending_confirmation: '待确认', confirmed: '已确认', cancelled: '已放弃', expired: '已过期' })[state.value] || '已结束')
const receiptText = computed(() => ({ confirmed: '变更已确认', cancelled: '本次提案已放弃', expired: '本次提案已过期' })[state.value] || '本次提案已结束')
const changesFutureOnly = computed(() => ['pause', 'delete'].includes(props.change.operation) && scopeText.value === '整个周期')
const operationEffect = computed(() => ({
 pause: '确认后停用周期，未来不再发生；已经生成的任务继续。',
 resume: '确认后启用周期，从下一次未来安排继续；不补执行过去的发生。',
 delete: '确认后删除周期计划，未来不再发生；已经生成的任务与历史报告保留。',
 skip: '确认后仅跳过这一次安排，其他日期与周期规则保持不变。',
})[props.change.operation] || '')
const versions = computed(() => [
 { key: 'before', label: '当前安排', template: props.change.before, targets: targetSummary(props.change.before) },
 ...(props.change.operation === 'edit' ? [{ key: 'after', label: '提案安排', template: props.change.after, targets: targetSummary(props.change.after) }] : []),
])

function scheduleText(template) {
 if (!template) return '时间未提供'
 if (template.interval?.startsAt && template.interval?.endsAt) {
  return `区间 · ${taskTime(template.interval.startsAt)} 至 ${taskTime(template.interval.endsAt)}`
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
   items.push(`${device.name || device.id || '设备'} · ${readTargetText(device.kind)}`)
  }
  if (phase.read?.alertDays) items.push(`安全台账 · 近 ${phase.read.alertDays} 天`)
 }
 const unique = [...new Set(items)]
 return { items: unique.length ? unique.slice(0, 4) : ['无设备目标'], omitted: Math.max(0, unique.length - 4) }
}
</script>

<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; }
button::after { border:0; }
.change-card { box-sizing:border-box; width:100%; margin-top:14px; padding:12px; border-radius:14px; background:linear-gradient(#fdfefd,#f6f8f5); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 0 .5px rgba(26,55,43,.10),0 1px 2px rgba(28,57,42,.07),0 8px 20px rgba(28,57,42,.06); color:#2f4838; }
.change-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.change-heading { display:flex; align-items:center; gap:8px; min-width:0; }
.change-kicker { color:#536e5c; font-size:12px; font-weight:650; }
.change-scope { flex-shrink:0; padding:3px 7px; border-radius:8px; background:#f3ead8; color:#87662c; font-size:10px; }
.change-status { flex-shrink:0; color:#9a7135; font-size:10px; font-weight:600; }
.change-status.confirmed { color:#397b61; }.change-status.cancelled,.change-status.expired { color:#87938b; }
.change-title { display:block; margin-top:6px; color:#263c2e; font-size:15px; font-weight:700; line-height:1.4; overflow-wrap:anywhere; }
.change-versions { margin-top:10px; border-top:1px solid #dfe7e1; }
.change-version { padding:10px 4px 8px; }
.change-version--after { border-left:2px solid #4a9272; padding-left:9px; }
.version-label { display:block; color:#87948b; font-size:10px; font-weight:600; }
.version-title { display:block; margin-top:3px; color:#344a3b; font-size:12px; font-weight:650; overflow-wrap:anywhere; }
.version-line { display:block; margin-top:4px; color:#748379; font-size:10px; line-height:1.5; overflow-wrap:anywhere; }
.target-list { display:flex; flex-direction:column; gap:3px; margin-top:6px; }
.target-item,.target-more { color:#526b5a; font-size:10px; line-height:1.45; overflow-wrap:anywhere; }
.target-more { color:#919d95; }
.change-arrow { height:14px; display:flex; align-items:center; justify-content:center; }
.change-note { display:block; padding:8px 9px; border-left:2px solid #b58c4b; background:#f8f4eb; color:#806338; font-size:10px; line-height:1.5; }
.change-effect { display:block; padding:10px; border-left:2px solid #4a9272; background:#edf5ef; color:#436850; font-size:12px; line-height:1.5; }
.change-receipt { display:block; padding:9px 3px 1px; border-top:1px solid #e0e8e1; color:#718176; font-size:11px; }
.change-actions { display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:7px; padding:11px 3px 1px; border-top:1px solid #dfe7e1; }
.change-actions button { min-height:42px; padding:0 12px; border-radius:9px; font-size:12px; line-height:42px; transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 150ms ease,opacity 150ms ease; }
.change-discard { color:#6e7d73; }
.change-confirm { min-width:100px; border:1px solid #176b54; background:#176b54; color:#fff; box-shadow:0 3px 8px #176b5422; }
.change-confirm.destructive { border-color:#a15343; background:#a15343; box-shadow:0 3px 8px #a1534322; }
.change-discard--pressed,.change-confirm--pressed { transform:scale(.975); }
.change-discard--pressed { background:#eef3ef; }
.change-confirm--pressed { background:#125b44; }
.change-confirm.destructive.change-confirm--pressed { background:#8c463a; }
.change-actions button[disabled] { opacity:.52; }
@media(prefers-reduced-motion:reduce) { .change-actions button { transition:none; } }
</style>
