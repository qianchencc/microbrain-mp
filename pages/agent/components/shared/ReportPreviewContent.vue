<template>
 <view class="rpc-host">
  <TaskIssueDetails back-in-header style="height:0;min-height:0;flex:1;display:flex;flex-direction:column" v-if="issue" :issue="issue" @close="issue = null" />
  <view class="rpc-evidence" :style="{ display: evidence && !issue ? 'flex' : 'none' }">
   <scroll-view class="rpc-scroll" scroll-y enhanced :show-scrollbar="false">
    <view v-if="evidence" class="rpc-body">
     <view class="rpc-kicker"><text class="rpc-kicker-text">计量依据</text><text class="rpc-pill">生成时保存</text></view>
     <text class="rpc-meta">{{ evidenceSpan }}</text>
     <text class="rpc-evidence-note">生成时保存的计量依据</text>
     <view v-for="(section, index) in evidenceSections" :key="index" class="rpc-sec">
      <text v-if="section.tag" class="rpc-evidence-tag">{{ section.tag }}</text>
      <view v-for="row in section.rows" :key="row.id" class="rpc-basis">
       <view class="rpc-basis-l">
        <text class="rpc-basis-n">{{ row.name }}</text>
        <text v-if="row.label && row.label !== row.name" class="rpc-basis-s">{{ row.label }}</text>
        <text class="rpc-basis-s">{{ row.bounds }}</text>
        <text class="rpc-basis-s">{{ row.statusText }}</text>
       </view>
       <text class="rpc-basis-v">{{ row.valueText }}</text>
      </view>
     </view>
    </view>
   </scroll-view>
  </view>
  <scroll-view class="rpc-scroll" scroll-y enhanced :show-scrollbar="false" :style="{ display: evidence || issue ? 'none' : 'flex' }">
   <view v-if="error" class="rpc-msg"><TaskErrorNotice :message="error" @details="showIssue" /><button class="rpc-btn rpc-retry" @tap="load">重新读取</button></view>
   <view v-else-if="!report" class="rpc-body rpc-skeleton" aria-label="正在读取报告">
    <view class="sk-bar sk-kicker" />
    <view class="sk-bar sk-title" />
    <view class="sk-bar sk-meta w-40" />
    <view class="sk-bar sk-meta w-56" />
    <view class="sk-bar sk-summary" />
    <view class="sk-bar sk-summary w-88" />
    <view class="sk-bar sk-section" />
    <view class="sk-bar sk-row" />
    <view class="sk-bar sk-row w-64" />
    <view class="sk-bar sk-row w-40" />
   </view>
   <view v-else class="rpc-body">
    <view class="rpc-kicker"><text class="rpc-kicker-text">{{ report.checkpointAt ? '检查报告' : '用电报告' }}</text><text class="rpc-pill" :class="{ 'rpc-pill-partial': report.status === 'partial' }">{{ report.status === 'partial' ? '部分完成' : '已完成' }}</text></view>
    <text class="rpc-title">{{ report.title }}</text>
    <text v-if="report.checkpointAt" class="rpc-meta">检查时间 {{ timeText(report.checkpointAt) }}</text>
    <text class="rpc-meta">生成 {{ timeText(report.generatedAt) }}</text>
    <text class="rpc-summary">{{ report.summary }}</text>
    <view v-for="(block, index) in report.blocks" :key="index" class="rpc-sec">
     <template v-if="block.type === 'text'">
      <text v-if="block.title" class="rpc-sec-title">{{ block.title }}</text>
      <text class="rpc-sec-text">{{ block.text }}</text>
     </template>
    <ReportFactSection v-else-if="block.type === 'meter_report'" :report="block.report" @evidence="openEvidence" />
    <template v-else-if="block.type === 'ac_inspection' && acViews[index]">
     <view class="rpc-ac">
      <view class="rpc-ac-head">
       <text class="rpc-sec-title">{{ acViews[index].title }}</text>
       <text v-if="acViews[index].outcomeText" class="rpc-ac-pill" :class="`tone-${acViews[index].outcomeTone}`">{{ acViews[index].outcomeText }}</text>
      </view>
      <text v-if="acViews[index].timeText" class="rpc-ac-meta">{{ acViews[index].timeText }}</text>
      <text class="rpc-ac-meta">{{ acViews[index].modeText }}</text>
      <view v-for="row in acViews[index].rows" :key="row.key" class="rpc-ac-row">
       <text class="rpc-ac-name">{{ row.name }}<text v-if="row.location" class="rpc-ac-loc"> · {{ row.location }}</text></text>
       <text v-if="row.stateText" class="rpc-ac-sub">检查前 {{ row.stateText }}</text>
       <text class="rpc-ac-sub" :class="`tone-${row.tone}`">{{ row.actionText }}<text v-if="row.readbackText"> · {{ row.readbackText }}</text></text>
       <text v-if="row.reason" class="rpc-ac-reason">{{ row.reason }}</text>
      </view>
      <text v-if="!acViews[index].rows.length" class="rpc-ac-sub">本检查点没有取得设备结果</text>
      <view v-if="acViews[index].estimate" class="rpc-ac-estimate">
       <view class="rpc-ac-estimate-head">
        <text class="rpc-ac-estimate-badge">{{ acViews[index].estimate.badge }}</text>
        <text v-if="acViews[index].estimate.valueText" class="rpc-ac-estimate-value">{{ acViews[index].estimate.valueText }}</text>
       </view>
       <text v-if="acViews[index].estimate.costText" class="rpc-ac-sub">{{ acViews[index].estimate.costText }}</text>
       <text v-for="(line, i) in acViews[index].estimate.assumptionTexts" :key="i" class="rpc-ac-sub">{{ line }}</text>
       <text v-if="acViews[index].estimate.calculationText" class="rpc-ac-sub">计算式 {{ acViews[index].estimate.calculationText }}</text>
       <text v-if="acViews[index].estimate.reasonText" class="rpc-ac-sub">{{ acViews[index].estimate.reasonText }}</text>
       <text v-if="acViews[index].estimate.potentialText" class="rpc-ac-sub">{{ acViews[index].estimate.potentialText }}</text>
      </view>
     </view>
    </template>
    </view>
    <view class="rpc-actions">
     <button class="rpc-btn" :disabled="quoting || downloading" @tap="quote">{{ quoting ? '正在读取…' : '引用本报告' }}</button>
     <button class="rpc-btn" :disabled="downloading || quoting" @tap="download('pdf')">{{ downloading === 'pdf' ? '下载中…' : '下载 PDF' }}</button>
     <button class="rpc-btn" :disabled="downloading || quoting" @tap="download('xlsx')">{{ downloading === 'xlsx' ? '下载中…' : '导出表格' }}</button>
    </view>
    <TaskErrorNotice v-if="actionError" :message="actionError" summary="这次操作未完成" @details="showIssue" />
   </view>
  </scroll-view>
 </view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { getReportArtifact, downloadReportArtifact } from '@/apis/agent/reports'
