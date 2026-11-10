<template>
  <view class="timeline-shell">
    <template v-if="calendar && compactCalendar">
      <button
        class="datefloat"
        hover-class="datefloat--pressed"
        :aria-label="calShown ? '收起设备日历' : '展开设备日历'"
        :aria-expanded="calShown"
        @tap="calShown ? closeCalendar() : openCalendar()"
        ><uni-icons
          type="calendar"
          size="12"
          color="var(--agent-text-secondary)"
        /><text>{{ Number(date.slice(5, 7)) }}月{{ Number(date.slice(8)) }}日</text></button
      >
      <view
        v-if="calMounted"
        class="cal-scrim"
        @tap="closeCalendar"
      />
      <view
        v-if="calMounted"
        class="cal-float"
        :class="{ 'cal-out': !calShown }"
        ><RegionCalendar
          :date="date"
          :today="localDate(now)"
          :max-date="maxDate"
          :marks="calendarMarks"
          :error="calendarError"
          compact
          @select="selectDate"
          @month-change="$emit('calendar-month', $event)"
      /></view>
    </template>
    <RegionCalendar
      v-else-if="calendar"
      :date="date"
      :today="localDate(now)"
      :max-date="maxDate"
      :marks="calendarMarks"
      :error="calendarError"
      @select="selectDate"
      @month-change="$emit('calendar-month', $event)"
    />
    <view class="timeline-stage">
      <scroll-view
        class="timeline-scroll"
        scroll-y
        enhanced
        :show-scrollbar="false"
        :scroll-with-animation="scrollAnimated"
        :scroll-top="scrollTop"
        :scroll-into-view="focusId"
        :upper-threshold="240"
        :lower-threshold="240"
        @scroll="onScroll"
        @scrolltoupper="$emit('reach-start')"
        @scrolltolower="$emit('reach-end')"
      >
        <view
          class="timeline"
          @tap="onBlankTap"
          @touchmove="lastBlankTap = null"
          :style="{ height: scene.height + 'px' }"
        >
          <image
            class="timeline-art"
            :src="svgImage"
            mode="scaleToFill"
            :style="{ width: width + 'px', height: scene.height + 'px' }"
            @error="renderError = '时间轴暂未加载，请重新进入'"
          />
          <text
            v-for="(label, index) in scene.labels"
            :key="'label-' + index"
            class="time-label"
            :class="label.kind"
            :style="{ top: label.displayY + 'px' }"
            >{{ label.text }}</text
          >
          <view
            v-if="scene.showNowLabel"
            class="time-label now"
            :style="{ top: scene.nowY + 'px' }"
            ><text>现在</text><text>{{ scene.nowText }}</text></view
          >
          <text
            v-for="day in scene.dates"
            :key="day.date"
            class="date-label"
            :style="{ top: day.y + 'px' }"
            >{{ day.date.slice(5).replace('-', ' / ') }}</text
          >
          <view
            v-for="item in scene.cards"
            :id="'timeline-card-' + item.id"
            :key="item.id"
            class="card-target"
            :style="{ top: item.top - 6 + 'px' }"
            @tap.stop="selectItem(item)"
          >
            <view
              class="timeline-card"
              :class="{ faded: item.faded, executing: item.status === 'executing' }"
              :hover-class="interactive ? 'timeline-card--pressed' : 'none'"
            >
              <template v-if="cardKind === 'task'">
                <view
                  class="task-row"
                  :class="{ cancelled: item.status === 'cancelled' }"
                >
                  <text class="task-label"
                    ><text
                      v-if="item.warning || item.failure"
                      class="warning-dot"
                    />{{ item.label }}</text
                  >
                  <text
                    v-if="item.status === 'cancelled'"
                    class="cancelled-status"
                    >已取消</text
                  >
                  <view class="avatars"
                    ><view
                      v-for="avatar in item.avatars"
                      :key="avatar.id"
                      class="device-avatar"
                      ><image
                        v-if="avatar.src"
                        :src="avatar.src"
                        mode="aspectFit" /><uni-icons
                        v-else
                        type="gear"
                        size="13"
                        color="var(--agent-text-muted)" /></view
                    ><text
                      v-if="item.more"
                      class="more"
                      >+{{ item.more }}</text
                    ></view
                  >
                  <view class="task-separator" />
                  <view
                    class="owner-mark"
                    :class="'cv-' + item.creatorVariant"
                    :aria-label="item.creatorName"
                    >{{ item.creatorMark }}</view
                  >
                </view>
              </template>
              <template v-else>
                <view class="record-card"
                  ><text
                    class="source"
                    :class="item.sourceText === '即时' ? 'immediate' : 'scheduled'"
                    >{{ item.sourceText }}</text
                  ><text class="record-target"
                    >{{ item.label }}<text class="record-task">{{ item.taskLabel }}</text></text
                  ><text
                    class="record-result"
                    :class="item.resultTone"
                    >{{ item.resultText }}</text
                  ><text
                    class="creator"
                    :class="'cv-' + item.creatorVariant"
                    >{{ item.creatorName.slice(0, 1) }}</text
                  ></view
                >
              </template>
            </view>
          </view>
          <text
            v-if="renderError"
            class="render-error"
            >{{ renderError }}</text
          >
        </view>
        <view
          v-if="bottomPad"
          class="timeline-tail"
          @tap="onBlankTap"
          @touchmove="lastBlankTap = null"
          :style="{ height: bottomPad + 'px' }"
        />
      </scroll-view>
      <!-- 空态提示盖在时间轴上而不占位替换：无记录时仍看到当天脊柱；层不拦截点按，重试等按钮单独放行 -->
      <view
        v-if="!items.length"
        class="timeline-empty"
        ><slot name="empty"
      /></view>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue';
