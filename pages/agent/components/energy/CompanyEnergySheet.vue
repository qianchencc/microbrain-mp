<template>
  <view class="epanel">
    <scroll-view
      class="ebody"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <view
        v-if="error && !report"
        class="estate-msg"
        ><text>{{ error }}</text
        ><button
          class="eretry"
          @tap="init(true)"
          >重试</button
        ></view
      >
      <view
        v-if="error && report"
        class="estale"
        ><text>{{ error }}</text
        ><button
          class="eretry"
          @tap="init(true)"
          >重试</button
        ></view
      >
      <template v-if="report || !error">
        <view class="calrow">
          <button
            v-if="!bounded || selected"
            class="calchip"
            @tap="calOpen = !calOpen"
            ><uni-icons
              type="calendar"
              size="13"
              color="var(--agent-text-secondary)" /><text>{{ labelOf(selected) }}</text
            ><uni-icons
              :type="calOpen ? 'up' : 'down'"
              size="11"
              color="var(--agent-text-muted)"
          /></button>
        </view>
        <RegionCalendar
          v-if="calOpen && selected && (!bounded || bounds)"
          class="ecal"
          :date="selected"
          :today="today"
          :min-date="bounded ? bounds?.min : undefined"
          :max-date="bounded ? bounds?.max || today : today"
          compact
          @select="onCalendar"
        />
        <view class="esec"
          ><text>每日用电</text><text v-if="basisNote">{{ basisNote }}</text></view
        >
        <CompanyEnergyStrip
          ref="stripRef"
          :days="strip"
          :selected="selected"
          @select="onSelectDay"
          @visible-range="onVisibleRange"
        />
        <view
          v-if="loading && !strip.length"
          class="eprepare"
          role="status"
          aria-label="正在准备历史统计"
          ><EnergySkeleton :pies="false" /><text class="eprepare-note">正在准备历史统计</text></view
        >
        <view class="ehero">
          <text class="elabel">{{ labelOf(selected) }} 用电</text>
          <template v-if="dayPending">
            <view class="sk-num" /><text class="edelta">正在准备该日统计</text>
          </template>
          <view
            v-else-if="selectedDay?.failed"
            class="efail"
            ><text class="enum">—</text
            ><view class="efail-row"
              ><text>该日读取失败</text
              ><button
                class="eretry"
                @tap="retrySelected"
                >重试</button
              ></view
            ></view
          >
          <template v-else>
            <text class="enum"
              >{{ selectedDay?.usage == null ? '—' : selectedDay.usage
              }}<text class="u">{{ unit ? ' ' + unit : '' }}</text></text
            >
            <text
              v-if="boundedEmpty"
              class="edelta"
              >所选统计期间无可计算用电</text
            >
            <text
              v-if="selectedDay?.usage != null"
              class="edelta"
              >较前一日 <text class="b">{{ pctText(dod) }}</text
              >　较上周同日 <text class="b">{{ pctText(wow) }}</text></text
            >
            <text
              v-if="
                todaySlice &&
                selectedDay &&
                selected !== today &&
                todayInBounds &&
                (selectedDay.elapsedUsage != null || todayUsage != null)
              "
              class="edelta"
              >当日同时段 {{ fmtUsage(selectedDay.elapsedUsage, unit) }} · 今日至今
              {{ fmtUsage(todayUsage, unit)
              }}<text v-if="vsToday != null"
                >　今日较当日同时段 <text class="b">{{ pctText(vsToday) }}</text></text
              ></text
            >
          </template>
        </view>
        <view class="esec"><text>当日构成</text></view>
        <template v-if="dayPending">
          <view
            v-for="i in 3"
            :key="'zc' + i"
            class="zone-row"
            ><view class="sk-zn" /><view class="ztrack"
              ><view
                class="zfill sk-fill"
                :style="{ width: 62 - i * 13 + '%' }" /></view
          ></view>
        </template>
        <template v-else-if="composition.items.length">
          <view
            v-for="(item, i) in composition.items"
            :key="item.label"
            class="zone-row"
          >
            <text class="zn">{{ item.label }}</text>
            <view class="ztrack"
              ><view
                class="zfill"
                :style="{
                  width: (item.value / compositionMax) * 100 + '%',
                  background: PIE_COLORS[i % PIE_COLORS.length],
                }"
            /></view>
            <text class="zv"
              >{{ item.value }}{{ unit ? ' ' + unit : '' }} ·
              {{ Math.round(item.share * 100) }}%</text
            >
          </view>
        </template>
        <text
          v-else-if="selectedDay?.failed"
          class="sec-empty"
          >该日读取失败，可在上方重试</text
        >
        <text
          v-else
          class="sec-empty"
          >当日无可计算的构成</text
        >
        <MonthlyEnergyComparison
          v-if="!bounded"
          :active="active"
          :cutoff="latestSampleTime"
        />
        <view class="esec"
          ><text>电表明细 · {{ labelOf(selected) }}</text
          ><text>{{ meterList.length }} 台</text></view
        >
        <template v-if="dayPending">
          <view
            v-for="i in 6"
            :key="'mk' + i"
            class="mrow"
            ><view class="mrow-copy"><view class="sk-name" /><view class="sk-loc" /></view
            ><view class="sk-v"
          /></view>
        </template>
        <text
          v-else-if="selectedDay?.failed"
          class="sec-empty"
          >该日明细读取失败，可在上方重试</text
        >
        <template v-else>
          <view
            v-for="meter in meterList"
            :key="meter.id"
            class="mrow"
          >
            <view class="mrow-copy"
              ><text class="mrow-name">{{ meter.name }}</text
              ><text
                v-if="meter.location"
                class="mrow-loc"
                >{{ meter.location }}</text
              ></view
            >
            <text class="mrow-v"
              >{{ meter.usage == null ? '—' : '用电 ' + meter.usage + (unit ? ' ' + unit : '')
              }}<text
                v-if="meter.usage != null && selectedDay?.usage"
                class="mrow-share"
                >占 {{ Math.round((meter.usage / selectedDay.usage) * 100) }}%</text
              ><text
                v-else-if="meter.status !== 'comparable'"
                class="mrow-share"
                >{{ statusText(meter.status) }}</text
              ></text
            >
          </view>
        </template>
        <text class="efoot">{{ footnote }}</text>
      </template>
    </scroll-view>
  </view>
