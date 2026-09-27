<template>
 <DeviceSheet :open="open" expanded compact-header title="设备" @close="$emit('close')">
  <template #header-right><text class="sheet-meta">{{ regionName }} · {{ devices.length }} 台</text></template>
  <template #header>
   <view class="filter-header" :class="{ searching }">
    <view class="group-controls">
     <button v-for="mode in modes" :key="mode.key" class="group-mode" :class="{ active: groupBy === mode.key }" hover-class="group-mode--pressed" @tap="groupBy = mode.key">{{ mode.label }}</button>
     <button class="icon-button" aria-label="搜索设备" hover-class="icon-button--pressed" @tap="openSearch"><image src="/static/search.svg" /></button>
     <text class="count">{{ devices.length }} 台</text>
    </view>
    <view class="search-controls">
     <button class="icon-button" aria-label="返回全部设备" hover-class="icon-button--pressed" @tap="closeSearch"><image src="/static/back.svg" /></button>
     <view class="search-field"><image src="/static/search.svg" /><input v-model="query" placeholder="搜索名称、位置或状态" placeholder-style="color:#8a978f" confirm-type="search" :focus="searchFocused" :adjust-position="false" /></view>
    </view>
   </view>
  </template>
  <view class="drawer-content">
   <view v-if="stateError && devices.length" class="state-warning"><text>状态暂不可用，设备目录仍可查看</text><button @tap="loadStates">重试</button></view>
   <scroll-view class="device-scroll" scroll-y enhanced :show-scrollbar="false">
    <view v-if="!regionId" class="empty">{{ regionError || '正在读取关注区域' }}</view>
    <view v-else-if="loading" class="empty">正在读取设备目录</view>
    <view v-else-if="error" class="empty"><text>{{ error }}</text><button @tap="loadDirectory">重新加载</button></view>
    <view v-else-if="!devices.length" class="empty">这个区域还没有接入设备</view>
    <view v-else-if="!groups.length" class="empty">没有匹配的设备</view>
    <view v-for="group in groups" :key="group.label" class="group">
     <text class="group-title">{{ group.label }} · {{ group.items.length }}</text>
     <view class="device-grid">
      <view v-for="device in group.items" :key="device.id" class="device-card">
       <view class="device-art"><image v-if="device.artwork" :src="device.artwork" mode="aspectFit" /><uni-icons v-else type="gear" size="28" color="#8b9a91" /><view class="state-lamp" :class="device.status" /></view>
       <view class="device-copy">
        <text class="device-name"><text v-for="(part, index) in device.nameParts" :key="index" :class="{ hit: part.hit }">{{ part.text }}</text></text>
        <text class="device-location"><text v-for="(part, index) in device.kindParts" :key="'kind-' + index" :class="{ hit: part.hit }">{{ part.text }}</text><text> · </text><text v-for="(part, index) in device.locationParts" :key="'location-' + index" :class="{ hit: part.hit }">{{ part.text }}</text></text>
        <text v-if="stateLoading" class="device-state">状态读取中 · 上报时间未知</text>
        <text v-else class="device-state"><text v-for="(part, index) in device.detailParts" :key="index" :class="{ hit: part.hit }">{{ part.text }}</text><text> · {{ device.age }}</text></text>
       </view>
      </view>
     </view>
    </view>
    <view class="list-tail" />
   </scroll-view>
  </view>
 </DeviceSheet>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { listRegionDevices, listRegionDeviceStates } from '@/apis/agent'
import DeviceSheet from './DeviceSheet.vue'
import { regionDeviceGroups } from '../region-device-view.mjs'

const props = defineProps({ open: Boolean, regionId: String, regionName: String, regionError: String })
const emit = defineEmits(['close', 'count'])
const modes = [{ key: 'kind', label: '类型' }, { key: 'location', label: '位置' }, { key: 'status', label: '状态' }]
const devices = ref([]), readings = ref({}), loading = ref(false), stateLoading = ref(false)
const error = ref(''), stateError = ref(''), groupBy = ref('kind'), query = ref(''), searching = ref(false), searchFocused = ref(false)
const observedNow = ref(Date.now())
const groups = computed(() => regionDeviceGroups(devices.value, readings.value, groupBy.value, query.value, observedNow.value))
let directoryRequest = 0, stateRequest = 0, focusTimer

async function loadDirectory() {
 const current = ++directoryRequest, regionId = props.regionId
 ++stateRequest; devices.value = []; readings.value = {}; stateLoading.value = false; error.value = ''; stateError.value = ''; emit('count', null)
 if (!regionId) return
 loading.value = true
 try {
  const result = await listRegionDevices(regionId)
  if (current !== directoryRequest || regionId !== props.regionId) return
  devices.value = result.devices || []
  emit('count', devices.value.length)
  if (props.open) loadStates()
 } catch (cause) { if (current === directoryRequest) error.value = cause.message || '设备目录暂不可用' }
 finally { if (current === directoryRequest) loading.value = false }
}

