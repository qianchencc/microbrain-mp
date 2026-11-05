<template>
  <view class="comparison">
    <view class="head">
      <text class="kind">{{ title }}</text>
      <text
        class="badge"
        :class="{ warn: report.status !== 'comparable' }"
        >{{ statusLabel }}</text
      >
    </view>
    <text class="scope">{{ report.meter.name }}</text>
    <text class="sub"
      >{{ report.meter.location ? report.meter.location + ' · ' : ''
      }}{{ report.weeks.length }} 个采样周 · {{ report.basis.cycle }}</text
    >

    <template v-if="columns.length">
      <scroll-view
        scroll-x
        class="chart-wrap"
        enhanced
        :show-scrollbar="false"
      >
        <view
          class="chart-inner"
          :style="{ width: chart.width <= 360 ? '100%' : chart.width + 'px' }"
        >
          <image
            class="chart"
            :src="chart.src"
            mode="scaleToFill"
            aria-label="每周累计示数增量"
          />
          <view
            class="meta"
            :style="{ marginLeft: metaMargin.left, marginRight: metaMargin.right }"
          >
            <button
              v-for="(week, index) in columns"
              :key="week.label + index"
              class="mcol"
              :class="{ selected: index === selectedIndex }"
              hover-class="mcol--pressed"
              :aria-label="`${week.label}至${week.endLabel}，${comparisonNumber(week.usage)}，环比${comparisonRatio(week)}`"
              @tap="
                selectedIndex = index;
                openSheet('evidence');
              "
            >
              <text
                class="chip"
                :class="chipOf(week)"
                >{{ week.current ? '进行中' : comparisonRatio(week) }}</text
              >
              <text class="ml">{{
                week.current ? week.label : week.label + '–' + week.endLabel
              }}</text>
              <text
                v-if="metaNote(week)"
                class="mn"
                >{{ metaNote(week) }}</text
              >
            </button>
          </view>
        </view>
      </scroll-view>
    </template>

    <view class="actions">
      <button
        hover-class="pressed"
        @tap="openSheet('evidence')"
        >采样依据</button
      >
      <button
        hover-class="pressed"
        @tap="openSheet('history')"
        >电表统计</button
      >
    </view>

    <DeviceSheet
      v-if="sheetMounted"
      :open="sheetOpen"
      :title="pane === 'evidence' ? '采样依据' : '电表统计'"
      :subtitle="report.meter.name"
      tall
      @close="sheetOpen = false"
    >
      <scroll-view
        v-if="pane === 'evidence'"
        class="evidence-scroll"
        scroll-y
        enhanced
        :show-scrollbar="false"
      >
        <view class="evidence-content">
          <view class="evidence-tabs"
            ><button
              v-for="(week, index) in columns"
              :key="week.label + index"
              class="evidence-tab"
              :class="{ active: index === selectedIndex }"
              hover-class="mcol--pressed"
              @tap="selectedIndex = index"
              >{{ week.current ? '本周' : week.label }}</button
            ></view
          >
          <view
            v-if="selected"
            class="evidence"
          >
            <text class="evidence-heading">{{
              selected.current
                ? '本周采样'
                : selected.label + '–' + selected.endLabel + ' 周采样依据'
            }}</text>
            <text
              >请求 {{ fmtDateTime(selected.requested.from) }} —
              {{ fmtDateTime(selected.requested.to) }}</text
            >
            <template v-if="!selected.current">
              <view class="proof">
                <view
                  ><text class="pk">起点采样</text
                  ><text class="pv">{{
                    selected.sampledFrom ? fmtDateTime(selected.sampledFrom.readTime) : '缺测'
                  }}</text></view
                >
                <view
                  ><text class="pk">终点采样</text
                  ><text class="pv">{{
                    selected.sampledTo ? fmtDateTime(selected.sampledTo.readTime) : '缺测'
                  }}</text></view
                >
                <view
                  ><text class="pk">起点示数</text
                  ><text class="pv">{{
                    selected.sampledFrom ? comparisonNumber(selected.sampledFrom.value) : '—'
                  }}</text></view
                >
                <view
                  ><text class="pk">终点示数</text
                  ><text class="pv">{{
                    selected.sampledTo ? comparisonNumber(selected.sampledTo.value) : '—'
                  }}</text></view
                >
              </view>
              <text
                >区间示数差：{{ comparisonNumber(selected.usage)
                }}<text v-if="previous">
                  · 上期 {{ comparisonNumber(previous.usage)
                  }}<text v-if="previous.status !== 'comparable'">（上期不可完整比较）</text></text
                ></text
              >
              <text
                v-for="note in selected.notes"
                :key="note"
                class="warning"
                >{{ note }}</text
              ><text
                v-if="selected.ratioNote"
                class="warning"
                >{{ selected.ratioNote }}</text
              >
            </template>
            <text v-else
              >截至
              {{ selected.sampledThrough ? fmtDateTime(selected.sampledThrough) : '尚无有效采样' }}
              · 不与整周直接比较</text
            >
          </view>
        </view>
      </scroll-view>
      <view
        v-else
        class="history-pane"
        ><MeterHistoryView
          class="history-host"
          :active="sheetOpen"
          :initial-query="historyQuery"
          :show-question="false"
      /></view>
    </DeviceSheet>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import DeviceSheet from '../shared/DeviceSheet.vue';
