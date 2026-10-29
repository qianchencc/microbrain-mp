<template>
 <view class="assistant-nav" :style="{ paddingTop: top + 'px' }">
  <view class="nav-line" :style="{ height: barHeight + 'px', paddingRight: rightInset + 'px' }">
   <button class="nav-back" :aria-label="'返回' + backLabel" hover-class="nav-pressed" @tap="$emit('back')"><uni-icons type="back" size="21" color="#315846" /></button>
   <view class="nav-title"><slot name="title"><text class="nav-title-text">{{ title }}</text></slot></view>
   <view class="nav-action"><slot name="action" /></view>
  </view>
  <view v-if="context" class="nav-context"><slot /></view>
 </view>
</template>
<script setup>
import { navMetrics } from '../lib/navigation.mjs'
defineProps({ title: String, backLabel: { type: String, default: '上一页' }, context: Boolean })
defineEmits(['back'])
const { top, barHeight, rightInset } = navMetrics()
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.assistant-nav { flex-shrink:0; background:linear-gradient(180deg,#fcfdfc,#f4f7f5); border-bottom:1px solid #2c4b3a0d; }
.nav-line { display:flex; align-items:center; padding-left:8px; box-sizing:border-box; min-height:44px; }
.nav-back { width:44px; height:44px; flex-shrink:0; display:flex; align-items:center; justify-content:center; margin:0; padding:0; background:transparent; border-radius:14px; }
.nav-back::after { border:0; }.nav-pressed { background:#e7eee8; }
.nav-title { flex:1; min-width:0; margin-left:4px; display:flex; align-items:center; overflow:hidden; }
.nav-title-text { flex:1; min-width:0; font-size:15px; font-weight:600; color:#293f31; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.nav-action { flex-shrink:0; display:flex; align-items:center; }
.nav-context { padding:2px 18px 10px; }
</style>
<style>
/* 具名插槽 #title 在 mp-weixin 会被外包一层普通 view（块级、min-width:auto），
   不能缩到内容以下——长区域名曾把右侧「工作台」挤向胶囊（真机复现）。
   scoped 命中不到该外包层，必须用全局选择器让它可收缩并裁剪溢出。 */
.assistant-nav .nav-title > view { flex:1; min-width:0; display:flex; overflow:hidden; }
</style>