async function loadStates() {
 const current = ++stateRequest, regionId = props.regionId
 if (!props.open || !regionId || !devices.value.length) return
 readings.value = {}; observedNow.value = Date.now(); stateLoading.value = true; stateError.value = ''
 try {
  const result = await listRegionDeviceStates(regionId)
  if (current !== stateRequest || regionId !== props.regionId || !props.open) return
  readings.value = Object.fromEntries((result.states || []).map(item => [item.id, item]))
  observedNow.value = Date.now()
 } catch (cause) { if (current === stateRequest) stateError.value = cause.message || '设备状态暂不可用' }
 finally { if (current === stateRequest) stateLoading.value = false }
}

function openSearch() {
 clearTimeout(focusTimer)
 searching.value = true
 focusTimer = setTimeout(() => { searchFocused.value = true }, 220)
}
function closeSearch() { clearTimeout(focusTimer); searchFocused.value = false; searching.value = false; query.value = '' }

watch(() => props.regionId, loadDirectory, { immediate: true })
watch(() => props.open, value => {
 if (value) { if (!loading.value) loadDirectory() }
 else { ++stateRequest; stateLoading.value = false; closeSearch(); groupBy.value = 'kind' }
})
onBeforeUnmount(() => { ++directoryRequest; ++stateRequest; clearTimeout(focusTimer) })
</script>

<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.2; }
button::after { border:0; }
.filter-header { position:relative; height:50px; border-top:1px solid #edf0ed; overflow:hidden; }
.sheet-meta { max-width:230px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#78877e; font-size:11px; }
.group-controls,.search-controls { position:absolute; inset:0; padding:0 16px; display:flex; align-items:center; gap:8px; transition:transform 260ms cubic-bezier(.32,.72,0,1),opacity 170ms ease-out; }
.search-controls { opacity:0; transform:translateX(22px); pointer-events:none; }
.filter-header.searching .group-controls { opacity:0; transform:translateX(-22px); pointer-events:none; }
.filter-header.searching .search-controls { opacity:1; transform:none; pointer-events:auto; }
.group-mode { height:32px; min-width:44px; padding:0 13px; border-radius:16px; background:#eff2ee; color:#45564d; font-size:12px; }
.group-mode.active { background:#176b54; color:#fff; }
.group-mode--pressed,.icon-button--pressed { opacity:.7; transform:scale(.95); }
.icon-button { width:32px; height:32px; border:1px solid #d8e1dc; border-radius:16px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.icon-button image { width:14px; height:14px; }
.count { margin-left:auto; font-size:11px; color:#89958e; }
.search-field { min-width:0; flex:1; height:36px; padding:0 12px; border:1px solid #d8e1dc; border-radius:18px; display:flex; align-items:center; gap:8px; background:#f4f7f5; }
.search-field image { width:14px; height:14px; flex-shrink:0; }
.search-field input { flex:1; min-width:0; height:100%; font-size:13px; color:#24382d; }
.drawer-content { min-height:0; flex:1; display:flex; flex-direction:column; }
.state-warning { margin:6px 16px 0; padding:7px 10px; background:#fbf4e5; color:#896529; font-size:11px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.state-warning button { color:#176b54; font-size:11px; }
.device-scroll { flex:1; min-height:0; height:0; box-sizing:border-box; padding:0 16px; }
.empty { padding:45px 8px; text-align:center; color:#89958e; font-size:13px; }
.empty text { display:block; }
.empty button { margin:14px auto 0; color:#176b54; font-size:12px; }
.group { margin-top:14px; }
.group-title { display:block; margin:0 2px 8px; font-size:11px; font-weight:600; color:#5f6e66; }
.device-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.device-card { min-width:0; background:#f8faf7; border:1px solid #dae3dc; border-radius:8px; overflow:hidden; }
.device-art { height:76px; position:relative; display:flex; align-items:center; justify-content:center; background:linear-gradient(155deg,#dfe4de,#f4f5ef 52%,#d4ddd6); }
.device-art image { width:92%; height:92%; }
.state-lamp { position:absolute; right:9px; top:9px; width:8px; height:8px; border-radius:50%; background:#bbc7be; border:1px solid white; box-shadow:0 1px 2px #1f352b33; }
.state-lamp.on { background:#e4ae37; box-shadow:0 0 6px #e7b94c99; }
.state-lamp.unknown { background:#fff; border-color:#b57932; }
.device-copy { padding:8px 9px 10px; min-width:0; }
.device-name,.device-location,.device-state { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.device-name { font-size:12px; font-weight:600; color:#24382d; }
.device-location { margin-top:3px; font-size:10px; color:#65786b; }
.device-state { margin-top:7px; padding-top:7px; border-top:1px solid #e2e9e2; font-size:10px; color:#687a6d; }
.hit { background:#f6dda4; border-radius:2px; }
.list-tail { height:28px; }
@media(prefers-reduced-motion:reduce) { .group-controls,.search-controls { transition:none; } }
</style>