import { getAgentStorageScope } from '@/utils/agent-session'
import { fmtShanghaiDateTime } from '../../lib/observations.mjs'
import { meterReportEvidenceSections, meterReportSpanText } from '../../lib/energy.mjs'
import { acInspectionSectionView } from '../../lib/reports.mjs'
import ReportFactSection from './ReportFactSection.vue'
import TaskIssueDetails from '../tasks/TaskIssueDetails.vue'
import TaskErrorNotice from '../tasks/TaskErrorNotice.vue'

const props = defineProps({ reportId: String, active: Boolean, source: { type: String, default: 'company' } })
const emit = defineEmits(['loaded', 'reference', 'navigation'])
const report = ref(null), error = ref(''), actionError = ref('')
const downloading = ref(''), quoting = ref(false)
const evidence = ref(null), issue = ref(null)
function showIssue(value) { issue.value = value }
let requestId = 0, pageVisible = true

const evidenceSections = computed(() => evidence.value ? meterReportEvidenceSections(evidence.value) : [])
const evidenceSpan = computed(() => evidence.value ? meterReportSpanText(evidence.value) : '')
const acViews = computed(() => (report.value?.blocks || [])
 .map(block => block?.type === 'ac_inspection' ? acInspectionSectionView(block) : null))
const navigation = computed(() => ({ title: issue.value ? '查看原因' : evidence.value ? '计量依据' : '', canBack: Boolean(issue.value || evidence.value) }))
watch(navigation, value => emit('navigation', value), { immediate: true })

