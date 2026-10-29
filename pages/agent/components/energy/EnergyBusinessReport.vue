<template>
 <view class="report">
  <view class="head">
   <text class="kind">{{ kindLabel }}</text>
   <text class="badge" :class="{ warn: stateLabel !== '完整结果' }">{{ stateLabel }}</text>
  </view>
  <text class="scope">{{ scopeName }}</text>
  <text class="sub">{{ fmtTime(report.requested.from) }} — {{ fmtTime(report.requested.to) }} · {{ report.coverage.requestedMeters }} 台电表</text>

  <template v-if="report.kind === 'statistics'">
   <view class="hero">
    <text class="hero-label">{{ statsLabel }}</text>
    <view class="number" :class="{ words: !statsNumber }">
     <text v-if="statsNumber">{{ statsNumber.value }}<text class="unit">{{ statsNumber.unit }}</text></text>
     <text v-else>{{ statsWords }}</text>
    </view>
    <view v-if="total || statsNumber" class="fact-row">
     <view v-if="report.summary.average != null" class="fact"><text>日均用电</text><text class="fact-value">{{ value(report.summary.average) }} kWh</text></view>
     <view v-else-if="total" class="fact"><text>纳入合计</text><text class="fact-value">{{ total.meterIds.length }} 台</text></view>
     <view v-else-if="single" class="fact"><text>取得采样</text><text class="fact-value">{{ single.samples || '—' }} 条</text></view>
    </view>
   </view>
   <text v-if="statsNotice" class="notice">{{ statsNotice }}</text>
  </template>

  <template v-else-if="report.kind === 'comparison'">
   <view class="hero">
    <text class="hero-label">{{ report.windows.length > 2 ? '最后一期相对前一期' : '本期相对基期' }}</text>
    <view class="number" :class="{ words: heroRatio == null }">
     <text v-if="heroRatio != null">{{ heroRatio > 0 ? '+' : heroRatio < 0 ? '−' : '' }}{{ Math.abs(heroRatio).toFixed(1) }}%<text v-if="difference != null" class="unit"> {{ difference >= 0 ? '增加' : '减少' }} {{ value(Math.abs(difference)) }} {{ diffUnit }}</text></text>
     <text v-else>{{ single ? '本表暂不可比' : '暂无范围合计对比' }}</text>
    </view>
   </view>
   <view v-if="pairMetrics" class="pair">
    <view class="pair-side"><text class="pair-label">{{ windowLabel(-2) }} · {{ windowRange(-2) }}</text><text class="pair-value">{{ pairMetrics.previous != null ? value(pairMetrics.previous) : '—' }}<text v-if="pairMetrics.previous != null" class="pair-unit"> {{ diffUnit }}</text></text></view>
    <view class="pair-side current"><text class="pair-label">{{ windowLabel(-1) }} · {{ windowRange(-1) }}</text><text class="pair-value">{{ pairMetrics.current != null ? value(pairMetrics.current) : '—' }}<text v-if="pairMetrics.current != null" class="pair-unit"> {{ diffUnit }}</text></text></view>
   </view>
   <text v-if="comparisonNotice" class="notice">{{ comparisonNotice }}</text>
  </template>

  <template v-else>
   <view class="hero">
    <text class="hero-label">数据质量与用电变化</text>
    <view class="number"><text>{{ report.findings.length }}<text class="unit"> 项待核查</text></text></view>
    <view class="fact-row">
     <view class="fact"><text>检查范围</text><text class="fact-value">{{ report.coverage.requestedMeters }} 台</text></view>
     <view class="fact"><text>取得采样</text><text class="fact-value">{{ report.coverage.completedMeters }} 台</text></view>
    </view>
   </view>
   <view v-for="rule in report.checks || []" :key="rule.code" class="check">
    <text class="check-label">{{ rule.label }}</text>
    <text class="check-pill" :class="rule.status">{{ checkText(rule) }}</text>
   </view>
   <button v-for="(finding, index) in report.findings.slice(0, 5)" :key="index" class="finding" hover-class="row-pressed" @tap="openFinding(finding)">
    <view class="finding-head"><view class="finding-title"><view class="fdot" /><view class="ftext">{{ finding.title }}</view></view><text class="pill">{{ meterName(finding.meterId) }}</text></view>
    <text class="finding-detail">{{ finding.detail }}</text>
   </button>
   <text v-if="!report.findings.length" class="empty">本次检查未发现问题</text>
   <button v-if="report.findings.length > 5" class="more" hover-class="pressed" @tap="open('findings')">查看全部 {{ report.findings.length }} 项 ›</button>
   <text v-for="(item, i) in (report.notChecked || []).slice(0, 2)" :key="i" class="notice">未检查{{ item.meterId ? ' · ' + meterName(item.meterId) : '' }}：{{ item.reason }}</text>
  </template>

  <text v-if="report.coverage.reason" class="notice">{{ report.coverage.reason }}</text>
  <view class="coverage">
   <text>{{ report.coverage.validMeters }}/{{ report.coverage.requestedMeters }} 台有效<text v-if="report.coverage.failedMeters"> · {{ report.coverage.failedMeters }} 台未计入</text></text>
   <button hover-class="pressed" @tap="open('meters')">查看范围 ›</button>
  </view>

  <template v-if="report.kind !== 'inspection'">
   <template v-if="chart.hasData">
    <view class="shead">
     <text>{{ chartTitle }}</text>
     <view v-if="chart.mode === 'series'" class="seg"><button v-for="g in grains" :key="g.key" :class="{ on: grain === g.key }" :aria-pressed="grain === g.key" hover-class="pressed" @tap="grain = g.key">{{ g.label }}</button></view>
    </view>
    <view v-if="chart.mode === 'paired'" class="legend"><view class="li"><view class="sw light" /><text>{{ windowLabel(0) }}</text></view><view class="li"><view class="sw" /><text>{{ windowLabel(-1) }}</text></view></view>
    <scroll-view scroll-x class="chart-wrap" enhanced :show-scrollbar="false">
     <view :style="{ width: chart.points.length <= 7 ? '100%' : chart.width + 'px' }"><image class="chart" :src="chart.src" mode="scaleToFill" /></view>
    </scroll-view>
    <text v-if="seriesNote" class="notice">{{ seriesNote }}</text>
   </template>

   <view v-if="listRows.length" class="shead">
    <text>{{ total ? '电表贡献' : '逐表统计 · 原始示数差' }}</text>
    <button class="link" hover-class="pressed" @tap="open('meters')">全部 {{ report.meters.length }} 台 ›</button>
   </view>
   <button v-for="row in listRows" :key="row.meter.id" class="mrow" hover-class="row-pressed" @tap="openMeter(row)">
    <view class="mrow-main">
     <text class="mrow-name">{{ row.meter.name }}</text>
     <text class="mrow-sub">{{ rowSub(row) }}</text>
     <view v-if="total && finiteUsage(row)" class="track"><view class="fill" :style="{ width: share(row) + '%' }" /></view>
    </view>
    <view class="mrow-value"><text class="v">{{ rowValue(row) }}</text><text class="u">{{ rowUnit(row) }}</text></view>
    <text class="arrow">›</text>
   </button>
   <text v-if="!listRows.length && !chart.hasData" class="empty">无法取得有效起止读数</text>
  </template>

  <view class="actions">
   <button hover-class="pressed" @tap="open('evidence')">采样依据</button>
   <button hover-class="pressed" @tap="open('history')">电表统计</button>
  </view>

  <DeviceSheet v-if="mounted" :open="sheetOpen" :title="paneTitle" :subtitle="selected?.meter.name || kindLabel" tall @close="sheetOpen = false">
   <template #header-left><button v-if="stack.length" class="back" aria-label="返回上一层" hover-class="pressed" @tap="back">‹</button></template>
   <view v-if="pane === 'history' && selected" class="history-pane"><MeterHistoryView class="history-host" :active="sheetOpen" :initial-query="historyQuery" :show-question="false" /></view>
   <scroll-view v-else class="details-scroll" scroll-y enhanced :show-scrollbar="false">
    <view class="details">
     <template v-if="pane === 'meters' || pane === 'history'">
      <text class="sheet-note">{{ total ? '每个电表保留自己的结果；读取失败不计为零。' : '按接入顺序逐表列出，不作跨表汇总。' }}</text>
      <button v-for="row in report.meters" :key="row.meter.id" class="mrow" hover-class="row-pressed" @tap="pushMeter(row, pane === 'history')">
       <view class="mrow-main"><text class="mrow-name">{{ row.meter.name }}</text><text class="mrow-sub">{{ rowSub(row) }}</text></view>
       <view class="mrow-value"><text class="v">{{ rowValue(row) }}</text><text class="u">{{ rowUnit(row) }}</text></view>
       <text class="arrow">›</text>
      </button>
     </template>
     <template v-else-if="pane === 'findings'">
      <button v-for="(finding, i) in report.findings" :key="i" class="finding" hover-class="row-pressed" @tap="pushFinding(finding)">
       <view class="finding-head"><view class="finding-title"><view class="fdot" /><text>{{ finding.title }}</text></view><text class="pill">{{ meterName(finding.meterId) }}</text></view>
       <text class="finding-detail">{{ finding.detail }}</text>
      </button>
     </template>
     <template v-else>
      <view v-if="finding" class="period-block">
       <text class="mrow-name">{{ finding.title }}</text>
       <text class="block-line">{{ finding.detail }}</text>
       <text class="notice">检查规则：{{ finding.rule }}</text>
      </view>
      <text class="block-line">请求 {{ fmtTime(report.requested.from) }} — {{ fmtTime(report.requested.to) }}</text>
      <text class="block-line">字段 epf · {{ selected ? (selected.unit ? selected.unit + ' / 倍率 ' + selected.multiplier : '单位与倍率未确认') : (report.basis.policyVersion ? '按已确认计量口径逐表计算' : '单位与倍率未确认') }}</text>
      <text v-for="(item, i) in (report.notChecked || []).filter(r => !selected || !r.meterId || r.meterId === selectedId)" :key="'unchecked-' + i" class="notice">未检查{{ item.meterId ? ' · ' + meterName(item.meterId) : '' }}：{{ item.reason }}</text>
      <text v-if="!selected" class="notice">{{ report.basis.policyVersion ? '计量口径版本：' + report.basis.policyVersion : '无已确认聚合口径，保留逐表结果' }}</text>
      <template v-if="selected">
       <view v-for="(period, i) in selected.periods" :key="i" class="period-block">
        <text class="mrow-name">{{ report.windows.length > 2 ? '区间 ' + (i + 1) : report.windows.length > 1 && i === 0 ? '基期' : '本次区间' }}</text>
        <view class="proof">
         <view><text class="pk">起点采样</text><text class="pv">{{ period.sampledFrom ? fmtTime(period.sampledFrom.readTime) : '未取得' }}</text></view>
         <view><text class="pk">终点采样</text><text class="pv">{{ period.sampledTo ? fmtTime(period.sampledTo.readTime) : '未取得' }}</text></view>
         <view><text class="pk">起点示数 · epf</text><text class="pv">{{ period.sampledFrom ? value(period.sampledFrom.value) : '—' }}</text></view>
         <view><text class="pk">终点示数 · epf</text><text class="pv">{{ period.sampledTo ? value(period.sampledTo.value) : '—' }}</text></view>
        </view>
        <text class="block-line">区间示数差：{{ period.usage != null ? value(period.usage) : '不可计算' }}<text v-if="period.ratio != null"> · 较前一段 {{ period.ratio.toFixed(1) }}%</text></text>
        <text v-for="note in period.notes" :key="note" class="notice">{{ note }}</text>
       </view>
       <text v-if="!selected.periods.length" class="notice">{{ selected.error || '尚未取得有效采样' }}</text>
       <view class="actions"><button hover-class="pressed" @tap="push('history')">查看这台电表的统计</button></view>
      </template>
      <view v-else class="actions"><button hover-class="pressed" @tap="push('meters')">查看逐表依据</button></view>
     </template>
    </view>
   </scroll-view>
  </DeviceSheet>
 </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import DeviceSheet from '../shared/DeviceSheet.vue'
