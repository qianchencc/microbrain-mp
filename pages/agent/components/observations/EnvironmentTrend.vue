<template>
  <view class="trend">
    <SlidingSegments
      :model-value="metricKey"
      tone="glass"
      :options="metricOptions"
      @update:modelValue="
        metricKey = $event;
        selectedId = '';
      "
    />
    <view class="hero">
      <view class="reading">
        <text class="hlabel">{{ metric?.label || '观测' }} · {{ resolutionText }}</text>
        <text class="number"
          >{{ focus?.values[metricKey] ?? '—'
          }}<text class="unit">{{ metric?.unit || '' }}</text></text
        >
        <text class="reading-time">{{ focusTime || '暂无有效采样' }}</text>
      </view>
      <view class="peak">
        <text>原始峰值 {{ metric?.peak?.value ?? '—' }}{{ metric?.unit || '' }}</text>
        <text>{{ metric?.peak ? fmtDateTime(metric.peak.at) : '暂无有效采样' }}</text>
      </view>
    </view>
    <text
      v-if="focusDetail"
      class="point-summary"
      >{{ focusDetail }}</text
    >
    <text
      v-if="showLatest"
      class="latest-fact"
    >
      最新采样 {{ latest.value }}{{ metric?.unit || '' }} · {{ fmtShanghaiDateTime(latest.at) }}
    </text>
    <text
      v-if="showWindow && windowText"
      class="window"
      >{{ windowText }}</text
    >
    <view
      class="plot"
      @tap="selectPoint"
      ><image
        class="chart"
        :src="chart.src"
        mode="scaleToFill"
    /></view>
    <view class="axis-time"
      ><text
        v-for="(tick, i) in axisTicks"
        :key="i"
        :class="`tick-${tick.edge}`"
        :style="{ left: tick.left + '%' }"
        >{{ tick.label }}</text
      ></view
    >
    <text
      v-if="qualityNotice"
      class="quality"
      >{{ qualityNotice }}</text
    >
    <text class="data-note">{{ coverageLine }} · 点图查看{{ resolutionText }}</text>
  </view>
</template>
<script setup>
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import {
  fmtDateTime,
  fmtShanghaiDateTime,
  environmentSampleIdentity,
  environmentChartPoints,
  environmentBucketState,
  environmentHistoryNotice,
  environmentWindowLabel,
  environmentTrendTicks,
} from '../../lib/observations.mjs';
import { trendLineChart } from '../../lib/energy.mjs';
import SlidingSegments from '../shared/SlidingSegments.vue';
const props = defineProps({
  report: { type: Object, required: true },
  showWindow: { type: Boolean, default: true },
});
const metricKey = ref('temp'),
  selectedId = ref('');
const metric = computed(
  () => props.report.metrics.find((item) => item.key === metricKey.value) || props.report.metrics[0]
);
const metricOptions = computed(() =>
  props.report.metrics.map((item) => ({ value: item.key, label: item.label }))
);
watch(
  () => props.report.metrics,
  (list) => {
    if (list?.length && !list.some((item) => item.key === metricKey.value))
      metricKey.value = list[0].key;
  }
);
const pointIdentity = (point) =>
  point.from ? `${point.from}/${point.to}` : environmentSampleIdentity(point);
