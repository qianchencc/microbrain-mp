<template>
 <view class="composer-wrap">
  <view class="voice-feedback" :class="{ visible: phase !== 'idle', cancel: cancelling }" aria-live="polite">
   <view class="voice-light" :class="{ pulsing: phase === 'recording' && !cancelling }" /><text>{{ feedback }}</text>
  </view>
  <view class="composer" :class="{ focused, voice: voiceMode, held: phase === 'recording', cancel: cancelling }">
   <button class="mode-button" :disabled="disabled || running || phase !== 'idle'" :aria-label="voiceMode ? '切换文字输入' : '切换语音输入'" hover-class="pressed" @tap="toggleMode">
    <image class="mode-icon" :src="voiceMode ? '/static/compose.svg' : '/static/mic.svg'" />
   </button>
   <view class="input-area">
    <textarea v-show="!voiceMode" class="composer-input" :value="modelValue" :disabled="disabled"
     :auto-height="true" :adjust-position="false" :hold-keyboard="true" :show-confirm-bar="false"
     confirm-type="send" :confirm-hold="true" :maxlength="200" placeholder="想查看或调整什么设备？" placeholder-class="composer-placeholder"
     @keyboardheightchange="$emit('keyboard', $event.detail.height)" @focus="focused = true" @blur="focused = false"
     @input="$emit('update:modelValue', $event.detail.value)" @confirm="send" />
    <view v-if="voiceMode" class="hold-input" role="button" aria-label="按住说话，上滑取消"
     @touchstart.stop="startVoice" @touchmove.stop.prevent="moveVoice" @touchend.stop="endVoice" @touchcancel.stop="interrupt">
     <text>{{ phase === 'idle' ? '按住说话' : feedback }}</text>
    </view>
   </view>
   <button v-show="!voiceMode || running" class="send-button" :class="{ ready: running || modelValue.trim() }"
    :disabled="!running && (disabled || !modelValue.trim())" :aria-label="running ? '停止回答' : '发送'" hover-class="pressed" @tap="running ? $emit('stop') : send()">
    <view v-if="running" class="stop-mark" /><image v-else class="send-icon" src="/static/send.svg" />
   </button>
  </view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createVoiceInput } from '../voice-input.mjs'