import MeterHistoryView from '../observations/MeterHistoryView.vue'
import { fmtShanghaiDateTime as fmtTime } from '../../lib/observations.mjs'
import { energyKindLabel, energyValue as value, energyBusinessChart, singleMeterOf } from '../../lib/energy.mjs'

const props = defineProps({ report: { type: Object, required: true }, running: Boolean })
const grain = ref('week'), mounted = ref(false), sheetOpen = ref(false), pane = ref('evidence'), selectedId = ref(null), finding = ref(null), stack = ref([])
const grains = [{ key: 'day', label: '日' }, { key: 'week', label: '周' }, { key: 'month', label: '月' }]

const kindLabel = computed(() => energyKindLabel(props.report.kind))
const total = computed(() => props.report.summary.total)
const single = computed(() => singleMeterOf(props.report))
const last = row => row?.periods.at(-1)
const finiteUsage = row => typeof last(row)?.usage === 'number' && Number.isFinite(last(row).usage)
const meterName = id => props.report.meters.find(m => m.meter.id === id)?.meter.name || '计量点'

const scopeName = computed(() => props.report.meters.length === 1 ? props.report.meters[0].meter.name : '当前接入计量范围')
const stateLabel = computed(() => props.report.coverage.status === 'denied' ? '授权失效' : !props.report.coverage.requestedMeters ? '无计量点' : total.value?.status === 'partial' ? '部分结果' : props.report.coverage.status === 'reading' ? props.running ? '读取中' : '已中断' : props.report.coverage.status === 'partial' ? '部分结果' : !total.value && props.report.kind !== 'inspection' ? single.value ? '口径待确认' : '用电量待核实' : '完整结果')

