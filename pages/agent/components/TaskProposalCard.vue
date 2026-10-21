<template>
 <view class="task-card">
  <view class="task-head"><text class="task-kicker">{{ isCancellation ? '取消任务' : task.repeat ? '周期计划' : '定时任务' }}</text><text class="task-state" :class="state">{{ stateText }}</text></view>
  <text class="task-name">{{ task.label }}</text>
  <text v-if="task.repeat" class="task-repeat">{{ repeatText(task.repeat) }}</text>
  <text v-if="task.repeat && isCreated && task.nextAt" class="task-interval">下一次 · {{ taskTime(task.nextAt) }}</text>
  <text v-if="task.interval" class="task-interval">{{ intervalText }}</text>
  <view class="task-phases">
  <view v-for="(phase, index) in task.phases" :key="phase.at" class="task-phase">
    <view class="phase-time"><view class="phase-node" :class="{ ending: !task.interval && index === 1 }" /><text>{{ phaseTitle(index) }} · {{ taskTime(phase.at) }}</text></view>
    <template v-if="phase.preflight">
     <text class="device-location preflight-line">范围 · {{ phase.preflight.includedScopes.join('、') }}</text>
     <text v-if="phase.preflight.excludedScopes.length" class="device-location preflight-line">保留 · {{ phase.preflight.excludedScopes.join('、') }} · {{ phase.preflight.excludedCount }} 台</text>
     <view class="device-target preflight-line preflight-counts"><text>目标 {{ phase.preflight.targetCount }} 台</text><text>当前已满足 {{ phase.preflight.alreadySatisfiedCount }}</text><text>待下发 {{ phase.preflight.needsDispatchCount }}</text><text>状态未知 {{ phase.preflight.unreadableCount }}</text></view>
     <text class="device-location preflight-line">预检 {{ taskTime(phase.preflight.observedAt) }} · 到时重新读取状态</text>
    </template>
    <view v-for="action in actionsOf(phase, index)" :key="action.deviceId" class="task-device">
     <view class="device-cell"><image v-if="artworkOf(action)" class="device-art" :src="artworkOf(action)" mode="aspectFit" /><text class="device-name">{{ action.deviceName }}</text></view><text class="device-target">{{ targetText(action.kind, action.command) }}</text>
    </view>
    <template v-if="source === 'company' && phase.read?.ac">
     <text class="read-window">{{ readAcOf(phase).summary }}</text>
     <text class="read-window">{{ readAcOf(phase).criteriaText }}</text>
    </template>
    <template v-else-if="source === 'company' && phase.read?.agent">
     <text class="read-window">{{ readAgentOf(phase).objectiveText }}</text>
     <text v-if="readAgentOf(phase).periodText" class="read-window">{{ readAgentOf(phase).periodText }}</text>
     <text v-if="readAgentOf(phase).comparisonText" class="read-window">{{ readAgentOf(phase).comparisonText }}</text>
    </template>
    <text v-else-if="source === 'company' && phase.read?.alertWindow === 'previous_day'" class="read-window">安全台账 · 阶段计划日期的前一自然日（上海时间）</text>
    <text v-else-if="source === 'company' && phase.read?.alertWindow === 'previous_week'" class="read-window">安全台账 · 上一自然周，周一至周日（上海时间）</text>
    <text v-else-if="source === 'company' && phase.read?.alertDays" class="read-window">安全台账 · 近 {{ phase.read.alertDays }} 天</text>
    <view v-for="device in readDevicesOf(phase, index)" :key="device.id" class="task-device read-device">
     <view class="device-cell"><image class="device-art" :src="artworkOf(device)" mode="aspectFit" /><text class="device-name">{{ device.name }}</text></view><text class="device-target">{{ readTargetText(device.kind, phase.read) }}</text>
     <text v-if="device.location" class="device-location">{{ device.location }}</text>
    </view>
    <button v-if="phaseRest(phase, index) || isExpanded(index)" class="phase-more" hover-class="phase-more--pressed" :aria-expanded="isExpanded(index)" @tap="togglePhase(index)">
     <text>{{ isExpanded(index) ? '收起' : `还有 ${phaseRest(phase, index)} 项 · 展开` }}</text>
     <uni-icons type="down" size="11" color="#176b54" :class="{ 'caret-up': isExpanded(index) }" />
    </button>
   </view>
  </view>
  <text v-if="isCancellation" class="task-note">已执行的设备动作不会回滚</text>
  <view v-if="state === 'pending_confirmation'" class="task-actions">
   <button class="task-secondary" hover-class="task-quiet--pressed" :disabled="busy" @tap="$emit('discard')">放弃</button>
   <button class="task-primary" :class="{ destructive: isCancellation }" hover-class="task-primary--pressed" :disabled="busy" @tap="$emit('confirm')">{{ isCancellation ? '确认取消' : task.repeat ? '创建周期计划' : '创建任务' }}</button>
  </view>
  <view v-else-if="isCreated" class="task-created">
   <button class="task-link" @tap="$emit('open')">{{ task.repeat ? '查看周期计划' : source === 'company' ? '查看任务安排' : '在区域面板查看' }} <uni-icons type="right" size="13" color="#176b54" /></button>
   <button v-if="task.latestTask" class="task-link" @tap="$emit('open', task.latestTask)">{{ task.latestTask.report ? '查看最近一次报告' : '查看本次任务' }} <uni-icons type="right" size="13" color="#176b54" /></button>
  </view>
  <text v-else class="task-ended">{{ state === 'expired' ? '提案已过期，请重新提出' : '本次提案已结束' }}</text>
 </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { readAcView, readAgentView, readTargetText, repeatText, taskTime, targetText } from '../task-detail-view.mjs'