import {
  createTimeline,
  dateFocusTop,
  firstDayCard,
  localDate,
  HOUR_PX,
  timelineSvg,
} from '../../lib/timeline.mjs';
import RegionCalendar from './RegionCalendar.vue';

const props = defineProps({
  interactive: { type: Boolean, default: true },
  cardKind: { type: String, default: 'task' },
  calendar: Boolean,
  compactCalendar: Boolean,
  focusItems: Boolean,
  bottomPad: { type: Number, default: 0 },
  calendarMarks: { type: Array, default: () => [] },
  calendarError: { type: String, default: '' },
  maxDate: String,
  items: { type: Array, default: () => [] },
  date: { type: String, default: () => localDate(new Date()) },
  now: { type: String, default: () => new Date().toISOString() },
  start: String,
  days: { type: Number, default: 1 },
});
const emit = defineEmits([
  'select',
  'date-change',
  'calendar-month',
  'visible-date',
  'reach-start',
  'reach-end',
]);
const DAY_MS = 86400000,
  DAY_PX = 24 * HOUR_PX;
const dayStart = (value) => Date.parse(`${value}T00:00:00+08:00`);
const windowStart = computed(() => props.start || props.date);
const instance = getCurrentInstance();
const width = ref(uni.getSystemInfoSync().windowWidth - 32);
const scrollTop = ref(0);
const focusId = ref('');
const renderError = ref('');
// 浮层进出共用同一条 class 过渡：挂载在收起态，下一帧翻转到展开态；关闭时反向播完再卸载。
const calMounted = ref(false),
  calShown = ref(false);
let calTimer = 0;
function openCalendar() {
  clearTimeout(calTimer);
  calMounted.value = true;
  calShown.value = false;
  calTimer = setTimeout(() => {
    calShown.value = true;
  }, 40);
}
function closeCalendar() {
  if (!calMounted.value) return;
  calShown.value = false;
  clearTimeout(calTimer);
  calTimer = setTimeout(() => {
    calMounted.value = false;
  }, 200);
}
defineExpose({
  dismissCalendar: () => {
    if (!calMounted.value) return false;
    closeCalendar();
    return true;
  },
});
const scrollAnimated = ref(true);
let lastScrollTop = 0,
  emittedDay = '',
  lastBlankTap = null;
