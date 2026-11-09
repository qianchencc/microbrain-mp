<template>
  <view class="composer-wrap">
    <view
      class="voice-feedback"
      :class="{ visible: phase !== 'idle', cancel: cancelling }"
      aria-live="polite"
    >
      <view
        class="voice-light"
        :class="{ pulsing: phase === 'recording' && !cancelling }"
      /><text>{{ feedback }}</text>
    </view>
    <view
      v-if="editing"
      class="edit-strip"
    >
      <image
        class="edit-strip__icon"
        src="/static/compose.svg"
      /><text class="edit-strip__label">正在编辑消息</text>
      <button
        class="edit-strip__cancel"
        aria-label="取消编辑"
        hover-class="pressed"
        @tap="$emit('cancel-edit')"
        ><image
          class="edit-strip__cancel-icon"
          src="/static/close.svg"
      /></button>
    </view>
    <view
      v-if="reference"
      class="edit-strip reference-strip"
    >
      <image
        class="edit-strip__icon"
        src="/static/compose.svg"
      />
      <button
        class="reference-label"
        :aria-label="referenceTitle"
        @tap="showReference"
        ><text
          >{{ referenceTitle }} · {{ reference.label || reference.content || '已关联原记录' }}</text
        ></button
      >
      <button
        v-if="!editing"
        class="edit-strip__cancel"
        aria-label="移除引用"
        hover-class="pressed"
        @tap="$emit('remove-reference')"
        ><image
          class="edit-strip__cancel-icon"
          src="/static/close.svg"
      /></button>
    </view>
    <view
      class="composer"
      :class="{
        focused,
        voice: voiceMode,
        held: phase === 'recording',
        cancel: cancelling,
        editing,
      }"
    >
      <button
        class="mode-button"
        :disabled="disabled || running || editing || phase !== 'idle'"
        :aria-label="voiceMode ? '切换文字输入' : '切换语音输入'"
        hover-class="pressed"
        @tap="toggleMode"
      >
        <image
          class="mode-icon"
          :src="voiceMode ? '/static/compose.svg' : '/static/mic.svg'"
        />
      </button>
      <view class="input-area">
        <textarea
          v-show="!voiceMode"
          class="composer-input"
          :value="fieldValue"
          :disabled="disabled"
          :focus="focusRequest"
          :auto-height="true"
          :adjust-position="false"
          :disable-default-padding="true"
          :hold-keyboard="true"
          :show-confirm-bar="false"
          confirm-type="send"
          :confirm-hold="true"
          :maxlength="200"
          :placeholder="editing ? '编辑这条消息' : placeholder || '想查看或调整什么设备？'"
          placeholder-class="composer-placeholder"
          @focus="onFocus"
          @blur="focused = false"
          @keyboardheightchange="onKeyboard"
          @input="onInput"
          @confirm="onConfirm"
        />
        <view
          v-if="voiceMode"
          class="hold-input"
          role="button"
          aria-label="按住说话，上滑取消"
          @touchstart.stop="startVoice"
          @touchmove.stop.prevent="moveVoice"
          @touchend.stop="endVoice"
          @touchcancel.stop="interrupt"
        >
          <text>{{ phase === 'idle' ? '按住说话' : feedback }}</text>
        </view>
      </view>
      <button
        v-show="!voiceMode || running"
        class="send-button"
        :class="{ ready: running || modelValue.trim() }"
        :disabled="!running && (disabled || !modelValue.trim())"
        :aria-label="running ? '停止回答' : editing ? '重新发送' : '发送'"
        hover-class="pressed"
        @tap="running ? $emit('stop') : send()"
      >
        <view
          v-if="running"
          class="stop-mark"
        /><image
          v-else
          class="send-icon"
          src="/static/send.svg"
        />
      </button>
    </view>
  </view>
</template>
<script setup>
import { referenceTitle as titleOfReference } from '../../lib/observations.mjs';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { createVoiceInput } from '../../domains/conversation/voice-input.mjs';
import { createFieldEchoGuard } from '../../domains/conversation/field-echo-guard.mjs';
import { resolveKeyboardDock } from '../../domains/conversation/keyboard-dock.mjs';
import { showAgentError } from '@/utils/agent-error';
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: Boolean,
  running: Boolean,
  editing: Boolean,
  placeholder: String,
  reference: Object,
});
const emit = defineEmits([
  'update:modelValue',
  'send',
  'stop',
  'voice',
  'keyboard',
  'cancel-edit',
  'remove-reference',
]);
const referenceTitle = computed(() => titleOfReference(props.reference));
function showReference() {
  uni.showModal({
    title: referenceTitle.value,
    content:
      props.reference.label ||
      props.reference.content ||
      '发送时读取同一记录的最新事实，可直接询问结果或说明修改意图。',
    showCancel: false,
  });
}
const focused = ref(false),
  voiceMode = ref(false),
  phase = ref('idle'),
  cancelling = ref(false),
  focusRequest = ref(false);
