<template>
  <view class="history">
    <view class="filters">
      <view class="types"
        ><button
          v-for="item in types"
          :key="item.type"
          :class="{ selected: type === item.type }"
          hover-class="pressed"
          @tap="chooseType(item.type)"
          >{{ item.label }}</button
        ></view
      >
      <view class="dates"
        ><picker
          mode="date"
          :value="fromDate || today"
          :end="endDate"
          @change="chooseDate('from', $event.detail.value)"
          ><view class="date-button"
            >{{ fromDate || '不限开始日期' }}
            <uni-icons
              type="down"
              size="10"
              color="var(--agent-text-muted)" /></view></picker
        ><text>至</text
        ><picker
          mode="date"
          :value="endDate"
          :start="fromDate || undefined"
          :end="today"
          @change="chooseDate('end', $event.detail.value)"
          ><view class="date-button"
            >{{ endDate }}
            <uni-icons
              type="down"
              size="10"
              color="var(--agent-text-muted)" /></view></picker
        ><button
          v-if="fromDate"
          class="reset"
          @tap="chooseDate('from', '')"
          >重置</button
        ></view
      >
    </view>
    <scroll-view
      class="records"
      scroll-y
      enhanced
      :show-scrollbar="false"
      :scroll-top="scrollTop"
      @scroll="scrollTop = $event.detail.scrollTop"
    >
      <view class="paper">
        <button
          v-for="record in records"
          :key="record.ledger + ':' + record.eventId + ':' + record.deviceId"
          class="record"
          hover-class="pressed"
          @tap="$emit('select', { record, observedAt })"
        >
          <view class="record-copy"
            ><text class="name">{{ record.deviceName }}</text
            ><text class="time">{{ fmtDateTime(record.occurredAt) }}</text
            ><text
              v-if="record.currentDevice"
              class="location"
              >{{
                record.currentDevice.location
                  ? `当前位置：${record.currentDevice.location}`
                  : '当前位置未核验'
              }}<text v-if="!record.currentDevice.name"> · 显示记录名称</text></text
            ><text
              v-else-if="record.location && record.location !== record.deviceName"
              class="location"
              >{{ record.location }}</text
            ></view
          >
          <uni-icons
            type="right"
            size="12"
            color="var(--agent-text-muted)"
          />
        </button>
        <text
          v-if="!records.length"
          class="empty"
          >{{
            loading
              ? '正在读取历史记录'
              : error
                ? '本次未取得记录'
                : cursor
                  ? '这一批没有可核实的匹配记录'
                  : '所选期间没有可核实的记录'
          }}</text
        >
      </view>
      <text
        v-if="error"
        class="error"
        aria-live="polite"
        >{{ error }}</text
      >
      <button
        v-if="cursor || error"
        class="more"
        :disabled="loading"
        hover-class="pressed"
        @tap="load(Boolean(error && !records.length), Boolean(error))"
        >{{ loading ? '正在读取…' : error ? '重试读取' : '查看更多记录' }}</button
      >
      <text
        v-else-if="loading"
        class="loading"
        >正在读取…</text
      >
    </scroll-view>
  </view>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { listSafetyHistory } from '@/apis/agent/observations';
import { getAgentStorageScope, isAgentStorageScope } from '@/utils/agent-session';
import { fmtDateTime } from '../../lib/observations.mjs';

const props = defineProps({ active: Boolean });
defineEmits(['select']);
const types = [
  { type: 'gas', label: '燃气' },
  { type: 'smoke', label: '烟感' },
  { type: 'water', label: '水浸' },
];
const today = fmtDateTime(new Date().toISOString()).slice(0, 10);
const type = ref('gas'),
  fromDate = ref(''),
  endDate = ref(today),
  scrollTop = ref(0);
const records = ref([]),
  observedAt = ref(''),
  cursor = ref(null),
  loading = ref(false),
  error = ref('');
let generation = 0,
  visible = true,
  scope = '',
  window = null;
