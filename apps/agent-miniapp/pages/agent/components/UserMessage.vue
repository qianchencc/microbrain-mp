<template>
 <view class="user-message-wrap" :class="{ 'user-message-wrap--editing': editing }">
  <template v-if="!editing">
   <view class="user-message" :class="{ 'user-message--closing': opening }"><text class="user-message__text">{{ content }}</text></view>
   <view v-if="recoverable" class="message-actions" :class="{ 'message-actions--closing': opening }" aria-label="消息操作">
    <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" aria-label="编辑" @tap="beginEdit">
     <image class="message-action__icon" src="/static/compose.svg" />
    </button>
    <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" aria-label="重试" @tap="$emit('retry')">
     <image class="message-action__icon" src="/static/refresh.svg" />
    </button>
   </view>
  </template>
  <view v-if="editing" class="user-editor" :class="{ 'user-editor--closing': closing }">
   <textarea class="user-editor__input" :value="draft" :auto-height="true" :maxlength="200" :focus="true"
    confirm-type="send" :disabled="disabled" @input="onEditorInput" @confirm="onEditorConfirm" />
   <view class="user-editor__actions">
    <button class="editor-action" :disabled="disabled" hover-class="editor-action--pressed" @tap="cancel">取消</button>
    <button class="editor-action editor-action--primary" :disabled="disabled || !fieldText.trim()" hover-class="editor-action--pressed" @tap="submit">重新发送</button>
   </view>
  </view>
 </view>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { fieldWriteSteps } from '../field-echo-guard.mjs'
const props = defineProps({ content: { type: String, default: '' }, recoverable: Boolean, disabled: Boolean })
const emit = defineEmits(['retry', 'edit'])
const editing = ref(false), closing = ref(false), opening = ref(false)
// draft 是写进原生层的程序性值（仅进入编辑/取消重置时变），编辑期间不回写：
// @input 在拼音组合中态也触发，回写 :value 会强制 IME 提交拼音。fieldText 跟踪字段实况。
const draft = ref(props.content), fieldText = ref(props.content)
let closeTimer, openTimer
// 重置草稿经两步判定：目标值恰等于已写入值时原生层仍显示回声文本，须先写显示值制造 diff
function writeDraft(target) {
 const steps = fieldWriteSteps(fieldText.value, draft.value, target)
 if (steps.length) { draft.value = steps[0]; if (steps.length === 2) nextTick(() => { draft.value = steps[1] }) }
 fieldText.value = target
}
watch(() => props.content, value => { if (!editing.value) writeDraft(value) })
watch(() => props.recoverable, value => {
 if (!value) { clearTimeout(openTimer); opening.value = false; closeEditor(false) }
})
// 进入编辑：气泡先退场（message-out），再挂载编辑器（editor-in 从气泡绿底过渡），双向都有动画
function beginEdit() {
 if (props.disabled || closing.value || opening.value) return
 writeDraft(props.content)
 opening.value = true
 openTimer = setTimeout(() => { opening.value = false; editing.value = true }, 140)
}
// 编辑态收起必须先播退场动画再卸载（含提交与 recoverable 翻转路径），否则气泡硬切出现
function closeEditor(reset) {
 if (closing.value) return
 clearTimeout(openTimer)
 opening.value = false
 closing.value = true
 closeTimer = setTimeout(() => { closing.value = false; editing.value = false; if (reset) writeDraft(props.content) }, 160)
}
function cancel() { if (!props.disabled) closeEditor(true) }
function onEditorInput(event) { fieldText.value = event.detail.value }
function onEditorConfirm(event) { onEditorInput(event); submit() }
function submit() {
 if (closing.value) return
 const value = fieldText.value.trim()
 if (!props.disabled && value) { emit('edit', value); closeEditor(false) }
}
onBeforeUnmount(() => { clearTimeout(closeTimer); clearTimeout(openTimer) })
</script>

<style scoped>
/* 布局不依赖 fit-content 测量：宿主由父级定宽（.user-row .um-host{width:100%}），
   wrap 定宽块级 + text-align:right，气泡 inline-block 收缩包裹——短消息不再被
   嵌套 intrinsic sizing 塌成一列（2026-09-16 三次实测根因）；font-size:0 消行盒
   基线空隙，文字自行声明字号。 */