import { resolveDeviceArtwork } from '../device-art/catalog.js'

// 单 phase 动作与待读设备共用 4 行预算；公司级任务的长清单默认收成尾巴可展开。
const ROW_LIMIT = 4
const expandedPhases = ref([])
const isExpanded = index => expandedPhases.value.includes(index)
function togglePhase(index) {
 expandedPhases.value = isExpanded(index) ? expandedPhases.value.filter(value => value !== index) : [...expandedPhases.value, index]
}
function actionsOf(phase, index) {
 return (phase.actions || []).slice(0, isExpanded(index) ? Infinity : ROW_LIMIT)
}
function readDevicesOf(phase, index) {
 const budget = isExpanded(index) ? Infinity : ROW_LIMIT - Math.min((phase.actions || []).length, ROW_LIMIT)
 return (props.source === 'company' ? phase.read?.devices || [] : []).slice(0, Math.max(0, budget))
}
function phaseRest(phase, index) {
 if (isExpanded(index)) return 0
 const total = (phase.actions || []).length + (props.source === 'company' ? phase.read?.devices?.length || 0 : 0)
 return Math.max(0, total - ROW_LIMIT)
}

const props = defineProps({ task: { type: Object, required: true }, source: { type: String, default: 'office' }, busy: Boolean })
defineEmits(['confirm', 'discard', 'open'])
const readAgentOf = phase => readAgentView(phase.read?.agent)
const readAcOf = phase => readAcView(phase.read?.ac)
const isCancellation = computed(() => props.task.kind === 'cancellation')
const state = computed(() => String(props.task.status || '').toLowerCase())
const isCreated = computed(() => isCancellation.value ? state.value === 'confirmed'
 : Boolean(props.task.created) || ['scheduled', 'executing', 'completed', 'partial', 'failed', 'unconfirmed', 'missed', 'interrupted'].includes(state.value))
const stateText = computed(() => isCancellation.value
 ? ({ pending_confirmation: '待确认', confirmed: '已取消', cancelled: '已放弃', expired: '已过期' })[state.value] || '已结束'
 : props.task.repeat && isCreated.value ? props.task.planStatus === 'paused' ? '已停用' : props.task.planStatus === 'deleted' ? '已删除' : props.task.nextAt === undefined ? '已创建' : props.task.nextAt ? '已启用' : props.task.latestTask?.status === 'executing' ? '本次进行中' : props.task.latestTask?.status === 'scheduled' ? '本次待执行' : '周期结束'
 : state.value === 'executing' && props.task.interval
  ? props.task.executionActive ? '设备执行中' : '区间进行中'
  : (props.source === 'company'
   ? ({ pending_confirmation: '待确认', scheduled: '未执行', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '执行失败', unconfirmed: '结果待核验', cancelled: '已取消', missed: '执行错过', interrupted: '执行中断', expired: '已过期' })
   : ({ pending_confirmation: '待确认', scheduled: '未执行', executing: '执行中', completed: '已执行', partial: '明确报错', failed: '明确报错', unconfirmed: '明确报错', cancelled: '已取消', missed: '明确报错', interrupted: '明确报错', expired: '已过期' }))[state.value] || '已结束')
