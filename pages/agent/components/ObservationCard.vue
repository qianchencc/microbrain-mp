<template>
 <view class="observations">
  <view v-for="(block, index) in observation.blocks || []" :key="index" class="ocard">
   <view class="oblock">
    <view class="oblock-head"><text>{{ blockLabel(block) }}</text><text class="count">{{ blockCount(block) }}</text></view>

    <EnvironmentTrend v-if="block.type === 'environment_history'" :report="block.report" />
    <MeterHistoryReport v-else-if="block.type === 'energy_history'" :report="block.report" />
    <view v-else-if="block.type === 'video_playback'" class="recording">
     <text class="recording-name">{{ block.report.name }}</text><text class="meta">{{ block.report.location }}</text>
     <text class="recording-window">{{ fmtShanghaiDateTime(block.report.beginTime) }} — {{ fmtShanghaiDateTime(block.report.endTime) }}</text>
     <text class="meta">录像是否存在以实际播放结果为准</text>
     <button class="vbtn recording-open" :disabled="!playerReady || fetchingId === block.report.deviceId" hover-class="vbtn--pressed" @tap="viewPlayback(block.report)">{{ playerReady ? '查看这段录像' : '播放页接入中' }}</button>
    </view>
    <template v-else-if="block.type === 'video'">
     <view v-for="d in devicesOf(block, index)" :key="d.deviceId" class="orow video-row">
      <view class="dot" :class="dotOf(d.online)" />
      <text class="nm">{{ d.name }}</text>
      <text class="loc">{{ d.location }}</text>
      <view class="video-actions"><button class="vbtn" :disabled="viewDisabled(d)" hover-class="vbtn--pressed" @tap="view(d)">{{ viewLabel(d) }}</button><button class="vbtn recording-link" :disabled="!playerReady" hover-class="vbtn--pressed" @tap="selectPlayback(d)">录像回放</button></view>
     </view>
    </template>
    <text v-if="block.type === 'video'" class="meta">状态查询于 {{ observed || '时间未知' }}</text>

    <template v-else-if="block.type === 'environment'">
     <view v-for="d in devicesOf(block, index)" :key="d.deviceId" class="erow">
      <view class="erow-head">
       <view class="dot" :class="d.reading ? 'on' : 'warn'" />
       <text class="nm">{{ d.name }}</text>
       <text v-if="sourceOf(d.reading)" class="src" :class="{ shadow: sourceOf(d.reading) === '平台影子值' }">{{ sourceOf(d.reading) }}</text>
      </view>
      <view v-if="cellsOf(d.reading).length" class="egrid">
       <view v-for="cell in cellsOf(d.reading)" :key="cell.key" class="ecell"><text class="ev">{{ cell.value }}</text><text class="ek">{{ cell.label }}</text></view>
      </view>
      <text v-else class="meta">{{ d.reading ? '读数不全' : '读数未知' }}</text>
     </view>
     <text class="meta">观测于 {{ observed || '时间未知' }}<text v-if="hasShadow(block)"> · 影子为平台侧兜底读数，可能不是该房间的实测值</text></text>
    </template>

    <template v-else-if="block.type === 'energy'">
     <view v-for="d in devicesOf(block, index)" :key="d.deviceId" class="erow">
      <view class="erow-head">
       <view class="dot" :class="staleOf(d.reading) ? 'warn' : 'on'" />
       <text class="nm">{{ d.name }}</text>
       <text class="loc">{{ d.location }}</text>
       <text class="epower">{{ energyPowerText(d.reading) }}</text>
      </view>
      <text class="meta" :class="{ stale: staleOf(d.reading) }">最新已知读数<text v-if="fmtDateTime(d.reading?.readTime)"> · {{ fmtDateTime(d.reading.readTime) }}<text v-if="ageHint(d.reading.readTime)">（{{ ageHint(d.reading.readTime) }}）</text></text></text>
     </view>
    </template>

    <template v-else-if="block.type === 'safety'">
     <view v-for="d in devicesOf(block, index)" :key="d.deviceId" class="orow">
      <view class="dot warn" />
      <text class="nm">{{ d.name }}</text>
      <text class="loc">{{ d.location }}</text>
      <text class="meta meta--wide">{{ safetySubtypeText(d.subtype) }} · 无实时状态 · 仅告警台账</text>
     </view>
    </template>

    <template v-else-if="block.type === 'alerts'">
     <button v-for="(a, i) in recordsOf(block, index)" :key="a.ledger && a.eventId ? a.ledger + ':' + a.eventId : i" class="arow" :disabled="source !== 'company'" hover-class="arow--pressed" @tap="$emit('select-alert', { record: a, observedAt: observation.observedAt })">
      <view class="alert-copy"><text class="anm">{{ a.deviceName }}<text v-if="a.location && a.location !== a.deviceName"> · {{ a.location }}</text></text><text class="at">{{ fmtDateTime(a.occurredAt) || '记录时间未知' }}</text></view>
      <text class="tag" :class="{ un: a.report === false, unknown: a.report == null }">{{ a.report === true ? '已上报' : a.report === false ? '未上报' : '标记未知' }}</text><uni-icons v-if="source === 'company'" type="right" size="12" color="#95a296" />
     </button>
     <text class="meta">{{ alertsMeta(block) }}</text>
     <button v-if="source === 'company'" class="omore" hover-class="omore--pressed" @tap="$emit('browse-alerts')">按类别和日期查看历史 <uni-icons type="right" size="11" color="#5f7a6b" /></button>
    </template>
    <button v-if="restOf(block, index) || isExpanded(index)" class="omore" hover-class="omore--pressed" :aria-expanded="isExpanded(index)" @tap="toggleBlock(index)">
     <text>{{ isExpanded(index) ? '收起列表' : `还有 ${restOf(block, index)} ${block.type === 'alerts' ? '条' : '台'} · 展开` }}</text>
     <uni-icons type="down" size="11" color="#5f7a6b" :class="{ 'caret-up': isExpanded(index) }" />
    </button>
   </view>
  </view>
  <view v-if="inlinePlayback && playbackDevice" class="inline-playback"><button class="omore" @tap="playbackDevice = null">收起录像期间</button><VideoPlaybackForm :key="playbackDevice.deviceId" :device="playbackDevice" :ready="playerReady" :busy="Boolean(fetchingId)" @open="viewPlayback({ ...playbackDevice, ...$event })" /></view>
  <DeviceSheet v-if="!inlinePlayback && playbackMounted" :open="Boolean(playbackDevice)" title="录像回放" @close="playbackDevice = null"><VideoPlaybackForm v-if="playbackDevice" :key="playbackDevice.deviceId" :device="playbackDevice" :ready="playerReady" :busy="Boolean(fetchingId)" @open="viewPlayback({ ...playbackDevice, ...$event })" /></DeviceSheet>
 </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import EnvironmentTrend from './EnvironmentTrend.vue'