const statsLabel = computed(() => total.value ? total.value.status === 'partial' ? '已取得结果的小计' : '所选区间用电量' : single.value ? '本表累计读数变化' : '逐表区间结果')
const statsNumber = computed(() => {
 if (total.value) return { value: value(total.value.value), unit: 'kWh' }
 if (single.value && last(single.value)?.usage != null) return { value: value(last(single.value).usage), unit: '表码增量' }
 return null
})
const statsWords = computed(() => props.report.coverage.completedMeters ? '已完成 ' + props.report.coverage.completedMeters + ' 台统计' : '暂无可计算结果')
const statsNotice = computed(() => {
 if (total.value?.status === 'partial') return '仅含 ' + total.value.meterIds.length + ' 台同口径电表的小计'
 if (!total.value && single.value) return '按原始示数差显示'
 if (!total.value && props.report.coverage.completedMeters) return '逐表差值已统计 · 不作总量加总'
 return ''
})

const heroRatio = computed(() => props.report.summary.ratio ?? (single.value ? last(single.value)?.ratio : null))
const diffUnit = computed(() => total.value ? 'kWh' : '表码差')
const difference = computed(() => props.report.summary.difference ?? (single.value?.periods.length > 1 && single.value.periods.slice(-2).every(p => p.status === 'comparable') ? last(single.value).usage - single.value.periods.at(-2).usage : null))
const windowLabel = index => {
 const i = index < 0 ? props.report.windows.length + index : index
 const w = props.report.windows[i]
 if (!w) return ''
 if (w.label) return w.label
 if (props.report.windows.length > 2) return i === props.report.windows.length - 1 ? '本期' : i === props.report.windows.length - 2 ? '前一期' : '第 ' + (i + 1) + ' 期'
 return i === 0 ? '基期' : '本期'
}
const windowRange = index => {
 const w = props.report.windows.at(index)
 return w ? String(w.from).slice(5, 10).replace('-', '/') + '—' + String(w.to).slice(5, 10).replace('-', '/') : ''
}
const pairMetrics = computed(() => {
 if (props.report.kind !== 'comparison') return null
 const previous = props.report.periods.at(-2)?.metric?.value ?? single.value?.periods.at(-2)?.usage ?? null
 const current = props.report.periods.at(-1)?.metric?.value ?? last(single.value)?.usage ?? null
 return previous != null || current != null ? { previous, current } : null
})
const comparisonNotice = computed(() => {
 if (props.report.summary.ratioNote && !heroRatio.value) return props.report.summary.ratioNote
 if (total.value?.status === 'partial') return '仅比较两期均完整的 ' + total.value.meterIds.length + ' 台'
 if (!total.value && !single.value && props.report.coverage.completedMeters) return '逐表等长区间差值 · 不作加总'
 return ''
})

