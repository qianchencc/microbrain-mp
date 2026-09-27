<template>
 <view class="region-page">
  <RegionChip workbench />
  <view class="empty"><text class="empty-title">{{ focusRegion?.name || '区域工作台' }}</text><text>{{ error || '此区域暂无任务记录' }}</text><button v-if="error" @tap="load">重新加载</button></view>
 </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import RegionChip from './components/RegionChip.vue'
import { focusRegion, loadRegionFocus, selectFocusRegion } from './region-focus.js'
const error = ref('')
let initialRegion = ''
onLoad(query => { initialRegion = query.regionId || '' })
async function load() {
 error.value = ''
 try { await loadRegionFocus(); if (initialRegion) { selectFocusRegion(initialRegion); initialRegion = '' } }
 catch (cause) { error.value = cause.message || '区域暂不可用' }
}
onShow(load)
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-page { height:100vh; box-sizing:border-box; padding-top:14px; background:#f4f7f5; color:#526759; }
.empty { padding:100px 24px; text-align:center; font-size:13px; color:#89958e; }
.empty text { display:block; }
.empty-title { margin-bottom:10px; font-size:17px; font-weight:600; color:#45604d; }
.empty button { margin-top:18px; background:transparent; font-size:13px; color:#176b54; }
.empty button::after { border:0; }
</style>