import MeterHistoryReport from './MeterHistoryReport.vue'
import DeviceSheet from './DeviceSheet.vue'
import VideoPlaybackForm from './VideoPlaybackForm.vue'
import { openVideoPlayer, videoPlayerReady } from '../video-player.js'
import { ageHint, energyPowerText, energyStale, environmentCells, environmentSource, fmtDateTime, fmtShanghaiDateTime, safetySubtypeText, videoOnline, videoViewLabel } from '../observation-view.mjs'

const props = defineProps({ observation: { type: Object, required: true }, readOnly: Boolean, source: { type: String, default: 'office' }, inlinePlayback: Boolean })
defineEmits(['select-alert', 'browse-alerts'])
const fetchingId = ref('')
const playbackDevice = ref(null)
const playbackMounted = ref(false)
function selectPlayback(device) { playbackMounted.value = true; playbackDevice.value = device }
const playerReady = videoPlayerReady()
const observed = computed(() => fmtDateTime(props.observation.observedAt))

// 大目录块默认只露出前 6 行，块尾提供展开/收起；告警台账以“条”计。
const ROW_LIMIT = 6
const expandedBlocks = ref([])
const isExpanded = index => expandedBlocks.value.includes(index)
function toggleBlock(index) {
 expandedBlocks.value = isExpanded(index) ? expandedBlocks.value.filter(value => value !== index) : [...expandedBlocks.value, index]
}
function devicesOf(block, index) {
 const items = block.devices || []
 return isExpanded(index) ? items : items.slice(0, ROW_LIMIT)
}
function recordsOf(block, index) {
 const items = block.records || []
 return isExpanded(index) ? items : items.slice(0, ROW_LIMIT)
}
function restOf(block, index) {
 if (isExpanded(index)) return 0
 const total = block.type === 'alerts' ? (block.records || []).length : (block.devices || []).length
 return Math.max(0, total - ROW_LIMIT)
}

