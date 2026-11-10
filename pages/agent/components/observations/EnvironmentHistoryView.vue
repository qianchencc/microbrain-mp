<template>
  <view class="history">
    <view class="ranger">
      <picker
        mode="date"
        :value="fromDate"
        :start="earliest || undefined"
        :disabled="!earliest"
        aria-label="开始日期"
        :end="today"
        @change="changeDate('from', $event.detail.value)"
        ><view class="rdate"
          >{{ fromDate
          }}<uni-icons
            type="down"
            size="10"
            color="var(--agent-text-muted)" /></view
      ></picker>
      <text class="rsep">至</text>
      <picker
        mode="date"
        :value="toDate"
        :disabled="!earliest"
        aria-label="结束日期"
        :start="dateLimits.min"
        :end="dateLimits.max"
        @change="changeDate('to', $event.detail.value)"
        ><view class="rdate"
          >{{ toDate
          }}<uni-icons
            type="down"
            size="10"
            color="var(--agent-text-muted)" /></view
      ></picker>
    </view>
    <scroll-view
      class="body"
      scroll-y
      enhanced
      :show-scrollbar="true"
    >
      <view class="paper"
        ><EnvironmentTrend
          v-if="report && (report.samples.length || report.coverage?.readSamples > 0)"
          :report="report"
          :show-window="false"
        /><text
          v-else-if="!error"
          class="empty"
          >{{ emptyMessage }}</text
        ></view
      >
      <view
        v-if="error"
        class="error"
        ><text>{{ error }}</text
        ><button @tap="load()">重试</button></view
      >
      <view
        v-if="report?.coverage?.readSamples > 0"
        class="foot"
      >
        <button
          class="question"
          hover-class="pressed"
          @tap="$emit('question', report.window)"
          ><uni-icons
            type="chatbubble"
            size="16"
            color="#fff"
          />
          向公司 Agent 询问此期间</button
        >
      </view>
    </scroll-view>
  </view>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { getEnvironmentHistory } from '@/apis/agent/observations';
import { getAgentStorageScope } from '@/utils/agent-session';
import { showAgentError } from '@/utils/agent-error';
import { useViewReads } from '../../lib/reads.mjs';
import EnvironmentTrend from './EnvironmentTrend.vue';
import {
  fmtShanghaiDateTime,
  mergeEnvironmentHistory,
  environmentDateRange,
  environmentRangeLimits,
} from '../../lib/observations.mjs';
const props = defineProps({ active: Boolean });
defineEmits(['question']);
const today = fmtShanghaiDateTime(new Date().toISOString()).slice(0, 10);
const fromDate = ref(today),
  toDate = ref(today),
  report = ref(null),
  earliest = ref(''),
  loading = ref(false),
  error = ref('');
const dateLimits = computed(() => environmentRangeLimits(fromDate.value, today));
const emptyMessage = computed(() => {
  if (loading.value) return '正在读取站点历史';
  if (report.value?.cache?.lastError) return `${report.value.cache.lastError}，请稍后重试`;
  if (report.value?.availableWindow?.from === null) return '当前授权范围暂无历史记录';
  if (report.value?.coverage?.complete)
    return '所选期间没有采样，请选择其他日期；实时读数另见概览。';
  return report.value ? '历史采样尚未完整，请稍后重试' : '本次未取得历史采样';
});
let scope = '',
  visible = true;
const reads = useViewReads(
  () => props.active,
  () => [fromDate.value, toDate.value]
);
function invalidate() {
  reads.invalidate();
  loading.value = false;
}
async function load() {
  if (!props.active || !visible || loading.value) return;
  let corrected = null;
  await reads.run(
    'history',
    (options) =>
      getEnvironmentHistory(
        {
          from: fromDate.value + 'T00:00:00+08:00',
          to: toDate.value + 'T23:59:59.999+08:00',
          resolution: 'auto',
        },
        options
      ),
    {
      start: () => {
        loading.value = true;
        error.value = '';
      },
      data: (value) => {
        scope = getAgentStorageScope();
        earliest.value = value.availableWindow?.from
          ? fmtShanghaiDateTime(value.availableWindow.from).slice(0, 10)
          : '';
        if (earliest.value)
          corrected = environmentDateRange(
            { from: fromDate.value, to: toDate.value },
            'from',
            fromDate.value,
            today,
            earliest.value
          );
        report.value = mergeEnvironmentHistory(null, value);
      },
      denied: () => {
        report.value = null;
      },
      error: (cause) => {
        showAgentError(cause, { fallback: '环境历史读取失败，请重试' });
        error.value = '读取失败';
      },
      finish: () => {
        loading.value = false;
      },
    }
  );
  if (
    corrected &&
    props.active &&
    visible &&
    scope === getAgentStorageScope() &&
    (corrected.from !== fromDate.value || corrected.to !== toDate.value)
  ) {
    invalidate();
    fromDate.value = corrected.from;
    toDate.value = corrected.to;
    report.value = null;
    void load();
  }
}
function changeDate(field, value) {
  const range = environmentDateRange(
    { from: fromDate.value, to: toDate.value },
    field,
    value,
    today,
    earliest.value
  );
  fromDate.value = range.from;
  toDate.value = range.to;
  invalidate();
  report.value = null;
  void load();
}
function resume() {
  if (props.active && (!report.value || scope !== getAgentStorageScope())) {
    invalidate();
    report.value = null;
    earliest.value = '';
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
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
}
.ranger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 2px 20px 14px;
  padding: 9px 0;
  border-radius: 11px;
  background: var(--agent-tint);
  font-size: 12px;
  color: var(--agent-text-secondary);
}
.rdate {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--agent-text-primary);
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.rsep {
  color: var(--agent-text-muted);
  font-size: 10px;
}
.body {
  flex: 1;
  min-height: 0;
  height: 0;
  box-sizing: border-box;
  padding-bottom: 14px;
}
.paper {
  margin: 0 20px;
  padding: 14px;
  background: linear-gradient(145deg, var(--agent-surface), var(--agent-surface-page));
  border: 1px solid var(--agent-line);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 4px 12px -10px rgba(var(--agent-shadow-rgb), 0.31);
}
button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 1.3;
}
button::after {
  border: 0;
}
.empty {
  display: block;
  padding: 20px;
  text-align: center;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.error {
  display: flex;
  justify-content: space-between;
  margin: 15px 20px;
  color: var(--agent-warning-deep);
}
.error button {
  font-size: $agent-font-size-compact;
  color: var(--agent-accent-deep);
}
.foot {
  padding: 14px 20px;
}
.question {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $agent-space-small;
  border-radius: 13px;
  font-size: $agent-font-size-compact;
  color: white;
  background: linear-gradient(155deg, var(--agent-accent), var(--agent-accent-deep));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.31),
    0 4px 10px -6px rgba(var(--agent-ink-rgb), 0.5);
}
.pressed {
  opacity: 0.75;
}
</style>
