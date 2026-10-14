<template>
 <DeviceSheet :open="open" :back="nativeBack" tall compact-header :title="sheetTitle" @close="closeSheet">
  <template #header-left>
   <button v-if="selectedTask || selectedPlan" class="back-button" aria-label="返回安排列表" @tap="backToList"><uni-icons type="back" size="15" color="#63776a" /></button>
  </template>
  <template #header-right>
   <button v-if="!selectedTask && !selectedPlan" class="refresh-button" aria-label="刷新安排" :disabled="loading" @tap="load"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="16" color="#176b54" /></button>
  </template>
  <view class="arrangements-content">
   <view class="list-pane" :style="{ display: selectedTask || selectedPlan ? 'none' : 'flex' }">
    <view class="view-switch"><SlidingSegments v-model="view" :options="views" /></view>
    <scroll-view class="arrangements-scroll" scroll-y enhanced :show-scrollbar="false">
     <view class="list-summary"><text>{{ listSummary }}</text><text>{{ visibleRows.length }} 项</text></view>
     <view v-if="loading && !listLoaded" class="state-message">加载中…</view>
     <view v-else-if="error && !visibleRows.length" class="state-message"><text>{{ error }}</text><button @tap="load">重试</button></view>
     <view v-else-if="!visibleRows.length" class="state-message">{{ emptyText }}</view>

     <template v-else-if="view === 'plans'">
      <button v-for="plan in plans" :key="plan.planId" class="plan-row" @tap="openPlan(plan)">
       <view class="status-mark" :class="planIsEnabled(plan) ? 'status-mark--active' : 'status-mark--paused'" />
       <view class="row-copy">
        <view class="row-heading"><text class="row-title">{{ plan.label || '未命名周期安排' }}</text><text class="plan-status" :class="planIsEnabled(plan) ? 'tone-active' : 'tone-muted'">{{ planStatus(plan) }}</text></view>
        <text class="row-subtitle">{{ repeatText(plan.repeat) || '重复规则未提供' }}</text>
        <view class="row-meta"><text>{{ plan.nextAt ? `下一次 · ${taskTime(plan.nextAt)}` : '暂无下一次安排' }}</text><text>{{ plan.creator?.displayName || '成员' }} 创建</text></view>
       </view>
       <uni-icons type="right" size="13" color="#99a59d" />
      </button>
     </template>

     <template v-else>
      <button v-for="task in tasks" :key="taskKey(task)" class="task-row" @tap="openTask(task)">
       <view class="row-copy">
        <view class="row-heading"><text class="row-title">{{ task.label || '任务安排' }}</text><text class="task-status" :class="'tone-' + taskTone(task.status)">{{ taskStatus(task.status) }}</text></view>
        <text v-if="task.repeat" class="row-subtitle">{{ repeatText(task.repeat) }}</text>
        <view class="row-meta"><text>{{ taskTime(taskTimeValue(task, view)) || '时间未提供' }}</text><text>{{ task.creator?.displayName || '成员' }}</text></view>
       </view>
       <uni-icons type="right" size="13" color="#99a59d" />
      </button>
     </template>

     <view v-if="error && visibleRows.length" class="list-footer list-error"><text>{{ error }}</text><button @tap="load">重试</button></view>
    </scroll-view>
   </view>

   <view v-if="selectedPlan" class="detail-pane"><text v-if="planLoading" class="list-footer">正在更新…</text>
    <scroll-view class="detail-scroll" scroll-y enhanced :show-scrollbar="false">
     <view class="plan-summary">
      <view class="summary-heading"><view class="status-mark" :class="planIsEnabled(selectedPlan) ? 'status-mark--active' : 'status-mark--paused'" /><text class="plan-label">{{ selectedPlan.label || '未命名周期安排' }}</text></view>
      <text class="summary-status" :class="planIsEnabled(selectedPlan) ? 'tone-active' : 'tone-muted'">{{ planStatus(selectedPlan) }}</text>
      <view class="summary-line"><text>重复规则</text><text>{{ repeatText(selectedPlan.repeat) || '未提供' }}</text></view>
      <view class="summary-line"><text>下一次安排</text><text>{{ selectedPlan.nextAt ? taskTime(selectedPlan.nextAt) : '暂无' }}</text></view>
      <view class="summary-line"><text>创建人</text><text>{{ selectedPlan.creator?.displayName || '成员' }}</text></view>
      <text class="summary-note">{{ planAccessSummary(selectedPlan) }}</text>
      <view v-if="selectedPlan.latestTask" class="latest-result">
       <view class="latest-result-copy"><text class="latest-result-title">最近一次结果</text><text>{{ taskTime(taskTimeValue(selectedPlan.latestTask, 'results')) || '时间未提供' }} · {{ taskStatus(selectedPlan.latestTask.status) }}</text></view>
       <button v-if="selectedPlan.latestTask.id || selectedPlan.latestTask.taskId" class="latest-result-link" @tap="openLatestReport">查看报告 <uni-icons type="right" size="12" color="#176b54" /></button>
      </view>
     </view>
    </scroll-view>
    <view class="detail-actions"><button class="reference-button" @tap="referencePlan"><uni-icons type="chatbubble" size="15" color="#fff" /><text>询问这个计划</text></button><view v-if="selectedPlan.canManage" class="cancel-actions"><button v-if="selectedPlan.nextDate" class="cancel-button" :disabled="planLoading" @tap="cancelWholePlan('occurrence')">取消本次</button><button class="cancel-button" :disabled="planLoading" @tap="cancelWholePlan('all')">取消全部</button></view></view>
   </view>

   <view v-if="selectedTask" class="detail-pane">
    <TaskDetailContent class="task-content-host" :active="open" :task-id="selectedTaskId" :initial-task="selectedTask" :snapshot-scope="loadedScope" :source="source" @reference="emit('reference', $event)" @cancelled="onTaskCancelled" @dismiss="backToList" />
   </view>
  </view>
 </DeviceSheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { getAgentStorageScope } from '@/utils/agent-session'
