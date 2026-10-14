<template>
 <view class="cdrawer">
  <view class="gmodes">
   <button v-for="mode in modes" :key="mode.key" class="gmode" :class="{ active: groupBy === mode.key }" @tap="groupBy = mode.key">{{ mode.label }}</button>
   <text class="gcount">{{ devices.length }} 台</text>
  </view>
  <scroll-view class="dscroll" scroll-y enhanced :show-scrollbar="false">
   <view v-for="group in groups" :key="group.label" class="dgroup">
    <button class="ghead" @tap="toggle(group.label)"><text>{{ group.label }} · {{ group.items.length }}</text><text class="gcar">{{ collapsed.has(group.label) ? '›' : '⌄' }}</text></button>
    <view v-if="!collapsed.has(group.label)" class="dgrid">
     <view v-for="device in group.items" :key="device.id" class="dcard">
      <view class="dart"><image v-if="artOf(device).src" :src="artOf(device).src" mode="aspectFit" /><view v-else-if="artOf(device).variant === 'video'" class="art-cam"><view class="art-cam__lens" /></view><view v-else-if="artOf(device).variant === 'observe'" class="art-sensor" /><uni-icons v-else type="gear" size="28" color="#8b9a91" /><view class="lamp" :class="{ observe: READ_ONLY_KINDS.has(device.kind) }" /></view>
      <view class="dcopy">
       <text class="dname">{{ device.name }}</text>
       <text class="dloc">{{ locationText(device) }}</text>
       <text class="dstate">{{ stateLabel(device) }}</text>
      </view>
     </view>
    </view>
   </view>
   <text v-if="!devices.length" class="dempty">该类别下暂无设备</text>
   <view class="dtail" />
  </scroll-view>
 </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { resolveDeviceArtwork } from '../device-art/catalog.js'

const props = defineProps({ devices: { type: Array, default: () => [] }, kind: String })

const modes = [{ key: 'location', label: '位置' }, { key: 'status', label: '状态' }]
const groupBy = ref('location')
const collapsed = ref(new Set())

const READ_ONLY_KINDS = new Set(['environment', 'energy', 'safety', 'video'])
const SUBTYPE_LABEL = { gas: '燃气', smoke: '烟感', water: '水浸', flooding: '水浸' }
// 上游 installAddress 为空、location 与设备名相同（"类型-位置-回路"结构）：
// 取"类型-其后除末段"作为空间分组，无短横线的名字剥掉尾部类型词。
const TYPE_TAIL = /(电表|水浸感应器|燃气感应器|光电感烟探测器|感应器|探测器|传感器|开关|智慧空调|空调|门禁|监控|摄像头|摄像机)$/u
function locationKey(device) {
 const name = (device.location || device.name || '').trim()
 const segs = name.split('-').map(s => s.trim()).filter(Boolean)
 if (segs.length > 1) {
  const rest = segs.slice(1)
  return rest.length > 1 ? rest.slice(0, -1).join('-') : rest[0]
 }
 const stripped = name.replace(TYPE_TAIL, '').trim()
 return stripped || '未标位置'
}
function stateLabel(device) {
 if (device.kind === 'safety' && device.subtype) return `只读观察 · ${SUBTYPE_LABEL[device.subtype] || device.subtype}`
 return READ_ONLY_KINDS.has(device.kind) ? '只读观察' : '可控制'
}
// 统一设备图：device-art/catalog.js 的位图素材（门禁/中央空调/格栅灯/灯带）+ variant CSS 兜底，与区域抽屉同规。
function artOf(device) {
 return resolveDeviceArtwork({ kind: device.kind, deviceName: device.name, location: device.location || device.name })
}
function locationText(device) {
 const key = locationKey(device)
 return key === device.name?.trim() ? '未标位置' : key
}
const groups = computed(() => {
 const map = new Map()
 for (const device of props.devices) {
  const key = groupBy.value === 'location' ? locationKey(device) : stateLabel(device)
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(device)
 }
 return [...map.entries()].map(([label, items]) => ({ label, items }))
})
function toggle(label) {
 const next = new Set(collapsed.value)
 next.has(label) ? next.delete(label) : next.add(label)
 collapsed.value = next
}
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; line-height:1.3; }
button::after { border:0; }
.cdrawer { flex:1; min-height:0; display:flex; flex-direction:column; color:#274635; font-size:13px; }
.gmodes { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid #edf0ed; flex-shrink:0; }
.gmode { height:32px; min-width:44px; padding:0 13px; border-radius:16px; background:#eff2ee; color:#45564d; font-size:12px; display:flex; align-items:center; justify-content:center; }
.gmode.active { background:#176b54; color:#fff; }
.gcount { margin-left:auto; font-size:11px; color:#89958e; }
.dscroll { flex:1; min-height:0; padding:0 16px; box-sizing:border-box; }
.dgroup { margin-top:14px; }
.ghead { display:flex; align-items:center; gap:6px; width:100%; padding:4px 2px; margin-bottom:8px; text-align:left; font-size:11px; font-weight:600; color:#5f6e66; }
.gcar { margin-left:auto; color:#9aa894; font-size:9px; }
.dgrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.dcard { border:1px solid #dae3dc; border-radius:8px; overflow:hidden; background:#f8faf7; }
.dart { height:64px; position:relative; display:flex; align-items:center; justify-content:center; background:linear-gradient(155deg,#dfe4de,#f4f5ef 52%,#d4ddd6); }
.dart image { width:92%; height:92%; }
.art-sensor { width:28px; height:28px; border-radius:50%; background:linear-gradient(160deg,#f2f4ef,#cfd8d1); box-shadow:inset 0 1px 0 #fff,inset 0 -3px 6px rgba(48,70,58,.18),0 4px 10px -5px rgba(30,50,40,.5); position:relative; }
.art-sensor::before { content:''; position:absolute; left:10px; top:10px; width:8px; height:8px; border-radius:50%; background:radial-gradient(circle at 35% 32%,#8fd0ae,#26714f 70%); }
.art-sensor::after { content:''; position:absolute; left:5px; top:19px; right:5px; height:1px; background:rgba(38,64,50,.25); }
.art-cam { width:44px; height:26px; position:relative; border-radius:7px; background:linear-gradient(160deg,#33493e,#17271f); box-shadow:inset 0 1px 0 rgba(255,255,255,.16); }
.art-cam::before { content:''; position:absolute; right:-6px; top:8px; width:7px; height:10px; border-radius:1px 3px 3px 1px; background:#28473a; }
.art-cam__lens { position:absolute; left:8px; top:7px; width:12px; height:12px; border-radius:50%; background:radial-gradient(circle at 35% 32%,#9fd7b9,#1e6647 55%,#0d3b28); }
.lamp { position:absolute; right:8px; top:8px; width:8px; height:8px; border-radius:50%; background:#bbc7be; border:1px solid #fff; box-shadow:0 1px 2px #1f352b33; }
.lamp.observe { background:#5d9478; }
.dcopy { padding:7px 9px 9px; min-width:0; }
.dname { display:block; font-size:12px; font-weight:600; color:#24382d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dloc { display:block; font-size:10px; color:#65786b; margin-top:3px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dstate { display:block; font-size:10px; color:#687a6d; margin-top:7px; padding-top:7px; border-top:1px solid #e2e9e2; }
.dempty { display:block; padding:35px 0; text-align:center; color:#94a193; font-size:11px; }
.dtail { height:28px; }
</style>