.user-message-wrap { display:block; width:100%; text-align:right; font-size:0; }
.user-message { display:inline-block; text-align:left; max-width:88%; box-sizing:border-box; padding:12px 15px; border-radius:15px 15px 4px 15px; background:linear-gradient(155deg,#247b62,#145b46); box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 2px 5px rgba(19,73,49,.10); animation:message-in 180ms cubic-bezier(.23,1,.32,1); }
.user-message__text { display:block; color:#fff; font-size:15px; line-height:1.6; overflow-wrap:anywhere; word-break:break-all; }
.user-message--closing,.message-actions--closing { animation:message-out 140ms cubic-bezier(.23,1,.32,1) forwards; }
@keyframes message-in { from { opacity:0; transform:translateY(4px); } }
@keyframes message-out { to { opacity:0; transform:scale(.97); } }
/* 操作行对齐 spectrum message-actions Ghost 变体：纯图标、28px、中性灰、按压 scale(.92)+浅底 */
.message-actions { display:flex; justify-content:flex-end; align-items:center; gap:2px; margin-top:4px; padding:2px 0; animation:message-in 180ms cubic-bezier(.23,1,.32,1); }
.message-action { display:flex; align-items:center; justify-content:center; width:28px; height:28px; margin:0; padding:0; border-radius:6px; background:transparent; transition:background-color 150ms ease,transform 150ms cubic-bezier(.23,1,.32,1),opacity 150ms ease; }
.message-action::after { border:0; }
.message-action--pressed { background:rgba(0,0,0,.04); transform:scale(.92); }
.message-action[disabled] { opacity:.4; }
.message-action__icon { width:14px; height:14px; opacity:.45; }
/* 编辑态必须有确定宽度：textarea 是原生组件，width:100% 撑不开 fit-content 父级，否则整卡塌缩。
   宽度相对容器（100vw - 32px 恰为正文区内宽，上限 320px），不能用 88vw 这类视口单位——
   窄屏上会溢出内容区，右对齐布局下向左溢出、几乎贴住屏幕边缘。 */
.user-message-wrap--editing { width:calc(100vw - 32px); max-width:320px; margin-left:auto; }
/* 编辑器入场从气泡的绿底起步（背景/圆角向纸白过渡，文字白→墨绿），观感是气泡原地变形而非换卡 */
.user-editor { width:100%; padding:10px; border:1px solid #a9bdb1; border-radius:17px 17px 5px 17px; background:#fbfcfb; box-shadow:0 0 0 3px rgba(36,111,80,.07),0 5px 18px rgba(28,63,43,.08); transform-origin:100% 0; animation:editor-in 200ms cubic-bezier(.23,1,.32,1); }
.user-editor--closing { animation:editor-out 160ms cubic-bezier(.23,1,.32,1) forwards; }
@keyframes editor-in { from { opacity:0; background-color:#247b62; border-color:#247b62; transform:scale(.97) translateY(-4px); } }
@keyframes editor-out { to { opacity:0; transform:scale(.96) translateY(-4px); } }
.user-editor__input { width:100%; min-height:56px; max-height:132px; padding:4px 5px 8px; box-sizing:border-box; color:#263b30; font-size:15px; line-height:1.6; animation:editor-text-in 200ms linear; }
@keyframes editor-text-in { from { color:#ffffff; } }
.user-editor__actions { display:flex; justify-content:flex-end; align-items:center; gap:4px; border-top:1px solid #e4e9e6; padding-top:6px; }
.editor-action { min-height:32px; margin:0; padding:0 10px; border-radius:8px; background:transparent; color:#64766c; font-size:12px; line-height:30px; white-space:nowrap; transition:transform 160ms cubic-bezier(.23,1,.32,1),opacity 160ms ease; }
.editor-action--primary { background:#176b54; color:#fff; font-weight:600; box-shadow:0 1px 3px rgba(19,73,49,.18); }
.editor-action::after { border:0; }
.editor-action--pressed { transform:scale(.97); opacity:.85; }
.editor-action[disabled] { opacity:.4; }
@media(prefers-reduced-motion:reduce) { .message-action,.editor-action { transition:none; }.user-message,.message-actions,.user-message--closing,.message-actions--closing,.user-editor,.user-editor--closing,.user-editor__input { animation:none; } }
</style>
