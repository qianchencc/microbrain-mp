<template>
 <DeviceSheet :open="open" tall compact-header title="任务" @close="$emit('close')">
  <template #header-right><text class="region-name">{{ regionName }}</text></template>
  <TaskDetailContent class="content-host" :active="open" :task-id="taskId" :sample-task="sampleTask" @cancelled="$emit('cancelled')" />
 </DeviceSheet>
</template>
<script setup>
import DeviceSheet from './DeviceSheet.vue'
import TaskDetailContent from './TaskDetailContent.vue'

defineProps({ open: Boolean, taskId: String, sampleTask: Object, regionName: String })
defineEmits(['close', 'cancelled'])
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
.region-name { max-width:215px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#839189; font-size:11px; }
.content-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
</style>
