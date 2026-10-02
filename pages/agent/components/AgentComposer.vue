<template>
 <view class="composer-wrap">
  <view class="voice-feedback" :class="{ visible: phase !== 'idle', cancel: cancelling }" aria-live="polite">
   <view class="voice-light" :class="{ pulsing: phase === 'recording' && !cancelling }" /><text>{{ feedback }}</text>
  </view>
  <view v-if="editing" class="edit-strip">
   <image class="edit-strip__icon" src="/static/compose.svg" /><text class="edit-strip__label">正在编辑消息</text>
   <button class="edit-strip__cancel" aria-label="取消编辑" hover-class="pressed" @tap="$emit('cancel-edit')"><image class="edit-strip__cancel-icon" src="/static/close.svg" /></button>
  </view>
  <view class="composer" :class="{ focused, voice: voiceMode, held: phase === 'recording', cancel: cancelling, editing }">
   <button class="mode-button" :disabled="disabled || running || editing || phase !== 'idle'" :aria-label="voiceMode ? '切换文字输入' : '切换语音输入'" hover-class="pressed" @tap="toggleMode">
    <image class="mode-icon" :src="voiceMode ? '/static/compose.svg' : '/static/mic.svg'" />
   </button>
   <view class="input-area">
    <textarea v-show="!voiceMode" class="composer-input" :value="fieldValue" :disabled="disabled" :focus="focusRequest"
     :auto-height="true" :adjust-position="false" :disable-default-padding="true"
     :hold-keyboard="true" :show-confirm-bar="false"
     confirm-type="send" :confirm-hold="true" :maxlength="200" :placeholder="editing ? '编辑这条消息' : (placeholder || '想查看或调整什么设备？')" placeholder-class="composer-placeholder"
     @focus="onFocus" @blur="focused = false" @keyboardheightchange="onKeyboard"
     @input="onInput" @confirm="onConfirm" />
    <view v-if="voiceMode" class="hold-input" role="button" aria-label="按住说话，上滑取消"
     @touchstart.stop="startVoice" @touchmove.stop.prevent="moveVoice" @touchend.stop="endVoice" @touchcancel.stop="interrupt">
     <text>{{ phase === 'idle' ? '按住说话' : feedback }}</text>
    </view>
   </view>
   <button v-show="!voiceMode || running" class="send-button" :class="{ ready: running || modelValue.trim() }"
    :disabled="!running && (disabled || !modelValue.trim())" :aria-label="running ? '停止回答' : (editing ? '重新发送' : '发送')" hover-class="pressed" @tap="running ? $emit('stop') : send()">
    <view v-if="running" class="stop-mark" /><image v-else class="send-icon" src="/static/send.svg" />
   </button>
  </view>
 </view>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createVoiceInput } from '../voice-input.mjs'
