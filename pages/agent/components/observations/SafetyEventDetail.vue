<template>
 <view class="event-content">
  <scroll-view class="event-scroll" scroll-y enhanced :show-scrollbar="false" :scroll-into-view="scrollTarget" scroll-with-animation>
   <view class="event-paper">
   <view class="event-heading"><text class="event-chip">{{ ledgerShort }}</text></view>
    <text class="event-name">{{ record.deviceName || '设备名称未提供' }}</text>
    <text v-if="record.currentDevice && !record.currentDevice.name" class="event-note">当前名称未核验，显示告警记录名称</text>
    <view class="event-field"><text>{{ record.currentDevice ? '当前位置' : '此前位置' }}</text><text>{{ record.currentDevice ? record.currentDevice.location || '未核验' : record.location || '未提供' }}</text></view>
    <view class="event-field"><text>告警时间</text><text>{{ fmtDateTime(record.occurredAt) || '未提供' }}</text></view>
    <view class="event-field"><text>台账来源</text><text>{{ record.ledger === 'gas' ? '燃气台账' : record.ledger === 'smoke' ? '烟感台账' : record.ledger === 'flooding' ? '水浸台账（含历史混表）' : '未提供' }}</text></view>
    <text class="event-observed">{{ verified ? '最新读取于' : '此前读取于' }} {{ fmtDateTime(observedAt) || '时间未提供' }}</text>
   </view>
   <view class="event-state" aria-live="polite"><text>{{ loading ? '正在更新记录' : error }}</text><button v-if="reference && (error || record.currentDevice && (!record.currentDevice.name || !record.currentDevice.location))" class="event-retry" :disabled="loading" hover-class="event-pressed" @tap="load">{{ error ? '重试' : '重新读取' }}</button></view>
   <view v-if="referenceAllowed" class="event-cameras">
    <view class="camera-head"><text class="camera-title">关联监控</text><text v-if="cameras.length" class="camera-count">{{ cameras.length }} 台</text></view>
    <button v-if="cameraLoading || !cameras.length" class="camera-find" :disabled="cameraLoading" hover-class="event-pressed" @tap="findCameras"><uni-icons type="videocam" size="17" color="var(--agent-accent-deep)" /><text>{{ cameraLoading ? '正在查找本端监控' : '按当前位置重新查找' }}</text></button>
    <text v-if="cameraError || cameraNote" class="camera-note">{{ cameraError || cameraNote }}</text>
    <view id="event-camera-list">
     <view v-for="camera in cameras" :key="camera.deviceId" class="camera-candidate"><image class="camera-art" src="/static/device-art/video-dome-camera.png" mode="aspectFit" /><view class="camera-info"><text class="camera-name">{{ camera.name }}</text><text class="camera-note">依据：{{ camera.safetyContext.basis }}</text><view class="camera-actions"><button :disabled="!playerReady || openingVideo" hover-class="event-pressed" @tap="openLive(camera)">看直播</button><button class="camera-main" :disabled="openingVideo" hover-class="event-pressed" @tap="selectRecording(camera)">获取回放</button></view></view></view>
    </view>
    <view v-if="selectedCamera" id="event-camera-window" class="camera-window"><button class="camera-back" @tap="selectedCamera = null">返回候选监控</button><VideoPlaybackForm :key="selectedCamera.deviceId" :device="selectedCamera" :ready="playerReady" :busy="openingVideo" @open="openRecording" /></view>
   </view>
  </scroll-view>
  <view class="event-actions"><button class="event-reference" :disabled="!referenceAllowed" hover-class="event-pressed" @tap="quote"><uni-icons type="chatbubble" size="16" color="#fff" /><text>引用到对话</text></button></view>
 </view>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import VideoPlaybackForm from './VideoPlaybackForm.vue'
import { openVideoPlayer, videoPlayerReady } from '../../lib/video.mjs'
import { fmtDateTime, safetySubtypeText, safetyEventReference } from '../../lib/observations.mjs'
import { getSafetyEvent, getSafetyEventCameras } from '@/apis/agent/observations'
import { getAgentStorageScope, isAgentStorageScope } from '@/utils/agent-session'

