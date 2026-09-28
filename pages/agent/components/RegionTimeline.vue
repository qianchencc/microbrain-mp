<template>
 <view class="timeline-shell">
 <view v-if="calendar && compactCalendar" class="compact-date-bar"><button class="compact-date-toggle" :aria-label="calendarOpen ? '收起设备日历' : '展开设备日历'" @tap="calendarOpen = !calendarOpen"><text>{{ Number(date.slice(5, 7)) }} 月 {{ Number(date.slice(8)) }} 日</text><uni-icons :type="calendarOpen ? 'up' : 'down'" size="12" color="#fff" /></button></view>
 <RegionCalendar v-if="calendar && (!compactCalendar || calendarOpen)" :date="date" :today="localDate(now)" :max-date="maxDate" :marks="calendarMarks" :error="calendarError" :compact="compactCalendar" @select="selectDate" @month-change="$emit('calendar-month', $event)" />
 <view v-if="!items.length" class="timeline-empty"><slot name="empty" /></view>
 <scroll-view v-else class="timeline-scroll" scroll-y enhanced :show-scrollbar="false" :scroll-top="scrollTop" :scroll-into-view="focusId">
  <view class="timeline" :style="{ height: scene.height + 'px' }">
   <image class="timeline-art" :src="svgImage" mode="scaleToFill" :style="{ width: width + 'px', height: scene.height + 'px' }" @error="renderError = '时间轴暂未加载，请重新进入'" />
   <text v-for="(label, index) in scene.labels" :key="'label-' + index" class="time-label" :class="label.kind" :style="{ top: label.displayY + 'px' }">{{ label.text }}</text>
   <view v-if="scene.showNowLabel" class="time-label now" :style="{ top: scene.nowY + 'px' }"><text>现在</text><text>{{ scene.nowText }}</text></view>
   <text v-for="day in scene.dates" :key="day.date" class="date-label" :style="{ top: day.y + 'px' }">{{ day.date.slice(5).replace('-', ' / ') }}</text>
   <view v-for="item in scene.cards" :id="'timeline-card-' + item.id" :key="item.id" class="card-target" :style="{ top: item.top - 6 + 'px' }" @tap="interactive && $emit('select', item)">
    <view class="timeline-card" :class="{ faded: item.faded, executing: item.status === 'executing' }" :hover-class="interactive ? 'timeline-card--pressed' : 'none'"><slot name="card" :item="item"><text class="card-label">{{ item.label }}</text></slot></view>
   </view>
   <text v-if="renderError" class="render-error">{{ renderError }}</text>
  </view>
 </scroll-view>
 </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { createTimeline, localDate } from '../timeline-geometry.mjs'
import { timelineSvg } from '../timeline-svg.mjs'
import RegionCalendar from './RegionCalendar.vue'

const props = defineProps({ interactive: { type: Boolean, default: true }, calendar: Boolean, compactCalendar: Boolean, focusItems: Boolean, calendarMarks: { type: Array, default: () => [] }, calendarError: Boolean, maxDate: String, items: { type: Array, default: () => [] }, date: { type: String, default: () => localDate(new Date()) }, now: { type: String, default: () => new Date().toISOString() }, days: { type: Number, default: 1 } })
const emit = defineEmits(['select', 'date-change', 'calendar-month'])
const instance = getCurrentInstance()
const width = ref(uni.getSystemInfoSync().windowWidth - 32)
const scrollTop = ref(0)
const focusId = ref('')
const renderError = ref('')
const calendarOpen = ref(false)
const scene = computed(() => createTimeline({ date: props.date, items: props.items, now: props.now, width: width.value, days: props.days }))
const svgImage = computed(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(timelineSvg(scene.value)))
function measure() {
 uni.createSelectorQuery().in(instance.proxy).select('.timeline').boundingClientRect(result => {
  if (result?.width) width.value = result.width
 }).exec()
}
function focusDate() {
 if (props.focusItems && scene.value.cards.length) {
  const cards = [...scene.value.cards].sort((a, b) => a.top - b.top)
  const target = cards.filter(card => card.top <= scene.value.nowY).at(-1) || cards[0]
  focusId.value = 'timeline-card-' + target.id
  return
 }
 scrollTop.value = localDate(props.now) === props.date ? Math.max(0, Math.min(scene.value.height - 400, scene.value.nowY - 220)) : 0
}
function selectDate(value) {
 if (props.compactCalendar) calendarOpen.value = false
 emit('date-change', value)
}
onMounted(async () => { await nextTick(); measure(); focusDate() })
watch(() => props.date, focusDate)
watch(() => props.items.length, (length, previous) => { if (length && !previous) nextTick(focusDate) })
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
.timeline-scroll { height:0; width:100%; position:relative; overflow:hidden; }
.timeline-shell { height:100%; min-height:0; display:flex; flex-direction:column; }
.compact-date-bar { height:38px; flex-shrink:0; display:flex; align-items:center; justify-content:flex-end; padding:0 12px; }
.compact-date-toggle { min-height:30px; margin:0; padding:0 11px; border:0; border-radius:15px; display:flex; align-items:center; gap:6px; background:#176b54; color:#fff; font-size:11px; font-weight:600; line-height:1; box-shadow:0 4px 12px #11553f3d; }
.compact-date-toggle::after { border:0; }
.timeline-scroll { flex:1; min-height:0; }
.timeline-empty { flex:1; min-height:0; }
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
.timeline-card { position:relative; height:32px; padding:0 7px 0 11px; border-radius:10px; display:block; line-height:32px; background:linear-gradient(#fefffe,#f9fbf9); box-shadow:inset 0 0 0 .5px rgba(26,55,43,.13), inset 0 1px 0 #fff, 0 1px 2px rgba(28,57,42,.05), 0 6px 14px -10px rgba(28,57,42,.2); transition:transform 140ms cubic-bezier(.23,1,.32,1); }
.timeline-card--pressed { transform:scale(.985); }
.timeline-card.faded { opacity:.6; }
.timeline-card.executing { box-shadow:inset 0 0 0 1px #176b5452, inset 0 1px 0 #fff, 0 6px 16px -10px #176b5473; }
.timeline-card.executing::before { content:""; position:absolute; left:4px; top:9px; bottom:9px; width:2.5px; border-radius:2px; background:#176b54; }
.card-label { display:block; font-size:12.5px; font-weight:600; color:#45564d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.render-error { position:absolute; top:470px; left:90px; color:#a34036; font-size:13px; }
@media (prefers-reduced-motion:reduce) { .timeline-card { transition:none; } }
</style>