import { createFieldEchoGuard } from '../field-echo-guard.mjs'
import { resolveKeyboardDock } from '../keyboard-dock.mjs'
const props = defineProps({ modelValue: { type: String, default: '' }, disabled: Boolean, running: Boolean, editing: Boolean, placeholder: String })
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'voice', 'keyboard', 'cancel-edit'])
const focused = ref(false), voiceMode = ref(false), phase = ref('idle'), cancelling = ref(false), focusRequest = ref(false)
// 字段非受控：打字（含拼音组合中态）不写回 :value，只向上同步；
// 仅程序性改写（发送后清空等）经回声判定后落原生层，否则 IME 会被强制提交。
const fieldValue = ref(props.modelValue)
const echoGuard = createFieldEchoGuard(props.modelValue)
let startY = 0, touchId
const feedback = computed(() => cancelling.value ? '松开取消' : ({ starting: '正在启动录音', recording: '松开发送，上滑取消', recognizing: '正在识别…', cancelling: '已取消' }[phase.value] || ''))
const voice = createVoiceInput({
 getManager: () => requirePlugin('WechatSI').getRecordRecognitionManager(),
 onPhase: value => { phase.value = value; if (value === 'idle') { cancelling.value = false; touchId = undefined } },
 onResult: text => { if (!props.disabled && !props.running) emit('voice', text) },
 onError: title => uni.showToast({ title, icon: 'none' }),
})
function onInput(event) { echoGuard.track(event.detail.value); emit('update:modelValue', event.detail.value) }
// confirm 的 detail.value 是上屏后的最终文本，先同步再发送，不丢 IME 末尾提交
function onConfirm(event) { onInput(event); send() }
// adjust-position=false：页面不平移，键盘高度交给父级做 composer-shell 底部停靠
function onKeyboard(event) { emit('keyboard', resolveKeyboardDock(event)) }
function onFocus() { focused.value = true }
// focusRequest 是随编辑态生命周期的粘性属性：编辑期间恒 true（字段本就该聚焦），
// 退出编辑才释放收键盘。禁止在 onFocus 里复位——程序化聚焦被 iOS 静默忽略时
// focusRequest 滞留 true，用户手动点焦触发的 @focus 若复位它，attr true→false
// 会主动 blur 掉刚聚焦的字段，输入框永远点不进去（2026-09-17 真机根因）。
watch(() => props.editing, value => {
 interrupt()
 if (value) { voiceMode.value = false; focusRequest.value = true }
 else focusRequest.value = false
})
// 程序性改写经 plan() 取步骤：目标值恰等于 fieldValue 时原生层仍显示回声文本，
// 需先写显示值制造 diff 再 nextTick 写目标值，否则发送后清空的 '' 写不进去。
watch(() => props.modelValue, value => {
 const steps = echoGuard.plan(value, fieldValue.value)
 if (!steps.length) return
 fieldValue.value = steps[0]
 if (steps.length === 2) nextTick(() => { fieldValue.value = steps[1] })
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

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.composer-wrap { position:relative; width:100%; max-width:480px; margin:0 auto; }
.composer { display:flex; align-items:flex-end; gap:3px; padding:5px; min-height:46px; box-sizing:border-box; border:1px solid #cbd9d0; border-radius:24px; background:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(28,57,42,.10),0 7px 22px rgba(28,57,42,.12); transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms cubic-bezier(.23,1,.32,1); }
.composer.focused { border-color:#78a28b; box-shadow:0 0 0 2px rgba(56,117,84,.07),0 2px 4px rgba(28,57,42,.10),0 9px 26px rgba(28,57,42,.14); transform:translateY(-1px); }
.mode-button,.send-button { display:flex; align-items:center; justify-content:center; margin:0; padding:0; width:36px; height:36px; flex:0 0 36px; line-height:36px; border-radius:50%; transition:transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }
.mode-button { background:transparent; }.mode-button[disabled] { opacity:.45; }.mode-button::after,.send-button::after { border:0; }.pressed { transform:scale(.94); opacity:.8; }
.mode-icon,.send-icon { width:19px; height:19px; opacity:.72; }.send-button.ready .send-icon { filter:brightness(0) invert(1); opacity:1; }
.input-area { flex:1; min-width:0; }
.composer-input { width:100%; min-height:36px; max-height:108px; box-sizing:border-box; padding:7px 3px; font-size:14px; line-height:22px; color:#263d30; }
.composer-placeholder { color:#8b9991; font-size:14px; line-height:22px; }
.send-button { background:#edf2ee; box-shadow:inset 0 1px 1px rgba(38,64,46,.04); }
.send-button.ready { background:linear-gradient(155deg,#2a876c,#145c46); box-shadow:inset 0 1px 0 rgba(255,255,255,.23),0 2px 4px rgba(20,76,50,.15); }
.send-button[disabled] { background:#edf2ee; box-shadow:none; }
.stop-mark { width:12px; height:12px; border-radius:3px; background:#fff; }
.hold-input { height:36px; display:flex; align-items:center; justify-content:center; padding-right:36px; font-size:13px; font-weight:500; color:#486555; user-select:none; }
.composer.editing { border-color:#78a28b; }
.composer.voice { background:linear-gradient(160deg,#f9fbf9,#eaf1eb); }
/* 编辑态上下文静带：贴着胶囊上沿常驻，✕ 是唯一退出编辑的出口（不放 disabled） */
.edit-strip { display:flex; align-items:center; gap:6px; margin:0 6px 6px; padding:6px 8px 6px 12px; border:1px solid #dfe8e1; border-radius:14px; background:#f4f8f4; box-shadow:0 1px 3px rgba(28,57,42,.06); animation:message-in 160ms cubic-bezier(.23,1,.32,1); }
.edit-strip__icon { width:13px; height:13px; opacity:.55; }
.edit-strip__label { flex:1; font-size:12px; color:#55705f; }
.edit-strip__cancel { display:flex; align-items:center; justify-content:center; width:26px; height:26px; margin:0; padding:0; border-radius:7px; background:transparent; }
.edit-strip__cancel::after { border:0; }
.edit-strip__cancel-icon { width:12px; height:12px; opacity:.6; }
@keyframes message-in { from { opacity:0; transform:translateY(3px); } }
.composer.held { border-color:#94b4a0; background:#e5eee7; box-shadow:inset 0 2px 5px rgba(30,69,44,.07); }
.composer.cancel { border-color:#c6b1a6; background:#f4ede8; }.composer.cancel .hold-input { color:#9b6251; }
.voice-feedback { position:absolute; bottom:calc(100% + 12px); left:50%; transform:translate(-50%,5px); opacity:0; pointer-events:none; display:flex; align-items:center; gap:8px; white-space:nowrap; padding:11px 16px; border:1px solid #dce5dd; border-radius:18px; background:#fafcf9; box-shadow:0 6px 24px rgba(30,59,40,.08),inset 0 1px 0 white; font-size:12px; color:#456350; transition:opacity 160ms ease,transform 180ms cubic-bezier(.23,1,.32,1); }
.voice-feedback.visible { opacity:1; transform:translate(-50%,0); }.voice-feedback.cancel { color:#9b6251; }
.voice-light { width:6px; height:6px; border-radius:50%; background:currentColor; }.voice-light.pulsing { animation:record-pulse 1s ease-in-out infinite alternate; }
@keyframes record-pulse { to { opacity:.35; } }
@media(prefers-reduced-motion:reduce) { .composer,.voice-feedback,.mode-button,.send-button { transition:none; }.edit-strip { animation:none; }.voice-light.pulsing { animation:none; } }
</style>
