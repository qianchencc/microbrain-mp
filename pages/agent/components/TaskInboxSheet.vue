<template>
 <DeviceSheet :open="open" :back="goBack" tall compact-header :title="navigation.title || '通知中心'" @close="$emit('close')">
  <template #header-left><button v-if="navigation.canBack" class="back-button" @tap="goBack"><uni-icons type="back" size="15" color="#63776a" /></button></template>
  <TaskInboxContent ref="content" class="inbox-host" :open="open" :source="source" @navigation="navigation = $event" @unread-count="$emit('unread-count', $event)" @reference="$emit('reference', $event)" />
 </DeviceSheet>
</template>
<script setup>
import { ref } from 'vue'
import DeviceSheet from './DeviceSheet.vue'
import TaskInboxContent from './TaskInboxContent.vue'
defineProps({ open: Boolean, source: { type: String, default: 'office' } })
const emit = defineEmits(['close', 'unread-count', 'reference'])
const content = ref(null), navigation = ref({ title: '', canBack: false })
function goBack() { if (!content.value?.back()) emit('close') }
</script>
<style scoped>
.inbox-host { height:0; min-height:0; flex:1; display:flex; flex-direction:column; }
.back-button { width:32px; height:32px; margin:0 8px 0 0; padding:0; display:flex; align-items:center; justify-content:center; background:#eff3ef; border-radius:16px; }
.back-button::after { border:0; }
</style>
