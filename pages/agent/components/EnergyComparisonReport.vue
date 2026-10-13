<template>
 <view class="comparison">
  <view class="heading"><text class="name">{{ report.meter.name }}</text><text class="status" :class="{ warning: report.status !== 'comparable' }">{{ statusLabel }}</text></view>
  <text class="scope">累计示数增量比较 · {{ report.basis.field }} · {{ report.weeks.length }} 周</text>
  <text class="cycle">{{ report.basis.cycle }}</text>
  <image class="chart" :src="chart" mode="scaleToFill" :aria-label="'每周累计示数增量，单位未确认；缺测不补零'" />
  <view class="columns">
   <button v-for="(week, index) in columns" :key="week.label" class="week" :class="{ selected: index === selectedIndex }" hover-class="week--pressed" :aria-label="`${week.label}至${week.endLabel}，${comparisonNumber(week.usage)}，环比${comparisonRatio(week)}`" @tap="selectedIndex = index; evidenceOpen = true">
    <text class="ratio" :class="{ up: week.ratio > 0, down: week.ratio <= 0 && week.ratio != null }">{{ week.current ? '进行中' : comparisonRatio(week) }}</text>
    <text class="date">{{ week.label }}</text><text class="end-date">{{ week.current ? '不参与环比' : '至 ' + week.endLabel }}</text>
   </button>
  </view>
  <text v-if="report.status === 'not_computable'" class="notice">当前采样不足以比较完整周。可查看已有采样和缺失边界。</text>
  <text v-else-if="report.status === 'partial'" class="notice">{{ report.coverage.complete ? '斜纹柱为缩短采样区间的实际增量，不估算整周。' : '采样读取尚不完整，已有增量仅供查看，暂不计算环比。' }}</text>
  <view v-if="evidenceOpen && selected" class="evidence">
   <view class="evidence-head"><text>{{ selected.current ? '本周采样' : comparisonDate(selected.requested.from) + ' 周采样依据' }}</text><button aria-label="收起采样依据" @tap="evidenceOpen = false"><uni-icons type="up" size="14" color="#7b9080" /></button></view>
   <text>请求 {{ fmtDateTime(selected.requested.from) }} — {{ fmtDateTime(selected.requested.to) }}</text>
   <template v-if="!selected.current">
    <text>起点 {{ selected.sampledFrom ? fmtDateTime(selected.sampledFrom.readTime) + ' · ' + comparisonNumber(selected.sampledFrom.value) : '缺测' }}</text>
    <text>终点 {{ selected.sampledTo ? fmtDateTime(selected.sampledTo.readTime) + ' · ' + comparisonNumber(selected.sampledTo.value) : '缺测' }}</text>
    <text v-for="note in selected.notes" :key="note" class="warning">{{ note }}</text><text v-if="selected.ratioNote" class="warning">{{ selected.ratioNote }}</text>
    <template v-if="previous"><text>上期 {{ fmtDateTime(previous.requested.from) }} — {{ fmtDateTime(previous.requested.to) }}</text><text>上期增量 {{ comparisonNumber(previous.usage) }}<text v-if="previous.status !== 'comparable'"> · 上期不可完整比较</text></text></template>
   </template>
   <text v-else>截至 {{ selected.sampledThrough ? fmtDateTime(selected.sampledThrough) : '尚无有效采样' }} · 不与整周直接比较</text>
  </view>
  <view v-if="report.explanation.status !== 'ready'" class="explanation"><text>{{ running ? '正在解读报告…' : '比较报告已保留，文字解读尚未完成' }}</text><button v-if="!running" :disabled="busy" class="retry" hover-class="pressed" @tap="$emit('retry-explanation', reference)">重试解读</button></view>
  <text class="note">单位与倍率未确认，以上为表码增量，非 kWh 耗电。</text>
  <text class="note">{{ report.coverage.upstream }}</text>
  <text class="note">{{ report.coverage.samples }} 条采样 · 最新 {{ report.coverage.latest ? fmtDateTime(report.coverage.latest) : '未知' }}<text v-if="!report.coverage.complete"> · 读取尚不完整</text></text>
  <text class="note">读取于 {{ fmtDateTime(report.observedAt) }}</text>
  <view class="actions"><button :disabled="busy" hover-class="pressed" @tap="evidenceOpen = !evidenceOpen">{{ evidenceOpen ? '收起依据' : '采样依据' }}</button><button :disabled="busy" hover-class="pressed" @tap="historyMounted = true; historyOpen = true">原始采样</button><button :disabled="busy" class="ask" hover-class="pressed" @tap="$emit('reference', reference)">继续追问 <uni-icons type="chatbubble" size="12" color="#fff" /></button></view>
  <DeviceSheet v-if="historyMounted" :open="historyOpen" title="原始计量采样" :subtitle="report.meter.name" @close="historyOpen = false"><MeterHistoryView :active="historyOpen" :initial-query="historyQuery" @question="historyOpen = false; $emit('reference', reference)" /></DeviceSheet>
 </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import DeviceSheet from './DeviceSheet.vue'
