<template>
 <view class="calendar" :class="{ compact }">
  <view class="calendar-head">
   <button class="month-arrow" aria-label="上个月" title="上个月" @tap="moveMonth(-1)"><uni-icons type="left" size="14" color="#586d60" /></button>
   <button class="month-title" @tap="expanded = !expanded"><text>{{ month.slice(0, 4) }} 年 {{ Number(month.slice(5)) }} 月</text><uni-icons :type="expanded ? 'up' : 'down'" size="12" color="#71877a" /></button>
   <button class="month-arrow" :disabled="month >= maxDate.slice(0, 7)" aria-label="下个月" title="下个月" @tap="moveMonth(1)"><uni-icons type="right" size="14" color="#586d60" /></button>
  </view>
  <view class="days">
   <button v-for="(day, index) in days" :key="day" class="day" :class="{ selected: day === date, today: day === today, outside: day.slice(0, 7) !== month, disabled: day > maxDate }" :disabled="day > maxDate" @tap="select(day)">
    <text class="weekday">{{ weekdays[index % 7] }}</text><text class="day-number">{{ Number(day.slice(8)) }}</text>
    <view v-if="marksByDay[day]" class="day-mark" :class="{ abnormal: marksByDay[day].abnormal }" />
   </button>
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
function select(day) { if (day > props.maxDate) return; month.value = day.slice(0, 7); emit('select', day) }
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; line-height:1.2; }
button::after { border:0; }
.calendar { flex-shrink:0; padding:6px 16px 10px; background:#fcfdfc; border-bottom:1px solid #e2e9e3; }
.calendar-head { height:28px; display:flex; align-items:center; justify-content:space-between; }
.month-arrow { width:30px; height:28px; display:flex; align-items:center; justify-content:center; }
.month-arrow[disabled] { opacity:.25; }
.month-title { display:flex; align-items:center; gap:7px; color:#455b4d; font-size:12px; font-weight:700; }
.days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:2px; }
.day { position:relative; min-width:0; height:44px; border-radius:8px; color:#536759; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
.day.selected { box-shadow:inset 0 0 0 1.5px #176b54; color:#176b54; font-weight:700; }
.day.today .day-number { color:#176b54; font-weight:700; }
.day.outside { color:#b5c1b8; }
.day.disabled { opacity:.3; }
.weekday { color:#9aa99f; font-size:9px; }
.day-number { font-size:11px; }
.day-mark { position:absolute; bottom:2px; width:4px; height:4px; border-radius:50%; background:#176b54; }
.day-mark.abnormal { background:#b57932; }
.calendar-error { margin:5px auto 0; color:#986b2d; font-size:10px; }
.calendar.compact { margin:0 14px 8px; padding:4px 9px 7px; border:1px solid #e1e9e2; border-radius:8px; background:#f8faf8; }
.calendar.compact .day { height:38px; }
</style>
