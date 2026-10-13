<template>
 <view class="event-content">
  <scroll-view class="event-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="event-paper">
    <view class="event-heading"><view class="event-symbol"><uni-icons type="notification" size="22" color="#a47b35" /></view><text class="event-kind">{{ safetySubtypeText(record.subtype) }}台账记录</text></view>
    <text class="event-name">{{ record.deviceName || '设备名称未提供' }}</text>
    <text v-if="record.currentDevice && !record.currentDevice.name" class="event-note">当前名称未核验，显示告警记录名称</text>
    <view class="event-field"><text>{{ record.currentDevice ? '当前位置' : '此前位置' }}</text><text>{{ record.currentDevice ? record.currentDevice.location || '未核验' : record.location || '未提供' }}</text></view>
    <view v-if="record.recordedDeviceName && record.recordedDeviceName !== record.deviceName" class="event-field"><text>记录名称</text><text>{{ record.recordedDeviceName }}</text></view>
    <view class="event-field"><text>记录时间</text><text>{{ fmtDateTime(record.occurredAt) || '未提供' }}</text></view>
    <view class="event-field"><text>台账来源</text><text>{{ record.ledger === 'gas' ? '燃气台账' : record.ledger === 'smoke' ? '烟感台账' : record.ledger === 'flooding' ? '水浸台账（含历史混表）' : '未提供' }}</text></view>
    <text class="event-note">这是平台历史台账，记录时位置与当前报警状态均未核验。</text>
    <text class="event-observed">{{ verified ? '最新读取于' : '此前读取于' }} {{ fmtDateTime(observedAt) || '时间未提供' }}</text>
   </view>
   <view class="event-state" aria-live="polite"><text>{{ loading ? '正在更新记录' : error }}</text><button v-if="reference && (error || record.currentDevice && (!record.currentDevice.name || !record.currentDevice.location))" class="event-retry" :disabled="loading" hover-class="event-pressed" @tap="load">{{ error ? '重试' : '重新读取' }}</button></view>
   <view v-if="referenceAllowed" class="event-cameras">
    <button class="camera-find" :disabled="cameraLoading" hover-class="event-pressed" @tap="findCameras"><uni-icons type="videocam" size="17" color="#397457" /><text>{{ cameraLoading ? '正在查找本端监控' : '按当前位置查找监控' }}</text></button>
    <text v-if="cameraError || cameraNote" class="camera-note">{{ cameraError || cameraNote }}</text>
    <button v-for="camera in cameras" :key="camera.deviceId" class="camera-candidate" hover-class="event-pressed" @tap="selectedCamera = camera"><view><text class="camera-name">{{ camera.name }}</text><text class="camera-note">{{ camera.safetyContext.basis }}</text></view><uni-icons type="right" size="12" color="#71907b" /></button>
    <view v-if="selectedCamera" class="camera-window"><button class="camera-back" @tap="selectedCamera = null">返回候选监控</button><VideoPlaybackForm :key="selectedCamera.deviceId" :device="selectedCamera" :ready="playerReady" :busy="openingVideo" @open="openRecording" /></view>
   </view>
  </scroll-view>
  <view class="event-actions"><button class="event-reference" :disabled="!referenceAllowed" hover-class="event-pressed" @tap="quote"><uni-icons type="chatbubble" size="16" color="#fff" /><text>引用到对话</text></button><text class="event-action-note">保留现有输入，由你决定何时发送</text></view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import VideoPlaybackForm from './VideoPlaybackForm.vue'
import { openVideoPlayer, videoPlayerReady } from '../video-player.js'
import { getSafetyEvent, getSafetyEventCameras } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import { fmtDateTime, safetySubtypeText } from '../observation-view.mjs'
import { safetyEventReference } from '../safety-event.mjs'

