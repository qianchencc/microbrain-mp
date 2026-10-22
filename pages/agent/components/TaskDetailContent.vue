<template>
 <scroll-view class="task-scroll" scroll-y enhanced :show-scrollbar="false">
  <view v-if="loading && !detail" class="message">加载中…</view>
  <view v-else-if="error" class="message"><text>{{ error }}</text><button @tap="load()">重新加载</button><button v-if="returnPlan" class="plan-back" @tap="returnToPlan"><uni-icons type="back" size="13" color="#63776a" /> 返回周期安排</button></view>
  <view v-else-if="detail" class="task-detail">
   <button v-if="returnPlan" class="plan-back" @tap="returnToPlan"><uni-icons type="back" size="13" color="#63776a" /> 返回周期安排</button>
   <text class="task-name">{{ detail.label }}</text>
   <text v-if="loading" class="task-when">正在更新…</text>
   <text v-if="detail.repeatText" class="task-when">{{ detail.repeatText }}</text>
   <text v-if="detail.occurrence" class="task-when">{{ detail.occurrence.virtual ? '未来安排 · 尚未开始' : '本次发生' }} · {{ detail.occurrence.date }}</text>
   <text v-if="detail.nextText && !detail.occurrence?.virtual" class="task-when">下一次执行 · {{ detail.nextText }}</text>
   <text class="task-when">{{ detail.whenText }}</text>
   <view class="owner-line"><view class="owner-mark" :class="'cv-' + ownerVariant">{{ creatorMark }}</view><text class="owner-name">{{ plan ? '周期计划' : `${detail.creator?.displayName || '成员'} 创建 · ${detail.createdText}` }}</text><text class="state-tag" :class="detail.status">{{ detail.statusText }}</text></view>
   <view v-if="plan && !sampleTask" class="plan-toggle-row">
    <view class="plan-toggle-copy"><text class="plan-toggle-title">周期计划</text><text class="plan-toggle-note">{{ planIsEnabled(plan) ? '停用后只影响未来发生' : '重新启用前会核验当前范围和绑定' }}</text></view>
    <view v-if="!planCanToggle(plan)" class="plan-switch-wrap plan-switch-wrap--disabled" @tap.stop="explainPlanAccess(plan)">
     <switch :key="`${planSwitchRevision}:${plan.planId}:${planIsEnabled(plan)}`" :checked="planIsEnabled(plan)" disabled />
    </view>
    <switch v-else :key="`${planSwitchRevision}:${plan.planId}:${planIsEnabled(plan)}`" :checked="planIsEnabled(plan)" :disabled="cancelling" @change="togglePlanStatus(plan, $event.detail.value)" />
   </view>
   <text v-if="plan?.pauseReason" class="plan-pause-reason">{{ plan.pauseReason }}</text>
   <view v-if="lightIds.length && !sampleTask" class="current-observation"><text>设备现态 · {{ currentLoading ? '读取中' : currentSummary || '未知' }}</text><button aria-label="刷新设备状态" :disabled="currentLoading" @tap="stateRefresh.run()"><uni-icons :class="{ spinning: currentLoading }" type="refreshempty" size="16" color="#176b54" /></button></view>
   <text v-if="currentError" class="current-error">{{ currentError }}</text>
   <text v-if="actionError" class="action-error">{{ actionError }}</text>
   <text class="section-title">{{ detail.interval ? '检查点' : '阶段' }} · {{ detail.phases.length }}</text>
   <view v-for="(phase, index) in detail.phases" :key="phase.id" class="phase">
    <view class="phase-rail"><view class="phase-node" :class="['tone-' + phase.tone, { ending: !detail.interval && detail.phases.length > 1 && index === 1 }]" /><view v-if="index < detail.phases.length - 1" class="phase-link"><view class="phase-link-fill" :style="{ height: phase.link + '%' }" /></view></view>
    <view class="phase-main">
     <view class="phase-head"><text class="phase-time">{{ phase.clock }}</text><text class="phase-title">{{ phase.title }}</text><text class="phase-status" :class="'tone-' + phase.tone">{{ phase.statusText }}</text></view>
     <template v-if="source === 'company' && phase.readAgent">
      <text class="task-when">{{ phase.readAgent.objectiveText }}</text>
      <text v-if="phase.readAgent.periodText" class="task-when">{{ phase.readAgent.periodText }}</text>
      <text v-if="phase.readAgent.comparisonText" class="task-when">{{ phase.readAgent.comparisonText }}</text>
     </template>
     <template v-else-if="source === 'company' && phase.readAc">
      <text class="task-when">{{ phase.readAc.summary }}</text>
      <text class="task-when">{{ phase.readAc.criteriaText }}</text>
      <text v-if="phase.readAc.cadenceText" class="task-when">{{ phase.readAc.cadenceText }}</text>
      <text class="task-when">{{ phase.readAc.actionText }}</text>
     </template>
     <ObservationCard v-if="phase.observations?.length" :observation="{ observedAt: phase.endedAt || phase.at, blocks: phase.observations }" :source="source" inline-playback read-only @select-alert="$emit('select-alert', $event)" @browse-alerts="$emit('browse-alerts')" />
     <text v-if="phase.failureReason" class="phase-reason">{{ phase.failureReason }}</text>
     <button v-if="phase.report" class="phase-report" :aria-label="`打开检查点报告 ${phase.report.title || ''}`" @tap="emit('open-report', phase.report)">
      <uni-icons type="compose" size="13" color="#176b54" />
      <text class="phase-report-title">{{ phase.report.title || '检查点报告' }}</text>
      <text v-if="phase.report.status === 'partial'" class="phase-report-tag">部分完成</text>
      <uni-icons type="right" size="12" color="#99a59d" />
     </button>
     <button v-if="phase.devices.length > 1" class="phase-devices" :aria-label="`${expandedPhases.includes(phase.id) ? '收起' : '展开'} ${phase.devices.length} 台设备`" :aria-expanded="expandedPhases.includes(phase.id)" @tap="togglePhase(phase.id)">
      <view class="phase-avatars"><view v-for="device in phase.devices.slice(0, 5)" :key="device.id" class="phase-avatar"><image v-if="device.artwork" :src="device.artwork" mode="aspectFit" /><uni-icons v-else type="gear" size="12" color="#7c8d82" /></view></view>
      <text class="phase-device-count">{{ phase.devices.length }} 台设备</text><uni-icons :type="expandedPhases.includes(phase.id) ? 'down' : 'right'" size="13" color="#839189" />
     </button>
     <view v-if="phase.devices.length <= 1 || expandedPhases.includes(phase.id)" class="device-list">
      <view v-for="device in phase.devices" :key="device.id" class="device-row">
       <text class="device-name">{{ device.name }}</text><text class="target">{{ device.targetText }}</text><text class="result" :class="device.resultTone">{{ device.resultText }}</text>
       <text v-if="device.kind === 'lighting' && currentStates[device.id]" class="current-device">现态：{{ currentStates[device.id].state === true ? '开启' : currentStates[device.id].state === false ? '关闭' : '未知' }}</text>
      </view>
      <text v-if="!phase.devices.length" class="no-devices">当前没有可查看的设备</text>
     </view>
    </view>
   </view>
   <view v-if="detail.report" class="task-report">
    <text class="report-title">执行报告 · {{ detail.report.generatedText }}</text>
    <text class="report-summary">{{ detail.report.outcomeText }} · {{ detail.report.checkpoints }} 个检查点 · {{ detail.report.devicesVisible }} 台设备</text>
    <text v-if="detail.report.summary" class="report-summary">{{ detail.report.summary.checkpointsText }} · {{ detail.report.summary.devicesText }}</text>
    <template v-if="detail.report.summary?.energy">
     <button v-if="detail.report.summary.energy.basis" class="report-energy-toggle" :aria-expanded="energyBasisOpen" @tap="energyBasisOpen = !energyBasisOpen">
      <text class="report-energy energy-warn energy-toggle-text">{{ detail.report.summary.energy.text }}</text>
      <text class="energy-tag">{{ detail.report.summary.energy.tag }}</text>
      <uni-icons :type="energyBasisOpen ? 'down' : 'right'" size="11" color="#a27128" />
     </button>
     <text v-else class="report-energy" :class="'energy-' + detail.report.summary.energy.tone">{{ detail.report.summary.energy.text }}</text>
     <view v-if="energyBasisOpen && detail.report.summary.energy.basis" class="energy-basis"><text v-for="line in detail.report.summary.energy.basis" :key="line" class="energy-basis-line">{{ line }}</text></view>
    </template>
   </view>
   <view v-if="plan && latestReport" class="task-report">
    <text class="report-title">最近一次执行 · {{ latestReport.generatedText }}</text>
    <text class="report-summary">{{ latestReport.outcomeText }} · {{ latestReport.checkpoints }} 个检查点 · {{ latestReport.devicesVisible }} 台设备</text>
    <button class="latest-report-link" @tap="openLatestReport">查看最近一次报告</button>
   </view>
   <view class="source"><text>{{ detail.sourceText }}</text><text v-if="detail.source?.conversationId">对话 {{ detail.source.conversationId.slice(0, 8) }}</text></view>
   <view v-if="!sampleTask" class="reference-actions"><button class="task-reference" @tap="referenceCurrent">{{ plan ? '询问这个计划' : '引用任务并询问' }}</button></view>
   <button v-if="!sampleTask && !loading && (detail.canCancel || (task?.occurrence?.virtual && detailMine && task.status !== 'cancelled'))" class="task-delete" :disabled="cancelling" :loading="cancelling" @tap="task?.occurrence?.virtual ? cancelPeriod('occurrence') : deleteTask()">{{ task?.occurrence ? '取消本次' : '取消任务' }}</button>
   <button v-if="!sampleTask && (plan?.canManage || (task?.occurrence && detailMine))" class="task-delete" :disabled="cancelling" :loading="cancelling" @tap="cancelPeriod('all')">取消全部</button>
  </view>
 </scroll-view>
