<template>
 <DeviceSheet :open="open" :back="nativeBack" tall compact-header :title="(view === 'inbox' ? inboxNavigation.title : navigation.title) || sheetTitle" @close="closeSheet">
  <template #header-left>
   <button v-if="selectedTask || selectedPlan || inboxNavigation.canBack || stackedView" class="back-button" aria-label="返回上一级" @tap="goBack"><uni-icons type="back" size="15" color="#63776a" /></button>
  </template>
  <template #header-right>
   <button v-if="!selectedTask && !selectedPlan && view !== 'inbox'" class="refresh-button" aria-label="刷新安排" :disabled="loading" @tap="load"><uni-icons :class="{ spinning: loading }" type="refreshempty" size="16" color="#176b54" /></button>
   <button v-if="source === 'company' && !selectedTask && !selectedPlan && view !== 'inbox'" class="refresh-button inbox-button" aria-label="通知中心" @tap="view = 'inbox'"><uni-icons type="email" size="16" color="#176b54" /><text v-if="inboxUnread" class="inbox-badge">{{ inboxUnread > 99 ? '99+' : inboxUnread }}</text></button>
  </template>
  <view class="arrangements-content">
   <view class="list-pane" :style="{ display: selectedTask || selectedPlan ? 'none' : 'flex' }">
    <view v-if="!inboxNavigation.canBack && !stackedView" class="view-switch"><SlidingSegments v-model="view" :options="views" /></view>
    <TaskInboxContent v-if="source === 'company' && view === 'inbox'" ref="inbox" class="task-content-host" :open="open && view === 'inbox' && !selectedTask && !selectedPlan" :source="source" @navigation="inboxNavigation = $event" @reference="emit('reference', $event)" @unread-count="inboxUnread = $event; emit('unread-count', $event)" @changed="emit('changed')" />
    <scroll-view v-else class="arrangements-scroll" scroll-y enhanced :show-scrollbar="false">
     <TaskCalendarView v-if="source === 'company' && view === 'calendar'" ref="calendar" :active="open && view === 'calendar' && !selectedTask && !selectedPlan" :date="selectedDate" :refresh-key="refreshKey" source="company" @date-change="selectedDate = $event" @select-task="openTask" />
     <template v-else>
     <button v-if="view === 'all' && source === 'company'" class="plan-strip" @tap="view = 'plans'">
      <text class="strip-title">周期计划</text>
      <text v-if="plansError" class="strip-meta strip-meta--fail">未能加载</text>
      <text v-else-if="plansLoaded" class="strip-meta">{{ plans.length }} 项 · 已启用 {{ enabledPlansCount }}</text>
      <text v-else class="strip-meta">读取中…</text>
      <uni-icons type="right" size="13" color="#99a59d" />
     </button>
     <view class="list-summary"><text>{{ listSummary }}</text><text>{{ view === 'all' ? '' : listLoaded ? `${visibleRows.length} 项` : '正在读取' }}</text></view>
     <view v-if="loading && !listLoaded" class="state-message">加载中…</view>
     <view v-else-if="error && !visibleRows.length" class="state-message"><text>{{ error }}</text><button @tap="load">重试</button></view>
     <view v-else-if="!visibleRows.length && view !== 'all'" class="state-message">{{ emptyText }}</view>

     <template v-else-if="view === 'all'">
      <view v-if="!agendaHasDays && !agenda.later.length" class="state-message">{{ emptyText }}</view>
      <template v-else>
      <view v-if="!agendaHasDays" class="day-empty">近 10 天暂无任务</view>
      <view v-for="day in agendaHasDays ? agenda.days : []" :key="day.date" class="agenda-day">
       <view class="agenda-rail"><text class="day-num">{{ railNum(day.date) }}</text><text class="day-wd">{{ railText(day.date) }}</text></view>
       <view class="agenda-rows">
        <button v-for="task in day.rows" :key="taskKey(task)" class="task-row task-row--agenda" @tap="openTask(task)">
         <text class="row-clock">{{ taskDayTime(task, day.date) }}</text>
         <view class="row-copy">
          <view class="row-heading"><text class="row-title">{{ task.label || '任务安排' }}</text><text class="task-status" :class="'tone-' + taskTone(task.status)">{{ taskStatus(task.status) }}</text></view>
          <text v-if="task.repeat || task.occurrence" class="row-subtitle">周期 · {{ repeatText(task.repeat) || '按周期执行' }}</text>
         </view>
        </button>
        <text v-if="!day.rows.length" class="day-empty">暂无任务</text>
       </view>
      </view>
      <view v-if="agenda.later.length" class="agenda-day">
       <view class="agenda-rail"><text class="day-num day-num--later">更晚</text></view>
       <view class="agenda-rows">
        <button v-for="item in agenda.later" :key="taskKey(item.task)" class="task-row task-row--agenda" @tap="openTask(item.task)">
         <view class="row-clock row-clock--later"><text>{{ item.date.slice(5) }}</text><text>{{ taskDayTime(item.task, item.date) }}</text></view>
         <view class="row-copy">
          <view class="row-heading"><text class="row-title">{{ item.task.label || '任务安排' }}</text><text class="task-status" :class="'tone-' + taskTone(item.task.status)">{{ taskStatus(item.task.status) }}</text></view>
          <text v-if="item.task.repeat || item.task.occurrence" class="row-subtitle">周期 · {{ repeatText(item.task.repeat) || '按周期执行' }}</text>
         </view>
        </button>
       </view>
      </view>
      <view v-if="moreLoading || moreError || hasMore" class="list-footer"><button v-if="moreError" @tap="loadMore">更晚任务加载失败 · 重试</button><button v-else-if="!moreLoading" @tap="loadMore">加载更晚任务</button><text v-else>加载中…</text></view>
      </template>
     </template>

     <template v-else-if="view === 'plans'">
      <view v-for="plan in plans" :key="plan.planId" class="plan-row">
       <button class="plan-main" @tap="openPlan(plan)">
        <view class="status-mark" :class="planIsEnabled(plan) ? 'status-mark--active' : 'status-mark--paused'" />
        <view class="row-copy">
         <view class="row-heading"><text class="row-title">{{ plan.label || '未命名周期安排' }}</text><text v-if="!planCanToggle(plan) && ['enabled', 'paused'].includes(plan.status)" class="plan-access-tag">仅可查看</text><text v-else class="plan-status" :class="planIsEnabled(plan) ? 'tone-active' : 'tone-muted'">{{ planStatus(plan) }}</text></view>
         <text class="row-subtitle">{{ repeatText(plan.repeat) || '重复规则未提供' }}</text>
         <text v-if="source === 'company' && taskRequirementsText(plan)" class="row-subtitle">{{ taskRequirementsText(plan) }}</text>
         <view class="row-meta"><text>{{ plan.nextAt ? `下一次执行 · ${taskTime(plan.nextAt)}` : '暂无下一次执行' }}</text><text>{{ plan.creator?.displayName || '成员' }} 创建</text></view>
        </view>
        <uni-icons type="right" size="13" color="#99a59d" />
       </button>
       <view v-if="!planCanToggle(plan)" class="plan-switch-wrap plan-switch-wrap--disabled" @tap.stop="explainPlanAccess(plan)">
        <switch :key="`${planSwitchRevision}:${plan.planId}:${planIsEnabled(plan)}`" class="plan-switch" :checked="planIsEnabled(plan)" disabled />
       </view>
       <switch v-else :key="`${planSwitchRevision}:${plan.planId}:${planIsEnabled(plan)}`" class="plan-switch" :checked="planIsEnabled(plan)" :disabled="planLoading" @change.stop="togglePlanStatus(plan, $event.detail.value)" />
      </view>
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
     </template>
    </scroll-view>
    <button v-if="source === 'company' && !inboxNavigation.canBack && !stackedView" class="create-task" @tap="emit('create')">让 Agent 安排任务 <uni-icons type="chatbubble" size="14" color="#176b54" /></button>
   </view>

   <view v-if="selectedPlan" class="detail-pane"><text v-if="planLoading" class="list-footer">正在更新…</text><text v-if="planDetailError" class="detail-error">{{ planDetailError }}</text>
    <scroll-view class="detail-scroll" scroll-y enhanced :show-scrollbar="false">
     <view class="plan-summary">
      <view class="summary-heading"><view class="status-mark" :class="planIsEnabled(selectedPlan) ? 'status-mark--active' : 'status-mark--paused'" /><text class="plan-label">{{ selectedPlan.label || '未命名周期安排' }}</text></view>
      <text class="summary-status" :class="planIsEnabled(selectedPlan) ? 'tone-active' : 'tone-muted'">{{ planStatus(selectedPlan) }}</text>
      <view class="summary-line"><text>重复规则</text><text>{{ repeatText(selectedPlan.repeat) || '未提供' }}</text></view>
      <view v-if="source === 'company' && taskRequirementsText(selectedPlan)" class="summary-line"><text>执行要求</text><text>{{ taskRequirementsText(selectedPlan) }}</text></view>
      <view class="summary-line"><text>下一次执行</text><text>{{ selectedPlan.nextAt ? taskTime(selectedPlan.nextAt) : '暂无' }}</text></view>
      <view class="summary-line"><text>创建人</text><text>{{ selectedPlan.creator?.displayName || '成员' }}</text></view>
      <text class="summary-note">{{ planAccessSummary(selectedPlan) }}</text>
      <text v-if="selectedPlan.pauseReason" class="pause-reason">{{ selectedPlan.pauseReason }}</text>
      <view class="plan-toggle-row">
       <view class="plan-toggle-copy"><text class="plan-toggle-title">周期计划</text><text class="plan-toggle-note">{{ planIsEnabled(selectedPlan) ? '停用后只影响未来发生' : '重新启用前会核验当前范围和绑定' }}</text></view>
       <view v-if="!planCanToggle(selectedPlan)" class="plan-switch-wrap plan-switch-wrap--disabled" @tap.stop="explainPlanAccess(selectedPlan)">
        <switch :key="`${planSwitchRevision}:${selectedPlan.planId}:${planIsEnabled(selectedPlan)}`" :checked="planIsEnabled(selectedPlan)" disabled />
       </view>
       <switch v-else :key="`${planSwitchRevision}:${selectedPlan.planId}:${planIsEnabled(selectedPlan)}`" :checked="planIsEnabled(selectedPlan)" :disabled="planLoading" @change="togglePlanStatus(selectedPlan, $event.detail.value)" />
      </view>
      <view v-if="selectedPlan.latestTask" class="latest-result">
       <view class="latest-result-copy"><text class="latest-result-title">最近一次结果</text><text>{{ taskTime(taskTimeValue(selectedPlan.latestTask, 'results')) || '时间未提供' }} · {{ taskStatus(selectedPlan.latestTask.status) }}</text></view>
       <button v-if="selectedPlan.latestTask.id || selectedPlan.latestTask.taskId" class="latest-result-link" @tap="openLatestReport">查看报告 <uni-icons type="right" size="12" color="#176b54" /></button>
      </view>
     </view>
    </scroll-view>
    <view class="detail-actions"><button class="reference-button" @tap="referencePlan"><uni-icons type="chatbubble" size="15" color="#fff" /><text>询问这个计划</text></button><view v-if="selectedPlan.canManage" class="cancel-actions"><button v-if="selectedPlan.nextDate" class="cancel-button" :disabled="planLoading" @tap="cancelWholePlan('occurrence')">取消本次</button><button class="cancel-button" :disabled="planLoading" @tap="cancelWholePlan('all')">取消全部</button></view></view>
   </view>

   <view v-if="selectedTask" class="detail-pane">
    <TaskResultContent ref="content" class="task-content-host" :active="open" :task-id="selectedTaskId" :initial-task="selectedTask" :snapshot-scope="loadedScope" :source="source" @reference="emit('reference', $event)" @cancelled="onTaskCancelled" @changed="emit('changed')" @dismiss="backToList" @navigation="navigation = $event" />
   </view>
  </view>
 </DeviceSheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { getAgentStorageScope } from '@/utils/agent-session'
