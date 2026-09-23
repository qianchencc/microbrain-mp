<template>
 <view class="user-message-wrap">
  <view class="user-message" :class="{ 'user-message--editing': editing }"><text class="user-message__text">{{ content }}</text></view>
  <view v-if="editing" class="message-actions" aria-label="编辑状态"><text class="editing-note">正在编辑…</text></view>
  <view v-else-if="recoverable" class="message-actions" aria-label="消息操作">
   <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" aria-label="编辑" @tap="$emit('begin-edit')">
    <image class="message-action__icon" src="/static/compose.svg" />
   </button>
   <button class="message-action" :disabled="disabled" hover-class="message-action--pressed" aria-label="重试" @tap="$emit('retry')">
    <image class="message-action__icon" src="/static/refresh.svg" />
   </button>
  </view>
 </view>
</template>

<script setup>
// editing 仅作视觉态：实际编辑收编进主输入框（全页面只有一条键盘停靠链路，
// 行内第二个 textarea 会与 composer 的 adjust-position=false 停靠方案双重补偿）。
defineProps({ content: { type: String, default: '' }, recoverable: Boolean, disabled: Boolean, editing: Boolean })
defineEmits(['retry', 'begin-edit'])
</script>

<style scoped>
/* 布局不依赖 fit-content 测量：宿主由父级定宽（.user-row .um-host{width:100%}），
   wrap 定宽块级 + text-align:right，气泡 inline-block 收缩包裹——短消息不再被
   嵌套 intrinsic sizing 塌成一列（2026-09-16 三次实测根因）；font-size:0 消行盒
   基线空隙，文字自行声明字号。 */
.user-message-wrap { display:block; width:100%; text-align:right; font-size:0; }
.user-message { display:inline-block; text-align:left; max-width:88%; box-sizing:border-box; padding:12px 15px; border-radius:15px 15px 4px 15px; background:linear-gradient(155deg,#247b62,#145b46); box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 2px 5px rgba(19,73,49,.10); animation:message-in 180ms cubic-bezier(.23,1,.32,1); transition:opacity 160ms ease; }
.user-message__text { display:block; color:#fff; font-size:15px; line-height:1.6; overflow-wrap:anywhere; word-break:break-all; }
.user-message--editing { opacity:.55; }
@keyframes message-in { from { opacity:0; transform:translateY(4px); } }
/* 操作行对齐 spectrum message-actions Ghost 变体：纯图标、28px、中性灰、按压 scale(.92)+浅底 */
.message-actions { display:flex; justify-content:flex-end; align-items:center; gap:2px; margin-top:4px; padding:2px 0; animation:message-in 180ms cubic-bezier(.23,1,.32,1); }
.message-action { display:flex; align-items:center; justify-content:center; width:28px; height:28px; margin:0; padding:0; border-radius:6px; background:transparent; transition:background-color 150ms ease,transform 150ms cubic-bezier(.23,1,.32,1),opacity 150ms ease; }
.message-action::after { border:0; }
.message-action--pressed { background:rgba(0,0,0,.04); transform:scale(.92); }
.message-action[disabled] { opacity:.4; }
.message-action__icon { width:14px; height:14px; opacity:.45; }
.editing-note { font-size:11px; color:#8b9991; }
@media(prefers-reduced-motion:reduce) { .message-action { transition:none; }.user-message,.message-actions { animation:none; } }
</style>
