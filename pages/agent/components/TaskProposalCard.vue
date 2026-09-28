<template>
 <view class="task-card">
  <view class="task-head"><text class="task-kicker">{{ isCancellation ? '取消任务' : '定时任务' }}</text><text class="task-state" :class="state">{{ stateText }}</text></view>
  <text class="task-name">{{ task.label }}</text>
  <view class="task-phases">
   <view v-for="(phase, index) in task.phases" :key="phase.at" class="task-phase">
    <view class="phase-time"><view class="phase-node" :class="{ ending: index === 1 }" /><text>{{ phaseTitle(index) }} · {{ taskTime(phase.at) }}</text></view>
    <view v-for="action in phase.actions" :key="action.deviceId" class="task-device">
     <text class="device-name">{{ action.deviceName }}</text><text class="device-target">{{ targetText(action.kind, action.command) }}</text>
    </view>
   </view>
  </view>
  <text v-if="isCancellation" class="task-note">已执行的设备动作不会回滚</text>
  <view v-if="state === 'pending_confirmation'" class="task-actions">
   <button class="task-secondary" :disabled="busy" @tap="$emit('discard')">放弃</button>
   <button class="task-primary" :class="{ destructive: isCancellation }" :disabled="busy" @tap="$emit('confirm')">{{ isCancellation ? '确认取消' : '创建任务' }}</button>
  </view>
  <button v-else-if="isCreated" class="task-link" @tap="$emit('open')">在区域面板查看 <uni-icons type="right" size="13" color="#176b54" /></button>
  <text v-else class="task-ended">{{ state === 'expired' ? '提案已过期，请重新提出' : '本次提案已结束' }}</text>
 </view>
</template>
<script setup>
import { computed } from 'vue'
import { taskTime, targetText } from '../task-detail-view.mjs'

const props = defineProps({ task: { type: Object, required: true }, busy: Boolean })
defineEmits(['confirm', 'discard', 'open'])
const isCancellation = computed(() => props.task.kind === 'cancellation')
const state = computed(() => String(props.task.status || '').toLowerCase())
const isCreated = computed(() => isCancellation.value ? state.value === 'confirmed'
 : Boolean(props.task.created) || ['scheduled', 'executing', 'completed', 'partial', 'failed', 'missed', 'interrupted'].includes(state.value))
const stateText = computed(() => isCancellation.value
 ? ({ pending_confirmation: '待确认', confirmed: '已取消', cancelled: '已放弃', expired: '已过期' })[state.value] || '已结束'
 : ({ pending_confirmation: '待确认', scheduled: '已安排', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '未完成', cancelled: '已取消', missed: '已错过', interrupted: '执行中断', expired: '已过期' })[state.value] || '已结束')
function phaseTitle(index) {
 if (isCancellation.value) return state.value === 'confirmed' ? '已取消' : '将取消'
 return props.task.phases.length === 1 ? '执行' : index === 0 ? '开始' : '结束'
}
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.task-card { width:100%; box-sizing:border-box; margin-top:14px; border:1px solid #dce7df; border-radius:8px; background:#fff; overflow:hidden; color:#2f4838; }
.task-head { display:flex; justify-content:space-between; align-items:center; padding:15px 15px 0; }
.task-kicker { color:#718579; font-size:11px; font-weight:600; }
.task-state { color:#176b54; font-size:11px; font-weight:600; }
.task-state.partial,.task-state.expired,.task-state.cancelled,.task-state.failed { color:#9c7040; }
.task-name { display:block; margin:5px 15px 12px; font-size:16px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
.task-phases { border-top:1px solid #e6ece7; }
.task-phase { padding:11px 15px 9px; }
.task-phase + .task-phase { border-top:1px solid #edf1ed; }
.phase-time { display:flex; align-items:center; gap:7px; margin-bottom:7px; color:#536e5c; font-size:11px; font-weight:600; }
.phase-node { width:9px; height:9px; box-sizing:border-box; flex-shrink:0; border-radius:50%; background:#267b60; }
.phase-node.ending { border:2px solid #267b60; background:#fff; }
.task-device { display:flex; justify-content:space-between; gap:12px; padding:4px 0 4px 16px; font-size:12px; line-height:1.4; }
.task-note { display:block; padding:0 15px 12px; color:#8b796c; font-size:11px; }
.device-name { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.device-target { flex-shrink:0; color:#5c7865; }
.task-actions { display:flex; gap:10px; padding:13px 15px 15px; border-top:1px solid #edf1ed; }
.task-actions button { display:flex; align-items:center; justify-content:center; min-height:40px; margin:0; border-radius:7px; font-size:13px; font-weight:600; }
.task-actions button::after,.task-link::after { border:0; }
.task-secondary { flex:1; background:#edf3ee; color:#4d6756; }
.task-primary { flex:2; background:#176b54; color:#fff; }
.task-primary.destructive { background:#9a5549; }
.task-actions button[disabled] { opacity:.55; }
.task-link { display:flex; align-items:center; justify-content:center; gap:4px; min-height:43px; margin:0; border-top:1px solid #e6ece7; border-radius:0; background:#f5f9f6; color:#176b54; font-size:12px; }
.task-ended { display:block; padding:12px 15px; border-top:1px solid #e6ece7; color:#89978b; font-size:11px; }
</style>
