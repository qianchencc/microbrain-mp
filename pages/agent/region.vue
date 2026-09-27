<template>
 <view class="region-page">
  <RegionChip workbench />
  <view class="day-heading"><text class="day-title">今天</text><text>{{ date.slice(5).replace('-', '月') }}日 · {{ tasks.length }} 条记录</text><button v-if="isDev" class="sample-toggle" @tap="toggleSample">{{ sampleMode ? '返回真实记录' : '查看样例' }}</button></view>
  <text v-if="sampleMode" class="sample-notice">本地演示记录 · 未写入设备或运行库</text>
  <view v-if="loading || error" class="notice"><text>{{ loading ? '正在读取任务记录' : error }}</text><button v-if="error" @tap="load">重新加载</button></view>
  <view v-else class="timeline-body">
   <view v-if="!items.length" class="empty">
    <image class="empty-art" :src="emptyArt" mode="aspectFit" />
    <text class="empty-title">今天还没有任务记录</text>
    <text>在物联 Agent 中确认设备操作后，</text><text>结果会显示在这里。</text>
   </view>
   <RegionTimeline v-else :key="sampleMode ? 'sample' : 'real'" :items="items" :date="date" :now="displayNow" :interactive="false">
    <template #card="{ item }">
     <view class="task-row">
     <view class="avatars"><view v-for="avatar in item.avatars" :key="avatar.id" class="device-avatar"><image v-if="avatar.src" :src="avatar.src" mode="aspectFit" /><uni-icons v-else type="gear" size="13" color="#7c8d82" /></view><text v-if="item.more" class="more">+{{ item.more }}</text></view>
     <text class="task-label">{{ item.label }}</text>
     <text v-if="!item.faded" class="task-state" :class="item.status">{{ item.statusText }}</text>
     <text class="creator">{{ item.creatorName }}</text>
     </view>
    </template>
   </RegionTimeline>
  </view>
  <view class="device-dock"><button class="device-entry" hover-class="device-entry--pressed" @tap="deviceDrawerOpen = true"><uni-icons type="list" size="17" color="#315846" /><text>设备</text><text v-if="deviceCount !== null" class="device-count">{{ deviceCount }}</text></button></view>
  <RegionDeviceDrawer :open="deviceDrawerOpen" :region-id="focusRegionId" :region-name="focusRegion?.name || ''" :region-error="error" @close="deviceDrawerOpen = false" @count="deviceCount = $event" />
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { listRegionTimeline } from '@/apis/agent'
import { isDev } from '@/config/settings'
import { getAgentStorageScope } from '@/utils/agent-session'
import RegionChip from './components/RegionChip.vue'
import RegionTimeline from './components/RegionTimeline.vue'
import RegionDeviceDrawer from './components/RegionDeviceDrawer.vue'
import { focusRegion, focusRegionId, loadRegionFocus, selectFocusRegion } from './region-focus.js'
import { localDate } from './timeline-geometry.mjs'
import { regionTimelineItems } from './region-timeline.mjs'
import { regionSampleTasks } from './region-sample-tasks.mjs'
const emptyArt = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><path d="M30 2c-9 12 9 22 0 38s9 26 0 38" fill="none" stroke="#c9d6ce" stroke-width="1.6"/><circle cx="31" cy="40" r="6" fill="#fff"/><circle cx="31" cy="40" r="4" fill="#ad711b"/></svg>')
const error = ref(''), loading = ref(true), tasks = ref([]), sampleMode = ref(false)
const deviceDrawerOpen = ref(false), deviceCount = ref(null)
const now = ref(new Date().toISOString()), date = computed(() => localDate(now.value))
const displayNow = computed(() => sampleMode.value ? `${date.value}T14:45:00+08:00` : now.value)
const items = computed(() => regionTimelineItems(tasks.value))
let initialRegion = '', requestId = 0, loadId = 0, visible = false, loadingDirectory = false
onLoad(query => { initialRegion = query.regionId || '' })
async function loadTimeline() {
 const current = ++requestId, region = focusRegionId.value, scope = getAgentStorageScope()
 tasks.value = []; error.value = ''; loading.value = true
 try {
  if (!region) return
  if (sampleMode.value) { tasks.value = regionSampleTasks(date.value, region); return }
  const result = await listRegionTimeline(region, date.value)
  if (current === requestId && scope === getAgentStorageScope()) tasks.value = result.tasks || []
 } catch (cause) { if (current === requestId && scope === getAgentStorageScope()) error.value = cause.message || '任务记录暂不可用' }
 finally { if (current === requestId) loading.value = false }
}
function toggleSample() { sampleMode.value = !sampleMode.value; loadTimeline() }
async function load() {
 const currentLoad = ++loadId
 loadingDirectory = true; loading.value = true; error.value = ''; tasks.value = []; ++requestId
 now.value = new Date().toISOString()
 try { await loadRegionFocus(); if (currentLoad !== loadId || !visible) return; if (initialRegion) { selectFocusRegion(initialRegion); initialRegion = '' }; await loadTimeline() }
 catch (cause) { if (currentLoad === loadId) { error.value = cause.message || '区域暂不可用'; loading.value = false } }
 finally { if (currentLoad === loadId) loadingDirectory = false }
}
watch(focusRegionId, () => { deviceCount.value = null; if (visible && !loadingDirectory) loadTimeline() })
onShow(() => { visible = true; load() })
onHide(() => { visible = false; deviceDrawerOpen.value = false; ++requestId; ++loadId })
onUnload(() => { visible = false; deviceDrawerOpen.value = false; ++requestId; ++loadId })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-page { height:100vh; box-sizing:border-box; padding-top:14px; background:#f4f7f5; color:#526759; display:flex; flex-direction:column; }
.day-heading { padding:18px 23px 12px; display:flex; align-items:baseline; flex-wrap:wrap; gap:9px; color:#89958e; font-size:11px; }
.day-title { color:#45564d; font-size:20px; font-weight:600; }
.sample-toggle { margin:0 0 0 auto; padding:0; background:transparent; color:#176b54; font-size:11px; line-height:1.4; }
.sample-toggle::after { border:0; }
.sample-notice { margin:0 23px 6px; color:#987034; font-size:11px; }
.timeline-body { position:relative; flex:1; min-height:0; margin:0 16px; overflow:hidden; }
.empty { padding:70px 24px 0; text-align:center; font-size:12px; line-height:1.8; color:#89958e; }
.empty-art { display:block; width:60px; height:80px; margin:0 auto 14px; }
.empty text { display:block; }
.empty-title { color:#526759; font-size:14px; font-weight:600; margin-bottom:5px; }
.notice { padding:70px 24px; text-align:center; font-size:13px; color:#89958e; }
.notice button { margin-top:18px; background:transparent; font-size:13px; color:#176b54; }
.notice button::after { border:0; }
.task-row { display:flex; align-items:center; gap:6px; height:32px; min-width:0; }
.avatars { display:flex; align-items:center; flex-shrink:0; }
.device-avatar { width:21px; height:21px; margin-left:-7px; border:1px solid #fff; border-radius:50%; background:#edf2ee; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.device-avatar image { width:21px; height:21px; }
.device-avatar:first-child { margin-left:0; }
.more { font-size:8px; margin-left:2px; color:#7a8d80; }
.task-label { flex:1; min-width:0; font-size:11px; font-weight:600; color:#45564d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.creator { flex-shrink:0; font-size:9px; color:#91a097; }
.task-state { flex-shrink:0; font-size:8px; color:#9e742f; }
.task-state::before { content:""; display:inline-block; width:4px; height:4px; margin:0 3px 1px 0; border-radius:50%; background:currentColor; }
.task-state.failed { color:#a76950; }
.device-dock { flex-shrink:0; height:70px; display:flex; align-items:center; justify-content:center; background:linear-gradient(#f4f7f500,#f4f7f5 36%); }
.device-entry { height:44px; min-width:130px; margin:0; padding:0 20px; border:1px solid #dce5dd; border-radius:22px; display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(#fff,#f2f6f1); box-shadow:0 5px 18px #233a2d1c; color:#315846; font-size:13px; font-weight:600; }
.device-entry::after { border:0; }
.device-entry--pressed { transform:scale(.97); }
.device-count { font-size:11px; color:#7b8d80; }
</style>
