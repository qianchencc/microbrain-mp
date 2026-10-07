<template>
 <DeviceSheet :open="open" expanded compact-header :title="sheetTitle" :back="backWithinDrawer" @close="$emit('close')">
  <template v-if="depth > 0" #header-left><button class="back-button" aria-label="返回上一级" @tap="backWithinDrawer"><uni-icons type="left" size="17" color="#315846" /></button></template>
  <template #header-right><view class="header-actions"><text v-if="depth === 0" class="sheet-meta">{{ regionName }} · {{ devices.length }} 台</text><button class="state-refresh" aria-label="刷新设备状态" :disabled="stateLoading || !devices.length" @tap="stateRefresh.run()"><uni-icons :class="{ spinning: stateLoading }" type="refreshempty" size="16" color="#315846" /></button></view></template>
  <template #header>
   <view v-if="depth === 0" class="filter-header" :class="{ searching }">
    <view class="group-controls">
     <button v-for="mode in modes" :key="mode.key" class="group-mode" :class="{ active: groupBy === mode.key }" hover-class="group-mode--pressed" @tap="groupBy = mode.key">{{ mode.label }}</button>
     <button class="icon-button" aria-label="搜索设备" hover-class="icon-button--pressed" @tap="openSearch"><image src="/static/search.svg" /></button>
     <view class="controls-spacer" />
     <view class="count">{{ devices.length }} 台</view>
    </view>
    <view class="search-controls" :class="{ searching }">
     <button class="icon-button" aria-label="返回全部设备" hover-class="icon-button--pressed" @tap="closeSearch"><image src="/static/back.svg" /></button>
     <view class="search-field"><image src="/static/search.svg" /><input v-model="query" placeholder="搜索名称、位置或状态" placeholder-style="color:#8a978f" confirm-type="search" :focus="searchFocused" :adjust-position="false" /></view>
    </view>
   </view>
  </template>
  <view class="drawer-content">
   <view class="nav-pane" :class="{ 'pane-before': depth > 0 }" :style="{ zIndex: 0 }">
    <text v-if="stateError && devices.length" class="state-warning">状态暂不可用</text>
    <scroll-view class="device-scroll" scroll-y enhanced :show-scrollbar="false">
     <view v-if="!regionId" class="empty">{{ regionError || '正在读取关注区域' }}</view>
     <view v-else-if="loading" class="empty">正在读取设备目录</view>
     <view v-else-if="error" class="empty"><text>{{ error }}</text><button @tap="loadDirectory">重新加载</button></view>
     <view v-else-if="!devices.length" class="empty">这个区域还没有接入设备</view>
     <view v-else-if="!groups.length" class="empty">没有匹配的设备</view>
     <view v-for="group in groups" :key="group.label" class="group">
      <text class="group-title">{{ group.label }} · {{ group.items.length }}</text>
      <view class="device-grid">
       <view v-for="device in group.items" :key="device.id" class="device-card" role="button" hover-class="device-card--pressed" @tap="openDevice(device.id)">
        <view class="device-art"><image v-if="device.artwork" :src="device.artwork" mode="aspectFit" /><view v-else-if="device.artVariant === 'video'" class="art-cam"><view class="art-cam__lens" /></view><view v-else-if="device.artVariant === 'observe'" class="art-sensor" /><uni-icons v-else type="gear" size="28" color="#8b9a91" /><view class="state-lamp" :class="device.status" /></view>
        <view class="device-copy">
         <text class="device-name"><text v-for="(part, index) in device.nameParts" :key="index" :class="{ hit: part.hit }">{{ part.text }}</text></text>
         <text class="device-location"><text v-for="(part, index) in device.kindParts" :key="'kind-' + index" :class="{ hit: part.hit }">{{ part.text }}</text><text> · </text><text v-for="(part, index) in device.locationParts" :key="'location-' + index" :class="{ hit: part.hit }">{{ part.text }}</text></text>
         <text class="device-state"><text v-for="(part, index) in device.detailParts" :key="index" :class="{ hit: part.hit }">{{ part.text }}</text></text>
        </view>
       </view>
      </view>
     </view>
     <view class="list-tail" />
    </scroll-view>
   </view>
   <view v-if="devicePane" class="nav-pane" :class="{ 'pane-before': depth > 1, 'pane-after': depth < 1 }" :style="{ zIndex: 1 }"><DeviceObservationView v-if="isObservationKind(devicePane.kind)" class="device-timeline-host" :device="devicePane" :reading="readings[devicePane.id]" /><DeviceTimelineView v-else ref="deviceTimeline" class="device-timeline-host" :device="devicePane" :date="date" :now="now" :sample-mode="sampleMode" :sample-date="sampleDate" :sample-tasks="sampleTasks" @task="pushTask" /></view>
   <view v-if="taskPane" class="nav-pane" :class="{ 'pane-after': depth < 2 }" :style="{ zIndex: 2 }"><TaskDetailContent class="task-content-host" :active="open && Boolean(taskPane)" :task-id="taskPane.taskId" :sample-task="taskPane.sampleTask" @cancelled="$emit('cancelled')" /></view>
  </view>
 </DeviceSheet>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { listRegionDevices, listRegionDeviceStates } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import DeviceSheet from './DeviceSheet.vue'
