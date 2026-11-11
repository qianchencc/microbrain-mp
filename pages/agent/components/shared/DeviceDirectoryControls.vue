<template>
  <view
    class="filter-header"
    :class="{ searching }"
  >
    <view class="group-controls">
      <button
        v-for="mode in modes"
        :key="mode.key"
        class="group-mode"
        :class="{ active: groupBy === mode.key }"
        :aria-pressed="groupBy === mode.key"
        hover-class="group-mode--pressed"
        @tap="$emit('update:groupBy', mode.key)"
        >{{ mode.label }}</button
      >
      <button
        class="icon-button"
        aria-label="搜索设备"
        hover-class="icon-button--pressed"
        @tap="openSearch"
      >
        <image src="/static/search.svg" />
      </button>
      <view class="controls-spacer" />
      <text class="count">{{ count }} 台</text>
    </view>
    <view class="search-controls">
      <button
        class="icon-button"
        aria-label="返回全部设备"
        hover-class="icon-button--pressed"
        @tap="closeSearch"
      >
        <image src="/static/back.svg" />
      </button>
      <view class="search-field">
        <image src="/static/search.svg" />
        <input
          :value="query"
          :placeholder="placeholder"
          placeholder-style="color:var(--agent-text-muted)"
          confirm-type="search"
          :focus="focused"
          :adjust-position="false"
          @input="$emit('update:query', $event.detail.value)"
        />
      </view>
    </view>
  </view>
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  modes: { type: Array, required: true },
  groupBy: { type: String, required: true },
  query: { type: String, default: '' },
  count: { type: Number, default: 0 },
  placeholder: { type: String, default: '搜索设备名称、位置或类型' },
});
const emit = defineEmits(['update:groupBy', 'update:query']);
const searching = ref(Boolean(props.query)),
  focused = ref(false);
function openSearch() {
  searching.value = true;
  nextTick(() => {
    if (searching.value) focused.value = true;
  });
}
function closeSearch() {
  const wasSearching = searching.value;
  searching.value = false;
  focused.value = false;
  if (props.query) emit('update:query', '');
  return wasSearching;
}
onBeforeUnmount(() => {
  searching.value = false;
});
defineExpose({ closeSearch });
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 1.2;
}
button::after {
  border: 0;
}
.filter-header {
  position: relative;
  height: 50px;
  flex-shrink: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-top: 1px solid var(--agent-line);
  border-bottom: 1px solid var(--agent-line);
  overflow: hidden;
}
.group-controls {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  transition:
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 140ms ease-out;
}
.search-controls {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  opacity: 0;
  transform: translateX(22px);
  pointer-events: none;
  transition:
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 140ms ease-out;
}
.filter-header.searching .group-controls {
  opacity: 0;
  transform: translateX(-22px);
  pointer-events: none;
}
.filter-header.searching .search-controls {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.group-mode {
  width: auto;
  flex-shrink: 0;
  height: 32px;
  min-width: 44px;
  padding: 0 13px;
  border-radius: 16px;
  background: var(--agent-tint);
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    transform 130ms cubic-bezier(0.23, 1, 0.32, 1);
}
.group-mode.active {
  background: $agent-color-accent;
  color: #fff;
}
.group-mode--pressed,
.icon-button--pressed {
  transform: scale(0.95);
}
.icon-button {
  width: 44px;
  height: 44px;
  border: 1px solid var(--agent-line);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-button image {
  width: 14px;
  height: 14px;
}
.controls-spacer {
  flex: 1;
  min-width: 0;
}
.count {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11px;
  color: var(--agent-text-muted);
}
.search-field {
  min-width: 0;
  flex: 1;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--agent-line);
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  background: $agent-color-surface-page;
}
.search-field image {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.search-field input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 13px;
  color: $agent-color-text-primary;
}
@media (prefers-reduced-motion: reduce) {
  .group-controls,
  .search-controls,
  .group-mode,
  .icon-button {
    transition: none;
  }
}
</style>
