<template>
 <AssistantNav :title="agentName" :back-label="backLabel" :context="context" @back="$emit('back')">
  <template #action><button class="identity" :aria-label="`${agentName}，会话菜单`" hover-class="identity--pressed" @tap="openMenu"><view class="dot" :class="{ 'dot--error': error, 'dot--working': status !== '服务在线' }" :aria-label="status" /><text class="session-label">会话</text></button></template>
  <slot />
 </AssistantNav>
</template>
<script setup>
const props = defineProps({ status: String, agentName: { type: String, default: '物联 Agent' }, backLabel: String, context: Boolean, disabled: Boolean, error: Boolean })
const emit = defineEmits(['clear', 'back'])
import AssistantNav from './AssistantNav.vue'
function openMenu() {
 const itemList = []
 if (!props.disabled) itemList.push('清除当前会话')
 if (!itemList.length) {
  uni.showToast({ title: '暂无可清除的会话', icon: 'none' })
  return
 }
 uni.showActionSheet({ itemList, success: ({ tapIndex }) => {
  if (!props.disabled && tapIndex === 0) emit('clear')
 } })
}
</script>
<style scoped>

/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view, text, input { font-size: inherit; line-height: inherit; }
.identity { width:44px; height:44px; display:flex; align-items:center; justify-content:center; gap:5px; margin:0; padding:0; background:transparent; border-radius:14px; }.identity::after { border:0; }.identity--pressed { background:#e7eee8; }
.dot { width:5px; height:5px; flex-shrink:0; border-radius:50%; background:#31866a; box-shadow:0 0 0 2px #e4eee8; }
.dot--working { background:#8c9c93; box-shadow:0 0 0 2px #e8edea; }.dot--error { background:#ad711b; box-shadow:0 0 0 2px #f4eadc; }
.session-label { font-size:11px; color:#536b5c; }
</style>