import { getTaskPlan, cancelTaskPlan, listAgentTasks, listNotifications, listTaskPlans, setTaskPlanStatus } from '@/apis/agent'
import { repeatText, taskRequirementsText, taskTime } from '../task-detail-view.mjs'
import DeviceSheet from './DeviceSheet.vue'
import SlidingSegments from './SlidingSegments.vue'
import TaskResultContent from './TaskResultContent.vue'
import TaskCalendarView from './TaskCalendarView.vue'
import TaskInboxContent from './TaskInboxContent.vue'
import { agendaGroups, taskDayTime, taskToday, taskLabel as taskStatus } from '../task-calendar.mjs'
import { shiftDate } from '../region-calendar.mjs'

const props = defineProps({ open: Boolean, source: { type: String, default: 'office' }, initialView: String, date: String, initialTask: Object, refreshKey: Number })
const emit = defineEmits(['close', 'reference', 'create', 'changed', 'unread-count'])
const calendar = ref(null), inbox = ref(null), inboxNavigation = ref({ title: '', canBack: false }), selectedDate = ref(props.date || taskToday())
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const ALL_CHUNK_DAYS = 62, ALL_MAX_DAYS = 371
const views = computed(() => props.source === 'company' ? [{ value: 'all', label: '全部任务' }, { value: 'calendar', label: '日历' }] : [
 { value: 'upcoming', label: '待执行' },
 { value: 'results', label: '执行结果' },
 { value: 'plans', label: '周期计划' },
])
const view = ref(props.source === 'company' ? 'all' : 'upcoming')
const tasks = ref([]), plans = ref([])
const loading = ref(false), error = ref(''), planLoading = ref(false), planSwitchRevision = ref(0)
const plansError = ref(''), plansLoading = ref(false), inboxUnread = ref(0)
const allLoadedTo = ref(0), moreLoading = ref(false), moreError = ref('')
const hasMore = computed(() => props.source === 'company' && view.value === 'all' && listLoaded.value && allLoadedTo.value > 0 && allLoadedTo.value < ALL_MAX_DAYS)
const listLoaded = ref(false)
const taskRows = new Map()
const plansLoaded = ref(false)
const selectedTask = ref(null), selectedPlan = ref(null), planDetailError = ref(''), returnPlan = ref(null), content = ref(null), navigation = ref({ title: '', canBack: false })
const selectedTaskId = computed(() => selectedTask.value?.taskId || selectedTask.value?.id || '')
const stackedView = computed(() => props.source === 'company' && (view.value === 'inbox' || view.value === 'plans'))
const sheetTitle = computed(() => selectedTask.value ? '任务报告' : selectedPlan.value || (props.source === 'company' && view.value === 'plans') ? '周期计划' : props.source === 'company' ? '任务管理' : '我的安排')
const visibleRows = computed(() => view.value === 'plans' ? plans.value : tasks.value)
const agenda = computed(() => agendaGroups(tasks.value, taskToday(), 10))
const agendaHasDays = computed(() => agenda.value.days.some(day => day.rows.length))
const enabledPlansCount = computed(() => plans.value.filter(plan => planIsEnabled(plan)).length)
const listSummary = computed(() => view.value === 'upcoming' ? '未来 30 天' : view.value === 'results' ? '最近 30 天' : view.value === 'all' ? '全部任务' : '周期安排')
const emptyText = computed(() => view.value === 'upcoming' ? '未来 30 天没有待执行安排' : view.value === 'results' ? '最近 30 天没有执行结果' : view.value === 'all' ? '暂无任务安排' : '暂无周期计划')
function railNum(date) { const today = taskToday(); return date.slice(5, 7) === today.slice(5, 7) ? String(Number(date.slice(8))) : date.slice(5) }
function railText(date) { const today = taskToday(); return date === today ? '今天' : date === shiftDate(today, 1) ? '明天' : `周${WEEKDAYS[new Date(`${date}T00:00:00+08:00`).getDay()]}` }
let requestId = 0, planRequest = 0, planStatusRequest = 0, plansRequest = 0, unreadRequest = 0, moreRequest = 0, loadedScope = '', pageVisible = true
function resetPlanSwitch() { planSwitchRevision.value += 1 }
function resetIdentity() { ++planStatusRequest; ++plansRequest; ++moreRequest; tasks.value = []; plans.value = []; taskRows.clear(); plansLoaded.value = false; allLoadedTo.value = 0; moreLoading.value = false; moreError.value = ''; listLoaded.value = false; selectedTask.value = null; selectedPlan.value = null; returnPlan.value = null; navigation.value = { title: '', canBack: false }; planLoading.value = false; plansLoading.value = false; plansError.value = ''; inboxUnread.value = 0; resetPlanSwitch() }
onHide(() => { pageVisible = false; ++requestId; ++planRequest; ++planStatusRequest; ++plansRequest; ++moreRequest; loading.value = false; planLoading.value = false; plansLoading.value = false; moreLoading.value = false; resetPlanSwitch() })
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
 if (kind === 'all') return { from: today.toISOString(), to: dayOffset(today, ALL_CHUNK_DAYS).toISOString() }
 if (kind === 'upcoming') return { from: today.toISOString(), to: dayOffset(today, 31).toISOString() }
 return { from: dayOffset(today, -30).toISOString(), to: now.toISOString() }
}
function taskKey(task) { return task.taskId || task.id || task.occurrence?.id || task.label }
function taskTimeValue(task, kind) {
 if (kind === 'results') return task.report?.generatedAt || task.interval?.endsAt || task.phases?.at(-1)?.endedAt || task.phases?.at(-1)?.at || task.createdAt
 return task.interval?.startsAt || task.phases?.[0]?.at || task.createdAt
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
 if (plan?.status === 'paused' || plan?.status === 'disabled') return '已停用'
 if (plan?.status === 'ended' || (!plan?.nextAt && plan?.status !== 'paused')) return '周期结束'
 return planIsEnabled(plan) ? '已启用' : '状态待确认'
}
function planCanToggle(plan) {
 if (plan?.status === 'enabled') return Boolean(plan.canPause)
 if (plan?.status === 'paused') return Boolean(plan.canResume)
 return false
}
function planAccessSummary(plan) {
 if (plan?.status === 'enabled' && plan.canPause) return '可停用未来发生；当前已生成的发生继续保留'
 if (plan?.status === 'paused' && plan.canResume) return '重新启用会重新核验当前完整范围和控制绑定'
 if (plan?.canManage) return '可取消本次或全部'
 return '当前账号仅可查看'
}
function explainPlanAccess(plan) {
 if (!plan || ['ended', 'deleted'].includes(plan.status)) return
 uni.showToast({ title: '需使用创建者账号，且当前范围覆盖全部设备才能管理', icon: 'none' })
}
function replacePlan(next) {
 if (!next?.planId) return
 plans.value = plans.value.map(plan => plan.planId === next.planId ? next : plan)
 if (selectedPlan.value?.planId === next.planId) selectedPlan.value = next
}
function planContextCurrent(planId, source, scope, version) {
 if (!props.open || props.source !== source || (view.value !== 'plans' && selectedPlan.value?.planId !== planId)) return false
 let currentScope = ''
 try { currentScope = getAgentStorageScope() } catch { return false }
 if (scope !== currentScope) return false
 const current = selectedPlan.value?.planId === planId ? selectedPlan.value : plans.value.find(item => item.planId === planId)
 return Boolean(current && (version === undefined || current.version === version))
}
function resumeContent(plan) {
 const next = plan?.resumeNextAt ? taskTime(plan.resumeNextAt) : ''
 return `下一次执行：${next || '暂无未来发生'}。将重新核验当前完整范围和控制绑定，从下一次未来发生继续，不补过去安排。`
}
async function togglePlanStatus(plan, enabled) {
 if (!plan?.planId || !planCanToggle(plan) || planLoading.value) return
 const action = ++planStatusRequest, operation = enabled ? 'resume' : 'pause'
 const source = props.source, scope = getAgentStorageScope(), planId = plan.planId, version = plan.version
 const title = operation === 'resume' ? '重新启用' : '停用周期计划'
 const content = operation === 'resume'
  ? resumeContent(plan)
  : '只停用未来发生；已经生成、执行中或已下发的本次不回滚。'
 const confirmed = await new Promise(resolve => uni.showModal({ title, content, confirmText: title, confirmColor: operation === 'resume' ? '#176b54' : '#a15343', success: result => resolve(result.confirm), fail: () => resolve(false) }))
 if (!confirmed) {
  if (action === planStatusRequest && planContextCurrent(planId, source, scope, version)) resetPlanSwitch()
  return
 }
 if (action !== planStatusRequest || !planContextCurrent(planId, source, scope, version)) return
 planLoading.value = true
 try {
  const result = await setTaskPlanStatus(planId, version, operation, source, operation === 'resume')
  if (action !== planStatusRequest || !planContextCurrent(planId, source, scope, version)) return
  replacePlan(result?.plan)
  resetPlanSwitch()
  emit('changed')
  uni.showToast({ title: operation === 'resume' ? '已重新启用' : '已停用未来发生', icon: 'none' })
 } catch (cause) {
  if (action !== planStatusRequest || !planContextCurrent(planId, source, scope, version)) return
  resetPlanSwitch()
  uni.showToast({ title: cause.message || '状态更新失败，请刷新后重试', icon: 'none' })
 } finally { if (action === planStatusRequest) planLoading.value = false }
}
function selectTaskRows(values, kind) {
 const rows = Array.isArray(values) ? values : []
 const allowed = kind === 'all' ? null : kind === 'upcoming' ? ['scheduled', 'executing', 'pending'] : ['completed', 'partial', 'failed', 'unconfirmed', 'cancelled', 'missed', 'interrupted', 'verified', 'satisfied']
 return rows.filter(task => !allowed || allowed.includes(task.status) || (kind === 'results' && Boolean(task.report)))
  .sort((a, b) => {
   const difference = Date.parse(taskTimeValue(a, kind) || '') - Date.parse(taskTimeValue(b, kind) || '')
   return kind === 'results' ? -difference : difference
  })
}