const LABELS = { video_playback: '录像回放', energy_history: '计量原始历史', environment_history: '环境趋势', video: '视频', environment: '环境', energy: '能耗', safety: '消防安全', alerts: '告警台账' }
const blockLabel = block => LABELS[block.type] || '观察'
const blockCount = block => block.type === 'video_playback' ? '录像窗口' : block.type === 'energy_history' ? `${block.report?.samples.length ?? 0} 条采样` : block.type === 'environment_history' ? `${block.report?.coverage.readSamples ?? 0} 条采样` : block.type === 'alerts' ? `${block.total ?? 0} 条` : `${block.devices?.length ?? 0} 台`
const dotOf = online => online === true ? 'on' : online === false ? 'off' : 'warn'
const cellsOf = reading => environmentCells(reading)
const sourceOf = reading => environmentSource(reading)
const hasShadow = block => (block.devices || []).some(d => d.reading?.source === 'shadow')
const staleOf = reading => energyStale(reading)
const onlineOf = value => videoOnline(value)
const viewDisabled = d => !playerReady || videoOnline(d.online) !== true || fetchingId.value === d.deviceId
const viewLabel = d => videoViewLabel(onlineOf(d.online), playerReady, fetchingId.value === d.deviceId)
async function view(d) {
 if (viewDisabled(d)) return
 fetchingId.value = d.deviceId
 try { await openVideoPlayer({ deviceId: d.deviceId, name: d.name, location: d.location, source: props.source }) }
 finally { fetchingId.value = '' }
}
async function viewPlayback(report) {
 if (!playerReady || fetchingId.value) return
 fetchingId.value = report.deviceId
 try { await openVideoPlayer({ ...report, source: props.source, mode: 'playback' }) }
 finally { fetchingId.value = '' }
}

