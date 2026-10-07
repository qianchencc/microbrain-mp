<template>
 <DeviceSheet :open="open" :back="nativeBack" tall compact-header :title="planId ? (viewingReport ? '最近一次报告' : '周期安排') : '任务'" @close="$emit('close')">
  <template #header-right><text v-if="regionName" class="region-name">{{ regionName }}</text></template>
  <TaskDetailContent ref="content" class="content-host" :active="open" :task-id="taskId" :plan-id="planId" :source="source" :sample-task="sampleTask" @cancelled="$emit('cancelled')" @reference="$emit('reference', $event)" @report-open="viewingReport = true" @plan-return="viewingReport = false" />
 </DeviceSheet>
</template>
<script setup>
import { ref, watch } from 'vue'
import DeviceSheet from './DeviceSheet.vue'
import TaskDetailContent from './TaskDetailContent.vue'

const props = defineProps({ open: Boolean, taskId: String, planId: String, source: { type: String, default: 'office' }, sampleTask: Object, regionName: String })
const content = ref(null), viewingReport = ref(false)
const emit = defineEmits(['close', 'cancelled', 'reference'])
function nativeBack() { if (viewingReport.value) content.value?.returnToPlan(); else emit('close') }
watch(() => [props.open, props.taskId, props.planId], () => { viewingReport.value = false })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-name { max-width:215px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#839189; font-size:11px; }
.content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
</style>