function selectItem(item) {
  lastBlankTap = null;
  if (props.interactive) emit('select', item);
}
function onBlankTap(event) {
  const tap = { at: Date.now(), x: Number(event.detail?.x || 0), y: Number(event.detail?.y || 0) };
  const previous = lastBlankTap;
  lastBlankTap = tap;
  if (
    !previous ||
    tap.at - previous.at > 350 ||
    Math.hypot(tap.x - previous.x, tap.y - previous.y) > 28
  )
    return;
  lastBlankTap = null;
  focusId.value = '';
  selectDate(localDate(props.now), true);
}
function onScroll(event) {
  lastBlankTap = null;
  const y = Number(event?.detail?.scrollTop);
  if (Number.isFinite(y)) lastScrollTop = y;
  if (props.days < 2 || !windowStart.value) return;
  const index = Math.min(props.days - 1, Math.max(0, Math.floor((lastScrollTop + 160) / DAY_PX)));
  const day = localDate(dayStart(windowStart.value) + index * DAY_MS);
  if (day !== emittedDay) {
    emittedDay = day;
    emit('visible-date', day);
  }
}
const scene = computed(() =>
  createTimeline({
    date: windowStart.value,
    items: props.items,
    now: props.now,
    width: width.value,
    days: props.days,
  })
);
const svgImage = computed(
  () => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(timelineSvg(scene.value))
);
function measure() {
  uni
    .createSelectorQuery()
    .in(instance.proxy)
    .select('.timeline')
    .boundingClientRect((result) => {
      if (result?.width) width.value = result.width;
    })
    .exec();
}
let pendingDateFocus = '';
function focusDate(forceNow = false) {
  pendingDateFocus = '';
  if (!forceNow && props.focusItems && scene.value.cards.length) {
    const cards = [...scene.value.cards].sort((a, b) => a.top - b.top);
    const target = cards.filter((card) => card.top <= scene.value.nowY).at(-1) || cards[0];
    const id = 'timeline-card-' + target.id;
    if (focusId.value === id) {
      focusId.value = '';
      nextTick(() => {
        focusId.value = id;
      });
    } else focusId.value = id;
    return;
  }
  const dayIndex = Math.round((dayStart(props.date) - dayStart(windowStart.value)) / DAY_MS);
  let targetTop = null;
  if (localDate(props.now) === props.date && scene.value.nowVisible)
    targetTop = Math.max(0, Math.min(scene.value.height - 400, scene.value.nowY - 220));
  else if (dayIndex >= 0 && dayIndex < props.days) {
    targetTop = dateFocusTop({ cards: scene.value.cards, date: props.date, dayIndex });
    // 该日任务尚未到达时先停在 00:00；第一张卡出现后再补一次定位。
    if (!firstDayCard(scene.value.cards, props.date)) pendingDateFocus = props.date;
  }
  if (targetTop === null) return;
  if (scrollTop.value === targetTop) {
    scrollTop.value = targetTop + 0.5;
    nextTick(() => {
      scrollTop.value = targetTop;
    });
  } else scrollTop.value = targetTop;
}
function selectDate(value, forceNow = false) {
  lastBlankTap = null;
  if (props.compactCalendar) closeCalendar();
  emit('date-change', value);
  nextTick(() => focusDate(forceNow));
}
onMounted(async () => {
  await nextTick();
  measure();
  focusDate();
});
// 日期变化若是滚动上报的回声（emittedDay），视口已经停在那天，不再二次定位。
watch(
  () => props.date,
  (value) => {
    if (value !== emittedDay) focusDate();
  }
);
watch(
  () => props.items.length,
  (length, previous) => {
    if (length && !previous) nextTick(focusDate);
  }
);
// 选中日的任务可能晚于定位到达：第一张卡出现时补一次定位；之后的静默刷新不再抢回视口。
watch(
  () => scene.value.cards,
  (cards) => {
    if (pendingDateFocus && firstDayCard(cards, pendingDateFocus)) focusDate();
  }
);
// 窗口向上 prepend 时画布整体下移 delta*DAY_PX，补偿 scrollTop 让视口停在原内容上。
watch(windowStart, (next, previous) => {
  if (!next || !previous) return;
  const delta = Math.round((dayStart(previous) - dayStart(next)) / DAY_MS);
  if (delta <= 0) return;
  scrollAnimated.value = false;
  nextTick(() => {
    scrollTop.value = lastScrollTop + delta * DAY_PX;
    nextTick(() => {
      scrollAnimated.value = true;
    });
  });
});
</script>

