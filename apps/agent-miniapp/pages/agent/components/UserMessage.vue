<template>
 <view class="user-message-wrap" :class="{ 'user-message-wrap--editing': editing }">
  <view v-if="editing" class="user-editor" :class="{ 'user-editor--closing': closing }">
   <textarea class="user-editor__input" :value="draft" :auto-height="true" :maxlength="200" :focus="true"
    confirm-type="send" :disabled="disabled" @input="draft = $event.detail.value" @confirm="submit" />
   <view class="user-editor__actions">
    <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" @tap="cancel">取消</button>
    <button class="message-action message-action--primary" :disabled="disabled || !draft.trim()" hover-class="message-action--pressed" @tap="submit">重新发送</button>
   </view>
  </view>
  <template v-else>
   <text class="user-message">{{ content }}</text>
   <view v-if="recoverable" class="message-actions" aria-label="消息操作">
    <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" @tap="beginEdit">
     <uni-icons type="compose" size="15" color="#64766c" /><text>编辑</text>
    </button>
    <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" @tap="$emit('retry')">
     <uni-icons type="refreshempty" size="15" color="#64766c" /><text>重试</text>
    </button>
   </view>
  </template>
 </view>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ content: { type: String, default: '' }, recoverable: Boolean, disabled: Boolean })
const emit = defineEmits(['retry', 'edit'])
const editing = ref(false), closing = ref(false)
const draft = ref(props.content)
let closeTimer
watch(() => props.content, value => { if (!editing.value) draft.value = value })
watch(() => props.recoverable, value => { if (!value) closeEditor(false) })
function beginEdit() { if (!props.disabled) { clearTimeout(closeTimer); closing.value = false; draft.value = props.content; editing.value = true } }
// 编辑态收起必须先播退场动画再卸载（含提交与 recoverable 翻转路径），否则气泡硬切出现
function closeEditor(reset) {
 if (closing.value) return
 closing.value = true
 closeTimer = setTimeout(() => { closing.value = false; editing.value = false; if (reset) draft.value = props.content }, 160)
}
function cancel() { if (!props.disabled) closeEditor(true) }
function submit() {
 if (closing.value) return
 const value = draft.value.trim()
 if (!props.disabled && value) { emit('edit', value); closeEditor(false) }
}
onBeforeUnmount(() => clearTimeout(closeTimer))
</script>

<style scoped>
.user-message-wrap { display:flex; flex-direction:column; align-items:flex-end; max-width:88%; }
.user-message { display:block; padding:12px 15px; border-radius:15px 15px 4px 15px; background:linear-gradient(155deg,#247b62,#145b46); box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 2px 5px rgba(19,73,49,.10); color:#fff; font-size:15px; line-height:1.6; overflow-wrap:anywhere; animation:message-in 180ms cubic-bezier(.23,1,.32,1); }
.message-actions { display:flex; align-items:center; gap:2px; margin-top:4px; animation:message-in 180ms cubic-bezier(.23,1,.32,1); }
@keyframes message-in { from { opacity:0; transform:translateY(4px); } }
.message-action { display:flex; align-items:center; justify-content:center; gap:4px; min-width:58px; min-height:40px; margin:0; padding:0 10px; border-radius:12px; background:transparent; color:#64766c; font-size:12px; line-height:1; white-space:nowrap; transition:background-color 140ms ease,transform 140ms cubic-bezier(.23,1,.32,1),opacity 140ms ease; }
.message-action::after { border:0; }.message-action--pressed { background:#e8eeea; transform:scale(.96); }.message-action[disabled] { opacity:.4; }
/* 编辑态必须有确定宽度：textarea 是原生组件，width:100% 撑不开 fit-content 父级，否则整卡塌缩。
   宽度相对容器（100vw - 32px 恰为正文区内宽，上限 320px），不能用 88vw 这类视口单位——
   窄屏上会溢出内容区，右对齐布局下向左溢出、几乎贴住屏幕边缘。 */
.user-message-wrap--editing { width:calc(100vw - 32px); max-width:320px; }
.user-editor { width:100%; padding:10px; border:1px solid #a9bdb1; border-radius:17px 17px 5px 17px; background:#fbfcfb; box-shadow:0 0 0 3px rgba(36,111,80,.07),0 5px 18px rgba(28,63,43,.08); transform-origin:100% 0; animation:editor-in 180ms cubic-bezier(.23,1,.32,1); }
.user-editor--closing { animation:editor-out 160ms cubic-bezier(.23,1,.32,1) forwards; }
@keyframes editor-in { from { opacity:0; transform:scale(.96) translateY(-4px); } }
@keyframes editor-out { to { opacity:0; transform:scale(.96) translateY(-4px); } }
.user-editor__input { width:100%; min-height:56px; max-height:132px; padding:4px 5px 8px; box-sizing:border-box; color:#263b30; font-size:15px; line-height:1.6; }
.user-editor__actions { display:flex; justify-content:flex-end; gap:4px; border-top:1px solid #e4e9e6; padding-top:6px; }
.message-action--primary { color:#176b54; font-weight:600; }
@media(prefers-reduced-motion:reduce) { .message-action { transition:none; }.user-message,.message-actions,.user-editor,.user-editor--closing { animation:none; } }
</style>