const chartPoints = computed(() => environmentChartPoints(props.report, metricKey.value));
const selected = computed(
  () => chartPoints.value.find((point) => pointIdentity(point.ref) === selectedId.value)?.ref
);
const points = computed(() =>
  chartPoints.value.filter((point) => point.value !== null).map((point) => point.ref)
);
const focus = computed(() => selected.value || points.value.at(-1));
const resolutionText = computed(
  () =>
    ({ day: '日均值', '3h': '3小时均值', raw: '原始采样' })[props.report.resolution] || '原始采样'
);
const qualityNotice = computed(() => {
  const notes = [environmentHistoryNotice(props.report)];
  const now = Date.now();
  const empty = (props.report.buckets || []).filter(
    (bucket) => environmentBucketState(bucket, metricKey.value, now) === 'missing'
  ).length;
  if (empty)
    notes.push(`${empty}${props.report.resolution === 'day' ? '天' : '个时段'}缺测，折线已断开`);
  return notes.filter(Boolean).join('；');
});
const latest = computed(() => {
  const raw = props.report.latest?.[metricKey.value];
  if (raw) return raw;
  if (props.report.resolution && props.report.resolution !== 'raw') return null;
  const last = points.value.at(-1);
  return last ? { value: last.values[metricKey.value], at: last.recordedAt } : null;
});
const showLatest = computed(
  () =>
    latest.value &&
    ((props.report.resolution && props.report.resolution !== 'raw') || selected.value)
);
const focusTime = computed(() => {
  const point = focus.value;
  if (!point) return '';
  const from = fmtShanghaiDateTime(point.from || point.recordedAt);
  if (props.report.resolution === 'day') return from.slice(0, 10);
  if (point.to) return `${from}–${fmtShanghaiDateTime(point.to).slice(11, 16)}`;
  return from;
});
const focusDetail = computed(() => {
  const detail = focus.value?.metrics?.[metricKey.value];
  if (!detail) return '';
  if (environmentBucketState(focus.value, metricKey.value) === 'future') return '该时段尚未开始';
  if (!detail.count) return '该时段无有效采样';
  const unit = metric.value?.unit || '';
  return `最低 ${detail.min}${unit} · 最高 ${detail.max}${unit} · ${detail.count}条采样`;
});
const range = computed(() => ({
  start: Date.parse(props.report.window.from),
  duration: Math.max(1, Date.parse(props.report.window.to) - Date.parse(props.report.window.from)),
}));
const coverageLine = computed(() => {
  const cov = props.report.coverage;
  const count = cov?.readSamples ?? metric.value?.count ?? 0;
  const incomplete = cov?.complete === false || props.report.nextPage != null;
  const span =
    incomplete && cov?.from && cov?.to
      ? ` · 覆盖 ${fmtShanghaiDateTime(cov.from)} 至 ${fmtShanghaiDateTime(cov.to)}`
      : '';
  return `已读取 ${count} 条采样${span}`;
});
const chart = computed(() =>
  trendLineChart(chartPoints.value, {
    from: range.value.start,
    to: range.value.start + range.value.duration,
    selected: focus.value,
  })
);
const windowText = computed(() => environmentWindowLabel(props.report.window));
const plotWidth = ref(360);
const axisTicks = computed(() =>
  environmentTrendTicks(props.report.window, { width: plotWidth.value })
);
const instance = getCurrentInstance();
function measurePlot() {
  uni
    .createSelectorQuery()
    .in(instance)
    .select('.plot')
    .boundingClientRect((rect) => {
      if (rect?.width > 0) plotWidth.value = rect.width;
    })
    .exec();
}
onMounted(measurePlot);
watch(() => props.report.window, measurePlot, { flush: 'post' });
function selectPoint(event) {
  if (!chartPoints.value.length) return;
  uni
    .createSelectorQuery()
    .in(instance)
    .select('.plot')
    .boundingClientRect((rect) => {
      if (!rect?.width) return;
      const x = ((event.detail.x - rect.left) / rect.width) * chart.value.width;
      const nearest = chartPoints.value.reduce((best, item) =>
        Math.abs(chart.value.xOf(item.at) - x) < Math.abs(chart.value.xOf(best.at) - x)
          ? item
          : best
      );
      selectedId.value = pointIdentity(nearest.ref);
    })
    .exec();
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
.trend {
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
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
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10px;
  margin: 12px 0 8px;
}
.hlabel {
  display: block;
  color: var(--agent-text-primary);
  font-size: 14px;
  font-weight: 600;
}
.number {
  display: block;
  margin-top: 3px;
  color: var(--agent-accent-deep);
  font-size: 32px;
  line-height: 1.25;
  font-weight: 600;
}
.unit {
  font-size: 13px;
  margin-left: 4px;
  font-weight: 400;
}
.peak {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  max-width: 46%;
  color: var(--agent-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}
.plot {
  position: relative;
  height: 154px;
}
.chart {
  width: 100%;
  height: 100%;
}
.window {
  display: block;
  margin: 12px 0 2px;
  color: var(--agent-text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.axis-time {
  position: relative;
  min-height: 14px;
  margin-top: 2px;
  color: var(--agent-text-secondary);
  font-size: 11px;
}
.axis-time text {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}
.axis-time .tick-start {
  transform: none;
}
.axis-time .tick-end {
  transform: translateX(-100%);
}
.reading {
  min-width: 0;
}
.reading-time,
.point-summary,
.latest-fact,
.data-note {
  display: block;
  color: var(--agent-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}
.point-summary,
.latest-fact {
  margin-top: 4px;
}
.data-note {
  margin-top: 10px;
}
.quality {
  display: block;
  margin-top: $agent-space-small;
  color: var(--agent-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}
.pressed {
  opacity: 0.7;
}
</style>