// 字段非受控：打字（含拼音组合中态）不写回 :value，只向上同步；
// 仅程序性改写（发送后清空等）经回声判定后落原生层，否则 IME 会被强制提交。
const fieldValue = ref(props.modelValue);
const echoGuard = createFieldEchoGuard(props.modelValue);
let startY = 0,
  touchId;
const feedback = computed(() =>
  cancelling.value
    ? '松开取消'
    : {
        starting: '正在启动录音',
        recording: '松开发送，上滑取消',
        recognizing: '正在识别…',
        cancelling: '已取消',
      }[phase.value] || ''
);
const voice = createVoiceInput({
  getManager: () => requirePlugin('WechatSI').getRecordRecognitionManager(),
  onPhase: (value) => {
    phase.value = value;
    if (value === 'idle') {
      cancelling.value = false;
      touchId = undefined;
    }
  },
  onResult: (text) => {
    if (!props.disabled && !props.running) emit('voice', text);
  },
  onError: (title, { status } = {}) =>
    status ? uni.showToast({ title, icon: 'none' }) : showAgentError(title, { fallback: title }),
});
function onInput(event) {
  echoGuard.track(event.detail.value);
  emit('update:modelValue', event.detail.value);
}
// confirm 的 detail.value 是上屏后的最终文本，先同步再发送，不丢 IME 末尾提交
function onConfirm(event) {
  onInput(event);
  send();
}
// adjust-position=false：页面不平移，键盘高度交给父级做 composer-shell 底部停靠
function onKeyboard(event) {
  emit('keyboard', resolveKeyboardDock(event));
}
function onFocus() {
  focused.value = true;
}
// focusRequest 是随编辑态生命周期的粘性属性：编辑期间恒 true（字段本就该聚焦），
// 退出编辑才释放收键盘。禁止在 onFocus 里复位——程序化聚焦被 iOS 静默忽略时
// focusRequest 滞留 true，用户手动点焦触发的 @focus 若复位它，attr true→false
// 会主动 blur 掉刚聚焦的字段，输入框永远点不进去（2026-09-17 真机根因）。
watch(
  () => props.editing,
  (value) => {
    interrupt();
    if (value) {
      voiceMode.value = false;
      focusRequest.value = true;
    } else focusRequest.value = false;
  }
);
// 程序性改写经 plan() 取步骤：目标值恰等于 fieldValue 时原生层仍显示回声文本，
// 需先写显示值制造 diff 再 nextTick 写目标值，否则发送后清空的 '' 写不进去。
watch(
  () => props.modelValue,
  (value) => {
    const steps = echoGuard.plan(value, fieldValue.value);
    if (!steps.length) return;
    fieldValue.value = steps[0];
    if (steps.length === 2)
      nextTick(() => {
        fieldValue.value = steps[1];
      });
  }
);
function send() {
  if (!props.disabled && !props.running && props.modelValue.trim()) emit('send');
}
function toggleMode() {
  if (props.disabled || props.running || phase.value !== 'idle') return;
  voiceMode.value = !voiceMode.value;
  if (voiceMode.value) {
    uni.hideKeyboard();
    focused.value = false;
  }
}
function startVoice(event) {
  if (props.disabled || props.running || phase.value !== 'idle' || event.touches.length !== 1)
    return;
  startY = event.touches[0].clientY;
  touchId = event.touches[0].identifier;
  cancelling.value = false;
  voice.start();
}
function moveVoice(event) {
  const touch = event.touches.find((item) => item.identifier === touchId);
  if (touch && ['starting', 'recording'].includes(phase.value))
    cancelling.value = startY - touch.clientY > 56;
}
function endVoice(event) {
  if (!event.changedTouches.some((item) => item.identifier === touchId)) return;
  voice.release(cancelling.value);
}
function interrupt() {
  if (phase.value !== 'idle') {
    cancelling.value = true;
    voice.release(true);
  }
}
watch(
  () => props.disabled || props.running,
  (value) => {
    if (value) interrupt();
  }
);
onBeforeUnmount(() => voice.dispose());
defineExpose({ interrupt });
</script>
<style scoped lang="scss">
@import '../../styles/tokens';

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.composer-wrap {
  position: relative;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}