</template>
<script setup>
import { computed, reactive, ref, toRefs, watch, nextTick, onBeforeUnmount } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { getCompanyEnergyDaily, getCompanyMeterReport } from '@/apis/agent/energy';
import { showAgentError } from '@/utils/agent-error';
import {
  getAgentStorageScope,
  isAgentStorageScope,
  waitForAgentSession,
} from '@/utils/agent-session';
import RegionCalendar from '../regions/RegionCalendar.vue';
import CompanyEnergyStrip from './CompanyEnergyStrip.vue';
import EnergySkeleton from './EnergySkeleton.vue';
import MonthlyEnergyComparison from './MonthlyEnergyComparison.vue';
import {
  shiftDate,
  dayLabel,
  unitOf,
  unitNote,
  floorComposition,
  meterRows,
  comparePct,
  statusText,
  PIE_COLORS,
  fmtUsage,
  historyCacheFailure,
  createEnergyPanel,
} from '../../lib/energy.mjs';
import { fmtDateTime } from '../../lib/observations.mjs';

const props = defineProps({
  active: Boolean,
  focusDate: String,
  bounded: Boolean,
  initialQuery: Object,
});
defineEmits(['refresh']);
const calOpen = ref(false),
  stripRef = ref(null);
const panel = createEnergyPanel({
  createState: reactive,
  read: () => props,
  api: { ready: waitForAgentSession, daily: getCompanyEnergyDaily, meter: getCompanyMeterReport },
  identity: { current: getAgentStorageScope, isCurrent: isAgentStorageScope },
  notice: (cause, fallback) => showAgentError(cause, { fallback }),
  position: (kind, value) => {
    if (kind === 'prepend') stripRef.value?.didPrepend(value);
    else nextTick(() => stripRef.value?.centerOn(value));
  },
});
const today = panel.state.today;
const {
  report,
  strip,
  meterDaily,
  selected,
  latestCompleteDay,
  latestSampleTime,
  error,
  loading,
  bounds,
  historyCache,
} = toRefs(panel.state);
const {
  init,
  jump: jumpToDate,
  select: onSelectDay,
  visibleRange: onVisibleRange,
  retry: retrySelected,
} = panel;
const unit = computed(() => unitOf(report.value));
const basisNote = computed(() => unitNote(report.value));
const selectedDay = computed(() => strip.value.find((d) => d.date === selected.value) || null);
const dayPending = computed(
  () => selectedDay.value?.pending || (props.bounded && loading.value && !selectedDay.value)
);
const meterList = computed(() => {
  const rows = meterRows({ meters: meterEntries.value }, selected.value);
  return [...rows].sort((a, b) => (b.usage ?? -1) - (a.usage ?? -1));
});
const meterEntries = computed(() => Object.values(meterDaily.value));
const composition = computed(() => floorComposition(meterList.value));
const compositionMax = computed(
  () => composition.value.items.reduce((m, i) => Math.max(m, i.value), 0) || 1
);
const usageOf = (date) => {
  if (props.bounded) {
    if (!bounds.value || date < bounds.value.min || date > bounds.value.max) return null;
    const day = strip.value.find((d) => d.date === date);
    return day?.complete ? day.usage : null;
  }
  return strip.value.find((d) => d.date === date)?.usage;
};
const selectedUsage = computed(() =>
  props.bounded
    ? selectedDay.value?.complete
      ? selectedDay.value.usage
      : null
    : selectedDay.value?.usage
);
const dod = computed(() =>
  comparePct(
    selectedUsage.value,
    !props.bounded && selected.value === today
      ? report.value?.comparison?.previousDay?.usage
      : usageOf(shiftDate(selected.value, -1))
  )
);
const wow = computed(() =>
  comparePct(
    selectedUsage.value,
    !props.bounded && selected.value === today
      ? report.value?.comparison?.lastWeekSameDay?.usage
      : usageOf(shiftDate(selected.value, -7))
  )
);
const labelOf = (date) => {
  if (!date) return '';
  const year = date.slice(0, 4) === today.slice(0, 4) ? '' : `${date.slice(0, 4)}年`;
  if (props.bounded) return `${year}${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
  return (
    year +
    (date === today
      ? `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日 · 今日至今`
      : dayLabel(date, latestCompleteDay.value))
  );
};
const todayInBounds = computed(
  () =>
    !props.bounded ||
    Boolean(bounds.value && today >= bounds.value.min && today <= bounds.value.max)
);
const boundedEmpty = computed(() =>
  Boolean(
    props.bounded &&
      report.value &&
      bounds.value &&
      !loading.value &&
      !strip.value.some((d) => d.pending || d.usage != null)
  )
);
// 与今日对比的公平口径：所选日只取与“今日至今”相同的 elapsed 窗口（08:00 → 当前时刻），
// 不拿完整日去比一个未过完的今天；任一侧无实测样本即显示 —。
const todaySlice = computed(() =>
  report.value?.comparison?.currentDay?.date === today ? report.value.comparison.currentDay : null
);
const todayUsage = computed(() => todaySlice.value?.usage ?? null);
const vsToday = computed(() => comparePct(todayUsage.value, selectedDay.value?.elapsedUsage));
// 后端 stale 只说明这是上次完整结果；原始 updatedAt 不清空、不改写。
const cacheNote = computed(() => {
  const cache = report.value?.cache;
  if (!cache || cache.status !== 'stale') return '';
  return cache.lastError?.message ? '上次更新未成功' : '';
});
// 历史补块按日期保留 cache 元数据：完整 stale body 的用量继续显示，但失败要以
// 固定短标签提示（原文只留在缓存元数据）；同块 fresh 返回时只清掉该块日期上的旧失败。
const historyNote = computed(() => {
  const failure = historyCacheFailure(historyCache.value);
  if (!failure?.messages?.length) return '';
  const range = failure.from === failure.to ? failure.from : `${failure.from}–${failure.to}`;
  return `${range} 历史补块读取失败`;
});
const footnote = computed(() => {
  if (!report.value) return '';
  if (props.bounded) {
    const meter = meterEntries.value[0];
    const parts = [];
    if (props.initialQuery && meter)
      parts.push([meter.name, meter.location].filter(Boolean).join(' · '));
    else parts.push(report.value.aggregation?.label || '');
    if (props.initialQuery)
      parts.push(`${fmtDateTime(props.initialQuery.from)} — ${fmtDateTime(props.initialQuery.to)}`);
    else if (bounds.value) parts.push(`${bounds.value.min} — ${bounds.value.max}`);
    if (latestSampleTime.value) parts.push(`数据截至 ${fmtDateTime(latestSampleTime.value)}`);
    if (report.value.truncated) parts.push('读取窗口被截断');
    if (cacheNote.value) parts.push(cacheNote.value);
    if (historyNote.value) parts.push(historyNote.value);
    parts.push(report.value.basis?.cycle || '');
    return parts.filter(Boolean).join(' · ');
  }
  const parts = [`数据截至 ${fmtDateTime(latestSampleTime.value)}`];
  if (report.value.truncated) parts.push('读取窗口被截断');
  else if (strip.value.some((day) => day.failed)) parts.push('部分日期读取未完成');
  if (cacheNote.value) parts.push(cacheNote.value);
  if (historyNote.value) parts.push(historyNote.value);
  parts.push(report.value.basis?.cycle || '');
  if (report.value.aggregation?.note) parts.push(report.value.aggregation.note);
  return parts.filter(Boolean).join(' · ');
});
function pctText(v) {
  return v == null ? '—' : (v >= 0 ? '+' : '') + v + '%';
}

function onCalendar(date) {
  calOpen.value = false;
  jumpToDate(date);
}
watch(
  [() => props.active, () => props.initialQuery],
  () => {
    void panel.update();
  },
  { immediate: true }
);
onHide(panel.hide);
onShow(() => {
  void panel.show();
});
onBeforeUnmount(panel.hide);
watch(() => props.focusDate, panel.focus);
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
  line-height: 1.3;
}
button::after {
  border: 0;
}
.epanel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: $agent-color-text-secondary;
  font-size: $agent-font-size-compact;
}
.ebody {
  flex: 1;
  min-height: 0;
  height: 0;
  padding: 6px 20px 24px;
  box-sizing: border-box;
}
.estate-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px 0;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
}
.eprepare-note {
  display: block;
  padding-top: 8px;
  font-size: 10px;
  color: $agent-color-text-muted;
  text-align: center;
}
.eretry {
  font-size: 11px;
  color: $agent-color-accent;
  border: 1px solid $agent-color-line;
  border-radius: 999px;
  padding: 7px 16px;
  background: $agent-color-surface;
}
.estale {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $agent-space-small;
  margin-top: 8px;
  font-size: 10.5px;
  color: $agent-color-warning;
}
.calrow {
  display: flex;
  margin: 8px 0 2px;
}
.calchip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border-radius: 15px;
  background: linear-gradient($agent-color-surface, $agent-color-tint);
  color: $agent-color-text-secondary;
  font-size: 11.5px;
  font-weight: 650;
  box-shadow:
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.16),
    inset 0 1px 0 #fff,
    0 4px 12px rgba(var(--agent-shadow-rgb), 0.16);
}
.calchip:active {
  transform: scale(0.95);
}
.ecal {
  margin: 8px -8px 4px;
}
.esec {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 2px;
  color: $agent-color-text-muted;
  padding-bottom: 8px;
  border-bottom: 1px solid $agent-color-line;
  margin-top: 24px;
}
.esec > text:last-child {
  letter-spacing: 0;
  font-size: 9px;
}
.ehero {
  margin-top: 14px;
}
.elabel {
  display: block;
  font-size: 10px;
  letter-spacing: 2px;
  color: $agent-color-text-muted;
}
.enum {
  display: block;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 40px;
  color: $agent-color-accent-deep;
  letter-spacing: -0.5px;
  margin-top: 2px;
}
.enum .u {
  font-size: 13px;
  color: $agent-color-text-muted;
}
.edelta {
  display: block;
  font-size: 10.5px;
  color: $agent-color-text-muted;
  margin-top: 6px;
}
.edelta .b {
  color: $agent-color-accent;
  font-weight: 600;
}
.edelta.warn {
  color: $agent-color-warning;
}
.edelta.muted {
  color: $agent-color-text-muted;
}
.zone-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid $agent-color-line;
  font-size: $agent-font-size-compact;
}
.zn {
  width: 56px;
  flex-shrink: 0;
  color: $agent-color-text-secondary;
}
.ztrack {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: $agent-color-tint;
}
.zfill {
  display: block;
  height: 3px;
  border-radius: 2px;
}
.zv {
  flex-shrink: 0;
  font-size: 10.5px;
  color: $agent-color-text-muted;
  font-variant-numeric: tabular-nums;
}
.sec-empty {
  display: block;
  padding: 14px 0;
  font-size: 11px;
  color: $agent-color-text-muted;
}
.mrow {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 0;
  border-bottom: 1px solid $agent-color-line;
  font-size: $agent-font-size-compact;
}
.mrow:last-of-type {
  border-bottom: 0;
}
.mrow-copy {
  flex: 1;
  min-width: 0;
}
.mrow-name {
  display: block;
  color: $agent-color-text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mrow-loc {
  display: block;
  font-size: 10px;
  color: $agent-color-text-muted;
  margin-top: 2px;
}
.mrow-v {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: $agent-color-text-secondary;
  font-size: 11.5px;
}
.mrow-share {
  font-style: normal;
  font-size: 10px;
  color: $agent-color-text-muted;
  margin-left: 6px;
}
.efoot {
  display: block;
  font-size: 9.5px;
  color: $agent-color-text-muted;
  line-height: 1.8;
  margin-top: 16px;
}
/* 所选日补块中：数值/构成/明细原位骨架；失败给重试（同 EnergySkeleton 的呼吸）。 */
.efail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 10.5px;
  color: $agent-color-warning;
}
.sk-num,
.sk-delta,
.sk-zn,
.sk-fill,
.sk-name,
.sk-loc,
.sk-v {
  background: $agent-color-tint;
  border-radius: 4px;
  animation: sk-pulse 1.4s ease-in-out infinite;
}
.sk-num {
  display: block;
  width: 150px;
  height: 38px;
  margin-top: 4px;
  border-radius: 8px;
}
.sk-delta {
  display: block;
  width: 220px;
  max-width: 80%;
  height: 10px;
  margin-top: 10px;
}
.sk-zn {
  width: 56px;
  height: 12px;
  flex-shrink: 0;
}
.sk-fill {
  background: $agent-color-tint;
}
.sk-name {
  display: block;
  width: 62%;
  height: 12px;
}
.sk-loc {
  display: block;
  width: 38%;
  height: 9px;
  margin-top: 6px;
}
.sk-v {
  width: 64px;
  height: 12px;
  flex-shrink: 0;
}
@keyframes sk-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.9;
  }
}
@media (prefers-reduced-motion: reduce) {
  .calchip:active {
    transform: none;
  }
  .sk-num,
  .sk-delta,
  .sk-zn,
  .sk-fill,
  .sk-name,
  .sk-loc,
  .sk-v {
    animation: none;
    opacity: 0.6;
  }
}
</style>
