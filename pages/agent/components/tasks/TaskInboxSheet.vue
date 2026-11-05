<template>
  <DeviceSheet
    :open="open"
    :back="goBack"
    tall
    compact-header
    :title="navigation.title || '通知中心'"
    :subtitle="navigation.canBack ? '' : sourceLabel + ' Agent · ' + lastUnread + ' 条未读'"
    @close="$emit('close')"
  >
    <template #header-left
      ><button
        v-if="navigation.canBack"
        class="back-button"
        @tap="goBack"
        ><uni-icons
          type="back"
          size="15"
          color="var(--agent-text-muted)" /></button
    ></template>
    <TaskInboxContent
      ref="content"
      class="inbox-host"
      :open="open"
      :source="source"
      @navigation="navigation = $event"
      @unread-count="onUnread"
      @reference="$emit('reference', $event)"
    />
  </DeviceSheet>
</template>
<script setup>
import { computed, ref } from 'vue';
import DeviceSheet from '../shared/DeviceSheet.vue';
import TaskInboxContent from './TaskInboxContent.vue';
const props = defineProps({ open: Boolean, source: { type: String, default: 'office' } });
const emit = defineEmits(['close', 'unread-count', 'reference']);
const content = ref(null),
  navigation = ref({ title: '', canBack: false }),
  lastUnread = ref(0);
const sourceLabel = computed(() => (props.source === 'company' ? '公司' : '办公室'));
function onUnread(count) {
  lastUnread.value = Number(count) || 0;
  emit('unread-count', count);
}
function goBack() {
  if (!content.value?.back()) emit('close');
}
</script>
<style scoped>
.inbox-host {
  height: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.back-button {
  width: 32px;
  height: 32px;
  margin: 0 8px 0 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--agent-tint);
  border-radius: 16px;
}
.back-button::after {
  border: 0;
}
</style>