const chart = computed(() => energyBusinessChart(props.report, grain.value))
const chartTitle = computed(() => {
 const unit = total.value ? 'kWh' : '表码增量'
 if (chart.value.mode === 'paired') return '逐表两期对比 · ' + unit
 if (props.report.kind === 'comparison') return '各期区间结果 · ' + unit
 return '区间构成 · ' + unit
})
const seriesNote = computed(() => {
 const remaining = props.report.seriesCoverage?.[grain.value]?.remaining
 return props.report.kind === 'statistics' && remaining ? '图表仅显示前 400 段，' + fmtTime(remaining.from) + ' 之后尚未绘制；区间统计仍覆盖原请求。可切换较粗粒度。' : ''
})
const listRows = computed(() => {
 const rows = props.report.meters || []
 return total.value ? [...rows].sort((a, b) => (last(b)?.usage ?? -1) - (last(a)?.usage ?? -1)).slice(0, 3) : rows.slice(0, 3)
})
const share = row => {
 if (!total.value || !finiteUsage(row)) return 0
 const top = Math.max(...props.report.meters.map(m => last(m)?.usage ?? 0), 1)
 return Math.min(100, Math.max(0, last(row).usage / top * 100))
}
function rowSub(row) {
 if (row.status === 'failed') return row.error || '读取失败 · 未计入结果'
 const period = last(row)
 if (!period || period.usage == null) return '缺少区间边界采样'
 if (!row.unit && period.sampledFrom && period.sampledTo) return '累计读数 ' + value(period.sampledFrom.value) + ' → ' + value(period.sampledTo.value)
 return row.meter.location || '有效区间'
}
function rowValue(row) {
 const usage = last(row)?.usage
 return usage != null ? (row.unit ? value(usage) : '+' + value(usage)) : '未计算'
}
function rowUnit(row) {
 const period = last(row)
 if (period?.usage == null) return ''
 const unit = row.unit || '表码增量'
 return props.report.kind === 'comparison' && period.ratio != null ? unit + ' · ' + (period.ratio > 0 ? '+' : '') + period.ratio.toFixed(1) + '%' : unit
}
const checkText = rule => ({ pending: '待执行', complete: '已检查 ' + (rule.checkedMeterIds?.length || 0) + ' 台', partial: '部分已检查 ' + (rule.checkedMeterIds?.length || 0) + ' 台', not_checked: '未检查' })[rule.status] || '检查范围'