const intervalText = computed(() => {
 if (!props.task.interval) return ''
 const start = taskTime(props.task.interval.startsAt), end = taskTime(props.task.interval.endsAt)
 const span = start.slice(0, 10) === end.slice(0, 10) ? `${start} 至 ${end.slice(-5)}` : `${start} 至 ${end}`
 return `${span} · ${props.task.phases?.length || 0} 个检查点`
})
const artworkOf = device => resolveDeviceArtwork({ kind: device.kind, deviceName: device.deviceName || device.name }).src
function phaseTitle(index) {
 if (isCancellation.value) return state.value === 'confirmed' ? '已取消' : '将取消'
 const actualTitle = props.task.phases[index]?.title
 if (actualTitle) return actualTitle
 if (props.task.interval) return `检查点${index + 1}`
 if (props.task.phases[index]?.preflight) return `阶段${index + 1}`
 return props.task.phases.length === 1 ? '执行' : index === 0 ? '开始' : '结束'
}
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.task-card { width:100%; box-sizing:border-box; margin-top:14px; padding:12px; border-radius:16px; background:linear-gradient(#fdfefd,#f6f8f5); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 0 .5px rgba(26,55,43,.10),0 1px 2px rgba(28,57,42,.07),0 10px 24px rgba(28,57,42,.07); overflow:hidden; color:#2f4838; }
.task-head { display:flex; justify-content:space-between; align-items:center; padding:3px 3px 0; }
.task-kicker { color:#63756b; font-size:12px; font-weight:600; }
.task-state { color:#176b54; font-size:11px; font-weight:600; }
.task-state.partial,.task-state.unconfirmed,.task-state.expired,.task-state.cancelled,.task-state.failed { color:#9c7040; }
.task-name { display:block; margin:5px 3px 0; font-size:16px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
.task-repeat { display:block; margin:7px 3px 0; color:#536e5c; font-size:12px; line-height:1.5; }
.task-interval { display:block; margin:6px 3px 10px; color:#8b9991; font-size:11px; }
.task-name + .task-phases,.task-interval + .task-phases { margin-top:10px; }
.task-phases { border-top:.5px solid #dbe3dd; }
.task-phase { padding:11px 3px 9px; }
.task-phase + .task-phase { border-top:.5px solid #dbe3dd; }
.phase-time { display:flex; align-items:center; gap:7px; margin-bottom:7px; color:#536e5c; font-size:11px; font-weight:600; }
.phase-node { width:9px; height:9px; box-sizing:border-box; flex-shrink:0; border-radius:50%; background:#267b60; }
.phase-node.ending { border:2px solid #267b60; background:#fff; }
.task-device { display:flex; flex-wrap:wrap; align-items:center; gap:6px 12px; padding:4px 0 4px 16px; font-size:12px; line-height:1.4; }
.device-cell { display:flex; align-items:center; gap:6px; flex:1; min-width:0; }
.device-art { width:18px; height:18px; flex-shrink:0; }
.device-name { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.device-target { flex-shrink:0; max-width:100%; color:#5c7865; }
.read-window { display:block; margin:2px 0 3px 16px; color:#917044; font-size:10px; }
.device-location { width:100%; margin-left:16px; color:#8b9991; font-size:10px; }
.preflight-line { display:block; width:auto; margin:3px 0 3px 16px; font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.preflight-counts { display:flex; flex-wrap:wrap; gap:2px 10px; }
.preflight-counts text { white-space:nowrap; }
.phase-more { width:100%; min-height:34px; margin-top:5px; display:flex; align-items:center; justify-content:center; gap:5px; color:#176b54; font-size:11px; font-weight:600; border-radius:0; }
.phase-more--pressed { background:#eef3ef; }
.caret-up { transform:rotate(180deg); }
.task-note { display:block; padding:0 3px 10px; color:#8b796c; font-size:11px; }
.task-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:13px 3px 3px; border-top:.5px solid #dbe3dd; }
.task-actions button { display:flex; align-items:center; justify-content:center; min-width:0; min-height:44px; margin:0; padding:0 12px; border-radius:10px; font-size:12px; line-height:44px; transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 160ms ease,box-shadow 160ms ease,opacity 160ms ease; }
.task-actions button::after,.task-link::after { border:0; }
.task-secondary { min-width:48px; border:0; background:transparent; color:#718078; }
.task-primary { min-width:112px; border:1px solid #176b54; background:#176b54; color:#fff; box-shadow:0 4px 10px #176b5422; }
.task-primary.destructive { border-color:#a15343; background:#a15343; box-shadow:0 4px 10px #a1534322; }
.task-quiet--pressed { transform:scale(.975); background:#eef3ef; }
.task-primary--pressed { transform:scale(.975); background:#126149; box-shadow:0 2px 6px #176b541c; }
.task-primary.destructive.task-primary--pressed { background:#8c463a; }
.task-actions button[disabled] { opacity:.52; box-shadow:none; }
.task-link { display:flex; align-items:center; justify-content:center; gap:4px; min-height:43px; margin:10px 0 0; border-top:.5px solid #dbe3dd; border-radius:0; background:transparent; color:#176b54; font-size:12px; }
.task-ended { display:block; padding:12px 3px 2px; border-top:.5px solid #dbe3dd; color:#89978b; font-size:11px; }
@media(prefers-reduced-motion:reduce){.task-actions button{transition:none}}
</style>