import DeviceTimelineView from './DeviceTimelineView.vue'
import DeviceObservationView from './DeviceObservationView.vue'
import TaskDetailContent from './TaskDetailContent.vue'
import { isObservationKind, regionDeviceGroups } from '../region-device-view.mjs'
import { createStateRefresh } from '../state-refresh.mjs'

const props = defineProps({ open: Boolean, regionId: String, regionName: String, regionError: String, date: String, now: String, refreshSignal: Number, sampleMode: Boolean, sampleDate: String, sampleTasks: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'count', 'cancelled'])
const modes = [{ key: 'kind', label: '类型' }, { key: 'location', label: '位置' }, { key: 'status', label: '状态' }]
const pageVisible = ref(true)
onHide(() => { pageVisible.value = false; stateRefresh.cancel(); ++stateRequest; ++directoryRequest; loading.value = false })
onShow(() => { pageVisible.value = true; if (props.open) {
 const scope = getAgentStorageScope()
 loadDirectory(scope === loadedScope)
} })
const devices = ref([]), readings = ref({}), loading = ref(false), stateLoading = ref(false)
const error = ref(''), stateError = ref(''), groupBy = ref('kind'), query = ref(''), searching = ref(false), searchFocused = ref(false)
const activeDeviceId = ref(''), activeTask = ref(null)
const deviceTimeline = ref(null)
const deviceClosing = ref(null), taskClosing = ref(null)
const paneTimers = {}
const depth = computed(() => activeTask.value ? 2 : activeDeviceId.value ? 1 : 0)
const sheetTitle = computed(() => activeTask.value ? '任务' : activeDevice.value?.name || '设备')
const devicePane = computed(() => activeDevice.value || deviceClosing.value)
const taskPane = computed(() => activeTask.value || taskClosing.value)
const groups = computed(() => regionDeviceGroups(devices.value, readings.value, groupBy.value, query.value))
const activeDevice = computed(() => activeDeviceId.value
 ? regionDeviceGroups(devices.value, readings.value, 'kind', '')
  .flatMap(group => group.items).find(device => device.id === activeDeviceId.value) || null : null)
let directoryRequest = 0, stateRequest = 0, focusTimer
let loadedRegionId = '', loadedScope = '', loadedAt = 0

function clearPaneTimer(key) { clearTimeout(paneTimers[key]); paneTimers[key] = null }
function releasePane(key, closing) { clearPaneTimer(key); paneTimers[key] = setTimeout(() => { closing.value = null }, 300) }
function openDevice(id) {
 clearPaneTimer('device'); deviceClosing.value = null
 activeTask.value = null; clearPaneTimer('task'); taskClosing.value = null
 activeDeviceId.value = id
}
function pushTask(payload) {
 clearPaneTimer('task'); taskClosing.value = null
 activeTask.value = payload
}
function pop() {
 if (activeTask.value) { taskClosing.value = activeTask.value; activeTask.value = null; releasePane('task', taskClosing) }
 else if (activeDeviceId.value) { deviceClosing.value = activeDevice.value; activeDeviceId.value = ''; releasePane('device', deviceClosing) }
}
function backWithinDrawer() {
 if (depth.value === 1 && deviceTimeline.value?.dismissCalendar()) return
 if (depth.value) pop()
 else if (searching.value) closeSearch()
 else emit('close')
}
function resetStack() {
 activeDeviceId.value = ''; activeTask.value = null
 deviceClosing.value = null; taskClosing.value = null
 clearPaneTimer('device'); clearPaneTimer('task')
}

async function loadDirectory(preserveNavigation = false) {
 preserveNavigation = preserveNavigation === true && loadedScope === getAgentStorageScope() && props.regionId === loadedRegionId
 const current = ++directoryRequest, regionId = props.regionId
 if (!preserveNavigation) resetStack()
 const scope = getAgentStorageScope()
 if (!preserveNavigation && regionId === loadedRegionId && scope === loadedScope && Date.now() - loadedAt < 30000) {
  if (props.open) stateRefresh.auto()
  return
 }
 ++stateRequest; if (!preserveNavigation) { devices.value = []; readings.value = {} };  stateLoading.value = false; error.value = ''; stateError.value = ''; emit('count', null)
 if (!regionId) return
 loading.value = true
 try {
  const result = await listRegionDevices(regionId)
  if (current !== directoryRequest || regionId !== props.regionId || !pageVisible.value || scope !== getAgentStorageScope()) return
  devices.value = result.devices || []
  if (activeDeviceId.value && !devices.value.some(device => device.id === activeDeviceId.value)) resetStack()
  loadedRegionId = regionId; loadedScope = scope; loadedAt = Date.now()
  emit('count', devices.value.length)
  if (props.open) stateRefresh.auto()
 } catch (cause) { if (current === directoryRequest) error.value = cause.message === 'request:fail' ? '设备目录暂不可用，请重试' : cause.message || '设备目录暂不可用' }
 finally { if (current === directoryRequest) loading.value = false }
}

