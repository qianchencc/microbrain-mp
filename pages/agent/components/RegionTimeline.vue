<template>
 <scroll-view class="timeline-scroll" scroll-y enhanced :show-scrollbar="false" :scroll-top="scrollTop">
  <view class="timeline" :style="{ height: scene.height + 'px' }">
   <canvas v-if="renderer === 'canvas'" :id="canvasId" type="2d" class="timeline-art" :style="{ width: width + 'px', height: scene.height + 'px' }" />
   <image v-else class="timeline-art" :src="svgImage" mode="scaleToFill" :style="{ width: width + 'px', height: scene.height + 'px' }" @error="renderError = 'SVG 图片未能加载'" />
   <text v-for="(label, index) in scene.labels" :key="'label-' + index" class="time-label" :class="label.kind" :style="{ top: label.displayY + 'px' }">{{ label.text }}</text>
   <view v-if="scene.showNowLabel" class="time-label now" :style="{ top: scene.nowY + 'px' }"><text>现在</text><text>{{ scene.nowText }}</text></view>
   <text v-for="day in scene.dates" :key="day.date" class="date-label" :style="{ top: day.y + 'px' }">{{ day.date.slice(5).replace('-', ' / ') }}</text>
   <view v-for="item in scene.cards" :key="item.id" class="card-target" :style="{ top: item.top - 6 + 'px' }" @tap="interactive && $emit('select', item)">
    <view class="timeline-card" :class="{ faded: item.faded }" :hover-class="interactive ? 'timeline-card--pressed' : 'none'"><slot name="card" :item="item"><text class="card-label">{{ item.label }}</text></slot></view>
   </view>
   <text v-if="renderError" class="render-error">{{ renderError }}</text>
  </view>
 </scroll-view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { createTimeline, localDate } from '../timeline-geometry.mjs'
import { drawTimeline } from '../timeline-canvas.mjs'
import { timelineSvg } from '../timeline-svg.mjs'

const props = defineProps({ interactive: { type: Boolean, default: true }, items: { type: Array, default: () => [] }, date: { type: String, default: () => localDate(new Date()) }, now: { type: String, default: () => new Date().toISOString() }, days: { type: Number, default: 1 }, renderer: { type: String, default: 'canvas' } })
defineEmits(['select'])
const instance = getCurrentInstance()
const canvasId = 'region-timeline-' + instance.uid
const width = ref(uni.getSystemInfoSync().windowWidth - 32)
const scrollTop = ref(0)
const renderError = ref('')
const scene = computed(() => createTimeline({ date: props.date, items: props.items, now: props.now, width: width.value, days: props.days }))
const svgImage = computed(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(timelineSvg(scene.value)))
let canvas

function draw() {
 if (!canvas) return
 const ratio = uni.getSystemInfoSync().pixelRatio || 1
 canvas.width = Math.round(width.value * ratio)
 canvas.height = Math.round(scene.value.height * ratio)
 const context = canvas.getContext('2d')
 context.scale(ratio, ratio)
 drawTimeline(context, scene.value)
}
function measure() {
 const query = uni.createSelectorQuery().in(instance.proxy)
 query.select('.timeline').boundingClientRect()
 if (props.renderer === 'canvas') query.select('#' + canvasId).fields({ node: true, size: true })
 query.exec(result => {
  if (result[0]?.width) width.value = result[0].width
  canvas = result[1]?.node
  draw()
 })
}
function focusDate() { scrollTop.value = Math.max(0, Math.min(scene.value.height - 400, scene.value.nowY - 220)) }
onMounted(async () => { await nextTick(); measure(); focusDate() })
watch(scene, () => nextTick(draw))
watch(() => props.date, focusDate)
watch(() => props.renderer, () => nextTick(measure))
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
.timeline-scroll { height:100%; width:100%; }
.timeline { position:relative; }
.timeline-art { position:absolute; left:0; top:0; pointer-events:none; }
.time-label { position:absolute; left:0; width:36px; text-align:right; font-size:10px; font-weight:600; color:#7c8d82; transform:translateY(-50%); line-height:1.2; font-variant-numeric:tabular-nums; }
.time-label.event { color:#45564d; font-size:11px; }
.time-label.past { color:#a0aea5; }
.time-label.now { color:#ad711b; }
.now text { display:block; }
.now text:first-child { font-size:8px; margin-bottom:2px; }
.date-label { position:absolute; left:80px; right:14px; color:#a9b6ae; font-size:10px; text-align:center; transform:translateY(-50%); }
.card-target { position:absolute; left:84px; right:14px; padding:6px 0; }
.timeline-card { height:32px; padding:0 7px 0 11px; border-radius:10px; display:flex; align-items:center; gap:7px; background:linear-gradient(#fefffe,#f9fbf9); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.13), inset 0 1px 0 #fff, 0 1px 2px rgba(28,57,42,.05), 0 6px 14px -10px rgba(28,57,42,.2); transition:transform 140ms cubic-bezier(.23,1,.32,1); }
.timeline-card--pressed { transform:scale(.985); }
.timeline-card.faded { opacity:.6; }
.card-label { font-size:12.5px; font-weight:600; color:#45564d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.render-error { position:absolute; top:470px; left:90px; color:#a34036; font-size:13px; }
@media (prefers-reduced-motion:reduce) { .timeline-card { transition:none; } }
</style>
