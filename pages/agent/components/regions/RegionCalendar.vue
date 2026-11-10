<template>
  <view
    class="calendar"
    :class="{ compact, expanded }"
  >
    <view class="calendar-head">
      <view class="head-zone"
        ><button
          class="month-arrow"
          :class="{ 'arrow-hidden': !expanded }"
          :disabled="Boolean(minDate) && month <= minDate.slice(0, 7)"
          aria-label="上个月"
          title="上个月"
          @tap="moveMonth(-1)"
          ><uni-icons
            type="left"
            size="14"
            color="var(--agent-text-secondary)" /></button
      ></view>
      <button
        class="month-title"
        :aria-expanded="expanded"
        @tap="setExpanded(!expanded)"
        ><text>{{ month.slice(0, 4) }} 年 {{ Number(month.slice(5)) }} 月</text
        ><uni-icons
          :type="expanded ? 'up' : 'down'"
          size="12"
          color="var(--agent-text-muted)"
      /></button>
      <view class="head-zone head-right">
        <button
          class="today-btn"
          :class="{ 'today-dim': !showToday || !todayInRange }"
          :disabled="!todayInRange"
          hover-class="today-btn--pressed"
          aria-label="回到现在"
          title="回到现在"
          @tap="backToToday"
          ><view class="today-face"
            ><uni-icons
              type="location"
              size="12"
              color="var(--agent-accent-deep)"
            /><text>现在</text></view
          ></button
        >
        <button
          class="month-arrow"
          :class="{ 'arrow-hidden': !expanded }"
          :disabled="Boolean(maxDate) && month >= maxDate.slice(0, 7)"
          aria-label="下个月"
          title="下个月"
          @tap="moveMonth(1)"
          ><uni-icons
            type="right"
            size="14"
            color="var(--agent-text-secondary)"
        /></button>
      </view>
    </view>
    <view
      class="days-wrap"
      :style="{
        maxHeight: (expanded ? Math.ceil(days.length / 7) : 1) * (compact ? 40 : 46) + 'px',
      }"
    >
      <view class="days">
        <button
          v-for="(day, index) in days"
          :key="day"
          class="day"
          :class="{
            selected: day === date,
            today: day === today,
            outside: day.slice(0, 7) !== month,
            disabled: outOfRange(day),
          }"
          :disabled="outOfRange(day)"
          @tap="select(day)"
        >
          <text class="weekday">{{ weekdays[index % 7] }}</text
          ><text class="day-number">{{ Number(day.slice(8)) }}</text>
          <view
            v-if="marksByDay[day]"
            class="day-mark"
            :class="{ abnormal: marksByDay[day].abnormal }"
          />
        </button>
      </view>
    </view>
    <button
      v-if="error"
      class="calendar-error"
      @tap="$emit('month-change', month)"
      >读取失败 · 重试</button
    >
  </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { calendarDates, shiftDate } from '../../lib/region.mjs';

const props = defineProps({
  date: String,
  today: String,
  minDate: String,
  maxDate: String,
  error: { type: String, default: '' },
  compact: Boolean,
  marks: { type: Array, default: () => [] },
});
const emit = defineEmits(['select', 'month-change']);
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const month = ref(props.date.slice(0, 7)),
  expanded = ref(false),
  gridExpanded = ref(false);
let collapseTimer = 0;
const days = computed(() =>
  calendarDates(
    gridExpanded.value || month.value !== props.date.slice(0, 7) ? `${month.value}-01` : props.date,
    gridExpanded.value
  )
);
const marksByDay = computed(() => Object.fromEntries(props.marks.map((mark) => [mark.date, mark])));
watch(
  () => props.date,
  (value) => {
    if (value.slice(0, 7) !== month.value) month.value = value.slice(0, 7);
  }
);
watch(month, (value) => emit('month-change', value), { immediate: true });
// 收起时网格多留一拍：高度先按 expanded 目标值裁切，月格被裁掉后再换成周格，形成真实的收起动画。
function setExpanded(value) {
  clearTimeout(collapseTimer);
  if (value) gridExpanded.value = true;
  else
    collapseTimer = setTimeout(() => {
      gridExpanded.value = false;
    }, 250);
  expanded.value = value;
}
function moveMonth(delta) {
  const next = shiftDate(`${month.value}-01`, delta < 0 ? -1 : 32).slice(0, 7);
  if (
    (!props.maxDate || next <= props.maxDate.slice(0, 7)) &&
    (!props.minDate || next >= props.minDate.slice(0, 7))
  ) {
    month.value = next;
    setExpanded(true);
  }
}
const showToday = computed(
  () => props.date !== props.today || month.value !== props.today.slice(0, 7)
);
const todayInRange = computed(
  () =>
    (!props.maxDate || props.today <= props.maxDate) &&
    (!props.minDate || props.today >= props.minDate)
);
const outOfRange = (day) =>
  (Boolean(props.maxDate) && day > props.maxDate) ||
  (Boolean(props.minDate) && day < props.minDate);
function select(day) {
  if (outOfRange(day)) return;
  month.value = day.slice(0, 7);
  emit('select', day);
}
function backToToday() {
  if (!todayInRange.value) return;
  setExpanded(false);
  select(props.today);
}
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 1.2;
}
button::after {
  border: 0;
}
.calendar {
  flex-shrink: 0;
  padding: 2px 16px 8px;
}
.calendar-head {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-zone {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}
.head-zone.head-right {
  justify-content: flex-end;
}
.month-arrow {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 180ms ease;
}
.month-arrow.arrow-hidden {
  opacity: 0;
  pointer-events: none;
}
.month-arrow[disabled] {
  opacity: 0.25;
}
.today-btn {
  width: 60px;
  height: 44px;
  font-size: 11px;
  margin: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 130ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 180ms ease;
}
.today-face {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 56px;
  height: 28px;
  border-radius: 14px;
  background: var(--agent-tint);
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.2),
    inset 0 1px 0 #fff;
}
.today-btn--pressed {
  transform: scale(0.92);
}
.today-btn.today-dim {
  opacity: 0.45;
}
.month-title {
  min-height: 44px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
  font-weight: 700;
}
.days-wrap {
  overflow: hidden;
  transition: max-height 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}
.day {
  position: relative;
  min-width: 0;
  height: 44px;
  border-radius: 8px;
  color: var(--agent-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition:
    box-shadow 150ms ease,
    color 150ms ease;
}
.day.selected {
  box-shadow: inset 0 0 0 1.5px $agent-color-accent;
  color: $agent-color-accent;
  font-weight: 700;
}
.day.today .day-number {
  color: $agent-color-accent;
  font-weight: 700;
}
.day.outside {
  color: var(--agent-text-faint);
}
.day.disabled {
  opacity: 0.3;
}
.weekday {
  color: var(--agent-text-muted);
  font-size: 9px;
}
.day-number {
  font-size: 11px;
}
.day-mark {
  position: absolute;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: $agent-color-accent;
}
.day-mark.abnormal {
  background: var(--agent-warning);
}
.calendar-error {
  white-space: normal;
  word-break: break-word;
  line-height: 1.5;
  margin: 5px auto 0;
  color: var(--agent-error);
  font-size: 10px;
}
.calendar.compact {
  padding: 4px 9px 8px;
}
.calendar.compact .day {
  height: 38px;
}
@media (prefers-reduced-motion: reduce) {
  .days-wrap,
  .month-arrow,
  .day {
    transition: none;
  }
}
</style>