<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.timeline-scroll {
  height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
}
.timeline-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.datefloat {
  position: absolute;
  top: 8px;
  left: 14px;
  z-index: 8;
  margin: 0;
  padding: 0 11px;
  height: 30px;
  border: 0;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(var(--agent-surface), var(--agent-tint));
  color: var(--agent-text-secondary);
  font-size: 11.5px;
  font-weight: 650;
  line-height: 1;
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.16),
    inset 0 1px 0 #fff,
    0 4px 12px rgba(var(--agent-shadow-rgb), 0.16);
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
.datefloat::after {
  border: 0;
}
.datefloat--pressed {
  transform: scale(0.95);
}
.cal-scrim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 7;
}
.cal-float {
  position: absolute;
  top: 42px;
  left: 12px;
  right: 12px;
  z-index: 8;
  border-radius: 14px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.16),
    0 12px 30px rgba(var(--agent-shadow-rgb), 0.18);
  overflow: hidden;
  transition:
    opacity 190ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 190ms cubic-bezier(0.23, 1, 0.32, 1);
}
.cal-float.cal-out {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
  pointer-events: none;
}
.timeline-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
.timeline-scroll {
  flex: 1;
  min-height: 0;
}
.timeline-empty {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
}
.timeline-empty :deep(button) {
  pointer-events: auto;
}
.timeline {
  position: relative;
}
.timeline-art {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}
.time-label {
  position: absolute;
  left: 0;
  width: 36px;
  text-align: right;
  font-size: 9px;
  font-weight: 600;
  color: var(--agent-text-faint);
  transform: translateY(-50%);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.time-label.event {
  color: var(--agent-text-secondary);
  font-size: 11px;
}
.time-label.past {
  color: var(--agent-text-faint);
}
.time-label.now {
  color: var(--agent-warning-deep);
}
.now text {
  display: block;
}
.now text:first-child {
  font-size: 9.5px;
  font-weight: 650;
  margin-bottom: 2px;
}
.now text:last-child {
  font-size: $agent-font-size-compact;
  font-weight: 750;
}
.date-label {
  position: absolute;
  left: 80px;
  right: 14px;
  color: var(--agent-text-faint);
  font-size: 10px;
  text-align: center;
  transform: translateY(-50%);
}
.card-target {
  position: absolute;
  left: 84px;
  right: 14px;
  padding: 6px 0;
}
@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
.timeline-card {
  position: relative;
  height: 32px;
  padding: 0 7px 0 11px;
  border-radius: 10px;
  display: block;
  line-height: 32px;
  background: linear-gradient(var(--agent-surface), var(--agent-surface-page));
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.13),
    inset 0 1px 0 #fff,
    0 1px 2px rgba(var(--agent-shadow-rgb), 0.05),
    0 6px 14px -10px rgba(var(--agent-shadow-rgb), 0.2);
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  animation: cardIn 200ms cubic-bezier(0.23, 1, 0.32, 1) backwards;
}
.timeline-card--pressed {
  transform: scale(0.985);
}
.timeline-card.faded {
  opacity: 0.6;
}
.timeline-card.executing {
  box-shadow:
    inset 0 0 0 1px rgba(var(--agent-shadow-rgb), 0.32),
    inset 0 1px 0 #fff,
    0 6px 16px -10px rgba(var(--agent-shadow-rgb), 0.45);
}
.timeline-card.executing::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 9px;
  bottom: 9px;
  width: 2.5px;
  border-radius: 2px;
  background: $agent-color-accent;
}
.task-row {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  min-width: 0;
}
.avatars {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.device-avatar {
  width: 21px;
  height: 21px;
  margin-left: -7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffffff, $agent-color-tint 72%);
  box-shadow:
    0 0 0 1.5px #fff,
    0 2px 5px rgba(var(--agent-shadow-rgb), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.device-avatar image {
  width: 21px;
  height: 21px;
}
.device-avatar:first-child {
  margin-left: 0;
}
.more {
  font-size: 8px;
  margin-left: 2px;
  color: $agent-color-text-muted;
}
.task-label {
  flex: 1;
  min-width: 0;
  font-size: $agent-font-size-compact;
  font-weight: 600;
  color: $agent-color-text-secondary;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.warning-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  border-radius: 50%;
  background: $agent-color-warning;
  box-shadow: 0 0 0 2px $agent-color-warning-faint;
  vertical-align: 1px;
}
.cancelled-status {
  flex-shrink: 0;
  color: $agent-color-text-muted;
  font-size: 9px;
}
.task-separator {
  width: 1px;
  height: 14px;
  flex-shrink: 0;
  background: $agent-color-line;
}
.owner-mark {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, $agent-color-accent, $agent-color-accent-deep);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
}
.owner-mark.cv-brass {
  background: linear-gradient(145deg, $agent-color-warning, $agent-color-warning-deep);
}
.owner-mark.cv-slate {
  background: linear-gradient(145deg, $agent-color-chart-deep, $agent-color-text-secondary);
}
.owner-mark.cv-grey {
  background: linear-gradient(145deg, $agent-color-text-faint, $agent-color-text-muted);
}
.task-row.cancelled .task-label {
  text-decoration: line-through;
  text-decoration-color: $agent-color-text-faint;
}
.record-card {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  min-width: 0;
}
.source {
  flex-shrink: 0;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
}
.source.immediate {
  color: var(--agent-text-secondary);
  background: var(--agent-tint);
}
.source.scheduled {
  color: $agent-color-accent;
  background: var(--agent-accent-faint);
}
.record-target {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--agent-text-secondary);
  font-size: 11px;
  font-weight: 600;
}
.record-task {
  margin-left: 5px;
  color: var(--agent-text-muted);
  font-size: 9px;
  font-weight: 400;
}
.record-result {
  flex-shrink: 0;
  font-size: 9px;
}
.record-result.ok,
.record-result.active {
  color: var(--agent-success);
}
.record-result.warn {
  color: $agent-color-warning;
}
.record-result.wait {
  color: var(--agent-text-muted);
}
.record-result.fail {
  color: var(--agent-error);
}
.creator {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--agent-accent), var(--agent-accent-deep));
  color: #fff;
  font-size: 9px;
}
.creator.cv-brass {
  background: linear-gradient(145deg, var(--agent-warning), var(--agent-warning-deep));
}
.creator.cv-slate {
  background: linear-gradient(145deg, var(--agent-text-muted), var(--agent-text-secondary));
}
.creator.cv-grey {
  background: linear-gradient(145deg, var(--agent-text-faint), var(--agent-text-muted));
}
.render-error {
  position: absolute;
  top: 470px;
  left: 90px;
  color: var(--agent-error);
  font-size: 13px;
}
@media (prefers-reduced-motion: reduce) {
  .timeline-card,
  .datefloat,
  .cal-float {
    transition: none;
    animation: none;
  }
}
</style>