const props = defineProps({ snapshot: { type: Object, required: true }, active: Boolean })
const emit = defineEmits(['reference'])
const record = ref(props.snapshot.record), observedAt = ref(props.snapshot.observedAt)
const loading = ref(false), error = ref(''), verified = ref(false)
const referenceAllowed = ref(false)
const cameras = ref([]), selectedCamera = ref(null), cameraLoading = ref(false), cameraError = ref(''), cameraNote = ref(''), openingVideo = ref(false)
const playerReady = videoPlayerReady()
let cameraRequest = 0, cameraScope = ''
const reference = computed(() => safetyEventReference(props.snapshot.record))
let requestId = 0, visible = true, referenceScope = ''
function invalidate() { ++cameraRequest; cameraLoading.value = false; ++requestId; loading.value = false; verified.value = false; referenceAllowed.value = false }
async function load() {
 if (loading.value) return
 const current = ++requestId
 verified.value = false; error.value = ''
 if (!props.active || !visible) return
 const target = reference.value
 if (!target) { error.value = '这条记录缺少稳定身份，仅可查看此前快照'; return }
 loading.value = true
 let scope
 try {
  scope = getAgentStorageScope()
  referenceScope = scope; referenceAllowed.value = true
  const result = await getSafetyEvent(target)
  if (current !== requestId || !visible || !props.active || scope !== getAgentStorageScope()) return
  const next = safetyEventReference(result.record)
  if (!next || next.eventId !== target.eventId || next.ledger !== target.ledger || next.deviceId !== target.deviceId) throw new Error('返回的记录身份不匹配，请重试')
  record.value = result.record; observedAt.value = result.observedAt; verified.value = true
 } catch (cause) {
  if (current === requestId && visible && props.active) {
   if (scope !== getAgentStorageScope() || ['SAFETY_EVENT_UNAVAILABLE', 'UNAUTHORIZED'].includes(cause.data?.code)) { record.value = {}; referenceAllowed.value = false }
   error.value = cause.message || '记录暂不可用，请稍后重试'
  }
 } finally { if (current === requestId) loading.value = false }
}
async function findCameras() {
 if (cameraLoading.value || !referenceAllowed.value || referenceScope !== getAgentStorageScope()) return
 const current = ++cameraRequest, scope = getAgentStorageScope(), target = reference.value
 cameraLoading.value = true; cameraError.value = ''; cameraNote.value = ''; cameras.value = []; selectedCamera.value = null
 try {
  const result = await getSafetyEventCameras(target)
  if (current !== cameraRequest || !visible || !props.active || scope !== getAgentStorageScope()) return
  const next = safetyEventReference(result.record)
  if (!next || next.eventId !== target.eventId || next.ledger !== target.ledger || next.deviceId !== target.deviceId) throw new Error('返回的记录身份不匹配')
  ++requestId; loading.value = false
  record.value = result.record; observedAt.value = result.observedAt; verified.value = true
  cameraScope = scope; cameras.value = result.candidates; cameraNote.value = result.note
 } catch (cause) {
  if (current === cameraRequest) {
   if (['UNAUTHORIZED', 'SAFETY_EVENT_UNAVAILABLE'].includes(cause.data?.code)) { record.value = {}; referenceAllowed.value = false; verified.value = false }
   cameraError.value = cause.message || '候选监控暂不可用，请重试'
  }
 }
 finally { if (current === cameraRequest) cameraLoading.value = false }
}
async function openRecording(window) {
 if (!selectedCamera.value || cameraScope !== getAgentStorageScope() || openingVideo.value) return
 openingVideo.value = true
 try { await openVideoPlayer({ ...selectedCamera.value, ...window, source: 'company', mode: 'playback' }) }
 finally { openingVideo.value = false }
}
function quote() {
 if (!referenceAllowed.value || referenceScope !== getAgentStorageScope()) return
 emit('reference', { ...reference.value, label: `${record.value.deviceName} · ${fmtDateTime(record.value.occurredAt)}` })
}
watch(() => [props.active, props.snapshot], () => {
 invalidate(); cameras.value = []; selectedCamera.value = null; cameraError.value = ''; cameraNote.value = ''; record.value = props.snapshot.record; observedAt.value = props.snapshot.observedAt
 if (props.active) void load()
}, { immediate: true })
onHide(() => { visible = false; invalidate() })
onShow(() => { visible = true; if (cameraScope && cameraScope !== getAgentStorageScope()) { cameras.value = []; selectedCamera.value = null; cameraNote.value = '' }; if (props.active) void load() })
onBeforeUnmount(invalidate)
</script>
<style scoped>
view,text { font-size:inherit; line-height:inherit; } button { margin:0; padding:0; font-size:inherit; line-height:inherit; } button::after { border:0; }
.event-content { flex:1; min-height:0; display:flex; flex-direction:column; color:#2c4436; font-size:13px; line-height:1.5; }
.event-scroll { height:0; flex:1; min-height:0; }.event-paper { margin:8px 20px 0; padding:18px; border-radius:16px; background:linear-gradient(#fbfcf8,#f3f7f1); border:1px solid #e0e7dc; box-shadow:inset 0 1px 0 #fff,0 3px 9px -7px #36503c50; }
.event-heading { display:flex; align-items:center; gap:8px; }.event-symbol { display:flex; align-items:center; justify-content:center; width:35px; height:35px; flex-shrink:0; border-radius:11px; background:#f0eadb; }.event-kind { flex:1; color:#7e8d7f; font-size:12px; }
.event-name { display:block; margin:16px 0 20px; font-size:19px; font-weight:600; line-height:1.4; overflow-wrap:anywhere; }.event-field { display:flex; justify-content:space-between; gap:18px; padding:11px 0; border-top:1px solid #e1e7dd; }.event-field text:first-child { flex-shrink:0; color:#809083; }.event-field text:last-child { text-align:right; overflow-wrap:anywhere; }
.event-note { display:block; margin-top:18px; color:#8f794c; font-size:12px; }.event-observed { display:block; margin-top:12px; color:#8b998e; font-size:11px; }.event-state { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:44px; margin:8px 20px; color:#859287; font-size:12px; }.event-retry { flex-shrink:0; min-height:44px; padding:0 12px; background:transparent; color:#176b54; }
.event-actions { flex-shrink:0; padding:14px 20px 12px; border-top:1px solid #e7ece5; }.event-reference { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:46px; border-radius:13px; background:linear-gradient(#297c61,#17654e); box-shadow:inset 0 1px 0 #ffffff30,0 3px 8px -5px #164c3b70; color:#fff; font-weight:600; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.event-reference[disabled] { opacity:.45; }.event-action-note { display:block; margin-top:8px; text-align:center; color:#89968c; font-size:11px; }.event-pressed { opacity:.72; transform:scale(.98); } @media(prefers-reduced-motion:reduce) { .event-reference { transition:none; } }
.event-cameras { margin:0 20px 16px; }.camera-find,.camera-candidate,.camera-back { display:flex;align-items:center;min-height:44px;padding:8px 12px;background:#f1f6ee;border:1px solid #dde7d9;border-radius:11px;color:#397457;gap:8px;text-align:left; }.camera-find { width:100%; }.camera-note { display:block;margin-top:6px;font-size:11px;color:#869580;line-height:1.6; }.camera-candidate { width:100%;justify-content:space-between;margin-top:10px;background:linear-gradient(#fbfcf8,#f3f7f1); }.camera-candidate view { flex:1;min-width:0; }.camera-name { display:block;overflow-wrap:anywhere;font-weight:600; }.camera-window { margin-top:16px; }.camera-back { background:transparent;border:0;padding:0; }.camera-window :deep(.playback-form) { padding:8px 0 0; }
</style>