const props = defineProps({ snapshot: { type: Object, required: true }, active: Boolean })
const emit = defineEmits(['reference'])
const record = ref(props.snapshot.record), observedAt = ref(props.snapshot.observedAt)
const loading = ref(false), error = ref(''), verified = ref(false)
const referenceAllowed = ref(false)
const cameras = ref([]), selectedCamera = ref(null), cameraLoading = ref(false), cameraError = ref(''), cameraNote = ref(''), openingVideo = ref(false)
const playerReady = videoPlayerReady()
const scrollTarget = ref('')
async function reveal(target) { scrollTarget.value = ''; await nextTick(); if (props.active && visible) scrollTarget.value = target }
function selectRecording(camera) { selectedCamera.value = camera; void reveal('event-camera-window') }
async function openLive(camera) {
 if (cameraScope !== getAgentStorageScope() || openingVideo.value) return
 openingVideo.value = true
 try { await openVideoPlayer({ ...camera, source: 'company', mode: 'live' }) }
 finally { openingVideo.value = false }
}
let cameraRequest = 0, cameraScope = ''
const ledgerShort = computed(() => ({ gas: '燃气台账', smoke: '烟感台账', flooding: '水浸台账' })[record.value.ledger] || '安全台账')
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
  const result = await getSafetyEvent(target, { isActive: () => current === requestId && visible && props.active })
  if (current !== requestId || !visible || !props.active || scope !== getAgentStorageScope()) return
  const next = safetyEventReference(result.record)
  if (!next || next.eventId !== target.eventId || next.ledger !== target.ledger || next.deviceId !== target.deviceId) throw new Error('返回的记录身份不匹配，请重试')
  record.value = result.record; observedAt.value = result.observedAt; verified.value = true
  void findCameras()
 } catch (cause) {
  if (current === requestId && visible && props.active) {
   if (!isAgentStorageScope(scope) || [401, 403].includes(cause.status) || ['SAFETY_EVENT_UNAVAILABLE', 'UNAUTHORIZED', 'FORBIDDEN'].includes(cause.data?.code)) { record.value = {}; referenceAllowed.value = false }
   error.value = cause.message || '记录暂不可用，请稍后重试'
  }
 } finally { if (current === requestId) loading.value = false }
}
async function findCameras() {
 if (cameraLoading.value || !referenceAllowed.value || referenceScope !== getAgentStorageScope()) return
 const current = ++cameraRequest, scope = getAgentStorageScope(), target = reference.value
 cameraLoading.value = true; cameraError.value = ''; cameraNote.value = ''
 if (cameraScope !== scope) { cameras.value = []; selectedCamera.value = null }
 try {
  const result = await getSafetyEventCameras(target, { isActive: () => current === cameraRequest && visible && props.active })
  if (current !== cameraRequest || !visible || !props.active || scope !== getAgentStorageScope()) return
  const next = safetyEventReference(result.record)
  if (!next || next.eventId !== target.eventId || next.ledger !== target.ledger || next.deviceId !== target.deviceId) throw new Error('返回的记录身份不匹配')
  ++requestId; loading.value = false
  record.value = result.record; observedAt.value = result.observedAt; verified.value = true
  cameraScope = scope; cameras.value = result.candidates; cameraNote.value = result.note
  if (cameras.value.length) void reveal('event-camera-list')
 } catch (cause) {
  if (current === cameraRequest) {
   if (!isAgentStorageScope(scope) || [401, 403].includes(cause.status) || ['UNAUTHORIZED', 'FORBIDDEN', 'SAFETY_EVENT_UNAVAILABLE'].includes(cause.data?.code)) { record.value = {}; cameras.value = []; selectedCamera.value = null; referenceAllowed.value = false; verified.value = false }
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
 invalidate(); scrollTarget.value = ''; cameras.value = []; selectedCamera.value = null; cameraError.value = ''; cameraNote.value = ''; record.value = props.snapshot.record; observedAt.value = props.snapshot.observedAt
 if (props.active) void load()
}, { immediate: true })
onHide(() => { visible = false; invalidate() })
onShow(() => { visible = true; if (cameraScope && cameraScope !== getAgentStorageScope()) { cameras.value = []; selectedCamera.value = null; cameraNote.value = '' }; if (props.active) void load() })
onBeforeUnmount(invalidate)
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view,text { font-size:inherit; line-height:inherit; } button { margin:0; padding:0; font-size:inherit; line-height:inherit; } button::after { border:0; }
.event-content { flex:1; min-height:0; display:flex; flex-direction:column; color:var(--agent-text-primary); font-size:13px; line-height:1.5; }
.event-scroll { height:0; flex:1; min-height:0; }.event-paper { margin:8px 20px 0; padding:18px; border-radius:16px; background:linear-gradient(var(--agent-surface),var(--agent-surface-page)); border:1px solid var(--agent-line); box-shadow:inset 0 1px 0 #fff,0 3px 9px -7px rgba(var(--agent-shadow-rgb),.31); }
.event-heading { display:flex; align-items:center; gap:$agent-space-small; }.event-chip { display:inline-flex; align-items:center; min-height:26px; padding:0 12px; border-radius:8px; background:var(--agent-warning-faint); color:var(--agent-warning-deep); font-size:$agent-font-size-compact; font-weight:600; }
.event-name { display:block; margin:16px 0 20px; font-size:19px; font-weight:600; line-height:1.4; overflow-wrap:anywhere; }.event-field { display:flex; justify-content:space-between; gap:18px; padding:11px 0; border-top:1px solid var(--agent-line); }.event-field text:first-child { flex-shrink:0; color:var(--agent-text-muted); }.event-field text:last-child { text-align:right; overflow-wrap:anywhere; }
.event-note { display:block; margin-top:18px; color:var(--agent-warning-deep); font-size:$agent-font-size-compact; }.event-observed { display:block; margin-top:12px; color:var(--agent-text-muted); font-size:11px; }.event-state { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:44px; margin:8px 20px; color:var(--agent-text-muted); font-size:$agent-font-size-compact; }.event-retry { flex-shrink:0; min-height:44px; padding:0 12px; background:transparent; color:$agent-color-accent; }
.event-actions { flex-shrink:0; padding:14px 20px calc(12px + env(safe-area-inset-bottom)); border-top:1px solid var(--agent-line); }.event-reference { display:flex; align-items:center; justify-content:center; gap:$agent-space-small; width:100%; min-height:46px; border-radius:13px; background:linear-gradient(var(--agent-accent),var(--agent-accent-deep)); box-shadow:inset 0 1px 0 #ffffff30,0 3px 8px -5px rgba(var(--agent-ink-rgb),.44); color:#fff; font-weight:600; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }.event-reference[disabled] { opacity:.45; }.event-pressed { opacity:.72; transform:scale(.98); } @media(prefers-reduced-motion:reduce) { .event-reference { transition:none; } }
.event-cameras { margin:0 20px 16px; }.camera-head { display:flex; align-items:baseline; justify-content:space-between; }.camera-title { color:var(--agent-text-primary); font-size:15px; font-weight:600; }.camera-count { color:var(--agent-text-muted); font-size:11px; }.camera-find,.camera-back { display:flex;align-items:center;min-height:44px;padding:8px 12px;background:var(--agent-tint);border:1px solid var(--agent-line);border-radius:11px;color:var(--agent-accent-deep);gap:$agent-space-small;text-align:left; }.camera-find { width:100%;margin-top:10px; }.camera-note { display:block;margin-top:6px;font-size:11px;color:var(--agent-text-muted);line-height:1.6; }.camera-candidate { display:flex;gap:12px;width:100%;box-sizing:border-box;margin-top:10px;padding:14px;border:1px solid var(--agent-line);border-radius:14px;background:linear-gradient(var(--agent-surface),var(--agent-surface-page)); }.camera-art { width:58px;height:58px;flex-shrink:0;align-self:center; }.camera-info { flex:1;min-width:0;display:flex;flex-direction:column; }.camera-name { display:block;overflow-wrap:anywhere;font-weight:600; }.camera-window { margin-top:16px; }.camera-back { background:transparent;border:0;padding:0; }.camera-window :deep(.playback-form) { padding:8px 0 0; }
.camera-actions { display:flex;gap:10px;margin-top:10px; }.camera-actions button { flex:1;min-height:38px;display:flex;align-items:center;justify-content:center;border:1px solid var(--agent-line);background:var(--agent-surface);color:var(--agent-accent-deep);border-radius:10px; }.camera-actions .camera-main { border:0;background:linear-gradient(var(--agent-accent),var(--agent-accent-deep));color:#fff;font-weight:600; }.camera-actions button[disabled] { opacity:.45; }
</style>
