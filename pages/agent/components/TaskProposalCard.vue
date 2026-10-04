<template>
 <view class="task-card">
  <view class="task-head"><text class="task-kicker">{{ isCancellation ? '取消任务' : '定时任务' }}</text><text class="task-state" :class="state">{{ stateText }}</text></view>
  <text class="task-name">{{ task.label }}</text>
  <text v-if="task.interval" class="task-interval">{{ intervalText }}</text>
  <view class="task-phases">
   <view v-for="(phase, index) in task.phases" :key="phase.at" class="task-phase">
    <view class="phase-time"><view class="phase-node" :class="{ ending: !task.interval && index === 1 }" /><text>{{ phaseTitle(index) }} · {{ taskTime(phase.at) }}</text></view>
    <view v-for="action in phase.actions" :key="action.deviceId" class="task-device">
     <view class="device-cell"><image v-if="artworkOf(action)" class="device-art" :src="artworkOf(action)" mode="aspectFit" /><text class="device-name">{{ action.deviceName }}</text></view><text class="device-target">{{ targetText(action.kind, action.command) }}</text>
    </view>
   </view>
  </view>
  <text v-if="isCancellation" class="task-note">已执行的设备动作不会回滚</text>
  <view v-if="state === 'pending_confirmation'" class="task-actions">
   <button class="task-secondary" hover-class="task-quiet--pressed" :disabled="busy" @tap="$emit('discard')">放弃</button>
   <button class="task-primary" :class="{ destructive: isCancellation }" hover-class="task-primary--pressed" :disabled="busy" @tap="$emit('confirm')">{{ isCancellation ? '确认取消' : '创建任务' }}</button>
  </view>
  <button v-else-if="isCreated" class="task-link" @tap="$emit('open')">在区域面板查看 <uni-icons type="right" size="13" color="#176b54" /></button>
  <text v-else class="task-ended">{{ state === 'expired' ? '提案已过期，请重新提出' : '本次提案已结束' }}</text>
 </view>
</template>
<script setup>
import { computed } from 'vue'
import { taskTime, targetText } from '../task-detail-view.mjs'
import { resolveDeviceArtwork } from '../device-art/catalog.js'

const props = defineProps({ task: { type: Object, required: true }, busy: Boolean })
defineEmits(['confirm', 'discard', 'open'])
const isCancellation = computed(() => props.task.kind === 'cancellation')
const state = computed(() => String(props.task.status || '').toLowerCase())
const isCreated = computed(() => isCancellation.value ? state.value === 'confirmed'
 : Boolean(props.task.created) || ['scheduled', 'executing', 'completed', 'partial', 'failed', 'unconfirmed', 'missed', 'interrupted'].includes(state.value))
const stateText = computed(() => isCancellation.value
 ? ({ pending_confirmation: '待确认', confirmed: '已取消', cancelled: '已放弃', expired: '已过期' })[state.value] || '已结束'
 : state.value === 'executing' && props.task.interval
  ? props.task.executionActive ? '设备执行中' : '区间进行中'
  : ({ pending_confirmation: '待确认', scheduled: '未执行', executing: '执行中', completed: '已执行', partial: '明确报错', failed: '明确报错', unconfirmed: '明确报错', cancelled: '已取消', missed: '明确报错', interrupted: '明确报错', expired: '已过期' })[state.value] || '已结束')
const intervalText = computed(() => {
 if (!props.task.interval) return ''
 const start = taskTime(props.task.interval.startsAt), end = taskTime(props.task.interval.endsAt)
 const span = start.slice(0, 10) === end.slice(0, 10) ? `${start} 至 ${end.slice(-5)}` : `${start} 至 ${end}`
 return `${span} · ${props.task.phases?.length || 0} 个检查点`
})
const artworkOf = action => resolveDeviceArtwork({ kind: action.kind, deviceName: action.deviceName }).src
function phaseTitle(index) {
 if (isCancellation.value) return state.value === 'confirmed' ? '已取消' : '将取消'
 if (props.task.interval) return `检查点${index + 1}`
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
