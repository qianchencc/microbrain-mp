<template>
  <view
    class="region-row"
    :class="{ 'in-nav': nav }"
  >
    <view class="region-chip">
      <button
        class="region-name"
        :disabled="regionsLoading && !regions.length"
        hover-class="region-name--pressed"
        @tap="open = true"
        ><text>{{
          regionsLoading && !regions.length
            ? '正在读取区域'
            : regionsError
              ? '区域暂不可用'
              : focusRegion?.name || '暂无可用区域'
        }}</text></button
      >
      <button
        class="region-toggle"
        :disabled="regionsLoading && !regions.length"
        hover-class="region-toggle--pressed"
        aria-label="切换关注区域"
        @tap="open = true"
        ><uni-icons
          type="bottom"
          size="14"
          color="var(--agent-text-secondary)"
      /></button>
      <view
        v-if="anyAttention"
        class="chip-att"
        aria-hidden="true"
      />
    </view>
  </view>
  <button
    v-if="regionsError && !nav"
    class="region-retry"
    @tap="reloadRegions"
    >区域暂不可用 · 重试</button
  >
  <DeviceSheet
    :open="open"
    title="关注区域"
    @close="open = false"
  >
    <view
      v-if="!regions.length || regionsError"
      class="region-empty"
      ><text>{{
        regionsLoading ? '正在读取区域…' : regionsError ? '区域暂不可用' : '暂无可用区域'
      }}</text
      ><button
        v-if="!regionsLoading"
        class="region-retry"
        @tap="reloadRegions"
        >{{ regionsError ? '重新读取' : '刷新区域' }}</button
      ></view
    >
    <scroll-view
      class="region-options"
      :style="{ height: regions.length * 68 + 8 + 'px' }"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <radio-group @change="choose($event.detail.value)">
        <label
          v-for="region in regions"
          :key="region.id"
          class="region-option"
          :class="{ chosen: region.id === focusRegionId }"
          ><view class="option-copy"
            ><text>{{ region.name }}</text
            ><view
              v-if="region.attention"
              class="attention"
              ><view class="attention-dot" /><text>有异常结果</text></view
            ></view
          ><radio
            :value="region.id"
            :checked="region.id === focusRegionId"
            :color="colors.accent"
        /></label>
      </radio-group>
    </scroll-view>
  </DeviceSheet>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { useViewReads } from '../../lib/reads.mjs';
import { showAgentError } from '@/utils/agent-error';
import DeviceSheet from '../shared/DeviceSheet.vue';
import {
  regions,
  focusRegion,
  focusRegionId,
  regionsLoading,
  regionsError,
  selectFocusRegion,
  loadRegionFocus,
} from '../../lib/region-focus.mjs';
import { AGENT_COLORS as colors } from '../../styles/colors.js';
defineProps({ workbench: Boolean, nav: Boolean });
const emit = defineEmits(['open', 'change']);
const open = ref(false);
const reads = useViewReads(
  () => true,
  () => open.value
);
watch(open, (value) => {
  if (value) void reloadRegions();
});
defineExpose({
  show() {
    open.value = true;
  },
});
function reloadRegions() {
  return reads.run('directory', loadRegionFocus, {
    error: (cause) => showAgentError(cause, { fallback: '区域暂不可用' }),
  });
}
const anyAttention = computed(() => regions.value.some((region) => region.attention));
function choose(id) {
  if (selectFocusRegion(id)) {
    open.value = false;
    emit('change', focusRegion.value);
  }
}
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.region-row {
  padding: 0 18px 10px;
  display: flex;
}
.region-row.in-nav {
  padding: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
.region-retry {
  white-space: normal;
  word-break: break-word;
  line-height: 1.5;
  margin: 4px 0 0;
  padding: 0;
  min-height: 32px;
  background: transparent;
  color: var(--agent-error);
  font-size: $agent-font-size-compact;
  text-align: left;
}
.region-chip {
  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  border-radius: 16px;
  background: linear-gradient(var(--agent-surface), var(--agent-tint));
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 0 0 0.5px rgba(var(--agent-shadow-rgb), 0.14),
    0 3px 8px -6px rgba(var(--agent-ink-rgb), 0.4);
}
.chip-att {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--agent-warning);
  border: 2px solid var(--agent-surface-page);
  box-shadow: 0 1px 3px rgba(var(--agent-shadow-rgb), 0.35);
}
button {
  background: transparent;
  margin: 0;
  padding: 0;
  border-radius: 0;
  line-height: 1.2;
}
button::after {
  border: 0;
}
button[disabled] {
  background: transparent;
  color: var(--agent-text-muted);
}
.region-name {
  display: flex;
  flex: 1;
  overflow: hidden;
  align-items: center;
  gap: $agent-space-small;
  padding: 0 10px 0 13px;
  min-height: 44px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--agent-text-secondary);
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
.region-name--pressed {
  transform: scale(0.97);
}
.region-name text {
  max-width: 190px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.region-toggle {
  width: 42px;
  min-height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid rgba(var(--agent-shadow-rgb), 0.08);
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
.region-toggle--pressed {
  transform: scale(0.9);
}
.region-empty {
  padding: 24px 20px;
  color: var(--agent-text-muted);
  font-size: 13px;
}
.region-options {
  max-height: 45vh;
}
.region-option {
  margin: 0 16px 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 14px;
  color: var(--agent-text-secondary);
  font-size: 15px;
  transition: background-color 150ms ease;
}
.region-option.chosen {
  background: var(--agent-accent-faint);
}
.option-copy {
  min-width: 0;
}
.option-copy text {
  display: block;
}
.attention {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--agent-warning);
}
.attention-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--agent-warning);
  flex-shrink: 0;
}
</style>