function timeText(instant) { return fmtShanghaiDateTime(instant) || '' }
function currentScope() {
 try { return getAgentStorageScope() } catch { return '' }
}
function statusOf(cause) {
 const status = cause?.status ?? cause?.data?.status
 return typeof status === 'number' ? status : 0
}
function requestAlive(current, id, source, scope) {
 return current === requestId && pageVisible && props.active
  && props.reportId === id && props.source === source && scope === currentScope()
}
function clearContent() {
 report.value = null
 evidence.value = null
}
function resetTransient() {
 issue.value = null
 clearContent()
 error.value = ''
 actionError.value = ''
 quoting.value = false
 downloading.value = ''
}
async function load() {
 if (!props.active || !props.reportId || !pageVisible) return
 const current = ++requestId, id = props.reportId, source = props.source, scope = currentScope()
 clearContent()
 error.value = ''; actionError.value = ''
 try {
  const result = await getReportArtifact(id, source)
  if (!requestAlive(current, id, source, scope)) return
  if (!result?.report) throw Object.assign(new Error('报告不存在或没有查看权限'), { status: 404 })
  report.value = result.report
  emit('loaded', result.report)
 } catch (cause) {
  if (!requestAlive(current, id, source, scope)) return
  clearContent()
  const status = statusOf(cause)
  error.value = cause?.message || '报告暂不可用，请重试'
 }
}
function openEvidence(report_) {
 evidence.value = report_
}
function back() {
 if (issue.value) { issue.value = null; return true }
 if (!evidence.value) return false
 evidence.value = null
 return true
}
async function quote() {
 const id = report.value?.id
 if (!id || quoting.value || downloading.value || !props.active || !pageVisible) return
 quoting.value = true; actionError.value = ''
 const current = requestId, source = props.source, scope = currentScope()
 try {
  const result = await getReportArtifact(id, source)
  if (!requestAlive(current, id, source, scope) || report.value?.id !== id) return
  if (!result?.report) throw Object.assign(new Error('报告不存在或没有查看权限'), { status: 404 })
  emit('reference', { type: 'report', reportId: result.report.id, label: result.report.title })
 } catch (cause) {
  if (!requestAlive(current, id, source, scope)) return
  const status = statusOf(cause)
  if (status === 401 || status === 403 || status === 404) { clearContent(); error.value = cause?.message || '报告不存在或没有查看权限' }
  else if (status === 503) { clearContent(); error.value = cause?.message || '暂时没能读取报告' }
  else actionError.value = cause?.message || '引用失败，请重试'
 } finally { if (requestAlive(current, id, source, scope)) quoting.value = false }
}
async function download(format = 'pdf') {
 const id = report.value?.id
 if (!id || downloading.value || quoting.value || !props.active || !pageVisible) return
 downloading.value = format; actionError.value = ''
 const current = requestId, source = props.source, scope = currentScope()
 try {
  await downloadReportArtifact(id, source, format, { isActive: () => requestAlive(current, id, source, scope) && report.value?.id === id })
 } catch (cause) {
  if (!requestAlive(current, id, source, scope) || report.value?.id !== id) return
  const status = statusOf(cause)
  if (status === 401 || status === 403 || status === 404 || cause?.data?.code === 'SCOPE_CHANGED') { clearContent(); error.value = cause?.message || '报告不存在或没有查看权限' }
  else if (status === 503) { clearContent(); error.value = cause?.message || '暂时没能读取报告' }
  else if (cause?.data?.code !== 'REPORT_VIEW_INACTIVE') actionError.value = cause?.message || '下载失败，请重试'
 } finally { if (requestAlive(current, id, source, scope)) downloading.value = '' }
}
onHide(() => { pageVisible = false; ++requestId; resetTransient() })
onShow(() => { pageVisible = true; if (props.active && props.reportId) void load() })
watch(() => [props.active, props.reportId, props.source], ([active]) => {
 ++requestId
 resetTransient()
 if (active) void load()
}, { immediate: true })
onBeforeUnmount(() => { ++requestId; resetTransient() })
defineExpose({ back })
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; border: 0; background: transparent; line-height: 1.4; }
button::after { border: 0; }
.rpc-host { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.rpc-evidence { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.rpc-scroll { flex: 1; min-height: 0; height: 0; }
.rpc-msg { padding: 56px 24px; text-align: center; color: var(--agent-text-muted); font-size: 13px; }
.rpc-body { padding: 4px 20px 34px; }
.rpc-kicker { display: flex; align-items: center; justify-content: space-between; gap: $agent-space-small; margin-top: 8px; }
.rpc-kicker-text { color: var(--agent-text-muted); font-size: 11px; }
.rpc-pill { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; background: var(--agent-success-faint); color: var(--agent-success); font-size: 10px; }
.rpc-pill-partial { background: var(--agent-warning-faint); color: var(--agent-warning); }
.rpc-title { display: block; margin-top: 6px; color: var(--agent-text-primary); font-size: 20px; font-weight: 700; line-height: 1.3; }
.rpc-meta { display: block; margin-top: 4px; color: var(--agent-text-muted); font-size: $agent-font-size-compact; }
.rpc-summary { display: block; margin-top: 12px; color: var(--agent-text-secondary); font-size: 14px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.rpc-sec { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--agent-line); }
.rpc-sec-title { display: block; margin-bottom: 8px; color: var(--agent-text-primary); font-size: 14px; font-weight: 700; }
.rpc-sec-text { display: block; font-size: $agent-font-size-compact; line-height: 1.8; color: var(--agent-text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; }
.rpc-evidence-note { display: block; margin-top: 6px; color: var(--agent-text-muted); font-size: 11px; }
.rpc-evidence-tag { display: block; margin-bottom: 4px; color: var(--agent-text-secondary); font-size: 11px; font-weight: 700; }
.rpc-basis { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--agent-line); }
.rpc-basis-l { flex: 1; min-width: 0; }
.rpc-basis-n { display: block; color: var(--agent-text-primary); font-size: $agent-font-size-compact; font-weight: 600; overflow-wrap: anywhere; }
.rpc-basis-s { display: block; margin-top: 2px; color: var(--agent-text-muted); font-size: 11px; overflow-wrap: anywhere; }
.rpc-basis-v { flex-shrink: 0; color: var(--agent-text-primary); font-size: 13px; font-weight: 650; }
.rpc-ac { display: flex; flex-direction: column; gap: 3px; }
.rpc-ac-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
.rpc-ac-pill { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; background: var(--agent-success-faint); color: var(--agent-success); font-size: 10px; }
.rpc-ac-pill.tone-warn { background: var(--agent-warning-faint); color: var(--agent-warning); }
.rpc-ac-pill.tone-fail { background: var(--agent-error-faint); color: var(--agent-error); }
.rpc-ac-pill.tone-muted { background: var(--agent-surface-page); color: var(--agent-text-muted); }
.rpc-ac-meta { display: block; color: var(--agent-text-muted); font-size: 11px; }
.rpc-ac-row { display: flex; flex-direction: column; gap: 1px; padding: 7px 0; border-bottom: 1px solid var(--agent-line); }
.rpc-ac-name { color: var(--agent-text-primary); font-size: $agent-font-size-compact; font-weight: 600; overflow-wrap: anywhere; }
.rpc-ac-loc { color: var(--agent-text-faint); font-weight: 400; }
.rpc-ac-sub { color: var(--agent-text-secondary); font-size: 11px; overflow-wrap: anywhere; }
.rpc-ac-sub.tone-ok { color: var(--agent-success); }
.rpc-ac-sub.tone-warn { color: var(--agent-warning); }
.rpc-ac-sub.tone-muted { color: var(--agent-text-muted); }
.rpc-ac-reason { color: var(--agent-text-muted); font-size: 11px; overflow-wrap: anywhere; }
.rpc-ac-estimate { display: flex; flex-direction: column; gap: 3px; margin-top: 9px; padding: 9px 10px; border: 1px solid var(--agent-line); border-radius: 9px; background: linear-gradient(var(--agent-surface), var(--agent-surface-page)); }
.rpc-ac-estimate-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rpc-ac-estimate-badge { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; background: var(--agent-warning-faint); color: var(--agent-warning); font-size: 10px; font-weight: 700; }
.rpc-ac-estimate-value { color: var(--agent-text-primary); font-size: 14px; font-weight: 700; }
.rpc-actions { display: flex; gap: 10px; margin-top: 18px; }
.rpc-btn { flex: 1; min-height: 44px; margin: 0; padding: 0; border: 1px solid var(--agent-line); border-radius: 9px; background: linear-gradient(var(--agent-surface), var(--agent-tint)); color: $agent-color-accent; font-size: $agent-font-size-compact; display: flex; align-items: center; justify-content: center; }
.rpc-btn[disabled] { opacity: .55; }
.rpc-retry { flex: 0; padding: 0 18px; margin-top: 12px; }
.rpc-error { display: block; margin-top: 8px; color: var(--agent-error); font-size: 11px; }

.rpc-skeleton { padding-top:18px; }
.sk-bar { height:10px; border-radius:6px; background:var(--agent-tint); animation:sk-pulse 1.25s ease-in-out infinite; }
.sk-kicker { width:34%; height:9px; }
.sk-title { margin-top:12px; width:70%; height:18px; background:var(--agent-tint); }
.sk-meta { margin-top:9px; height:9px; }
.sk-summary { margin-top:14px; height:9px; }
.sk-section { margin-top:22px; width:24%; height:9px; }
.sk-row { margin-top:12px; height:9px; }
.w-40 { width:40%; } .w-56 { width:56%; } .w-64 { width:64%; } .w-88 { width:88%; }
@keyframes sk-pulse { 0%, 100% { opacity:.55; } 50% { opacity:1; } }
@media(prefers-reduced-motion:reduce){ .sk-bar { animation:none; opacity:.8; } }
</style>
