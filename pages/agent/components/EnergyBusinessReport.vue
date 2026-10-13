<template>
 <view class="energy-report">
  <view class="heading"><text class="title">{{ kindLabel }}</text><text class="badge" :class="{ warning: stateLabel !== '完整结果' }">{{ stateLabel }}</text></view>
  <text class="range">{{ report.meters.length === 1 ? report.meters[0].meter.name : '当前接入计量范围' }}</text>
  <text class="meta">{{ fmtTime(report.requested.from) }} — {{ fmtTime(report.requested.to) }} · {{ report.coverage.requestedMeters }} 台</text>
  <template v-if="report.kind === 'statistics'">
   <view class="hero"><text class="caption">{{ total?.status === 'partial' ? '有效电表小计' : total ? '所选区间用电量' : single ? '本表区间示数增量' : '逐表区间统计' }}</text><text class="big">{{ total ? value(total.value) : single ? value(last(single)?.usage) : report.coverage.completedMeters ? '已取得 ' + report.coverage.completedMeters + ' 台结果' : '暂无可计算结果' }}<text v-if="total || single" class="unit"> {{ total ? 'kWh' : '示数差' }}</text></text></view>
   <view v-if="report.summary.average != null" class="facts"><view><text class="caption">日均用电</text><text>{{ value(report.summary.average) }} kWh</text></view></view>
  </template>
  <template v-else-if="report.kind === 'comparison'">
   <view class="hero"><text class="caption">{{ report.windows.length > 2 ? '最后一期相对前一期' : '本期相对基期' }}</text><text class="big">{{ ratio == null ? single ? '本表暂不可比' : '合计暂不可比' : (ratio > 0 ? '+' : '') + ratio.toFixed(1) + '%' }}</text><text v-if="difference != null" class="meta">差额 {{ value(difference) }} {{ total ? 'kWh' : '示数差' }}</text><text v-if="ratioNote" class="notice">{{ ratioNote }}</text></view>
   <view v-for="(period,i) in report.periods" :key="i" class="period-fact"><text class="meter-name">{{ period.label || (report.periods.length > 2 ? '区间 ' + (i + 1) : i === 0 ? '基期' : '本期') }}<text class="period-value">{{ value(period.metric?.value ?? single?.periods[i]?.usage) }} {{ period.metric ? 'kWh' : single ? '示数差' : '' }}</text></text><text class="meta">{{ fmtTime(period.from) }} — {{ fmtTime(period.to) }}</text><text v-if="i && report.periods.length > 2" class="meta">{{ period.ratio != null ? '较前一段 ' + period.ratio.toFixed(1) + '%' : period.ratioNote || '合计暂不可比' }}</text></view>
  </template>
  <template v-else>
   <view class="hero"><text class="caption">数据质量{{ report.rules.growthThreshold != null ? '与用电增幅' : '' }}</text><text class="big">{{ report.findings.length }}<text class="unit"> 项待核查</text></text></view>
   <text v-for="rule in report.checks || []" :key="rule.code" class="meta">{{ rule.label }} · {{ ({pending:'待执行',complete:'已检查',partial:'部分已检查',not_checked:'未检查'})[rule.status] || '检查范围' }}<text v-if="rule.checkedMeterIds?.length"> {{ rule.checkedMeterIds.length }} 台</text></text>
   <text v-for="(item, i) in (report.notChecked || []).slice(0,3)" :key="i" class="meta">未检查{{ item.meterId ? ' · ' + meterName(item.meterId) : '' }}：{{ item.reason }}</text>
   <button v-if="report.notChecked?.length > 3" class="more" @tap="open('evidence')">全部 {{ report.notChecked.length }} 项未检查说明 ›</button>
   <text class="meta">{{ report.rules.growthThreshold == null ? '本次未设置用电增长阈值，未作增长正常/异常判断。' : '本次指定增幅阈值 ' + report.rules.growthThreshold + '%；发现仅为核查线索。' }}</text>
  </template>
  <text v-if="!total && report.kind !== 'inspection'" class="notice">{{ single ? '单位与倍率未确认，保留本表实际示数差，不换算为 kWh。' : '已自动读取当前范围。合计需确认单位、倍率与不重叠计量集合；各表仍保留实际区间的示数差。' }}</text>
  <text v-else-if="total?.status === 'partial'" class="notice">仅统计 {{ total.meterIds.length }} 台同口径有效电表，未计入项保留在明细中，不代表全部范围总量。</text>
  <text v-if="report.coverage.reason" class="notice">{{ report.coverage.reason }}</text>
  <view class="coverage"><text>{{ report.coverage.completedMeters }} / {{ report.coverage.requestedMeters }} 台读取完成 · {{ report.coverage.validMeters }} 台区间完整</text><button hover-class="pressed" @tap="open('meters')">查看范围 ›</button></view>
  <template v-if="report.kind === 'inspection'">
   <button v-for="(finding, index) in report.findings.slice(0, 5)" :key="index" class="finding" hover-class="row-pressed" @tap="openFinding(finding)"><text class="meter-name">{{ finding.title }}</text><text class="meta">{{ meterName(finding.meterId) }} · {{ finding.detail }}</text></button>
   <text v-if="!report.findings.length" class="meta empty">本次已执行的检查规则未发现问题；不等于未检查的项目正常。</text>
   <button v-if="report.findings.length > 5" class="more" @tap="open('findings')">查看全部 {{ report.findings.length }} 项 ›</button>
  </template>
  <template v-else>
   <template v-if="total || single">
    <view class="chart-heading"><text>{{ report.kind === 'statistics' ? '区间构成' : '分期增量' }} · {{ total ? 'kWh' : '示数差' }}</text><view v-if="report.kind === 'statistics'" class="grain"><button v-for="g in grains" :key="g.key" :class="{ active: grain === g.key }" @tap="grain = g.key">{{ g.label }}</button></view></view>
    <scroll-view v-if="chart.points.some(p => p.usage != null)" scroll-x class="chart-scroll" :show-scrollbar="false"><view :style="{ width: chart.points.length <= 6 ? '100%' : chart.width + 'px' }"><image class="chart" :src="chart.src" mode="scaleToFill" /><view class="axis"><text v-for="(point, i) in chart.points" :key="i">{{ point.label }}</text></view></view></scroll-view>
    <text v-if="report.kind === 'statistics' && report.seriesCoverage?.[grain]?.remaining" class="notice">图表仅显示前 400 段，{{ fmtTime(report.seriesCoverage[grain].remaining.from) }} 之后尚未绘制；区间统计仍覆盖原请求。可切换较粗粒度。</text>
    <text class="meta">缺少完整分段边界的时段留空，未补零或估算。</text>
   </template>
   <view class="list-heading"><text>{{ total ? '电表明细' : '逐表结果 · 示数差' }}</text><button class="more" @tap="open('meters')">全部 {{ report.meters.length }} 台 ›</button></view>
   <button v-for="row in report.meters.slice(0, 3)" :key="row.meter.id" class="meter-row" hover-class="row-pressed" @tap="openMeter(row)"><view><text class="meter-name">{{ row.meter.name }}</text><text class="meta">{{ row.status === 'failed' ? row.error : last(row)?.notes.join('；') || row.meter.location }}</text></view><view class="row-value"><text>{{ value(last(row)?.usage) }}</text><text class="small">{{ row.unit || '示数差' }}<text v-if="report.kind === 'comparison' && last(row)?.ratio != null"> · {{ last(row).ratio.toFixed(1) }}%</text></text></view><text>›</text></button>
  </template>
  <text class="meta source">{{ report.basis.upstream }} · 查询于 {{ fmtTime(report.observedAt) }}</text>
  <view class="actions"><button hover-class="pressed" @tap="open('evidence')">采样依据</button><button hover-class="pressed" @tap="open('history')">原始采样</button></view>
  <DeviceSheet v-if="mounted" :open="sheetOpen" :title="paneTitle" :subtitle="selected?.meter.name || kindLabel" tall @close="sheetOpen = false">
   <template #leading><button v-if="stack.length" class="back" aria-label="返回上一层" @tap="back">‹</button></template>
   <view v-if="pane === 'history' && selected" class="history-pane"><MeterHistoryView class="history-host" :active="sheetOpen" :initial-query="historyQuery" :show-question="false" /></view>
   <scroll-view v-else class="details-scroll" scroll-y enhanced :show-scrollbar="false"><view class="details">
    <template v-if="pane === 'meters' || pane === 'history'">
     <button v-for="row in report.meters" :key="row.meter.id" class="meter-row" @tap="pushMeter(row, pane === 'history')"><view><text class="meter-name">{{ row.meter.name }}</text><text class="meta">{{ row.status === 'failed' ? row.error : row.meter.location }}</text></view><text>{{ value(last(row)?.usage) }} {{ row.unit || '示数差' }} ›</text></button>
    </template>
    <template v-else-if="pane === 'findings'"><button v-for="(finding, i) in report.findings" :key="i" class="finding" @tap="pushFinding(finding)"><text class="meter-name">{{ finding.title }}</text><text class="meta">{{ meterName(finding.meterId) }} · {{ finding.detail }}</text></button></template>
    <template v-else>
     <view v-if="finding" class="evidence"><text class="meter-name">{{ finding.title }}</text><text>{{ finding.detail }}</text><text class="notice">检查规则：{{ finding.rule }}</text></view>
     <text class="meta">请求 {{ fmtTime(report.requested.from) }} — {{ fmtTime(report.requested.to) }}</text>
     <text class="meta">字段 epf · {{ selected ? selected.unit ? selected.unit + ' / 倍率 ' + selected.multiplier : '单位与倍率未确认' : report.basis.policyVersion ? '按已确认计量口径逐表计算' : '单位与倍率未确认' }}</text>
     <text v-for="(item, i) in (report.notChecked || []).filter(r => !selected || !r.meterId || r.meterId === selectedId)" :key="'unchecked-' + i" class="notice">未检查{{ item.meterId ? ' · ' + meterName(item.meterId) : '' }}：{{ item.reason }}</text>
     <text v-if="!selected" class="notice">{{ report.basis.policyVersion ? '计量口径版本：' + report.basis.policyVersion : '无已确认聚合口径，保留逐表结果' }}</text>
     <template v-if="selected"><view v-for="(period, i) in selected.periods" :key="i" class="evidence"><text class="meter-name">{{ report.windows.length > 2 ? '区间 ' + (i + 1) : report.windows.length > 1 && i === 0 ? '基期' : '本次区间' }}</text><text>请求 {{ fmtTime(period.requested.from) }} — {{ fmtTime(period.requested.to) }}</text><text>起点 {{ period.sampledFrom ? fmtTime(period.sampledFrom.readTime) + ' · ' + value(period.sampledFrom.value) : '缺测' }}</text><text>终点 {{ period.sampledTo ? fmtTime(period.sampledTo.readTime) + ' · ' + value(period.sampledTo.value) : '缺测' }}</text><text v-for="note in period.notes" :key="note" class="notice">{{ note }}</text></view><text v-if="!selected.periods.length" class="notice">{{ selected.error || '尚未取得有效采样' }}</text><view class="actions"><button @tap="push('history')">查看原始采样</button></view></template>
     <view v-else class="actions"><button @tap="push('meters')">查看逐表依据</button></view>
    </template>
   </view></scroll-view>
  </DeviceSheet>
 </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import DeviceSheet from './DeviceSheet.vue'