.reference-strip {
  border-left: 2px solid $agent-color-warning-deep;
}
.reference-label {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  text-align: left;
  color: $agent-color-text-secondary;
  font-size: 11px;
  line-height: 20px;
}
.reference-label::after {
  border: 0;
}
.reference-label text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.composer {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 5px;
  min-height: 46px;
  box-sizing: border-box;
  border: 1px solid $agent-color-line;
  border-radius: 24px;
  background: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(var(--agent-shadow-rgb), 0.1),
    0 7px 22px rgba(var(--agent-shadow-rgb), 0.12);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
}
.composer.focused {
  border-color: $agent-color-accent;
  box-shadow:
    0 0 0 2px rgba(var(--agent-shadow-rgb), 0.07),
    0 2px 4px rgba(var(--agent-shadow-rgb), 0.1),
    0 9px 26px rgba(var(--agent-shadow-rgb), 0.14);
  transform: translateY(-1px);
}
.mode-button,
.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  line-height: 36px;
  border-radius: 50%;
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 140ms ease;
}
.mode-button {
  background: transparent;
}
.mode-button[disabled] {
  opacity: 0.45;
}
.mode-button::after,
.send-button::after {
  border: 0;
}
.pressed {
  transform: scale(0.94);
  opacity: 0.8;
}
.mode-icon,
.send-icon {
  width: 19px;
  height: 19px;
  opacity: 0.72;
}
.send-button.ready .send-icon {
  filter: brightness(0) invert(1);
  opacity: 1;
}
.input-area {
  flex: 1;
  min-width: 0;
}
.composer-input {
  width: 100%;
  min-height: 36px;
  max-height: 108px;
  box-sizing: border-box;
  padding: 7px 3px;
  font-size: 14px;
  line-height: 22px;
  color: $agent-color-text-primary;
}
.composer-placeholder {
  color: $agent-color-text-muted;
  font-size: 14px;
  line-height: 22px;
}
.send-button {
  background: $agent-color-tint;
  box-shadow: inset 0 1px 1px rgba(var(--agent-shadow-rgb), 0.04);
}
.send-button.ready {
  background: linear-gradient(155deg, $agent-color-accent, $agent-color-accent-deep);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.23),
    0 2px 4px rgba(var(--agent-shadow-rgb), 0.15);
}
.send-button[disabled] {
  background: $agent-color-tint;
  box-shadow: none;
}
.stop-mark {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: #fff;
}
.hold-input {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 36px;
  font-size: 13px;
  font-weight: 500;
  color: $agent-color-text-secondary;
  user-select: none;
}
.composer.editing {
  border-color: $agent-color-accent;
}
.composer.voice {
  background: linear-gradient(160deg, $agent-color-surface, $agent-color-tint);
}
/* 编辑态上下文静带：贴着胶囊上沿常驻，✕ 是唯一退出编辑的出口（不放 disabled） */
.edit-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 6px 6px;
  padding: 6px 8px 6px 12px;
  border: 1px solid $agent-color-line;
  border-radius: 14px;
  background: $agent-color-surface;
  box-shadow: 0 1px 3px rgba(var(--agent-shadow-rgb), 0.06);
  animation: message-in 160ms cubic-bezier(0.23, 1, 0.32, 1);
}
.edit-strip__icon {
  width: 13px;
  height: 13px;
  opacity: 0.55;
}
.edit-strip__label {
  flex: 1;
  font-size: $agent-font-size-compact;
  color: $agent-color-text-secondary;
}
.edit-strip__cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin: 0;
  padding: 0;
  border-radius: 7px;
  background: transparent;
}
.edit-strip__cancel::after {
  border: 0;
}
.edit-strip__cancel-icon {
  width: 12px;
  height: 12px;
  opacity: 0.6;
}
@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
}
.composer.held {
  border-color: $agent-color-text-muted;
  background: $agent-color-tint;
  box-shadow: inset 0 2px 5px rgba(var(--agent-shadow-rgb), 0.07);
}
.composer.cancel {
  border-color: $agent-color-error-faint;
  background: $agent-color-error-faint;
}
.composer.cancel .hold-input {
  color: $agent-color-error;
}
.voice-feedback {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translate(-50%, 5px);
  opacity: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  white-space: nowrap;
  padding: 11px 16px;
  border: 1px solid $agent-color-line;
  border-radius: 18px;
  background: $agent-color-surface;
  box-shadow:
    0 6px 24px rgba(var(--agent-shadow-rgb), 0.08),
    inset 0 1px 0 white;
  font-size: $agent-font-size-compact;
  color: $agent-color-text-secondary;
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
.voice-feedback.visible {
  opacity: 1;
  transform: translate(-50%, 0);
}
.voice-feedback.cancel {
  color: $agent-color-error;
}
.voice-light {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.voice-light.pulsing {
  animation: record-pulse 1s ease-in-out infinite alternate;
}
@keyframes record-pulse {
  to {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .composer,
  .voice-feedback,
  .mode-button,
  .send-button {
    transition: none;
  }
  .edit-strip {
    animation: none;
  }
  .voice-light.pulsing {
    animation: none;
  }
}
</style>