</template>
<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { cancelTask, cancelTaskPlan, getTaskDetail, getTaskLightingStates, getTaskPlan, setTaskPlanStatus } from '@/apis/agent'
import { taskDetailView, taskPlanSnapshot, taskTime } from '../task-detail-view.mjs'
import { onShow, onHide } from '@dcloudio/uni-app'
import { getAgentStorageScope } from '@/utils/agent-session'
import { createStateRefresh } from '../state-refresh.mjs'
import { creatorVariant } from '../region-device-view.mjs'
import ObservationCard from './ObservationCard.vue'

const props = defineProps({ active: Boolean, taskId: String, planId: String, sampleTask: Object, initialTask: Object, snapshotScope: String, source: { type: String, default: 'office' } })
const emit = defineEmits(['cancelled', 'changed', 'loaded', 'report-open', 'open-report', 'plan-return', 'reference', 'dismiss', 'select-alert', 'browse-alerts'])
const task = ref(null), plan = ref(null), returnPlan = ref(null)
const activeTaskId = ref(''), activePlanId = ref('')
const loading = ref(false), error = ref(''), actionError = ref(''), cancelling = ref(false), planSwitchRevision = ref(0)
const detailFresh = ref(false)
const currentStates = ref({}), currentLoading = ref(false), currentError = ref('')
const expandedPhases = ref([]), energyBasisOpen = ref(false)
const detail = computed(() => {
 const view = taskDetailView(task.value || taskPlanSnapshot(plan.value))
 if (plan.value && view) return { ...view, statusText: ({ enabled: plan.value.nextAt ? '已启用' : '周期结束', paused: '已停用', deleted: '已删除' })[plan.value.status] || (plan.value.nextAt ? '已启用' : '周期结束') }
 return view
})
function referenceCurrent() {
 if (plan.value) emit('reference', { type: 'task_plan', planId: plan.value.planId, label: plan.value.label })
 else if (task.value) emit('reference', { type: 'task', taskId: task.value.id, label: task.value.label })
}
function planIsEnabled(value) { return value?.status === 'enabled' && Boolean(value.nextAt) }
function planCanToggle(value) {
 if (value?.status === 'enabled') return Boolean(value.canPause)
 if (value?.status === 'paused') return Boolean(value.canResume)
 return false
}
function explainPlanAccess(value) {
 if (!value || ['ended', 'deleted'].includes(value.status)) return
 uni.showToast({ title: '需使用创建者账号，且当前范围覆盖全部设备才能管理', icon: 'none' })
}
function planStatusContextCurrent(planId, source, scope, version, action) {
 if (action !== planStatusRequest || !props.active || props.source !== source || activePlanId.value !== planId || plan.value?.planId !== planId) return false
 let currentScope = ''
 try { currentScope = getAgentStorageScope() } catch { return false }
 return currentScope === scope && plan.value.version === version
}
function resumeContent(value) {
 const next = value?.resumeNextAt ? taskTime(value.resumeNextAt) : ''
 return `下一次执行：${next || '暂无未来发生'}。将重新核验当前完整范围和控制绑定，从下一次未来发生继续，不补过去安排。`
}
async function togglePlanStatus(value, enabled) {
 if (!value?.planId || !planCanToggle(value) || cancelling.value) return
 const action = ++planStatusRequest, operation = enabled ? 'resume' : 'pause', planId = value.planId, version = value.version
 const source = props.source, scope = getAgentStorageScope()
 const title = operation === 'resume' ? '重新启用' : '停用周期计划'
 const content = operation === 'resume'
  ? resumeContent(value)
  : '只停用未来发生；已经生成、执行中或已下发的本次不回滚。'
 const confirmed = await new Promise(resolve => uni.showModal({ title, content, confirmText: title, confirmColor: operation === 'resume' ? '#176b54' : '#a15343', success: result => resolve(result.confirm), fail: () => resolve(false) }))
 if (!confirmed) {
  if (planStatusContextCurrent(planId, source, scope, version, action)) planSwitchRevision.value += 1
  return
 }
 if (!planStatusContextCurrent(planId, source, scope, version, action)) return
 cancelling.value = true; actionError.value = ''
 try {
  const result = await setTaskPlanStatus(planId, version, operation, source, operation === 'resume')
  if (!planStatusContextCurrent(planId, source, scope, version, action)) return
  if (result?.plan) plan.value = result.plan
  planSwitchRevision.value += 1
  emit('changed')
  uni.showToast({ title: operation === 'resume' ? '已重新启用' : '已停用未来发生', icon: 'none' })
 } catch (cause) {
  if (!planStatusContextCurrent(planId, source, scope, version, action)) return
  planSwitchRevision.value += 1
  actionError.value = cause.message || '状态更新失败，请刷新后重试'
 } finally { if (action === planStatusRequest) cancelling.value = false }
}
async function cancelPeriod(scope) {
 if (cancelling.value) return
 const planId = plan.value?.planId || task.value?.occurrence?.planId, date = task.value?.occurrence?.date
 const source = props.source, identity = getAgentStorageScope()
 if (!planId) return
 cancelling.value = true; actionError.value = ''
 try {
  const result = await getTaskPlan(planId, source)
  if (!result.plan?.canManage) throw new Error('当前无权取消这个周期')
  const title = scope === 'all' ? '取消全部' : '取消本次'
  const confirmed = await new Promise(resolve => uni.showModal({ title, content: scope === 'all'
   ? '取消这个周期全部尚未执行的安排；已执行或已下发的动作不会回滚。'
   : '只取消这一次，后续周期照常执行。', confirmText: title, confirmColor: '#a15343', success: value => resolve(value.confirm), fail: () => resolve(false) }))
  if (!confirmed || !props.active || source !== props.source || identity !== getAgentStorageScope()
    || planId !== (plan.value?.planId || task.value?.occurrence?.planId)) return
  await cancelTaskPlan(planId, result.plan.version, scope, date, source)
  emit('cancelled'); emit('dismiss')
 } catch (cause) { actionError.value = cause.message || '取消失败，请刷新后重试' }
 finally { cancelling.value = false }
}
const latestReport = computed(() => taskDetailView(plan.value?.latestTask)?.report || null)
// 来源 draft/conversation id 只对创建者返回；等价于“我创建的任务”，用于创建者标记显示“我”。
const detailMine = computed(() => Boolean(detail.value?.source?.draftId || detail.value?.source?.conversationId))
const creatorMark = computed(() => detailMine.value ? '我' : (detail.value?.creator?.displayName || '').slice(0, 1))
const ownerVariant = computed(() => creatorVariant(detail.value?.creator?.displayName, detailMine.value))
const lightIds = computed(() => props.source === 'office' ? [...new Set((detail.value?.phases || []).flatMap(phase => phase.devices.filter(device => device.kind === 'lighting').map(device => device.id)))] : [])
const currentSummary = computed(() => {
 const known = lightIds.value.filter(id => typeof currentStates.value[id]?.state === 'boolean')
 const on = known.filter(id => currentStates.value[id].state).length
 const unknown = lightIds.value.length - known.length
 return [on && `${on} 开启`, known.length - on && `${known.length - on} 关闭`, unknown && `${unknown} 未知`].filter(Boolean).join(' · ')
})
let requestId = 0, currentRequestId = 0, planStatusRequest = 0, refreshTimer, observedTaskId = '', pageVisible = true, wasHidden = false, detailScope = ''
function startPolling() {
 clearInterval(refreshTimer)
 if (props.active && pageVisible && !props.sampleTask) refreshTimer = setInterval(() => {
  if (activePlanId.value || ['scheduled', 'executing'].includes(task.value?.status)) load(true)
 }, 10000)
}
onHide(() => { pageVisible = false; wasHidden = true; clearInterval(refreshTimer); stateRefresh.cancel(); ++requestId; ++currentRequestId; ++planStatusRequest; loading.value = false; currentLoading.value = false; cancelling.value = false; planSwitchRevision.value += 1 })
onShow(() => {
 pageVisible = true
 let scope = ''
 try { scope = getAgentStorageScope() } catch { /* 失效身份不保留上一人的报告 */ }
 if (scope !== detailScope) { ++planStatusRequest; task.value = null; plan.value = null; returnPlan.value = null; currentStates.value = {}; expandedPhases.value = []; cancelling.value = false; planSwitchRevision.value += 1 }
 if (wasHidden && props.active) { load(true); startPolling() }
 wasHidden = false
})
function togglePhase(id) {
 expandedPhases.value = expandedPhases.value.includes(id) ? expandedPhases.value.filter(value => value !== id) : [...expandedPhases.value, id]
}
async function load(silent = false) {
 const current = ++requestId, taskId = activeTaskId.value, planId = activePlanId.value
 let loaded = false
 let scope = ''
 try { scope = getAgentStorageScope() } catch { /* 接口仍负责展示身份错误 */ }
 if (scope !== detailScope) { task.value = null; plan.value = null; returnPlan.value = null; currentStates.value = {}; expandedPhases.value = [] }
 detailScope = scope
 if (!pageVisible || !props.active || (!taskId && !planId)) return
 if (!silent) {
  const snapshot = props.initialTask
  task.value = snapshot?.id === taskId && snapshot.agentSource === props.source && props.snapshotScope === scope && scope ? snapshot : null
  plan.value = null; error.value = ''; loading.value = false; detailFresh.value = false
 }
 if (props.sampleTask) { task.value = props.sampleTask; return }
 if (!silent) loading.value = true
 try {
  if (planId) {
   const result = await getTaskPlan(planId, props.source)
   if (current === requestId && pageVisible && props.active && activePlanId.value === planId && scope === getAgentStorageScope()) {
    if (!result?.plan) { plan.value = null; error.value = '周期计划不存在或没有查看权限'; return }
    error.value = ''
    plan.value = result.plan
   }
  } else {
   const result = await getTaskDetail(taskId, props.source)
   if (current === requestId && pageVisible && props.active && activeTaskId.value === taskId && scope === getAgentStorageScope()) {
    if (!result?.task) { task.value = null; currentStates.value = {}; error.value = '任务不存在或没有查看权限'; return }
    const previousPhases = new Map((task.value?.phases || []).map(phase => [phase.id, phase.status]))
    error.value = ''
    task.value = result.task
    detailFresh.value = true
    loaded = true
    if (props.source === 'office' && result.task.phases.some(phase => phase.devices.some(device => device.kind === 'lighting'))) {
     if (!silent) void stateRefresh.auto()
     else if (result.task.phases.some(phase => ['pending', 'executing'].includes(previousPhases.get(phase.id)) && !['pending', 'executing'].includes(phase.status))) stateRefresh.after(1000)
    }
   }
  }
 } catch (cause) { if (current === requestId && pageVisible && scope === detailScope) {
  let currentScope = ''
  try { currentScope = getAgentStorageScope() } catch { /* 失效身份不得保留旧报告 */ }
  if (cause.data || !scope || scope !== currentScope) { task.value = null; plan.value = null; currentStates.value = {} }
  error.value = cause.message || (planId ? '周期计划读取失败：未取得具体原因' : '任务读取失败：未取得具体原因')
 } }
 finally { if (!silent && current === requestId) loading.value = false }
 if (loaded) {
  await nextTick()
  if (current === requestId && pageVisible && props.active && activeTaskId.value === taskId && scope === getAgentStorageScope()) emit('loaded', taskId)
 }
}
async function loadCurrentStates(taskId = activeTaskId.value) {
 const current = ++currentRequestId
 if (!pageVisible || !props.active || !taskId || props.sampleTask || props.source !== 'office') return
 currentError.value = ''; currentLoading.value = true
 try {
  const result = await getTaskLightingStates(taskId)
  if (current === currentRequestId && pageVisible && props.active && activeTaskId.value === taskId) {
   currentStates.value = Object.fromEntries((result.states || []).map(state => [state.id, state]))
  }
 } catch (cause) { if (current === currentRequestId) { currentStates.value = {}; currentError.value = cause.message || '当前状态暂不可用' } }
 finally { if (current === currentRequestId) currentLoading.value = false }
}
const stateRefresh = createStateRefresh(() => loadCurrentStates(activeTaskId.value))
function openLatestReport() {
 if (!plan.value?.latestTask?.id) return
 returnPlan.value = plan.value
 activePlanId.value = ''
 activeTaskId.value = plan.value.latestTask.id
 emit('report-open')
 void load()
}
function returnToPlan() {
 if (!returnPlan.value) return
 ++requestId
 plan.value = returnPlan.value
 returnPlan.value = null
 task.value = null
 activeTaskId.value = ''
 activePlanId.value = plan.value.planId
 error.value = ''
 loading.value = false
 emit('plan-return')
}
async function deleteTask() {
 if (!detail.value?.canCancel || cancelling.value) return
 const taskId = activeTaskId.value, version = task.value.version
 const settledInterval = detail.value?.interval && !detail.value.phases.some(phase => phase.status === 'pending')
 const title = task.value.occurrence ? '取消本次' : '取消任务'
 const confirmed = await new Promise(resolve => uni.showModal({ title,
  content: settledInterval ? '结束剩余区间；已发生动作不会回滚。'
   : `${detail.value?.interval ? '未执行的检查点' : '未执行的阶段'}将取消；已经执行的设备动作不会回滚。${task.value.occurrence ? '后续周期照常执行。' : ''}`, confirmText: title, confirmColor: '#a15343',
  success: result => resolve(result.confirm), fail: () => resolve(false) }))
 if (!confirmed || !props.active || activeTaskId.value !== taskId) return
 cancelling.value = true; actionError.value = ''
 try {
  await cancelTask(taskId, version, props.source)
  await load(true)
  emit('cancelled'); emit('dismiss')
 } catch (cause) {
  actionError.value = cause.message || '取消失败，请刷新后重试'
  await load(true)
 } finally { cancelling.value = false }
}
watch(() => [props.active, props.taskId, props.planId, props.sampleTask, props.source], () => {
 ++planStatusRequest; planSwitchRevision.value += 1
 clearInterval(refreshTimer)
 stateRefresh.cancel(); ++currentRequestId; currentLoading.value = false; currentError.value = ''
 activeTaskId.value = props.taskId || ''
 activePlanId.value = props.planId || ''
 returnPlan.value = null
 if (observedTaskId !== activeTaskId.value || props.sampleTask) currentStates.value = {}
 if (props.source !== 'office') currentStates.value = {}
 observedTaskId = activeTaskId.value || activePlanId.value
 actionError.value = ''
 expandedPhases.value = []
 energyBasisOpen.value = false
 if (props.active) {
  load()
  startPolling()
 }
 else { ++requestId; loading.value = false; cancelling.value = false } // 保留关闭动画的结果快照；下次打开由 load 重新读取。
}, { immediate: true })
onUnmounted(() => { clearInterval(refreshTimer); stateRefresh.cancel(); ++currentRequestId; ++requestId; ++planStatusRequest })
defineExpose({ returnToPlan })
</script>
<style scoped>
.reference-actions { margin-top:16px; display:flex; flex-direction:column; gap:8px; }.task-reference { min-height:42px; width:100%; display:flex; align-items:center; justify-content:center; border:1px solid #cadcd1; border-radius:9px; background:linear-gradient(#fafffb,#edf5ef); color:#176b54; font-size:12px; }.task-reference.secondary { background:transparent; color:#6a7f70; }
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:12px auto 0; padding:0; background:transparent; color:#176b54; font-size:12px; }
button::after { border:0; }
.task-scroll { flex:1; min-height:0; height:0; }
.message { padding:56px 24px; text-align:center; color:#839189; font-size:13px; }
.message text { display:block; }
.task-detail { padding:10px 20px 34px; }
.task-name { display:block; color:#263c2e; font-size:18px; font-weight:700; line-height:1.35; }
.plan-back { display:flex; align-items:center; gap:4px; min-height:30px; margin:0 0 8px; color:#63776a; font-size:11px; }
.task-when { display:block; margin-top:5px; color:#75877b; font-size:12px; }
.owner-line { display:flex; align-items:center; gap:8px; margin-top:13px; }
.owner-mark { width:25px; height:25px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,#3a9478,#11553f); color:#fff; font-size:11px; font-weight:600; }
.owner-mark.cv-brass { background:linear-gradient(145deg,#d9b06c,#a87c33); }
.owner-mark.cv-slate { background:linear-gradient(145deg,#8fa7b8,#5d7484); }
.owner-mark.cv-grey { background:linear-gradient(145deg,#a9b0aa,#7a817b); }
.owner-name { min-width:0; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#718176; font-size:11px; }
.state-tag { flex-shrink:0; padding:4px 8px; border-radius:8px; color:#4d7663; background:#eaf3ed; font-size:11px; }
.state-tag.partial,.state-tag.unconfirmed { color:#936827; background:#f9f0df; }
.state-tag.failed,.state-tag.interrupted,.state-tag.missed { color:#a15343; background:#f2e3e0; }
.state-tag.cancelled { color:#7a7f76; background:#eef1ef; }
.plan-toggle-row { margin-top:14px; padding-top:12px; border-top:1px solid #e8ede9; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.plan-switch-wrap { min-width:52px; min-height:32px; display:flex; align-items:center; justify-content:flex-end; }
.plan-switch-wrap--disabled { opacity:.72; }
.plan-toggle-copy { min-width:0; display:flex; flex-direction:column; gap:4px; }
.plan-toggle-title { color:#34483b; font-size:12px; font-weight:600; }
.plan-toggle-note { color:#87948b; font-size:10px; }
.plan-pause-reason { display:block; margin-top:6px; color:#a27128; font-size:11px; }
.current-observation { min-height:32px; margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:8px; color:#4a6654; font-size:11px; }
.current-observation button { width:32px; height:32px; margin:0; display:flex; align-items:center; justify-content:center; }
.current-observation button[disabled] { opacity:.5; }
.current-error { display:block; color:#a15343; font-size:11px; }
.spinning { animation:state-spin 900ms linear infinite; }
@keyframes state-spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce){.spinning{animation:none}}
.section-title { display:block; margin:18px 0 9px; font-size:11px; font-weight:700; color:#75877b; }
.phase { display:flex; gap:11px; }
.phase-rail { width:16px; display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
.phase-node { width:14px; height:14px; margin-top:3px; border:2px solid #89a395; box-sizing:border-box; border-radius:50%; background:#fff; }
.phase-node.tone-ok { background:#176b54; border-color:#176b54; box-shadow:inset 0 0 0 3px white; }
.phase-node.tone-warn { background:#ad711b; border-color:#ad711b; box-shadow:inset 0 0 0 3px white; }
.phase-node.tone-fail { background:#a15343; border-color:#a15343; box-shadow:inset 0 0 0 3px white; }
.phase-node.tone-active { border-color:#176b54; background:#fff; }
.phase-node.tone-off { border-color:#aab4ac; }
.phase-node.ending { background:#fff; }
.phase-link { width:3px; min-height:25px; flex:1; border-radius:2px; background:#dde5df; overflow:hidden; }
.phase-link-fill { width:100%; background:linear-gradient(#3c8a68,#8fb9a4); }
.phase-main { flex:1; min-width:0; padding-bottom:18px; }
.phase-head { display:flex; align-items:baseline; gap:7px; min-width:0; }
.phase-time { color:#263c2e; font-size:12px; font-weight:700; }
.phase-title { color:#839189; font-size:11px; }
.phase-status { margin-left:auto; flex-shrink:0; color:#839189; font-size:11px; }
.phase-status.tone-ok { color:#397b61; }
.phase-status.tone-warn { color:#a27128; }
.phase-status.tone-fail { color:#a15343; }
.phase-status.tone-active { color:#176b54; }
.phase-status.tone-off { color:#8a8f86; }
.phase-reason { display:block; margin-top:5px; color:#a27128; font-size:11px; }
.phase-report { width:100%; min-height:44px; margin:9px 0 0; padding:6px 10px; border:1px solid #dbe7de; border-radius:8px; display:flex; align-items:center; gap:7px; background:linear-gradient(#fdfefd,#f4f8f4); text-align:left; }
.phase-report:active { background:#eef4ef; }
.phase-report-title { flex:1; min-width:0; color:#2f5240; font-size:12px; font-weight:600; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.phase-report-tag { flex-shrink:0; color:#a27128; font-size:10px; }
.phase-devices { width:100%; min-height:38px; margin:9px 0 0; padding:5px 9px; border:1px solid #e0e9e1; border-radius:8px; display:flex; align-items:center; gap:8px; background:#f9fbf9; text-align:left; }
.phase-avatars { display:flex; align-items:center; flex-shrink:0; padding-left:5px; }
.phase-avatar { width:22px; height:22px; margin-left:-5px; border:1px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#edf2ee; }
.phase-avatar image { width:22px; height:22px; }
.phase-device-count { flex:1; min-width:0; color:#718176; font-size:11px; }
.device-list { margin-top:9px; border-top:1px solid #e2e9e3; animation:listIn 160ms cubic-bezier(.23,1,.32,1) backwards; }
@keyframes listIn { from { opacity:0; transform:translateY(4px); } }
.device-row { padding:9px 0; border-bottom:1px solid #e2e9e3; display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:8px; row-gap:3px; }
.device-name { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#304b39; font-size:12px; font-weight:600; }
.target { color:#63796b; font-size:11px; text-align:right; }
.result { grid-column:1/-1; font-size:11px; }
.current-device { grid-column:1/-1; color:#507764; font-size:10px; }
.result.ok { color:#397b61; }.result.warn { color:#a27128; }.result.fail { color:#a15343; }.result.wait { color:#839189; }
.no-devices { display:block; padding:12px 0; color:#839189; font-size:11px; }
.task-report { margin-top:14px; padding:12px 14px; border:1px solid #e0e9e1; border-radius:10px; background:linear-gradient(#fdfefd,#f6f8f5); box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(28,57,42,.05); }
.latest-report-link { width:100%; margin:8px 0 0; color:#176b54; font-size:11px; text-align:left; }
.report-title { display:block; color:#4d7663; font-size:11px; font-weight:700; }
.report-summary { display:block; margin-top:5px; color:#263c2e; font-size:12px; font-weight:600; }
.report-energy { display:block; margin-top:5px; font-size:11px; line-height:1.4; }
.report-energy.energy-ok { color:#397b61; }
.report-energy.energy-warn { color:#a27128; }
.report-energy.energy-muted { color:#7e8982; }
.report-energy-toggle { width:100%; margin:5px 0 0; padding:5px 0 0; display:flex; align-items:baseline; gap:6px; text-align:left; }
.energy-toggle-text { flex:1; min-width:0; margin-top:0; }
.energy-tag { flex-shrink:0; padding:2px 6px; border-radius:6px; background:#f7efdd; color:#936827; font-size:9px; }
.energy-basis { margin-top:6px; padding:7px 9px; border-top:1px solid #eadfc9; display:flex; flex-direction:column; gap:4px; }
.energy-basis-line { color:#8a7a5c; font-size:10px; line-height:1.45; }
.report-note { display:block; margin-top:5px; color:#85958a; font-size:11px; }
.source { display:flex; justify-content:space-between; gap:8px; padding-top:14px; border-top:1px solid #e2e9e3; color:#85958a; font-size:11px; }
.task-delete { width:100%; height:38px; margin:18px 0 0; border:1px solid #ead6d1; border-radius:8px; background:#fff; color:#a15343; font-size:12px; line-height:36px; }
.task-delete[disabled] { opacity:.55; }
.action-error { display:block; margin-top:10px; color:#a15343; font-size:11px; }
@media(prefers-reduced-motion:reduce){.device-list{animation:none}}
</style>
