<template>
 <view class="strip-wrap">
  <view class="pullzone" :style="{ width: pullWidth + 'px' }">
   <view class="pz">
    <image class="pz-ring" :src="ringImage" mode="aspectFit" />
   </view>
  </view>
  <scroll-view class="strip" scroll-x enhanced :show-scrollbar="false" :bounces="false" :scroll-left="scrollLeft" :scroll-with-animation="animateScroll"
   upper-threshold="40" @scrolltoupper="reachLeft" @scroll="onScroll"
   @touchstart="touchStart" @touchmove="touchMove" @touchend="touchEnd" @touchcancel="touchEnd">
   <button v-for="day in days" :key="day.date" class="eday" :class="{ sel: day.date === selected, dim: !day.pending && !day.failed && day.usage == null }" @tap="$emit('select', day.date)">
    <view class="ebar"><view class="bar" :class="{ sel: day.date === selected, empty: !day.pending && !day.failed && day.usage == null, pend: day.pending, fail: day.failed }" :style="{ height: barHeight(day) }" /></view>
    <view class="edlab"><text class="lab" :class="{ sel: day.date === selected }">{{ day.date.slice(5) }}</text></view>
   </button>
  </scroll-view>
 </view>
</template>
<script setup>
import { computed, ref, watch, getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { STRIP_COL_WIDTH } from '../../lib/energy.mjs'
import { AGENT_COLORS } from '../../styles/colors.js'

const props = defineProps({ days: { type: Array, default: () => [] }, selected: String, viewportWidth: { type: Number, default: 0 }, pullEnabled: Boolean })
const emit = defineEmits(['select', 'pull-open', 'reach-left', 'visible-range'])
const ctx = getCurrentInstance()

const PULL_FULL = 160
const scrollLeft = ref(0)
const animateScroll = ref(true)
const pull = ref(0)
const maxUsage = computed(() => props.days.reduce((m, d) => d.usage != null && d.usage > m ? d.usage : m, 0) || 1)
const pullWidth = computed(() => Math.min(pull.value * 0.42, 48))
// 进度环：SVG data-uri（同 timeline-svg 约定），stroke-dashoffset 随拉动距离填充。
const ringImage = computed(() => {
 const C = 2 * Math.PI * 10
 const off = C * (1 - Math.min(pull.value / PULL_FULL, 1))
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="none" stroke="${AGENT_COLORS.line}" stroke-width="3"/><circle cx="14" cy="14" r="10" fill="none" stroke="${AGENT_COLORS.accentDeep}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 14 14)"/></svg>`
 return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
})

function barHeight(day) {
 // 占位柱给确定性的错落高度（按日号散列），整段铺开后看着自然而非一片平。
 if (day.pending) return (30 + (Number(day.date.slice(8)) * 37) % 35) + '%'
 if (day.usage == null) return '6%'
 return Math.max(day.usage / maxUsage.value * 100, 6) + '%'
}

let viewport = 0, tracking = null, currentScroll = 0
let lastScrollCmd = -1
function scrollTo(target) {
 // scroll-left 仅在绑定值变化时生效；目标恰等于上次程序值时（如选中同一日期后手动滑开再选中）加 0.01px 微扰强制触发，视差不可见。
 if (lastScrollCmd === target) target += 0.01
 lastScrollCmd = target
 scrollLeft.value = target
}
function measure() {
 return new Promise(resolve => {
  uni.createSelectorQuery().in(ctx.proxy).select('.strip').boundingClientRect(rect => resolve(rect?.width || props.viewportWidth || 320)).exec()
 })
}
// 可视日期区间上报：滚动时节流发出（尾随一次），供宿主按区间预取待加载日。
let vrTimer = 0, vrPending = false
function emitVisibleRange(scrollPos = currentScroll) {
 if (!viewport || !props.days.length) return
 const firstIdx = Math.max(0, Math.floor(scrollPos / STRIP_COL_WIDTH))
 const lastIdx = Math.min(props.days.length - 1, Math.ceil((scrollPos + viewport) / STRIP_COL_WIDTH))
 const first = props.days[firstIdx]?.date
 if (first) emit('visible-range', { first, last: props.days[lastIdx]?.date || first })
}
function scheduleVisibleRange() {
 vrPending = true
 if (vrTimer) return
 vrTimer = setTimeout(() => {
  vrTimer = 0
  if (vrPending) { vrPending = false; emitVisibleRange() }
 }, 120)
}
async function centerOn(date) {
 const idx = props.days.findIndex(d => d.date === date)
 if (idx < 0) return
 if (!viewport) viewport = await measure()
 const target = Math.max(0, idx * STRIP_COL_WIDTH - (viewport - STRIP_COL_WIDTH) / 2)
 // 短距带动画；跨月长跳直接落位——长距离滚动动画在小屏上像卡死。
 animateScroll.value = Math.abs(target - currentScroll) <= viewport * 3
 if (!animateScroll.value) currentScroll = target
 scrollTo(target)
 emitVisibleRange(target)
}
function didPrepend(count) {
 // 左端插入 count 天之后补偿位移，视野不跳（无动画）。
 animateScroll.value = false
 currentScroll += count * STRIP_COL_WIDTH
 scrollTo(currentScroll)
}
function onScroll(e) { currentScroll = e.detail.scrollLeft; scheduleVisibleRange() }
function reachLeft() { emit('reach-left', props.days[0]?.date) }
function touchStart(e) {
 if (!props.pullEnabled) return
 const t = e.touches[0]
 tracking = { x: t.clientX, sl: currentScroll }
}
function touchMove(e) {
 if (!tracking || !props.pullEnabled) return
 const dx = e.touches[0].clientX - tracking.x
 pull.value = currentScroll <= 40 && tracking.sl <= 40 && dx > 0 ? Math.min(dx, 220) : 0
}
function touchEnd() {
 if (props.pullEnabled && pull.value >= PULL_FULL) emit('pull-open')
 pull.value = 0
 tracking = null
}
watch(() => props.selected, date => { if (date) centerOn(date) })
// v-if 挂载时 selected 已就位、watch 不会回放——挂载即居中。
onMounted(async () => { if (props.selected) await centerOn(props.selected); emitVisibleRange() })
onUnmounted(() => { if (vrTimer) clearTimeout(vrTimer) })
defineExpose({ centerOn, didPrepend })
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; line-height:1.2; }
button::after { border:0; }
.strip-wrap { position:relative; margin:10px -20px 0; }
.pullzone { position:absolute; left:0; top:0; bottom:0; width:0; overflow:hidden; z-index:2; display:flex; align-items:center; }
.pz { flex:0 0 48px; height:calc(100% - 8px); margin:4px 0 4px 4px; border-radius:$agent-radius-medium; background:$agent-color-tint; display:flex; align-items:center; justify-content:center; }
.pz-ring { width:26px; height:26px; }
.strip { white-space:nowrap; padding:2px 0 0; }
.eday { display:inline-flex; flex-direction:column; align-items:center; width:21px; padding:0; vertical-align:top; }
.ebar { width:100%; height:64px; display:flex; align-items:flex-end; justify-content:center; }
.bar { display:block; width:8px; min-height:4px; border-radius:2.5px; background:$agent-color-chart; }
.bar.sel { background:$agent-color-chart-deep; }
.bar.empty { background:$agent-color-tint; }
.bar.fail { background:$agent-color-tint; }
/* 待加载占位柱：幽灵呼吸（同 EnergySkeleton），选中即染玉色——日历跳转后立刻有高亮，不等数据。 */
.bar.pend { background:$agent-color-tint; animation:sk-pulse 1.4s ease-in-out infinite; }
.bar.pend.sel { background:$agent-color-chart; }
@keyframes sk-pulse { 0%,100% { opacity:.45 } 50% { opacity:.9 } }
@media(prefers-reduced-motion:reduce) { .bar.pend { animation:none; opacity:.6 } }
.eday.dim .bar { opacity:.45; }
.edlab { position:relative; width:100%; height:36px; }
.lab { position:absolute; right:10.5px; top:1px; font-style:normal; font-size:7.5px; color:$agent-color-text-muted; white-space:nowrap; transform:rotate(-60deg); transform-origin:top right; }
.lab.sel { color:$agent-color-accent-deep; font-weight:700; }
</style>