import { getTaskPlan, cancelTaskPlan, listAgentTasks, listTaskPlans } from '@/apis/agent'
import { repeatText, taskTime } from '../task-detail-view.mjs'
import DeviceSheet from './DeviceSheet.vue'
import SlidingSegments from './SlidingSegments.vue'
import TaskDetailContent from './TaskDetailContent.vue'

const props = defineProps({ open: Boolean, source: { type: String, default: 'office' } })
const emit = defineEmits(['close', 'reference'])
const views = [
 { value: 'upcoming', label: '待执行' },
 { value: 'results', label: '执行结果' },
 { value: 'plans', label: '周期计划' },
]
const view = ref('upcoming')
const tasks = ref([]), plans = ref([])
const loading = ref(false), error = ref(''), planLoading = ref(false)
const listLoaded = ref(false)
const taskRows = new Map()
let plansLoaded = false
const selectedTask = ref(null), selectedPlan = ref(null), returnPlan = ref(null)
const selectedTaskId = computed(() => selectedTask.value?.taskId || selectedTask.value?.id || '')
const sheetTitle = computed(() => selectedTask.value ? '任务报告' : selectedPlan.value ? '周期计划' : '我的安排')
const visibleRows = computed(() => view.value === 'plans' ? plans.value : tasks.value)
const listSummary = computed(() => view.value === 'upcoming' ? '未来 30 天' : view.value === 'results' ? '最近 30 天' : '周期安排')
const emptyText = computed(() => view.value === 'upcoming' ? '未来 30 天没有待执行安排' : view.value === 'results' ? '最近 30 天没有执行结果' : '暂无周期计划')
let requestId = 0, planRequest = 0, loadedScope = '', pageVisible = true
function resetIdentity() { tasks.value = []; plans.value = []; taskRows.clear(); plansLoaded = false; listLoaded.value = false; selectedTask.value = null; selectedPlan.value = null; returnPlan.value = null }
onHide(() => { pageVisible = false; ++requestId; ++planRequest; loading.value = false; planLoading.value = false })
onShow(() => { pageVisible = true; if (props.open) void load() })

