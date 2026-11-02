<template>
 <DeviceSheet :open="open" :back="nativeBack" tall compact-header :title="navigation.title || (planId ? (viewingReport ? '最近一次报告' : '周期安排') : '任务详情')" @close="$emit('close')">
  <template #header-left><button v-if="navigation.canBack" class="back-button" aria-label="返回上一级" @tap="nativeBack"><uni-icons type="back" size="15" color="var(--agent-text-muted)" /></button></template>
  <template #header-right><text v-if="regionName" class="region-name">{{ regionName }}</text></template>
  <TaskResultContent ref="content" class="content-host" :active="open" :task-id="taskId" :plan-id="planId" :source="source" :sample-task="sampleTask" @cancelled="$emit('cancelled')" @changed="$emit('changed')" @dismiss="$emit('close')" @reference="$emit('reference', $event)" @report-open="viewingReport = true" @plan-return="viewingReport = false" @navigation="navigation = $event" />
 </DeviceSheet>
</template>
<script setup>
import { ref, watch } from 'vue'
import DeviceSheet from '../shared/DeviceSheet.vue'
import TaskResultContent from './TaskResultContent.vue'

const props = defineProps({ open: Boolean, taskId: String, planId: String, source: { type: String, default: 'office' }, sampleTask: Object, regionName: String })
const content = ref(null), viewingReport = ref(false), navigation = ref({ title: '', canBack: false })
const emit = defineEmits(['close', 'cancelled', 'changed', 'reference'])
function nativeBack() { if (content.value?.back()) return; if (viewingReport.value) content.value?.returnToPlan(); else emit('close') }
watch(() => [props.open, props.taskId, props.planId, props.source], () => { viewingReport.value = false; navigation.value = { title: '', canBack: false } })
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-name { max-width:120px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--agent-text-muted); font-size:11px; }
.back-button { width:44px; height:44px; margin-right:4px; border-radius:22px; display:flex; align-items:center; justify-content:center; background:var(--agent-tint); }
.content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
</style>