import MeterHistoryView from '../observations/MeterHistoryView.vue';
import { fmtShanghaiDateTime as fmtDateTime } from '../../lib/observations.mjs';
import {
  energyComparisonChart,
  comparisonColumns,
  comparisonNumber,
  comparisonRatio,
  comparisonChip,
} from '../../lib/energy.mjs';

const props = defineProps({ report: { type: Object, required: true } });
const selectedIndex = ref(0),
  sheetOpen = ref(false),
  sheetMounted = ref(false),
  pane = ref('evidence');
function openSheet(view) {
  pane.value = view;
  sheetMounted.value = true;
  sheetOpen.value = true;
}

const columns = computed(() => comparisonColumns(props.report));
const chart = computed(() => energyComparisonChart(props.report, columns.value));
const metaMargin = computed(() => ({
  left: ((chart.value.padLeft / chart.value.width) * 100).toFixed(3) + '%',
  right: ((chart.value.padRight / chart.value.width) * 100).toFixed(3) + '%',
}));
const selected = computed(() => columns.value[selectedIndex.value]);
const previous = computed(() =>
  selected.value?.current
    ? null
    : selectedIndex.value
      ? props.report.weeks[selectedIndex.value - 1]
      : props.report.baseline
);
const title = computed(() => (props.report.basis.unit ? '用电周环比' : '累计示数差值比较'));
const statusLabel = computed(
  () =>
    ({
      comparable: '可比较',
      partial: '部分可比较',
      not_computable: '数据不足',
      read_failed: '读取失败',
    })[props.report.status] || props.report.status
);
const chipOf = (week) => comparisonChip(week);
function metaNote(week) {
  if (week.current)
    return week.sampledThrough ? '截至 ' + fmtDateTime(week.sampledThrough).slice(5) : '';
  if (week.ratio == null && week.ratioNote) return '环比不可比';
  if (week.notes?.length) return week.notes[0].split('：')[0].slice(0, 9);
  return '';
}
const historyQuery = computed(() => ({
  equipmentId: props.report.meter.id,
  ...props.report.window,
}));
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
  line-height: 1.4;
}
button::after {
  border: 0;
}
.comparison {
  color: $agent-color-text-secondary;
  font-size: $agent-font-size-compact;
  margin-top: 10px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.kind {
  font-size: $agent-font-size-compact;
  font-weight: 600;
  color: $agent-color-text-muted;
}
.badge {
  font-size: 10px;
  white-space: nowrap;
  padding: 3px 8px;
  border-radius: 9px;
  background: $agent-color-accent-faint;
  color: $agent-color-accent;
}
.badge.warn {
  background: $agent-color-warning-faint;
  color: $agent-color-warning-deep;
}
.scope {
  display: block;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 10px;
}
.sub {
  display: block;
  font-size: 11px;
  color: $agent-color-text-muted;
  line-height: 1.7;
  margin-top: 4px;
}
.chart-wrap {
  width: 100%;
  margin-top: 14px;
}
.chart {
  display: block;
  width: 100%;
  height: 168px;
}
.meta {
  display: flex;
}
.mcol {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0 10px;
  border-radius: 8px;
}
.mcol--pressed {
  background: $agent-color-tint;
}
.selected .ml {
  color: $agent-color-accent-deep;
  font-weight: 600;
}
.chip {
  font-size: 10px;
  border-radius: 8px;
  padding: 2px 7px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  background: $agent-color-tint;
  color: $agent-color-text-muted;
}
.chip.up {
  background: $agent-color-warning-faint;
  color: $agent-color-warning-deep;
}
.chip.down {
  background: $agent-color-accent-faint;
  color: $agent-color-accent;
}
.ml {
  font-size: 10px;
  color: $agent-color-text-muted;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mn {
  font-size: 9px;
  color: $agent-color-warning;
  white-space: nowrap;
}
.actions {
  display: flex;
  gap: $agent-space-small;
  margin-top: 12px;
}
.actions button {
  flex: 1;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $agent-color-line;
  background: $agent-color-accent-faint;
  border-radius: $agent-radius-medium;
  color: $agent-color-accent;
  font-size: 11px;
  font-weight: 600;
  transition: transform 130ms cubic-bezier(0.23, 1, 0.32, 1);
}
.pressed {
  transform: scale(0.97);
}
.evidence-scroll {
  height: 0;
  flex: 1;
  min-height: 0;
}
.evidence-content {
  padding: 4px 20px 24px;
}
.evidence-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.evidence-tab {
  min-height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $agent-color-line;
  border-radius: 10px;
  background: $agent-color-surface;
  color: $agent-color-text-muted;
  font-size: 11px;
}
.evidence-tab.active {
  border-color: $agent-color-accent;
  color: $agent-color-accent;
  background: $agent-color-accent-faint;
  font-weight: 600;
}
.evidence {
  padding: 16px;
  background: linear-gradient(145deg, $agent-color-surface, $agent-color-tint);
  border: 1px solid $agent-color-line;
  border-radius: 14px;
}
.evidence > text {
  display: block;
  font-size: $agent-font-size-compact;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.evidence .evidence-heading {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
}
.evidence .warning {
  color: $agent-color-warning-deep;
}
.proof {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 12px;
  margin: 12px 0;
  padding: 13px 0;
  border-top: 1px solid $agent-color-line;
  border-bottom: 1px solid $agent-color-line;
}
.pk {
  display: block;
  font-size: 10px;
  color: $agent-color-text-muted;
}
.pv {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.history-pane,
.history-host {
  height: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
@media (prefers-reduced-motion: reduce) {
  .actions button {
    transition: none;
  }
}
</style>
