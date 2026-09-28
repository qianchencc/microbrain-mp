<template>
 <DeviceSheet :open="open" tall compact-header title="任务" @close="$emit('close')">
  <template #header-right><text class="region-name">{{ regionName }}</text></template>
  <scroll-view class="task-scroll" scroll-y enhanced :show-scrollbar="false">
   <view v-if="loading" class="message">正在读取任务</view>
   <view v-else-if="error" class="message"><text>{{ error }}</text><button @tap="load()">重新加载</button></view>
   <view v-else-if="detail" class="task-detail">
    <text class="task-name">{{ detail.label }}</text>
    <text class="task-when">{{ detail.whenText }}</text>
    <view class="owner-line"><view class="owner-mark">{{ detail.creator.displayName.slice(0, 1) }}</view><text class="owner-name">{{ detail.creator.displayName }} 创建 · {{ detail.createdText }}</text><text class="state-tag" :class="detail.status">{{ detail.statusText }}</text></view>
    <view class="summary" :class="{ warning: ['partial', 'failed', 'interrupted', 'missed'].includes(detail.status) }">{{ detail.summary }}</view>
    <text v-if="actionError" class="action-error">{{ actionError }}</text>
    <text class="section-title">阶段 · {{ detail.phases.length }}</text>
    <view v-for="(phase, index) in detail.phases" :key="phase.id" class="phase">
     <view class="phase-rail"><view class="phase-node" :class="{ complete: ['verified', 'satisfied', 'completed'].includes(phase.status), ending: detail.phases.length > 1 && index === 1 }" /><view v-if="index < detail.phases.length - 1" class="phase-link" /></view>
     <view class="phase-main">
      <view class="phase-head"><text class="phase-time">{{ phase.clock }}</text><text class="phase-title">{{ phase.title }}</text><text class="phase-status">{{ phase.statusText }}</text></view>
      <text v-if="phase.failureReason" class="phase-reason">{{ phase.failureReason }}</text>
      <button v-if="phase.devices.length > 1" class="phase-devices" :aria-label="`${expandedPhases.includes(phase.id) ? '收起' : '展开'} ${phase.devices.length} 台设备`" :aria-expanded="expandedPhases.includes(phase.id)" @tap="togglePhase(phase.id)">
       <view class="phase-avatars"><view v-for="device in phase.devices.slice(0, 5)" :key="device.id" class="phase-avatar"><image v-if="device.artwork" :src="device.artwork" mode="aspectFit" /><uni-icons v-else type="gear" size="12" color="#7c8d82" /></view></view>
       <text class="phase-device-count">{{ phase.devices.length }} 台设备</text><uni-icons :type="expandedPhases.includes(phase.id) ? 'down' : 'right'" size="13" color="#839189" />
      </button>
      <view v-if="phase.devices.length <= 1 || expandedPhases.includes(phase.id)" class="device-list">
       <view v-for="device in phase.devices" :key="device.id" class="device-row">
        <text class="device-name">{{ device.name }}</text><text class="target">{{ device.targetText }}</text><text class="result" :class="device.resultTone">{{ device.resultText }}</text>
       </view>
       <text v-if="!phase.devices.length" class="no-devices">当前没有可查看的设备</text>
      </view>
     </view>
    </view>
    <view class="source"><text>{{ detail.sourceText }}</text><text v-if="detail.source?.conversationId">对话 {{ detail.source.conversationId.slice(0, 8) }}</text></view>
    <button v-if="detail.canCancel && !sampleTask" class="task-delete" :disabled="cancelling" :loading="cancelling" @tap="deleteTask">删除任务</button>
   </view>
  </scroll-view>
 </DeviceSheet>
</template>
<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { cancelTask, getTaskDetail } from '@/apis/agent'
import DeviceSheet from './DeviceSheet.vue'
import { taskDetailView } from '../task-detail-view.mjs'

