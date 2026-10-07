<template>
 <view class="assistant-nav" :style="{ paddingTop: top + 'px' }">
  <view class="nav-line" :style="{ height: barHeight + 'px', paddingRight: rightInset + 'px' }">
   <button class="nav-back" :aria-label="'返回' + backLabel" hover-class="nav-pressed" @tap="$emit('back')"><uni-icons type="back" size="21" color="#315846" /></button>
   <text class="nav-title">{{ title }}</text>
   <view class="nav-action"><slot name="action" /></view>
  </view>
  <view v-if="context" class="nav-context"><slot /></view>
 </view>
</template>
<script setup>
import { navMetrics } from '../nav-metrics.js'
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
.nav-title { flex:1; min-width:0; margin-left:4px; font-size:15px; font-weight:600; color:#293f31; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.nav-action { flex-shrink:0; display:flex; align-items:center; }
.nav-context { padding:2px 18px 10px; }
</style>