function startOfDay(date) {
 const value = new Date(date)
 value.setHours(0, 0, 0, 0)
 return value
}
function dayOffset(date, amount) {
 const value = new Date(date)
 value.setDate(value.getDate() + amount)
 return value
}
function taskRange(kind) {
 const now = new Date()
 const today = startOfDay(now)
 if (kind === 'upcoming') return { from: today.toISOString(), to: dayOffset(today, 31).toISOString() }
 return { from: dayOffset(today, -30).toISOString(), to: now.toISOString() }
}
function taskKey(task) { return task.taskId || task.id || task.occurrence?.id || task.label }
function taskTimeValue(task, kind) {
 if (kind === 'results') return task.report?.generatedAt || task.interval?.endsAt || task.phases?.at(-1)?.endedAt || task.phases?.at(-1)?.at || task.createdAt
 return task.interval?.startsAt || task.phases?.[0]?.at || task.createdAt
}
function taskStatus(status) {
 return ({ scheduled: '待执行', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '执行失败', unconfirmed: '结果待核验', cancelled: '已取消', missed: '已错过', interrupted: '已中断', verified: '已核验', satisfied: '无需执行' })[status] || status || '状态未知'
}
function taskTone(status) {
 if (['failed', 'missed', 'interrupted'].includes(status)) return 'fail'
 if (['partial', 'unconfirmed'].includes(status)) return 'warn'
 if (['completed', 'verified', 'satisfied'].includes(status)) return 'ok'
 if (status === 'cancelled') return 'muted'
 return 'active'
}
function planIsEnabled(plan) { return !['paused', 'disabled', 'ended'].includes(plan?.status) && Boolean(plan?.nextAt) }
function planStatus(plan) {
 if (plan?.status === 'paused' || plan?.status === 'disabled') return '已暂停'
 if (plan?.status === 'ended' || (!plan?.nextAt && plan?.status !== 'paused')) return '周期结束'
 return planIsEnabled(plan) ? '已启用' : '状态待确认'
}
function planAccessSummary(plan) {
 if (plan.canManage) return '可取消本次或全部'
 return '当前账号仅可查看'
}
function selectTaskRows(values, kind) {
 const rows = Array.isArray(values) ? values : []
 const allowed = kind === 'upcoming' ? ['scheduled', 'executing', 'pending'] : ['completed', 'partial', 'failed', 'unconfirmed', 'cancelled', 'missed', 'interrupted', 'verified', 'satisfied']
 return rows.filter(task => (kind !== 'upcoming' || (!task.occurrence && !task.repeat && task.source?.type !== 'recurring_plan'))
   && (allowed.includes(task.status) || (kind === 'results' && Boolean(task.report))))
  .sort((a, b) => {
   const difference = Date.parse(taskTimeValue(a, kind) || '') - Date.parse(taskTimeValue(b, kind) || '')
   return kind === 'results' ? -difference : difference
  })
}

