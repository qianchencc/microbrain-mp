<template>
  <button
    class="plan-switch"
    :class="{ 'plan-switch--on': enabled, 'plan-switch--muted': busy || !manageable }"
    :disabled="busy"
    aria-role="switch"
    aria-label="周期任务"
    :aria-checked="enabled ? 'true' : 'false'"
    :aria-disabled="busy || !manageable ? 'true' : 'false'"
    :aria-busy="busy ? 'true' : 'false'"
    hover-class="plan-switch--pressed"
    @tap.stop="activate"
  >
    <view class="plan-switch-track"><view class="plan-switch-thumb" /></view>
  </button>
</template>

<script setup>
const props = defineProps({ enabled: Boolean, busy: Boolean, manageable: Boolean });
const emit = defineEmits(['toggle', 'unavailable']);
function activate() {
  if (!props.busy) emit(props.manageable ? 'toggle' : 'unavailable');
}
</script>

<style scoped lang="scss">
@import '../../styles/tokens';
.plan-switch {
  flex-shrink: 0;
  width: 52px;
  height: 44px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: transparent;
}
.plan-switch::after {
  border: 0;
}
.plan-switch[disabled] {
  background: transparent;
}
.plan-switch-track {
  width: 48px;
  height: 30px;
  padding: 2px;
  box-sizing: border-box;
  border-radius: 15px;
  background: $agent-color-line;
}
.plan-switch-thumb {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: $agent-color-surface;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
.plan-switch--on .plan-switch-track {
  background: $agent-color-accent-deep;
}
.plan-switch--on .plan-switch-thumb {
  transform: translateX(18px);
}
.plan-switch--muted {
  opacity: 0.55;
}
.plan-switch--pressed .plan-switch-track {
  opacity: 0.85;
}
@media (prefers-reduced-motion: reduce) {
  .plan-switch-thumb {
    transition: none;
  }
}
</style>