function alertsMeta(block) {
 const parts = []
 const records = block.records || []
 if (records.length && (block.total ?? 0) > records.length) parts.push(`本次读取 ${block.total} 条，显示最近 ${records.length} 条`)
 else if (records.length) parts.push(`本次读取 ${block.total ?? records.length} 条`)
 else parts.push(block.windowDays ? `近 ${block.windowDays} 天无记录` : '本次查询无记录')
 if (block.latest?.time) parts.push(`最新一条 ${fmtDateTime(block.latest.time)}（${ageHint(block.latest.time)}）`)
 parts.push('平台上报标记不代表已恢复')
 return parts.join(' · ')
}
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
button { margin:0; padding:0; background:transparent; }
button::after { border:0; }
.observations { margin-top:10px; }
.ocard { margin-top:8px; }
.ocard:first-child { margin-top:0; }
.oblock { border-radius:12px; background:#f7faf6; box-shadow:inset 0 0 0 .5px #dfe8e0, 0 2px 8px -6px rgba(30,52,40,.4); padding:10px 12px; }
.oblock-head { display:flex; align-items:center; justify-content:space-between; color:#4e6355; font-size:11px; font-weight:700; }
.count { color:#93a29a; font-weight:500; }
.orow { display:flex; align-items:center; gap:7px; margin-top:9px; min-width:0; }
.dot { width:8px; height:8px; flex-shrink:0; border-radius:50%; }
.dot.on { background:#3f9d74; box-shadow:0 0 0 3px #3f9d7420; }
.dot.off { background:#b9b2a4; }
.dot.warn { background:#a27128; }
.nm { flex-shrink:0; max-width:46%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#2c4435; font-size:12px; font-weight:600; }
.loc { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#839189; font-size:10px; }
.vbtn { flex-shrink:0; height:28px; padding:0 12px; border-radius:14px; display:flex; align-items:center; justify-content:center;
 background:linear-gradient(155deg,#2a876c,#145c46); color:#fff; font-size:11px; font-weight:600;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 3px 8px -4px rgba(20,90,66,.55); transition:transform 130ms cubic-bezier(.23,1,.32,1); }
.vbtn[disabled] { background:linear-gradient(155deg,#e3e9e4,#d5dcd6); color:#93a19a; font-weight:500; box-shadow:none; }
.vbtn--pressed:not([disabled]) { transform:scale(.95); }
.erow { margin-top:10px; }
.erow-head { display:flex; align-items:center; gap:7px; min-width:0; }
.src { flex-shrink:0; padding:2px 7px; border-radius:8px; background:#e4f2ea; color:#1d6b4e; font-size:9px; font-weight:600; }
.src.shadow { background:#f1ead7; color:#8a6a24; }
.egrid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; margin-top:8px; }
.ecell { padding:7px 6px 6px; border-radius:7px; background:#eef3ee; box-shadow:inset 0 0 0 .5px #dfe6e0; }
.ev { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#234434; font-size:12px; font-weight:700; }
.ek { display:block; margin-top:2px; color:#7d8d83; font-size:9px; }
.epower { flex-shrink:0; color:#234434; font-size:13px; font-weight:700; }
.meta { display:block; margin-top:7px; color:#8b9a91; font-size:10px; line-height:1.5; }
.meta.stale { color:#a27128; }
.meta--wide { flex:1; min-width:0; margin-top:0; }
.arow { display:flex; align-items:center; gap:9px; width:100%; min-height:52px; padding:8px 0; box-sizing:border-box; text-align:left; border-bottom:1px solid #e5ece3; border-radius:0; color:inherit; }.arow:last-of-type { border-bottom:0; }.arow--pressed { background:#eaf1e7; }.alert-copy { flex:1; min-width:0; }.alert-copy .anm { display:block; max-width:100%; font-size:12px; }.alert-copy .at { display:block; margin-top:3px; }
.at { flex-shrink:0; color:#6d7e73; font-size:10px; font-variant-numeric:tabular-nums; }
.anm { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#2c4435; font-size:11px; font-weight:600; }
.omore { width:100%; min-height:34px; margin-top:7px; display:flex; align-items:center; justify-content:center; gap:5px; color:#3c6b58; font-size:11px; font-weight:600; border-radius:0; }
.omore--pressed { background:#eef4ef; }
.omore uni-icons { transition:transform 160ms ease; }
.caret-up { transform:rotate(180deg); }
.tag { flex-shrink:0; padding:2px 7px; border-radius:8px; background:#e4f2ea; color:#1d6b4e; font-size:9px; font-weight:600; }
.tag.unknown { background:#edf0eb; color:#829087; }
.tag.un { background:#f1ead7; color:#8a6a24; }
.recording-name,.recording-window { display:block; }.recording-name { font-size:13px;font-weight:600; }.recording-window { font-size:11px;color:#607c64;line-height:1.7;margin:9px 0; }.recording-open { margin-top:12px; }.video-row { display:grid;grid-template-columns:6px minmax(0,1fr);row-gap:5px; }.video-row .loc,.video-actions { grid-column:2; }.video-actions { display:flex;gap:8px;margin-top:3px; }.video-actions .vbtn { margin:0; }
@media(prefers-reduced-motion:reduce) { .vbtn,.omore uni-icons { transition:none; } }
</style>
