<template>
 <view class="trc-host">
  <view class="trc-pane" :style="{ display: reportRef ? 'none' : 'flex' }">
   <TaskDetailContent ref="content" class="trc-content-host" :active="active && !reportRef" :task-id="taskId" :plan-id="planId" :sample-task="sampleTask" :initial-task="initialTask" :snapshot-scope="snapshotScope" :source="source"
    @cancelled="$emit('cancelled')" @changed="$emit('changed')" @loaded="$emit('loaded', $event)" @report-open="$emit('report-open')" @open-report="openReport" @plan-return="$emit('plan-return')" @reference="$emit('reference', $event)" @dismiss="$emit('dismiss')" />
  </view>
  <ReportPreviewContent v-if="reportRef" ref="report" class="trc-pane trc-report" :report-id="reportRef.reportId" :active="active && Boolean(reportRef)" :source="source"
   @reference="$emit('reference', $event)" @navigation="reportNav = $event" />
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import TaskDetailContent from './TaskDetailContent.vue'
import ReportPreviewContent from './ReportPreviewContent.vue'

const props = defineProps({ active: Boolean, taskId: String, planId: String, sampleTask: Object, initialTask: Object, snapshotScope: String, source: { type: String, default: 'office' } })
const emit = defineEmits(['cancelled', 'changed', 'loaded', 'report-open', 'plan-return', 'reference', 'dismiss', 'navigation'])
const content = ref(null), report = ref(null)
const reportRef = ref(null), reportNav = ref({ title: '', canBack: false })
const navigation = computed(() => reportRef.value
 ? { title: reportNav.value.title || '检查点报告', canBack: true }
 : { title: '', canBack: false })
watch(navigation, value => emit('navigation', value), { immediate: true })

function openReport(ref) {
 if (!ref?.reportId || props.source !== 'company') return
 reportRef.value = { reportId: ref.reportId, title: ref.title || '', phaseId: ref.phaseId || '', phaseAt: ref.phaseAt || '' }
}
function back() {
 if (!reportRef.value) return false
 if (report.value?.back()) return true
 reportRef.value = null
 reportNav.value = { title: '', canBack: false }
 return true
}
function returnToPlan() { return content.value?.returnToPlan() }
watch(() => [props.taskId, props.planId, props.source, props.active], ([taskId, planId, source, active], previous) => {
 if (!reportRef.value) return
 if (!active || source !== previous?.[2] || (taskId || planId) !== (previous?.[0] || previous?.[1])) {
  reportRef.value = null
  reportNav.value = { title: '', canBack: false }
 }
})
defineExpose({ back, returnToPlan })
</script>
<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
.trc-host { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.trc-pane { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.trc-content-host { height: 0; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.trc-report { animation: trcIn 260ms cubic-bezier(.32,.72,0,1) backwards; }
@keyframes trcIn { from { opacity: 0; transform: translateX(14px); } }
@media(prefers-reduced-motion:reduce) { .trc-report { animation: none; } }
</style>
