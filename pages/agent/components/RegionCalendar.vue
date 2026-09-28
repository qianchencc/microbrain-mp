<template>
 <view class="calendar" :class="{ compact, expanded }">
  <view class="calendar-head">
   <view class="head-zone"><button class="month-arrow" :class="{ 'arrow-hidden': !expanded }" aria-label="上个月" title="上个月" @tap="moveMonth(-1)"><uni-icons type="left" size="14" color="#586d60" /></button></view>
   <button class="month-title" :aria-expanded="expanded" @tap="expanded = !expanded"><text>{{ month.slice(0, 4) }} 年 {{ Number(month.slice(5)) }} 月</text><uni-icons :type="expanded ? 'up' : 'down'" size="12" color="#71877a" /></button>
   <view class="head-zone head-right">
    <button v-if="showToday" class="today-btn" hover-class="today-btn--pressed" aria-label="回到今天" title="回到今天" @tap="backToToday">今</button>
    <button class="month-arrow" :class="{ 'arrow-hidden': !expanded }" :disabled="month >= maxDate.slice(0, 7)" aria-label="下个月" title="下个月" @tap="moveMonth(1)"><uni-icons type="right" size="14" color="#586d60" /></button>
   </view>
  </view>
  <view class="days-wrap" :style="{ maxHeight: Math.ceil(days.length / 7) * (compact ? 40 : 46) + 'px' }">
   <view class="days">
    <button v-for="(day, index) in days" :key="day" class="day" :class="{ selected: day === date, today: day === today, outside: day.slice(0, 7) !== month, disabled: day > maxDate }" :disabled="day > maxDate" @tap="select(day)">
     <text class="weekday">{{ weekdays[index % 7] }}</text><text class="day-number">{{ Number(day.slice(8)) }}</text>
     <view v-if="marksByDay[day]" class="day-mark" :class="{ abnormal: marksByDay[day].abnormal }" />
    </button>
   </view>
  </view>
  <button v-if="error" class="calendar-error" @tap="$emit('month-change', month)">日期标记暂不可用 · 重试</button>
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { calendarDates, shiftDate } from '../region-calendar.mjs'

const props = defineProps({ date: String, today: String, maxDate: String, error: Boolean, compact: Boolean, marks: { type: Array, default: () => [] } })
const emit = defineEmits(['select', 'month-change'])
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const month = ref(props.date.slice(0, 7)), expanded = ref(false)
const days = computed(() => calendarDates(expanded.value || month.value !== props.date.slice(0, 7) ? `${month.value}-01` : props.date, expanded.value))
const marksByDay = computed(() => Object.fromEntries(props.marks.map(mark => [mark.date, mark])))
watch(() => props.date, value => { if (value.slice(0, 7) !== month.value) month.value = value.slice(0, 7) })
watch(month, value => emit('month-change', value), { immediate: true })
function moveMonth(delta) {
 const next = shiftDate(`${month.value}-01`, delta < 0 ? -1 : 32).slice(0, 7)
 if (next <= props.maxDate.slice(0, 7)) { month.value = next; expanded.value = true }
}
const showToday = computed(() => props.date !== props.today || month.value !== props.today.slice(0, 7))
function select(day) { if (day > props.maxDate) return; month.value = day.slice(0, 7); emit('select', day) }
function backToToday() { expanded.value = false; select(props.today) }
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; line-height:1.2; }
button::after { border:0; }
.calendar { flex-shrink:0; padding:2px 16px 8px; }
.calendar-head { height:28px; display:flex; align-items:center; justify-content:space-between; }
.head-zone { flex:1; min-width:0; display:flex; align-items:center; gap:2px; }
.head-zone.head-right { justify-content:flex-end; }
.month-arrow { width:30px; height:28px; display:flex; align-items:center; justify-content:center; transition:opacity 180ms ease; }
.month-arrow.arrow-hidden { opacity:0; pointer-events:none; }
.month-arrow[disabled] { opacity:.25; }
.today-btn { height:24px; min-width:28px; padding:0 8px; margin:0; border-radius:12px; background:#eaf1ec; box-shadow:inset 0 0 0 .5px rgba(26,55,43,.14); color:#2f5a47; font-size:11px; font-weight:700; line-height:24px; text-align:center; animation:fadeIn 160ms ease-out backwards; transition:transform 130ms cubic-bezier(.23,1,.32,1); }
.today-btn--pressed { transform:scale(.94); }
@keyframes fadeIn { from { opacity:0; } }
.month-title { display:flex; align-items:center; gap:7px; color:#455b4d; font-size:12px; font-weight:700; }
.days-wrap { overflow:hidden; transition:max-height 240ms cubic-bezier(.32,.72,0,1); }
.days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:2px; }
.day { position:relative; min-width:0; height:44px; border-radius:8px; color:#536759; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; transition:box-shadow 150ms ease,color 150ms ease; }
.day.selected { box-shadow:inset 0 0 0 1.5px #176b54; color:#176b54; font-weight:700; }
.day.today .day-number { color:#176b54; font-weight:700; }
.day.outside { color:#b5c1b8; }
.day.disabled { opacity:.3; }
.weekday { color:#9aa99f; font-size:9px; }
.day-number { font-size:11px; }
.day-mark { position:absolute; bottom:2px; width:4px; height:4px; border-radius:50%; background:#176b54; }
.day-mark.abnormal { background:#ad711b; }
.calendar-error { margin:5px auto 0; color:#986b2d; font-size:10px; }
.calendar.compact { padding:4px 9px 8px; }
.calendar.compact .day { height:38px; }
@media(prefers-reduced-motion:reduce){.days-wrap,.month-arrow,.day{transition:none}}
</style>