async function load(force = true) {
 if (!props.open || !pageVisible) return
 const current = ++requestId, kind = view.value
 loading.value = true
 error.value = ''
 let scope = ''
 try {
  scope = getAgentStorageScope()
  const source = props.source
  if (scope !== loadedScope) { resetIdentity(); loadedScope = scope }
  tasks.value = taskRows.get(kind) || []
  listLoaded.value = kind === 'plans' ? plansLoaded : taskRows.has(kind)
  if (!force && listLoaded.value) return
  if (kind === 'plans') {
   const result = await listTaskPlans({ source: props.source })
   if (current === requestId && pageVisible && props.open && view.value === kind && source === props.source && scope === getAgentStorageScope()) {
    plans.value = Array.isArray(result?.plans) ? result.plans : []
    plansLoaded = true; listLoaded.value = true
   }
  } else {
   const range = taskRange(kind)
   const result = await listAgentTasks({ source: props.source, ...range })
   if (current === requestId && pageVisible && props.open && view.value === kind && source === props.source && scope === getAgentStorageScope()) {
    tasks.value = selectTaskRows(result?.tasks, kind)
    taskRows.set(kind, tasks.value); listLoaded.value = true
   }
  }
 } catch (cause) {
  if (current === requestId && props.open && view.value === kind) {
   let currentScope = ''
   try { currentScope = getAgentStorageScope() } catch { /* 失效身份不得保留旧列表 */ }
   if (cause.data || !scope || scope !== currentScope) resetIdentity()
   error.value = cause.message || '安排暂不可用'
  }
 } finally {
  if (current === requestId) loading.value = false
 }
}
function openTask(task) {
 if (!taskKey(task)) return
 selectedTask.value = task
 selectedPlan.value = null
}
async function openPlan(plan) {
 const current = ++planRequest, source = props.source, scope = getAgentStorageScope()
 selectedPlan.value = plan; selectedTask.value = null; returnPlan.value = null
 planLoading.value = true
 try {
  const result = await getTaskPlan(plan.planId, source)
  if (current === planRequest && pageVisible && props.open && scope === getAgentStorageScope() && props.source === source && selectedPlan.value?.planId === plan.planId) {
   if (!result.plan) throw new Error('计划不存在或已无权查看')
   selectedPlan.value = result.plan
  }
 } catch (cause) { if (current === planRequest && props.open) { selectedPlan.value = null; error.value = cause.message || '周期计划暂不可用' } }
 finally { if (current === planRequest) planLoading.value = false }
}
function openLatestReport() {
 const task = selectedPlan.value?.latestTask
 if (!task?.id && !task?.taskId) return
 returnPlan.value = selectedPlan.value
 openTask(task)
}
function backToList() {
 ++planRequest; planLoading.value = false
 if (returnPlan.value) {
  selectedPlan.value = returnPlan.value
  returnPlan.value = null
  selectedTask.value = null
  return
 }
 selectedTask.value = null
 selectedPlan.value = null
}
function nativeBack() { if (selectedTask.value || selectedPlan.value) backToList(); else closeSheet() }
function closeSheet() {
 ++planRequest; planLoading.value = false
 selectedTask.value = null
 selectedPlan.value = null
 returnPlan.value = null
 emit('close')
}
function onTaskCancelled() {
 returnPlan.value = null; selectedPlan.value = null; selectedTask.value = null
 void load()
}
async function cancelWholePlan(scopeType) {
 if (!selectedPlan.value?.canManage || planLoading.value) return
 const plan = selectedPlan.value, source = props.source, scope = getAgentStorageScope()
 const title = scopeType === 'all' ? '取消全部' : '取消本次'
 const confirmed = await new Promise(resolve => uni.showModal({ title, content: scopeType === 'all' ? '取消这个周期全部尚未执行的安排；已执行或已下发的动作不会回滚。' : '只取消下一次安排，后续周期照常执行。', confirmText: title, confirmColor: '#a15343', success: result => resolve(result.confirm), fail: () => resolve(false) }))
 if (!confirmed || !props.open || selectedPlan.value?.planId !== plan.planId || source !== props.source || scope !== getAgentStorageScope()) return
 planLoading.value = true
 try {
  await cancelTaskPlan(plan.planId, plan.version, scopeType, scopeType === 'occurrence' ? plan.nextDate : undefined, source)
  backToList(); void load()
 } catch (cause) { error.value = cause.message || '取消失败，请刷新后重试'; uni.showToast({ title: error.value, icon: 'none' }) }
 finally { planLoading.value = false }
}
function referencePlan() {
 if (!selectedPlan.value?.planId) return
 emit('reference', { type: 'task_plan', planId: selectedPlan.value.planId, label: selectedPlan.value.label || '' })
}

watch(() => props.source, () => {
 resetIdentity()
})
watch(() => [props.open, props.source, view.value], ([isOpen, source], previous) => {
 if (isOpen) void load(!previous || !previous[0] || previous[1] !== source)
 else { ++requestId; loading.value = false }
}, { immediate: true })
</script>