async function loadStates() {
 const current = ++stateRequest, regionId = props.regionId
 if (!props.open || !pageVisible.value || !regionId || !devices.value.length) return
 stateLoading.value = true; stateError.value = ''
 try {
  const result = await listRegionDeviceStates(regionId)
  if (current !== stateRequest || regionId !== props.regionId || !props.open) return
  readings.value = Object.fromEntries((result.states || []).map(item => [item.id, item]))
 } catch (cause) { if (current === stateRequest) { readings.value = {}; stateError.value = cause.message || '设备状态暂不可用' } }
 finally { if (current === stateRequest) stateLoading.value = false }
}
const stateRefresh = createStateRefresh(loadStates)

function openSearch() {
 clearTimeout(focusTimer)
 searching.value = true
 focusTimer = setTimeout(() => { searchFocused.value = true }, 0)
}
function closeSearch() { clearTimeout(focusTimer); searchFocused.value = false; searching.value = false; query.value = '' }

watch(() => props.regionId, () => {
 loadedRegionId = ''; loadedAt = 0; devices.value = []; readings.value = {}; emit('count', null)
 if (props.open) loadDirectory()
}, { immediate: true })
watch(() => props.open, value => {
 if (value) { resetStack(); if (!loading.value) loadDirectory() }
 else { stateRefresh.cancel(); ++stateRequest; stateLoading.value = false; closeSearch(); groupBy.value = 'kind'; resetStack() }
})
watch(() => props.refreshSignal, () => { if (props.open) stateRefresh.after(1000) })
onBeforeUnmount(() => { stateRefresh.cancel(); ++directoryRequest; ++stateRequest; clearTimeout(focusTimer); clearPaneTimer('device'); clearPaneTimer('task') })
</script>

