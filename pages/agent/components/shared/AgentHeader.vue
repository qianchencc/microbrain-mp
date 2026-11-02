<template>
 <AssistantNav :title="agentName" :back-label="backLabel" :context="context" @back="$emit('back')">
  <template #title><slot name="title"><text class="header-title">{{ agentName }}</text></slot></template>
  <template #action>
   <button v-if="workbench" class="workbench-link" aria-label="工作台与会话菜单" hover-class="workbench-link--pressed" @tap="openMenu"><text>工作台</text><uni-icons type="forward" size="12" color="var(--agent-text-secondary)" /></button>
   <button v-else class="identity" :aria-label="`${agentName}，会话菜单`" hover-class="identity--pressed" @tap="openMenu"><view class="dot" :class="{ 'dot--error': error, 'dot--working': status !== '服务在线' }" :aria-label="status" /><uni-icons type="more-filled" size="17" color="var(--agent-text-secondary)" /></button>
  </template>
  <slot />
 </AssistantNav>
</template>
<script setup>
const props = defineProps({ status: String, agentName: { type: String, default: '物联 Agent' }, backLabel: String, context: Boolean, workbench: Boolean, workbenchBusy: Boolean, inboxEnabled: Boolean, tasksEnabled: Boolean, inboxUnreadCount: { type: Number, default: 0 }, disabled: Boolean, error: Boolean })
const emit = defineEmits(['clear', 'back', 'open-inbox', 'open-tasks', 'workbench'])
import AssistantNav from './AssistantNav.vue'
import { openAgentMenu } from '../../lib/navigation.mjs'
function openMenu() { openAgentMenu(props, event => emit(event)) }
</script>
<style scoped lang="scss">
@import "../../styles/tokens";

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.header-title { font-size:15px; font-weight:600; color:var(--agent-text-primary); }
.workbench-link { height:44px; display:flex; align-items:center; gap:4px; flex-shrink:0; margin:0; padding:0 8px; background:transparent; color:var(--agent-text-secondary); font-size:$agent-font-size-compact; }.workbench-link::after { border:0; }.workbench-link--pressed { opacity:.65; }
.identity { width:44px; height:44px; display:flex; align-items:center; justify-content:center; gap:5px; margin:0; padding:0; background:transparent; border-radius:14px; }.identity::after { border:0; }.identity--pressed { background:var(--agent-tint); }
.dot { width:5px; height:5px; flex-shrink:0; border-radius:50%; background:var(--agent-success); box-shadow:0 0 0 2px var(--agent-success-faint); }
.dot--working { background:var(--agent-text-muted); box-shadow:0 0 0 2px var(--agent-tint); }.dot--error { background:var(--agent-error); box-shadow:0 0 0 2px var(--agent-error-faint); }
</style>