const props = defineProps({ open: Boolean, taskId: String, sampleTask: Object, regionName: String })
const emit = defineEmits(['close', 'cancelled'])
const task = ref(null), loading = ref(false), error = ref(''), actionError = ref(''), cancelling = ref(false)
const expandedPhases = ref([])
const detail = computed(() => taskDetailView(task.value))
let requestId = 0, refreshTimer
function togglePhase(id) {
 expandedPhases.value = expandedPhases.value.includes(id) ? expandedPhases.value.filter(value => value !== id) : [...expandedPhases.value, id]
}
async function load(silent = false) {
 const current = ++requestId
 if (!props.open || !props.taskId) return
 if (!silent) { task.value = null; error.value = ''; loading.value = false }
 if (props.sampleTask) { task.value = props.sampleTask; return }
 if (!silent) loading.value = true
 try {
  const result = await getTaskDetail(props.taskId)
  if (current === requestId && props.open) task.value = result.task
 } catch (cause) { if (!silent && current === requestId) error.value = cause.message || '任务暂不可用' }
 finally { if (!silent && current === requestId) loading.value = false }
}
async function deleteTask() {
 if (!detail.value?.canCancel || cancelling.value) return
 const taskId = props.taskId, version = task.value.version
 const confirmed = await new Promise(resolve => uni.showModal({ title: '删除任务',
  content: '未执行的阶段将取消；已经执行的设备动作不会回滚。', confirmText: '删除任务', confirmColor: '#a15343',
  success: result => resolve(result.confirm), fail: () => resolve(false) }))
 if (!confirmed || !props.open || props.taskId !== taskId) return
 cancelling.value = true; actionError.value = ''
 try {
  await cancelTask(taskId, version)
  await load(true)
  emit('cancelled')
 } catch (cause) {
  actionError.value = cause.message || '删除失败，请刷新后重试'
  await load(true)
 } finally { cancelling.value = false }
}
watch(() => [props.open, props.taskId, props.sampleTask], () => {
 clearInterval(refreshTimer)
 actionError.value = ''
 expandedPhases.value = []
 if (props.open) {
  load()
  if (!props.sampleTask) refreshTimer = setInterval(() => {
   if (['scheduled', 'executing'].includes(task.value?.status)) load(true)
  }, 10000)
 }
 else { ++requestId; loading.value = false; task.value = null }
}, { immediate: true })
onUnmounted(() => clearInterval(refreshTimer))
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:12px auto 0; padding:0; background:transparent; color:#176b54; font-size:12px; }
button::after { border:0; }
.region-name { max-width:215px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#839189; font-size:11px; }
.task-scroll { flex:1; min-height:0; height:0; }
.message { padding:56px 24px; text-align:center; color:#839189; font-size:13px; }
.message text { display:block; }
.task-detail { padding:10px 20px 34px; }
.task-name { display:block; color:#263c2e; font-size:18px; font-weight:700; line-height:1.35; }
.task-when { display:block; margin-top:5px; color:#75877b; font-size:12px; }
.owner-line { display:flex; align-items:center; gap:8px; margin-top:13px; }
.owner-mark { width:25px; height:25px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#216b55; color:#fff; font-size:11px; }
.owner-name { min-width:0; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#718176; font-size:11px; }
.state-tag { flex-shrink:0; padding:4px 8px; border-radius:8px; color:#4d7663; background:#eaf3ed; font-size:11px; }
.state-tag.partial,.state-tag.failed,.state-tag.interrupted,.state-tag.missed { color:#936827; background:#f9f0df; }
.summary { margin-top:14px; padding:10px 12px; background:#f4f8f4; border:1px solid #e0e9e1; border-radius:8px; color:#456052; font-size:12px; }
.summary.warning { color:#8d672d; background:#fbf5e9; border-color:#edddbf; }
.section-title { display:block; margin:18px 0 9px; font-size:11px; font-weight:700; color:#75877b; }
.phase { display:flex; gap:11px; }
.phase-rail { width:16px; display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
.phase-node { width:14px; height:14px; margin-top:3px; border:2px solid #89a395; box-sizing:border-box; border-radius:50%; background:#fff; }
.phase-node.complete { background:#176b54; border-color:#176b54; box-shadow:inset 0 0 0 3px white; }
.phase-node.ending { background:#fff; }
.phase-link { width:2px; min-height:25px; flex:1; background:#d5e0d8; }
.phase-main { flex:1; min-width:0; padding-bottom:18px; }
.phase-head { display:flex; align-items:baseline; gap:7px; min-width:0; }
.phase-time { color:#263c2e; font-size:12px; font-weight:700; }
.phase-title { color:#839189; font-size:11px; }
.phase-status { margin-left:auto; flex-shrink:0; color:#397b61; font-size:11px; }
.phase-reason { display:block; margin-top:5px; color:#9b6630; font-size:11px; }
.phase-devices { width:100%; min-height:38px; margin:9px 0 0; padding:5px 9px; border:1px solid #e0e9e1; border-radius:8px; display:flex; align-items:center; gap:8px; background:#f9fbf9; text-align:left; }
.phase-avatars { display:flex; align-items:center; flex-shrink:0; padding-left:5px; }
.phase-avatar { width:22px; height:22px; margin-left:-5px; border:1px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#edf2ee; }
.phase-avatar image { width:22px; height:22px; }
.phase-device-count { flex:1; min-width:0; color:#718176; font-size:11px; }
.device-list { margin-top:9px; border-top:1px solid #e2e9e3; }
.device-row { padding:9px 0; border-bottom:1px solid #e2e9e3; display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:8px; row-gap:3px; }
.device-name { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#304b39; font-size:12px; font-weight:600; }
.target { color:#63796b; font-size:11px; text-align:right; }
.result { grid-column:1/-1; font-size:11px; }
.result.ok { color:#397b61; }.result.warn { color:#a27128; }.result.fail { color:#a15343; }.result.wait { color:#839189; }
.no-devices { display:block; padding:12px 0; color:#839189; font-size:11px; }
.source { display:flex; justify-content:space-between; gap:8px; padding-top:14px; border-top:1px solid #e2e9e3; color:#85958a; font-size:11px; }
.task-delete { width:100%; height:38px; margin:18px 0 0; border:1px solid #ead6d1; border-radius:8px; background:#fff; color:#9a5549; font-size:12px; line-height:36px; }
.task-delete[disabled] { opacity:.55; }
.action-error { display:block; margin-top:10px; color:#a15343; font-size:11px; }
</style>