import MeterHistoryView from './MeterHistoryView.vue'
import { fmtShanghaiDateTime as fmtTime } from '../observation-view.mjs'
import { energyKindLabel, energyValue as value, energyBusinessChart } from '../energy-business-view.mjs'
const props = defineProps({ report: { type: Object, required: true }, running: Boolean })
const grain = ref('week'), mounted = ref(false), sheetOpen = ref(false), pane = ref('evidence'), selectedId = ref(null), finding = ref(null), stack = ref([])
const grains = [{ key: 'day', label: '日' }, { key: 'week', label: '周' }, { key: 'month', label: '月' }]
const kindLabel = computed(() => energyKindLabel(props.report.kind)), total = computed(() => props.report.summary.total)
const single = computed(() => !total.value && props.report.meters.length === 1 ? props.report.meters[0] : null)
const ratio = computed(() => props.report.summary.ratio ?? last(single.value)?.ratio)
const ratioNote = computed(() => single.value ? last(single.value)?.ratioNote : props.report.summary.ratioNote)
const difference = computed(() => props.report.summary.difference ?? (single.value?.periods.length > 1 && single.value.periods.slice(-2).every(p => p.status === 'comparable') ? last(single.value).usage - single.value.periods.at(-2).usage : null))
const chart = computed(() => energyBusinessChart(props.report, grain.value))
const stateLabel = computed(() => props.report.coverage.status === 'denied' ? '授权失效' : !props.report.coverage.requestedMeters ? '无计量点' : total.value?.status === 'partial' ? '部分结果' : props.report.coverage.status === 'reading' ? props.running ? '读取中' : '已中断' : props.report.coverage.status === 'partial' ? '部分结果' : !total.value && props.report.kind !== 'inspection' ? single.value ? '单位待确认' : '合计待确认' : '完整结果')
const selected = computed(() => props.report.meters.find(m => m.meter.id === selectedId.value))
const paneTitle = computed(() => ({ meters: '电表范围与明细', evidence: '采样依据', history: selected.value ? '原始计量采样' : '选择电表查看采样', findings: '待核查项' })[pane.value])
const historyQuery = computed(() => ({ equipmentId: selectedId.value, from: [...props.report.windows].sort((a,b) => Date.parse(a.from)-Date.parse(b.from))[0]?.from || props.report.requested.from, to: [...props.report.windows].sort((a,b) => Date.parse(b.to)-Date.parse(a.to))[0]?.to || props.report.requested.to }))
const last = row => row?.periods.at(-1)
const meterName = id => props.report.meters.find(m => m.meter.id === id)?.meter.name || '计量点'
function open(view) { pane.value = view; selectedId.value = null; finding.value = null; stack.value = []; mounted.value = true; sheetOpen.value = true }
function push(view) { stack.value.push({ pane: pane.value, id: selectedId.value, finding: finding.value }); pane.value = view }
function openMeter(row) { open('evidence'); selectedId.value = row.meter.id }
function pushMeter(row, history) { push(history ? 'history' : 'evidence'); selectedId.value = row.meter.id; finding.value = null }
function openFinding(item) { open('evidence'); selectedId.value = item.meterId; finding.value = item }
function pushFinding(item) { push('evidence'); selectedId.value = item.meterId; finding.value = item }
function back() { const previous = stack.value.pop(); if (previous) { pane.value = previous.pane; selectedId.value = previous.id; finding.value = previous.finding } }
</script>
<style scoped>
view,text,input{font-size:inherit;line-height:inherit}button{margin:0;padding:0;background:transparent;line-height:1.4}button::after{border:0}.energy-report{color:#35533f;font-size:12px;margin-top:10px}.heading,.coverage,.chart-heading,.list-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.title{font-size:13px;font-weight:600}.badge{font-size:10px;padding:3px 8px;color:#267451;background:#e5f1e3;border-radius:8px}.badge.warning{color:#9a7639;background:#f4eddf}.range{display:block;font-size:17px;font-weight:600;margin-top:12px}.meta,.caption,.small{display:block;color:#81927c;font-size:10px;line-height:1.8}.meta{margin-top:4px}.hero{padding:18px 0 10px}.big{display:block;font-size:29px;font-weight:650;line-height:1.4;font-variant-numeric:tabular-nums}.unit{font-size:12px;color:#7b9074;font-weight:400}.period-fact{padding:10px 0;border-bottom:1px solid #e0e8d9}.period-value{float:right;font-variant-numeric:tabular-nums}.facts{display:flex;gap:18px;margin:0 0 12px}.facts>view{flex:1;font-size:14px;font-weight:600}.notice{display:block;color:#98743c;font-size:11px;line-height:1.8;margin:10px 0}.coverage{padding:10px 0;border-top:1px solid #e0e8d9;border-bottom:1px solid #e0e8d9;font-size:10px;color:#7b8f71}.coverage button{color:#3c7050;min-height:28px;flex-shrink:0;font-size:10px}.chart-heading,.list-heading{font-size:11px;color:#7b8f71;margin-top:16px}.grain{display:flex;background:#eaf0e3;border-radius:8px;padding:3px;gap:2px}.grain button{display:flex;align-items:center;justify-content:center;min-width:28px;height:25px;color:#7b8f71;font-size:10px;border-radius:6px}.grain .active{background:#fafcf7;color:#267451}.chart-scroll{width:100%;margin-top:12px}.chart{width:100%;height:166px;display:block}.axis{display:flex;margin-left:10%;font-size:9px;color:#809477}.axis>text{flex:1;text-align:center;white-space:nowrap}.meter-row{display:flex;align-items:center;gap:10px;width:100%;padding:14px 0;border-bottom:1px solid #e1e8dc;text-align:left;color:#42624b;font-size:11px}.meter-row>view:first-child{flex:1;min-width:0}.meter-name{display:block;font-size:12px;font-weight:600}.row-value{text-align:right;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}.small{font-size:9px;font-weight:400}.finding{width:100%;padding:15px 0;border-bottom:1px solid #e1e8dc;text-align:left;color:#42624b}.more{display:block;color:#427552;font-size:11px;margin-top:10px;min-height:28px}.empty{padding:15px 0}.actions{display:flex;gap:8px;margin-top:15px}.actions button{flex:1;min-height:38px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid #dce6d5;background:#eaf1e4;color:#3c7050;font-size:11px;font-weight:600}.source{margin-top:12px}.details-scroll,.history-pane,.history-host{height:0;flex:1;min-height:0}.history-pane,.history-host{display:flex;flex-direction:column}.details{padding:5px 20px 25px}.evidence{padding:15px 0;border-bottom:1px solid #e0e8d9}.evidence>text{display:block;font-size:11px;line-height:1.9;overflow-wrap:anywhere}.back{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:24px}.pressed{transform:scale(.97)}.row-pressed{background:#eef3e8}button{transition:transform 120ms ease-out}@media(prefers-reduced-motion:reduce){button{transition:none}}
</style>