async function loadPlans(force = true) {
 if (!props.open || !pageVisible) return
 const current = ++plansRequest
 let scope = ''
 try {
  scope = getAgentStorageScope()
  const source = props.source
  if (scope !== loadedScope) return
  if (!force && plansLoaded.value) return
  plansLoading.value = true; plansError.value = ''
  const result = await listTaskPlans({ source })
  if (current === plansRequest && pageVisible && props.open && source === props.source && scope === getAgentStorageScope()) {
   plans.value = Array.isArray(result?.plans) ? result.plans : []
   plansLoaded.value = true; plansError.value = ''
  }
 } catch (cause) {
  if (current === plansRequest && props.open) plansError.value = cause.message || '周期计划暂不可用'
 } finally { if (current === plansRequest) plansLoading.value = false }
}

async function refreshUnread() {
 if (props.source !== 'company' || !props.open) return
 const current = ++unreadRequest
 try {
  const scope = getAgentStorageScope()
  const result = await listNotifications({ source: 'company', limit: 1 })
  if (current === unreadRequest && props.open && scope === getAgentStorageScope()) inboxUnread.value = Number(result?.unreadCount) || 0
 } catch { /* 未读角标失败不阻塞列表 */ }
}

async function load(force = true) {
 if (!props.open || !pageVisible) return
 if (view.value === 'calendar') { calendar.value?.refresh(); return }
 if (view.value === 'inbox') { inbox.value?.refresh(); return }
 const current = ++requestId, kind = view.value
 loading.value = true
 error.value = ''
 let scope = ''
 try {
  scope = getAgentStorageScope()
  const source = props.source
  if (scope !== loadedScope) { resetIdentity(); loadedScope = scope }
  tasks.value = taskRows.get(kind) || []
  listLoaded.value = kind === 'plans' ? plansLoaded.value : taskRows.has(kind)
  if (kind === 'plans') {
   await loadPlans(force)
   if (current === requestId && view.value === 'plans') { listLoaded.value = plansLoaded.value; error.value = plansError.value }
   return
  }
  if (kind === 'all' && props.source === 'company') void loadPlans(force)
  if (!force && listLoaded.value) return
  const range = taskRange(kind)
  const result = await listAgentTasks({ source: props.source, ...range })
  if (current === requestId && pageVisible && props.open && view.value === kind && source === props.source && scope === getAgentStorageScope()) {
   tasks.value = selectTaskRows(result?.tasks, kind)
   taskRows.set(kind, tasks.value); listLoaded.value = true
   if (kind === 'all') { allLoadedTo.value = ALL_CHUNK_DAYS; moreError.value = '' }
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
async function loadMore() {
 if (view.value !== 'all' || moreLoading.value || !hasMore.value || !props.open || !pageVisible) return
 const current = ++moreRequest
 moreLoading.value = true; moreError.value = ''
 try {
  const scope = getAgentStorageScope(), source = props.source
  const today = startOfDay(new Date())
  const from = dayOffset(today, allLoadedTo.value).toISOString()
  const to = dayOffset(today, Math.min(allLoadedTo.value + ALL_CHUNK_DAYS, ALL_MAX_DAYS)).toISOString()
  const result = await listAgentTasks({ source, from, to })
  if (current !== moreRequest || !pageVisible || !props.open || view.value !== 'all' || source !== props.source || scope !== getAgentStorageScope()) return
  const seen = new Set(tasks.value.map(taskKey))
  tasks.value = [...tasks.value, ...(result?.tasks || []).filter(task => !seen.has(taskKey(task)))]
  taskRows.set('all', tasks.value)
  allLoadedTo.value = Math.min(allLoadedTo.value + ALL_CHUNK_DAYS, ALL_MAX_DAYS)
 } catch (cause) {
  if (current === moreRequest) moreError.value = cause.message || '加载失败'
 } finally { if (current === moreRequest) moreLoading.value = false }
}
function openTask(task) {
 if (!taskKey(task)) return
 selectedTask.value = props.source === 'company' ? { id: taskKey(task) } : task
 selectedPlan.value = null
}
async function openPlan(plan) {
 ++planStatusRequest; resetPlanSwitch()
 const current = ++planRequest, source = props.source, scope = getAgentStorageScope()
 selectedPlan.value = plan; selectedTask.value = null; planDetailError.value = ''; returnPlan.value = null
 planLoading.value = true
 try {
  const result = await getTaskPlan(plan.planId, source)
  if (current === planRequest && pageVisible && props.open && scope === getAgentStorageScope() && props.source === source && selectedPlan.value?.planId === plan.planId) {
   if (!result.plan) throw new Error('计划不存在或已无权查看')
   selectedPlan.value = result.plan
  }
 } catch (cause) {
  if (current === planRequest && props.open) {
   planDetailError.value = cause.message || '周期计划读取失败，请刷新后重试'
   uni.showToast({ title: planDetailError.value, icon: 'none' })
  }
 }
 finally { if (current === planRequest) planLoading.value = false }
}
function openLatestReport() {
 const task = selectedPlan.value?.latestTask
 if (!task?.id && !task?.taskId) return
 returnPlan.value = selectedPlan.value
 openTask(task)
}
function backToList() {
 ++planRequest; ++planStatusRequest; planLoading.value = false; resetPlanSwitch()
 navigation.value = { title: '', canBack: false }
 if (returnPlan.value) {
  selectedPlan.value = returnPlan.value
  returnPlan.value = null
  selectedTask.value = null
  return
 }
 selectedTask.value = null
 selectedPlan.value = null
}
function goBack() {
 if (view.value === 'inbox' && inbox.value?.back()) return
 if (content.value?.back()) return
 if (selectedTask.value || selectedPlan.value || !stackedView.value) { backToList(); return }
 view.value = 'all'
}
function nativeBack() {
 if (view.value === 'inbox' && inbox.value?.back()) return
 if (content.value?.back()) return
 if (selectedTask.value || selectedPlan.value) { backToList(); return }
 if (stackedView.value) { view.value = 'all'; return }
 closeSheet()
}
function closeSheet() {
 ++planRequest; ++planStatusRequest; planLoading.value = false; resetPlanSwitch()
 selectedTask.value = null
 selectedPlan.value = null
 planDetailError.value = ''
 returnPlan.value = null
 navigation.value = { title: '', canBack: false }
 emit('close')
}
function onTaskCancelled() {
 emit('changed')
 returnPlan.value = null; selectedPlan.value = null; selectedTask.value = null
 navigation.value = { title: '', canBack: false }
 void load()
}
async function cancelWholePlan(scopeType) {
 if (!selectedPlan.value?.canManage || planLoading.value) return
 const plan = selectedPlan.value, source = props.source, scope = getAgentStorageScope()
 const title = scopeType === 'all' ? '取消全部' : '取消本次'
 const confirmed = await new Promise(resolve => uni.showModal({ title, content: scopeType === 'all' ? '取消这个周期全部尚未执行的安排；已执行或已下发的动作不会回滚。' : '只取消下一次执行，后续周期照常执行。', confirmText: title, confirmColor: '#a15343', success: result => resolve(result.confirm), fail: () => resolve(false) }))
 if (!confirmed || !props.open || selectedPlan.value?.planId !== plan.planId || source !== props.source || scope !== getAgentStorageScope()) return
 planLoading.value = true
 try {
  await cancelTaskPlan(plan.planId, plan.version, scopeType, scopeType === 'occurrence' ? plan.nextDate : undefined, source)
  backToList(); emit('changed'); void load()
 } catch (cause) { error.value = cause.message || '取消失败，请刷新后重试'; uni.showToast({ title: error.value, icon: 'none' }) }
 finally { planLoading.value = false }
}
function referencePlan() {
 if (!selectedPlan.value?.planId) return
 emit('reference', { type: 'task_plan', planId: selectedPlan.value.planId, label: selectedPlan.value.label || '' })
}

watch(() => props.open, (open, previous) => {
 if (open && !previous) {
  ++planRequest; planLoading.value = false
  selectedTask.value = null; selectedPlan.value = null; returnPlan.value = null
  navigation.value = { title: '', canBack: false }
  inboxNavigation.value = { title: '', canBack: false }
  const initial = props.initialView === 'schedule' ? 'all' : props.initialView
  view.value = props.source === 'company' ? initial || 'all' : 'upcoming'
  selectedDate.value = props.date || taskToday()
  void refreshUnread()
  if (props.initialTask) openTask(props.initialTask)
 }
}, { immediate: true })
watch(() => props.refreshKey, () => { if (props.open) void load() })
watch(() => props.source, () => {
 resetIdentity()
})
watch(() => [props.open, props.source, view.value], ([isOpen, source, currentView], previous) => {
 if (currentView !== 'inbox') inboxNavigation.value = { title: '', canBack: false }
 if (isOpen) void load(!previous || !previous[0] || previous[1] !== source)
 else { ++requestId; ++planStatusRequest; loading.value = false; planLoading.value = false; resetPlanSwitch(); navigation.value = { title: '', canBack: false } }
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
.plan-row,.task-row { width:100%; min-height:76px; display:flex; align-items:center; gap:10px; padding:12px 2px; border-bottom:1px solid #e8ede9; text-align:left; }
.plan-row:active,.task-row:active { background:#f5f8f5; }
.plan-main { min-width:0; flex:1; display:flex; align-items:center; gap:11px; text-align:left; }
.plan-switch { flex-shrink:0; transform:scale(.78); transform-origin:right center; }
.plan-switch-wrap { flex-shrink:0; min-width:52px; min-height:32px; display:flex; align-items:center; justify-content:flex-end; }
.plan-switch-wrap--disabled { opacity:.72; }
.row-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:4px; }
.row-heading { min-width:0; display:flex; align-items:baseline; justify-content:space-between; gap:9px; }
.row-title { min-width:0; white-space:normal; word-break:break-word; color:#304739; font-size:13px; font-weight:600; }
.plan-status,.task-status { flex-shrink:0; font-size:10px; }
.plan-access-tag { flex-shrink:0; color:#8b7561; font-size:10px; }
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
.detail-error { display:block; flex-shrink:0; padding:8px 18px 0; color:#a15343; font-size:11px; text-align:center; }
.plan-strip { width:100%; min-height:40px; display:flex; align-items:center; gap:8px; padding:8px 2px; border-bottom:1px solid #e5ebe6; text-align:left; }
.plan-strip:active { opacity:.65; }
.strip-title { color:#34483b; font-size:12px; font-weight:600; }
.strip-meta { min-width:0; flex:1; color:#929e96; font-size:11px; text-align:right; }
.strip-meta--fail { color:#a15343; }
.agenda-day { display:flex; gap:10px; padding-top:8px; }
.agenda-rail { width:32px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; padding-top:14px; }
.day-num { font-size:15px; font-weight:700; color:#33503d; line-height:1.2; }
.day-num--later { font-size:12px; color:#75877b; }
.day-wd { font-size:10px; color:#8b9a90; }
.agenda-rows { min-width:0; flex:1; }
.day-empty { display:block; padding:14px 0; border-bottom:1px solid #e8ede9; color:#b4bfb8; font-size:11px; }
.task-row--agenda { min-height:0; gap:10px; }
.row-clock { width:46px; flex-shrink:0; align-self:flex-start; padding-top:2px; font-size:11px; color:#466350; line-height:1.4; }
.row-clock--later { display:flex; flex-direction:column; gap:3px; }
.row-clock--later text:first-child { font-weight:600; }
.inbox-button { position:relative; }
.inbox-badge { position:absolute; top:-4px; right:-2px; min-width:15px; padding:1px 4px; border-radius:9px; background:#a15343; color:#fff; font-size:9px; line-height:1.4; }
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
.pause-reason { display:block; padding-top:4px; color:#a27128; font-size:11px; }
.plan-toggle-row { margin-top:13px; padding-top:12px; border-top:1px solid #e8ede9; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.plan-toggle-copy { min-width:0; display:flex; flex-direction:column; gap:4px; }
.plan-toggle-title { color:#34483b; font-size:12px; font-weight:600; }
.plan-toggle-note { color:#87948b; font-size:10px; }
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
.create-task { min-height:44px; margin:6px 18px 10px; display:flex; align-items:center; justify-content:center; gap:8px; color:#176b54; background:#eaf1eb; border-radius:8px; font-size:12px; flex-shrink:0; }
</style>