<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.2; min-width:0; min-height:0; }
button::after { border:0; }
.filter-header { position:relative; height:50px; padding:0 16px; display:flex; align-items:center; border-top:1px solid #edf0ed; border-bottom:1px solid #edf0ed; overflow:hidden; }
.header-actions { display:flex; align-items:center; gap:6px; min-width:0; }
.sheet-meta { max-width:100px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#78877e; font-size:11px; }
.state-refresh { width:44px; height:44px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.state-refresh[disabled] { opacity:.5; }
.spinning { animation:state-spin 900ms linear infinite; }
@keyframes state-spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce){.spinning{animation:none}}
.back-button { width:44px; height:44px; margin-right:8px; border-radius:15px; background:#eef2ef; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.group-controls { width:100%; min-width:0; display:flex; align-items:center; gap:8px; transition:transform 200ms cubic-bezier(.32,.72,0,1),opacity 140ms ease-out; }
.search-controls { position:absolute; top:0; right:0; bottom:0; left:0; padding:0 16px; display:flex; align-items:center; gap:8px; opacity:0; transform:translateX(22px); pointer-events:none; transition:transform 200ms cubic-bezier(.32,.72,0,1),opacity 140ms ease-out; }
.filter-header.searching .group-controls { opacity:0; transform:translateX(-22px); pointer-events:none; }
.filter-header.searching .search-controls { opacity:1; transform:none; pointer-events:auto; }
.group-mode { width:auto; flex-shrink:0; height:32px; min-width:44px; padding:0 13px; border-radius:16px; background:#eff2ee; color:#45564d; font-size:12px; display:flex; align-items:center; justify-content:center; transition:background-color 180ms ease,color 180ms ease,transform 130ms cubic-bezier(.23,1,.32,1); }
.group-mode.active { background:#176b54; color:#fff; }
.group-mode--pressed,.icon-button--pressed { transform:scale(.95); }
.icon-button { width:44px; height:44px; border:1px solid #d8e1dc; border-radius:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.icon-button image { width:14px; height:14px; }
.controls-spacer { flex:1; min-width:0; }
.count { flex-shrink:0; white-space:nowrap; font-size:11px; color:#89958e; }
.search-field { min-width:0; flex:1; height:36px; padding:0 12px; border:1px solid #d8e1dc; border-radius:18px; display:flex; align-items:center; gap:8px; background:#f4f7f5; }
.search-field image { width:14px; height:14px; flex-shrink:0; }
.search-field input { flex:1; min-width:0; height:100%; font-size:13px; color:#24382d; }
.drawer-content { min-height:0; flex:1; display:flex; flex-direction:column; position:relative; overflow:hidden; }
.nav-pane { position:absolute; top:0; right:0; bottom:0; left:0; display:flex; flex-direction:column; background:#fcfdfc; transition:transform 200ms cubic-bezier(.32,.72,0,1),opacity 200ms cubic-bezier(.32,.72,0,1); will-change:transform; }
.nav-pane.pane-before { transform:translateX(-12%); opacity:.8; pointer-events:none; }
.nav-pane.pane-after { transform:translateX(26%); opacity:0; pointer-events:none; }
.device-timeline-host { height:0; min-height:0; flex:1; overflow:hidden; }
.task-content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
.state-warning { margin:6px 16px 0; color:#a27128; font-size:11px; }
.device-scroll { flex:1; min-height:0; height:0; box-sizing:border-box; padding:0 16px; }
.empty { padding:45px 8px; text-align:center; color:#89958e; font-size:13px; animation:fadeIn 160ms ease-out backwards; }
@keyframes fadeIn { from { opacity:0; } }
.empty text { display:block; }
.empty button { margin:14px auto 0; color:#176b54; font-size:12px; }
.group { margin-top:14px; }
.group-title { display:block; margin:0 2px 8px; font-size:11px; font-weight:600; color:#5f6e66; }
.device-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.device-card { min-width:0; background:#f8faf7; border:1px solid #dae3dc; border-radius:8px; overflow:hidden; transition:transform 130ms cubic-bezier(.23,1,.32,1); animation:cardIn 200ms cubic-bezier(.23,1,.32,1) backwards; }
.device-card--pressed { transform:scale(.97); }
@keyframes cardIn { from { opacity:0; transform:translateY(8px) scale(.98); } }
.device-art { height:76px; position:relative; display:flex; align-items:center; justify-content:center; background:linear-gradient(155deg,#dfe4de,#f4f5ef 52%,#d4ddd6); }
.device-art image { width:92%; height:92%; }
.state-lamp { position:absolute; right:9px; top:9px; width:8px; height:8px; border-radius:50%; background:#bbc7be; border:1px solid white; box-shadow:0 1px 2px #1f352b33; transition:background-color 200ms ease,box-shadow 200ms ease,border-color 200ms ease; }
.state-lamp.on { background:#e4ae37; box-shadow:0 0 6px #e7b94c99; }
.state-lamp.unknown { background:#fff; border-color:#ad711b; }
.state-lamp.observe { background:#5d9478; box-shadow:0 0 4px #5d947866; }
.art-cam { width:44px; height:26px; position:relative; border-radius:7px; background:linear-gradient(160deg,#33493e,#17271f); box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 5px 12px -6px rgba(20,40,32,.65); }
.art-cam::before { content:''; position:absolute; right:-6px; top:8px; width:7px; height:10px; border-radius:1px 3px 3px 1px; background:linear-gradient(90deg,#1c3026,#28473a); }
.art-cam__lens { position:absolute; left:8px; top:7px; width:12px; height:12px; border-radius:50%; background:radial-gradient(circle at 35% 32%,#9fd7b9,#1e6647 55%,#0d3b28); box-shadow:inset 0 0 0 1px rgba(255,255,255,.3); }
.art-sensor { width:28px; height:28px; position:relative; border-radius:50%; background:linear-gradient(160deg,#f2f4ef,#cfd8d1); box-shadow:inset 0 1px 0 #fff,inset 0 -3px 6px rgba(48,70,58,.18),0 4px 10px -5px rgba(30,50,40,.5); }
.art-sensor::before { content:''; position:absolute; left:10px; top:10px; width:8px; height:8px; border-radius:50%; background:radial-gradient(circle at 35% 32%,#8fd0ae,#26714f 70%); box-shadow:0 0 4px #3f9d7455; }
.art-sensor::after { content:''; position:absolute; left:5px; top:19px; right:5px; height:1px; background:rgba(38,64,50,.25); }
.device-copy { padding:8px 9px 10px; min-width:0; }
.device-name,.device-location,.device-state { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.device-name { font-size:12px; font-weight:600; color:#24382d; }
.device-location { margin-top:3px; font-size:10px; color:#65786b; }
.device-state { margin-top:7px; padding-top:7px; border-top:1px solid #e2e9e2; font-size:10px; color:#687a6d; }
.hit { background:#f6dda4; border-radius:2px; }
.list-tail { height:28px; }
@media(prefers-reduced-motion:reduce) { .group-controls,.search-controls,.device-card,.nav-pane,.group-mode,.state-lamp,.empty { transition:none; animation:none; } }
</style>
