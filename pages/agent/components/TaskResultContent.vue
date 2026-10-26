<template>
 <view class="trc-host">
  <view class="trc-pane" :style="{ display: reportRef || safetyRef ? 'none' : 'flex' }">
   <TaskDetailContent ref="content" class="trc-content-host" :active="active && !reportRef && !safetyRef" :task-id="taskId" :plan-id="planId" :sample-task="sampleTask" :initial-task="initialTask" :snapshot-scope="snapshotScope" :source="source"
    @navigation="taskNav = $event" @cancelled="$emit('cancelled')" @changed="$emit('changed')" @loaded="$emit('loaded', $event)" @report-open="$emit('report-open')" @open-report="openReport" @plan-return="$emit('plan-return')" @reference="$emit('reference', $event)" @dismiss="$emit('dismiss')" @select-alert="openSafetyEvent" @browse-alerts="openSafetyHistory" />
  </view>
  <view v-if="safetyRef" class="trc-pane trc-safety" :style="{ display: reportRef ? 'none' : 'flex' }">
   <SafetyHistoryList v-if="safetyRef.mode === 'history'" class="safety-host" :active="active && Boolean(safetyRef)" @select="openSafetyEvent" />
   <SafetyEventDetail v-else class="safety-host" :snapshot="safetyRef.snapshot" :active="active && Boolean(safetyRef)" @reference="$emit('reference', $event)" />
  </view>
  <ReportPreviewContent v-if="reportRef" ref="report" class="trc-pane trc-report" :report-id="reportRef.reportId" :active="active && Boolean(reportRef)" :source="source"
   @reference="$emit('reference', $event)" @navigation="reportNav = $event" />
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import TaskDetailContent from './TaskDetailContent.vue'
import ReportPreviewContent from './ReportPreviewContent.vue'
import SafetyHistoryList from './SafetyHistoryList.vue'
import SafetyEventDetail from './SafetyEventDetail.vue'

const props = defineProps({ active: Boolean, taskId: String, planId: String, sampleTask: Object, initialTask: Object, snapshotScope: String, source: { type: String, default: 'office' } })
const emit = defineEmits(['cancelled', 'changed', 'loaded', 'report-open', 'plan-return', 'reference', 'dismiss', 'navigation'])
const content = ref(null), report = ref(null)
const reportRef = ref(null), reportNav = ref({ title: '', canBack: false })
const safetyRef = ref(null), taskNav = ref({ title: '', canBack: false })
const navigation = computed(() => {
 if (reportRef.value) return { title: reportNav.value.title || '检查报告', canBack: true }
 if (safetyRef.value?.mode === 'event') return { title: '安全台账详情', canBack: true }
 if (safetyRef.value?.mode === 'history') return { title: '安全事件台账', canBack: true }
 return taskNav.value
})
watch(navigation, value => emit('navigation', value), { immediate: true })

function openReport(ref) {
 if (!ref?.reportId || props.source !== 'company') return
 safetyRef.value = null
 reportRef.value = { reportId: ref.reportId, title: ref.title || '', phaseId: ref.phaseId || '', phaseAt: ref.phaseAt || '' }
}
function back() {
 if (!reportRef.value && !safetyRef.value && content.value?.back()) return true
 if (safetyRef.value?.mode === 'event' && safetyRef.value.returnHistory) {
  safetyRef.value = { mode: 'history' }
  return true
 }
 if (safetyRef.value) {
  safetyRef.value = null
  return true
 }
 if (!reportRef.value) return false
 if (report.value?.back()) return true
 reportRef.value = null
 reportNav.value = { title: '', canBack: false }
 return true
}
function openSafetyHistory() {
 if (props.source !== 'company') return
 safetyRef.value = { mode: 'history' }
}
function openSafetyEvent(snapshot) {
 if (props.source !== 'company' || !snapshot?.record) return
 safetyRef.value = { mode: 'event', snapshot, returnHistory: safetyRef.value?.mode === 'history' }
}
function returnToPlan() { return content.value?.returnToPlan() }
watch(() => [props.taskId, props.planId, props.source, props.active], ([taskId, planId, source, active], previous) => {
 const [previousTaskId, previousPlanId, previousSource] = previous || []
 const invalidated = !active || source !== previousSource || (taskId || planId) !== (previousTaskId || previousPlanId)
 if (invalidated) safetyRef.value = null
 if (!reportRef.value || !invalidated) return
 reportRef.value = null
 reportNav.value = { title: '', canBack: false }
})
defineExpose({ back, returnToPlan })
</script>
<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
.trc-host { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.trc-pane { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.trc-content-host { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.trc-report { animation: trcIn 260ms cubic-bezier(.32,.72,0,1) backwards; }
.trc-safety { animation: trcIn 260ms cubic-bezier(.32,.72,0,1) backwards; }
.safety-host { height:0; flex:1; min-height:0; display:flex; flex-direction:column; }
@keyframes trcIn { from { opacity: 0; transform: translateX(14px); } }
@media(prefers-reduced-motion:reduce) { .trc-report,.trc-safety { animation: none; } }
</style>
