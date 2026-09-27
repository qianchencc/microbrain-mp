<template>
 <view class="region-row">
  <view class="region-chip">
   <button class="region-name" :disabled="!focusRegion || regionsLoading" @tap="$emit('open', focusRegion)"><view class="region-dot" /><text>{{ regionsLoading ? '正在读取区域' : focusRegion?.name || '暂无可用区域' }}</text><uni-icons v-if="!workbench && focusRegion" type="forward" size="12" color="#7f9287" /></button>
   <button class="region-toggle" :disabled="!regions.length || regionsLoading" aria-label="切换关注区域" @tap="open = true"><uni-icons type="bottom" size="14" color="#536b5c" /></button>
  </view>
 </view>
 <button v-if="regionsError" class="region-retry" @tap="loadRegionFocus().catch(() => {})">{{ regionsError }} · 重试</button>
 <DeviceSheet :open="open" title="关注区域" subtitle="未指明地点时，优先在此区域查找设备" @close="open = false">
  <scroll-view class="region-options" scroll-y enhanced :show-scrollbar="false">
   <radio-group @change="choose($event.detail.value)">
    <label v-for="region in regions" :key="region.id" class="region-option" :class="{ chosen: region.id === focusRegionId }"><view class="option-copy"><text>{{ region.name }}</text><text v-if="region.attention" class="attention">有待查看的异常</text></view><radio :value="region.id" :checked="region.id === focusRegionId" color="#176b54" /></label>
   </radio-group>
  </scroll-view>
 </DeviceSheet>
</template>
<script setup>
import { ref } from 'vue'
import DeviceSheet from './DeviceSheet.vue'
import { regions, focusRegion, focusRegionId, regionsLoading, regionsError, selectFocusRegion, loadRegionFocus } from '../region-focus.js'
defineProps({ workbench: Boolean })
const emit = defineEmits(['open', 'change'])
const open = ref(false)
function choose(id) { if (selectFocusRegion(id)) { open.value = false; emit('change', focusRegion.value) } }
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-row { padding:0 18px 10px; display:flex; }
.region-retry { margin:0 18px 10px; color:#9a752e; font-size:12px; text-align:left; }
.region-chip { display:flex; min-width:0; max-width:100%; border-radius:16px; background:linear-gradient(#fefffe,#edf2ec); box-shadow:inset 0 1px 0 #fff,inset 0 0 0 .5px #29493624,0 3px 8px -6px #233a2d66; }
button { background:transparent; margin:0; padding:0; border-radius:0; line-height:1.2; }
button::after { border:0; }
button[disabled] { background:transparent; color:#89958e; }
.region-name { display:flex; align-items:center; gap:8px; padding:0 10px 0 13px; min-height:44px; min-width:0; font-size:13px; font-weight:600; color:#3d5947; }
.region-name text { max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.region-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; background:#628775; box-shadow:0 1px 0 #fff; }
.region-toggle { width:42px; min-height:44px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-left:1px solid #526b4c14; }
.region-options { height:45vh; }
.region-option { margin:0 16px 8px; padding:16px; display:flex; align-items:center; justify-content:space-between; gap:16px; border-radius:14px; color:#405747; font-size:15px; }
.region-option.chosen { background:#edf3ee; }
.option-copy { min-width:0; }
.option-copy text { display:block; }
.attention { margin-top:4px; font-size:11px; color:#9a752e; }
</style>
