<template>
  <button
    class="agent-refresh"
    :aria-label="label"
    :disabled="disabled"
    @tap="$emit('tap')"
    ><uni-icons
      :class="{ 'agent-refresh-spin': loading }"
      type="refreshempty"
      :size="size"
      :color="color"
  /></button>
</template>
<script setup>
defineProps({
  loading: Boolean,
  disabled: Boolean,
  size: { type: [Number, String], default: 16 },
  color: { type: String, default: 'var(--agent-accent-deep)' },
  label: { type: String, default: '刷新' },
});
defineEmits(['tap']);
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
.agent-refresh {
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $agent-color-tint;
  line-height: 1;
}
.agent-refresh::after {
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .agent-refresh-spin {
    animation: none;
  }
}
.agent-refresh[disabled] {
  opacity: 0.5;
}
.agent-refresh-spin {
  animation: agent-refresh-spin 900ms linear infinite;
}
@keyframes agent-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