const selected = computed(() => props.report.meters.find(m => m.meter.id === selectedId.value))
const paneTitle = computed(() => ({ meters: '电表范围与明细', evidence: '采样依据', history: selected.value ? '电表统计' : '选择电表查看统计', findings: '待核查项' })[pane.value])
const historyQuery = computed(() => ({ equipmentId: selectedId.value, from: [...props.report.windows].sort((a, b) => Date.parse(a.from) - Date.parse(b.from))[0]?.from || props.report.requested.from, to: [...props.report.windows].sort((a, b) => Date.parse(b.to) - Date.parse(a.to))[0]?.to || props.report.requested.to }))

function open(view) { pane.value = view; selectedId.value = null; finding.value = null; stack.value = []; mounted.value = true; sheetOpen.value = true }
function push(view) { stack.value.push({ pane: pane.value, id: selectedId.value, finding: finding.value }); pane.value = view }
function openMeter(row) { open('evidence'); selectedId.value = row.meter.id }
function pushMeter(row, history) { push(history ? 'history' : 'evidence'); selectedId.value = row.meter.id; finding.value = null }
function openFinding(item) { open('evidence'); selectedId.value = item.meterId; finding.value = item }
function pushFinding(item) { push('evidence'); selectedId.value = item.meterId; finding.value = item }
function back() { const previous = stack.value.pop(); if (previous) { pane.value = previous.pane; selectedId.value = previous.id; finding.value = previous.finding } }
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; background: transparent; line-height: 1.4; }
button::after { border: 0; }
.report { color: #35533f; font-size: 12px; margin-top: 10px; }
.head, .coverage, .shead, .mrow, .finding-head, .finding-title, .legend .li { display: flex; align-items: center; }
.head, .coverage, .shead, .mrow, .finding-head { justify-content: space-between; gap: 10px; }
.kind { font-size: 12px; font-weight: 600; color: #6b8069; }
.badge { font-size: 10px; white-space: nowrap; padding: 3px 8px; border-radius: 9px; background: #e4efdf; color: #176b54; }
.badge.warn { background: #f6efe1; color: #a77c37; }
.scope { display: block; font-size: 17px; font-weight: 600; line-height: 1.4; margin-top: 10px; }
.sub { display: block; font-size: 11px; color: #80907f; line-height: 1.7; margin-top: 4px; }
.hero { padding: 15px 0 12px; }
.hero-label { color: #71856d; font-size: 11px; }
.number { margin-top: 5px; font-size: 33px; letter-spacing: -1.2px; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; }
.number.words { font-size: 22px; letter-spacing: -.3px; line-height: 1.45; }
.unit { font-size: 12px; font-weight: 400; letter-spacing: 0; margin-left: 6px; color: #788d74; }
.fact-row { display: flex; gap: 18px; margin-top: 13px; }
.fact { font-size: 11px; color: #80907f; }
.fact-value { display: block; font-size: 15px; font-weight: 600; color: #47664b; font-variant-numeric: tabular-nums; margin-top: 2px; }
.notice { display: block; padding: 9px 12px; border-radius: 11px; background: #f5eddf; color: #967033; font-size: 11px; line-height: 1.7; margin-top: 10px; }
.pair { display: flex; gap: 16px; padding: 10px 0 4px; }
.pair-side { flex: 1; min-width: 0; border-left: 2px solid #c1d4ba; padding-left: 11px; }
.pair-side.current { border-color: #176b54; }
.pair-label { display: block; font-size: 10px; color: #7c8e75; line-height: 1.6; }
.pair-value { display: block; font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 3px; }
.pair-unit { font-size: 10px; font-weight: 400; color: #80907f; }
.coverage { font-size: 11px; color: #7a8d72; padding: 10px 0; border-top: 1px solid #e2e9dd; border-bottom: 1px solid #e2e9dd; margin-top: 12px; }
.coverage button { color: #176b54; min-height: 28px; white-space: nowrap; font-size: 11px; flex-shrink: 0; }
.shead { font-size: 11px; color: #7d8f75; margin-top: 16px; }
.seg { display: flex; gap: 2px; background: #eaf0e4; border-radius: 8px; padding: 3px; }
.seg button { font-size: 10px; min-width: 27px; min-height: 24px; border-radius: 6px; color: #7b8f71; display: flex; align-items: center; justify-content: center; }
.seg button.on { color: #176b54; background: #fafcf6; font-weight: 600; }
.legend { gap: 14px; color: #7b8e74; font-size: 10px; margin-top: 8px; }
.sw { width: 7px; height: 7px; border-radius: 2px; background: #277f61; margin-right: 5px; }
.sw.light { background: #bad0ba; }
.chart-wrap { width: 100%; margin-top: 8px; }
.chart { display: block; width: 100%; height: 172px; }
.link { color: #176b54; font-size: 11px; min-height: 24px; flex-shrink: 0; }
.mrow { width: 100%; gap: 10px; padding: 12px 0; border-bottom: 1px solid #e3e9dc; text-align: left; }
.mrow-main { flex: 1; min-width: 0; }
.mrow-name { display: block; font-size: 12px; font-weight: 600; line-height: 1.5; }
.mrow-sub { display: block; font-size: 10px; color: #80907f; margin-top: 3px; overflow-wrap: anywhere; }
.mrow-value { flex-shrink: 0; text-align: right; }
.mrow-value .v { display: block; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mrow-value .u { display: block; font-size: 9px; color: #80907f; margin-top: 2px; }
.track { height: 3px; margin-top: 7px; border-radius: 3px; background: #e6eddf; max-width: 165px; }
.fill { display: block; height: 100%; background: #80ac83; border-radius: 3px; }
.arrow { color: #90a18a; flex-shrink: 0; }
.check { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; font-size: 11px; color: #5f7560; border-bottom: 1px solid #eef1e6; }
.check-pill { font-size: 10px; color: #7a8d72; flex-shrink: 0; }
.check-pill.complete { color: #267451; }
.check-pill.partial, .check-pill.not_checked { color: #a77c37; }
.finding { display: flex; flex-direction: column; align-items: stretch; width: 100%; text-align: left; padding: 13px 0; border-bottom: 1px solid #e3e9dc; }
.fdot { width: 6px; height: 6px; border-radius: 50%; background: #a77c37; flex-shrink: 0; }
.ftext { min-width: 0; overflow-wrap: anywhere; }
.finding-title { flex: 1; gap: 7px; font-size: 12px; font-weight: 600; min-width: 0; }
.finding-detail { display: block; font-size: 11px; color: #7c8e75; line-height: 1.7; margin-top: 6px; }
.pill { flex-shrink: 0; max-width: 45%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 2px 7px; background: #f6eee0; color: #a77c37; border-radius: 7px; font-size: 10px; }
.empty { display: block; padding: 18px 0; color: #72846d; font-size: 12px; }
.more { display: block; color: #176b54; font-size: 11px; min-height: 28px; margin-top: 8px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.actions button { flex: 1; min-height: 38px; display: flex; align-items: center; justify-content: center; border: 1px solid #dce7d4; background: #eaf1e4; border-radius: 12px; color: #4a7751; font-size: 11px; font-weight: 600; transition: transform 130ms cubic-bezier(.23, 1, .32, 1); }
.pressed { transform: scale(.97); }
.back { width: 34px; height: 34px; border-radius: 50%; background: #e9f0e2; font-size: 19px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.history-pane, .history-host { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.details-scroll { height: 0; flex: 1; min-height: 0; }
.details { padding: 4px 20px 26px; }
.sheet-note { display: block; font-size: 10px; color: #80907f; line-height: 1.7; margin-bottom: 4px; }
.block-line { display: block; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }
.period-block { padding: 14px; background: linear-gradient(145deg, #fcfdf8, #f4f8f0); border: 1px solid #dce5d8; border-radius: 14px; margin-top: 14px; }
.period-block .mrow-name { margin-bottom: 4px; }
.proof { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; margin: 12px 0; padding: 13px 0; border-top: 1px solid #e2e9dd; border-bottom: 1px solid #e2e9dd; }
.pk { display: block; font-size: 10px; color: #80907f; }
.pv { display: block; font-size: 13px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.row-pressed { background: #eef3ea; }
@media (prefers-reduced-motion: reduce) { .actions button { transition: none; } }
</style>