import MeterHistoryView from './MeterHistoryView.vue'
import { fmtShanghaiDateTime as fmtDateTime } from '../observation-view.mjs'
import { energyComparisonChart, comparisonColumns, comparisonNumber, comparisonDate, comparisonRatio } from '../energy-comparison-view.mjs'
const props = defineProps({ report: { type: Object, required: true }, busy: Boolean, running: Boolean })
defineEmits(['reference', 'retry-explanation'])
const selectedIndex = ref(0), evidenceOpen = ref(false), historyOpen = ref(false), historyMounted = ref(false)
const columns = computed(() => comparisonColumns(props.report)), chart = computed(() => energyComparisonChart(props.report))
const selected = computed(() => columns.value[selectedIndex.value])
const previous = computed(() => selected.value?.current ? null : selectedIndex.value ? props.report.weeks[selectedIndex.value - 1] : props.report.baseline)
const statusLabel = computed(() => ({ comparable: '可比较', partial: '部分可比较', not_computable: '数据不足' })[props.report.status])
const reference = computed(() => ({ type: 'energy_report', reportId: props.report.reportId, label: props.report.meter.name + ' · 周比较报告' }))
const historyQuery = computed(() => ({ equipmentId: props.report.meter.id, ...props.report.window }))
</script>
<style scoped>
view,text,input { font-size:inherit;line-height:inherit; }button { margin:0;padding:0;background:transparent;line-height:1.4; }button::after { border:0; }
.comparison { color:#35533f;font-size:12px;margin-top:12px; }.heading { display:flex;align-items:baseline;gap:6px;flex-wrap:wrap; }.name { font-size:14px;font-weight:600; }.status { padding:2px 7px;font-size:10px;border-radius:8px;color:#267451;background:#e5f1e6; }.warning { color:#9a7639; }.status.warning { background:#f4eddf; }.scope,.cycle,.note { display:block;line-height:1.7;color:#81927f; }.scope { margin-top:6px;font-size:11px; }.cycle { font-size:10px; }.chart { display:block;margin-top:18px;width:100%;height:166px; }.columns { display:flex;margin:0 1px 15px 10%;gap:0; }.week { flex:1;min-width:0;min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;border-radius:8px;color:#72876f; }.week--pressed { background:#e6eee3; }.ratio { display:block;font-size:10px;white-space:nowrap;background:#edf0e8;border-radius:7px;padding:2px 5px; }.ratio.up { color:#987738;background:#f4eedf; }.ratio.down { color:#287657;background:#e4f0e5; }.date { font-size:10px;white-space:nowrap; }.end-date { font-size:9px;white-space:nowrap;color:#8a9c84; }.selected .date { color:#286f4e;font-weight:600; }
.notice { display:block;color:#96733c;font-size:11px;line-height:1.7;margin-bottom:10px; }.evidence { margin:12px 0;padding:12px 0;border-top:1px solid #dee7d9;border-bottom:1px solid #dee7d9; }.evidence>text { display:block;font-size:10px;line-height:1.9;overflow-wrap:anywhere; }.evidence-head { display:flex;align-items:center;justify-content:space-between;font-weight:600; }.evidence-head button { width:36px;height:36px;display:flex;align-items:center;justify-content:center; }.note { margin-top:4px;font-size:10px; }.actions { display:flex;gap:5px;flex-wrap:wrap;margin-top:14px; }.actions button { flex:1;min-width:70px;min-height:36px;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:12px;color:#3c7050;background:#eaf1e5;font-size:11px;font-weight:600; }.actions .ask,.retry { background:linear-gradient(155deg,#2a876c,#145c46);color:#fff;box-shadow:inset 0 1px 0 #ffffff30,0 3px 8px -4px #145a4280; }.explanation { display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;margin-bottom:8px;color:#96733c;font-size:11px;line-height:1.6; }.retry { height:32px;padding:0 10px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:11px; }.pressed { transform:scale(.97); }.actions button,.retry { transition:transform 130ms cubic-bezier(.23,1,.32,1); }button[disabled] { opacity:.45; }@media(prefers-reduced-motion:reduce) { .actions button,.retry { transition:none; } }
</style>