<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; border:0; background:transparent; line-height:1.2; }
button::after { border:0; }
.arrangements-content,.list-pane,.detail-pane { min-height:0; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.view-switch { flex-shrink:0; padding:4px 18px 8px; }
.arrangements-scroll,.detail-scroll { height:0; min-height:0; flex:1; box-sizing:border-box; padding:0 18px 14px; }
.list-summary { display:flex; justify-content:space-between; padding:7px 2px 10px; border-bottom:1px solid #e5ebe6; color:#75877b; font-size:11px; }
.plan-row,.task-row { width:100%; min-height:76px; display:flex; align-items:center; gap:11px; padding:12px 2px; border-bottom:1px solid #e8ede9; text-align:left; }
.plan-row:active,.task-row:active { background:#f5f8f5; }
.row-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:4px; }
.row-heading { min-width:0; display:flex; align-items:baseline; justify-content:space-between; gap:9px; }
.row-title { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#304739; font-size:13px; font-weight:600; }
.plan-status,.task-status { flex-shrink:0; font-size:10px; }
.tone-active,.tone-ok { color:#397b61; }.tone-muted { color:#7e8982; }.tone-warn { color:#a27128; }.tone-fail { color:#a15343; }
.row-subtitle { color:#78877e; font-size:11px; line-height:1.45; }
.row-meta { min-width:0; display:flex; justify-content:space-between; gap:8px; color:#929e96; font-size:10px; }
.row-meta text { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.status-mark { width:7px; height:7px; flex-shrink:0; border-radius:50%; background:#b0833c; box-shadow:0 0 0 3px #f5eddf; }
.status-mark--paused { background:#9aa59e; box-shadow:0 0 0 3px #eef1ee; }
.state-message { padding:48px 16px; text-align:center; color:#839189; font-size:13px; }
.state-message text { display:block; overflow-wrap:anywhere; }
.state-message button,.list-footer button { margin:10px auto 0; color:#176b54; font-size:12px; }
.list-footer { padding:16px 0 22px; text-align:center; color:#99a39d; font-size:11px; }
.list-error { color:#a15343; }
.back-button,.refresh-button { width:32px; height:32px; margin-right:8px; border-radius:16px; display:flex; align-items:center; justify-content:center; background:#eff3ef; }
.refresh-button { margin:0 14px 0 0; }
.refresh-button[disabled] { opacity:.5; }
.spinning { animation:arrangements-spin 900ms linear infinite; }
.detail-scroll { padding-top:4px; }
.plan-summary { padding:12px 3px 18px; }
.summary-heading { display:flex; align-items:center; gap:11px; }
.plan-label { min-width:0; color:#263c2e; font-size:17px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
.summary-status { display:block; margin:8px 0 17px 18px; font-size:11px; }
.summary-line { min-height:38px; display:grid; grid-template-columns:82px minmax(0,1fr); align-items:center; gap:12px; border-top:1px solid #e8ede9; font-size:12px; }
.summary-line text:first-child { color:#87948b; }
.summary-line text:last-child { color:#34483b; overflow-wrap:anywhere; text-align:right; }
.summary-note { display:block; padding:11px 0 3px; color:#87948b; font-size:11px; }
.latest-result { margin-top:14px; padding-top:12px; border-top:1px solid #e4eae5; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.latest-result-copy { min-width:0; display:flex; flex-direction:column; gap:4px; color:#87948b; font-size:10px; }
.latest-result-title { color:#4d7663; font-size:11px; font-weight:700; }
.latest-result-link { min-height:32px; flex-shrink:0; display:flex; align-items:center; gap:4px; color:#176b54; font-size:11px; }
.task-content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
.detail-actions { flex-shrink:0; padding:10px 18px 12px; border-top:1px solid #e5ebe6; background:#fbfcfb; }
.reference-button { width:100%; min-height:42px; display:flex; align-items:center; justify-content:center; gap:8px; border-radius:6px; background:linear-gradient(180deg,#28775e,#17634c); color:#fff; font-size:12px; font-weight:600; box-shadow:0 2px 5px #16372816,inset 0 1px 0 #ffffff30; }
.cancel-actions { display:flex; gap:8px; margin-top:10px; }.cancel-button { flex:1; min-width:0; margin:0; height:38px; display:flex; align-items:center; justify-content:center; border:1px solid #ead6d1; border-radius:6px; background:#fff; color:#a15343; font-size:12px; }.cancel-button[disabled] { opacity:.55; }
.reference-button:active { background:#145841; }
@keyframes arrangements-spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; } }
</style>