function invalidate() {
  generation += 1;
  loading.value = false;
}
function reset() {
  invalidate();
  records.value = [];
  cursor.value = null;
  observedAt.value = '';
  error.value = '';
  scrollTop.value = 0;
  window = null;
}
async function load(first = true, force = false) {
  if (!props.active || !visible || loading.value) return;
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const identity = getAgentStorageScope();
    if (identity !== scope) {
      records.value = [];
      cursor.value = null;
      window = null;
      scope = identity;
    }
    const refreshCount = first ? Math.max(20, records.value.length) : 20;
    const query = {
      type: type.value,
      limit: 20,
      from:
        first || !window
          ? fromDate.value
            ? `${fromDate.value}T00:00:00+08:00`
            : undefined
          : window.from,
      to: first || !window ? `${endDate.value}T23:59:59.999+08:00` : window.to,
      cursor: first ? undefined : cursor.value,
    };
    const options = {
      force: force === true,
      isActive: () => current === generation && props.active && visible,
    };
    let result = await listSafetyHistory(query, options);
    const refreshed = [...(result.items || [])];
    while (first && refreshed.length < refreshCount && result.nextCursor) {
      if (
        current !== generation ||
        !props.active ||
        !visible ||
        identity !== getAgentStorageScope()
      )
        return;
      result = await listSafetyHistory(
        { type: type.value, limit: 20, ...result.window, cursor: result.nextCursor },
        options
      );
      refreshed.push(...(result.items || []));
    }
    if (current !== generation || !props.active || !visible || identity !== getAgentStorageScope())
      return;
    const existing = first ? [] : records.value;
    const seen = new Set(
      existing.map((record) => record.ledger + ':' + record.eventId + ':' + record.deviceId)
    );
    records.value = [
      ...existing,
      ...refreshed.filter(
        (record) => !seen.has(record.ledger + ':' + record.eventId + ':' + record.deviceId)
      ),
    ];
    cursor.value = result.nextCursor;
    observedAt.value = result.observedAt;
    window = result.window;
  } catch (cause) {
    if (current !== generation || !props.active || !visible) return;
    if (
      !isAgentStorageScope(scope) ||
      [401, 403].includes(cause.status) ||
      ['UNAUTHORIZED', 'FORBIDDEN'].includes(cause.data?.code)
    ) {
      records.value = [];
      cursor.value = null;
      observedAt.value = '';
    }
    if (cause.data?.code === 'INVALID_SAFETY_CURSOR') {
      records.value = [];
      cursor.value = null;
      window = null;
      observedAt.value = '';
    }
    error.value = cause.message || '安全历史暂不可用，请稍后重试';
  } finally {
    if (current === generation) loading.value = false;
  }
}
function chooseType(next) {
  if (type.value === next) return;
  type.value = next;
  reset();
  void load();
}
function chooseDate(field, value) {
  if (field === 'from') fromDate.value = value;
  else endDate.value = value;
  reset();
  void load();
}
function resume() {
  if (props.active) {
    if (scope !== getAgentStorageScope()) reset();
    void load();
  }
}
watch(
  () => props.active,
  (active) => {
    if (active) resume();
    else invalidate();
  },
  { immediate: true }
);
onHide(() => {
  visible = false;
  invalidate();
});
onShow(() => {
  visible = true;
  resume();
});
onBeforeUnmount(invalidate);
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.history {
  flex: 1;
  min-height: 0;
  height: 0;
  display: flex;
  flex-direction: column;
  color: var(--agent-text-primary);
  font-size: 13px;
}
button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 1.4;
}
button::after {
  border: 0;
}
.filters {
  flex-shrink: 0;
  padding: 4px 20px 14px;
  border-bottom: 1px solid var(--agent-line);
}
.types {
  display: flex;
  gap: 6px;
  padding: 3px;
  border-radius: $agent-radius-medium;
  background: var(--agent-tint);
}
.types button {
  flex: 1;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--agent-text-muted);
  border-radius: 9px;
  font-size: 13px;
}
.types .selected {
  background: var(--agent-surface);
  color: var(--agent-accent-deep);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(var(--agent-shadow-rgb), 0.12);
}
.dates {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  margin-top: 10px;
  font-size: 11px;
  color: var(--agent-text-muted);
  flex-wrap: wrap;
}
.date-button {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--agent-line);
  border-radius: 7px;
  color: var(--agent-text-secondary);
}
.reset {
  color: var(--agent-accent-deep);
  min-height: 32px;
  padding: 0 6px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.records {
  flex: 1;
  height: 0;
  min-height: 0;
}
.paper {
  margin: 14px 20px 0;
  padding: 0 14px;
  background: linear-gradient(145deg, var(--agent-surface), var(--agent-surface-page));
  border: 1px solid var(--agent-line);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 4px 12px -10px rgba(var(--agent-shadow-rgb), 0.31);
}
.record {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 75px;
  padding: 13px 0;
  border-bottom: 1px solid var(--agent-line);
  text-align: left;
}
.record-copy {
  flex: 1;
  min-width: 0;
}
.name {
  display: block;
  color: var(--agent-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.time,
.location {
  display: block;
  margin-top: 4px;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.empty {
  display: block;
  padding: 35px 0;
  text-align: center;
  color: var(--agent-text-muted);
}
.more {
  margin: 14px 20px;
  min-height: 40px;
  width: calc(100% - 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--agent-accent-deep);
  background: var(--agent-tint);
  border-radius: 10px;
  font-size: $agent-font-size-compact;
}
.error {
  display: block;
  margin: 12px 20px;
  color: var(--agent-warning-deep);
  font-size: $agent-font-size-compact;
}
.loading {
  display: block;
  margin: 12px 20px 18px;
  text-align: center;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.pressed {
  opacity: 0.7;
}
</style>