const props = defineProps({ modelValue: { type: String, default: '' }, disabled: Boolean, running: Boolean })
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'keyboard', 'voice'])
const focused = ref(false), voiceMode = ref(false), phase = ref('idle'), cancelling = ref(false)
let startY = 0, touchId
const feedback = computed(() => cancelling.value ? '松开取消' : ({ starting: '正在启动录音', recording: '松开发送，上滑取消', recognizing: '正在识别…', cancelling: '已取消' }[phase.value] || ''))
const voice = createVoiceInput({
 getManager: () => requirePlugin('WechatSI').getRecordRecognitionManager(),
 onPhase: value => { phase.value = value; if (value === 'idle') { cancelling.value = false; touchId = undefined } },
 onResult: text => { if (!props.disabled && !props.running) emit('voice', text) },
 onError: title => uni.showToast({ title, icon: 'none' }),
})
function send() { if (!props.disabled && !props.running && props.modelValue.trim()) emit('send') }
function toggleMode() {
 if (props.disabled || props.running || phase.value !== 'idle') return
 voiceMode.value = !voiceMode.value
 if (voiceMode.value) { uni.hideKeyboard(); focused.value = false }
}
function startVoice(event) {
 if (props.disabled || props.running || phase.value !== 'idle' || event.touches.length !== 1) return
 startY = event.touches[0].clientY
 touchId = event.touches[0].identifier
 cancelling.value = false
 voice.start()
}
function moveVoice(event) {
 const touch = event.touches.find(item => item.identifier === touchId)
 if (touch && ['starting', 'recording'].includes(phase.value)) cancelling.value = startY - touch.clientY > 56
}
function endVoice(event) {
 if (!event.changedTouches.some(item => item.identifier === touchId)) return
 voice.release(cancelling.value)
}
function interrupt() { if (phase.value !== 'idle') { cancelling.value = true; voice.release(true) } }
watch(() => props.disabled || props.running, value => { if (value) interrupt() })
onBeforeUnmount(() => voice.dispose())
defineExpose({ interrupt })
</script>
<style scoped>
.composer-wrap { position:relative; width:100%; max-width:480px; margin:0 auto; }
.composer { display:flex; align-items:flex-end; gap:3px; padding:5px; min-height:46px; box-sizing:border-box; border:1px solid #cbd9d0; border-radius:24px; background:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(28,57,42,.10),0 7px 22px rgba(28,57,42,.12); transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms cubic-bezier(.23,1,.32,1); }
.composer.focused { border-color:#78a28b; box-shadow:0 0 0 2px rgba(56,117,84,.07),0 2px 4px rgba(28,57,42,.10),0 9px 26px rgba(28,57,42,.14); transform:translateY(-1px); }
.mode-button,.send-button { display:flex; align-items:center; justify-content:center; margin:0; padding:0; width:36px; height:36px; flex:0 0 36px; line-height:36px; border-radius:50%; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }
.mode-button { background:transparent; }.mode-button[disabled] { opacity:.45; }.mode-button::after,.send-button::after { border:0; }.pressed { transform:scale(.94); opacity:.8; }
.mode-icon,.send-icon { width:19px; height:19px; opacity:.72; }.send-button.ready .send-icon { filter:brightness(0) invert(1); opacity:1; }
.input-area { flex:1; min-width:0; }
.composer-input { width:100%; min-height:36px; max-height:108px; box-sizing:border-box; padding:7px 3px; font-size:14px; line-height:22px; color:#263d30; }
.composer-placeholder { color:#8b9991; font-size:13px; }
.send-button { background:#edf2ee; box-shadow:inset 0 1px 1px rgba(38,64,46,.04); }
.send-button.ready { background:linear-gradient(155deg,#2a876c,#145c46); box-shadow:inset 0 1px 0 rgba(255,255,255,.23),0 2px 4px rgba(20,76,50,.15); }
.send-button[disabled] { background:#edf2ee; box-shadow:none; }
.stop-mark { width:12px; height:12px; border-radius:3px; background:#fff; }
.hold-input { height:36px; display:flex; align-items:center; justify-content:center; padding-right:36px; font-size:13px; font-weight:500; color:#486555; user-select:none; }
.composer.voice { background:linear-gradient(160deg,#f9fbf9,#eaf1eb); }
.composer.held { border-color:#94b4a0; background:#e5eee7; box-shadow:inset 0 2px 5px rgba(30,69,44,.07); }
.composer.cancel { border-color:#c6b1a6; background:#f4ede8; }.composer.cancel .hold-input { color:#9b6251; }
.voice-feedback { position:absolute; bottom:calc(100% + 12px); left:50%; transform:translate(-50%,5px); opacity:0; pointer-events:none; display:flex; align-items:center; gap:8px; white-space:nowrap; padding:11px 16px; border:1px solid #dce5dd; border-radius:18px; background:#fafcf9; box-shadow:0 6px 24px rgba(30,59,40,.08),inset 0 1px 0 white; font-size:12px; color:#456350; transition:opacity 160ms ease,transform 180ms cubic-bezier(.23,1,.32,1); }
.voice-feedback.visible { opacity:1; transform:translate(-50%,0); }.voice-feedback.cancel { color:#9b6251; }
.voice-light { width:6px; height:6px; border-radius:50%; background:currentColor; }.voice-light.pulsing { animation:record-pulse 1s ease-in-out infinite alternate; }
@keyframes record-pulse { to { opacity:.35; } }
@media(prefers-reduced-motion:reduce) { .composer,.voice-feedback,.mode-button,.send-button { transition:none; }.voice-light.pulsing { animation:none; } }
</style>
