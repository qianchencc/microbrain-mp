<template>
  <view class="agent-page">
    <!-- disabled 仅表示无会话可清；busy 时保留入口作逃生口（服务端 409 才是权威），
       否则 isRunning 卡死时用户没有任何自救手段（2026-09-17 预览整页失联） -->
    <AgentHeader
      :status="headerStatus"
      agent-name="办公室 Agent"
      :back-label="returnLabel"
      workbench
      :workbench-busy="navigating"
      inbox-enabled
      :inbox-unread-count="inboxCount"
      tasks-enabled
      @open-tasks="conv?.openTasks()"
      @open-inbox="conv?.openInbox()"
      @workbench="openWorkbench"
      :disabled="!connected"
      :error="hasError"
      @clear="conv?.clearHistory()"
      @back="returnToOffice"
    >
      <template #title
        ><RegionChip
          ref="regionChip"
          nav
      /></template>
    </AgentHeader>
    <AgentConversation
      v-if="!redirecting"
      ref="conv"
      class="agent-conv"
      source="office"
      :active="pageActive"
      @status="(value) => (headerStatus = value)"
      @connected="(value) => (connected = value)"
      @inbox-count="(value) => (inboxCount = value)"
      @error="(value) => (hasError = value)"
      @navigating="(value) => (navigating = value)"
    />
  </view>
</template>
<script setup>
// 办公室 Agent 页面宿主：会话主体在 AgentConversation；这里只做导航头接线、
// URL 深链解析与页面生命周期转发（active prop）。
// 公司 Agent 已迁至仪表盘浮层；source=company / 告警 / 引用 / 窗口参数一律重定向。
import { onMounted, ref } from 'vue';
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';
import AgentHeader from './components/shared/AgentHeader.vue';
import RegionChip from './components/regions/RegionChip.vue';
import AgentConversation from './components/conversation/AgentConversation.vue';
import { backToParent, previousPageLabel } from './lib/navigation.mjs';
import { focusRegion } from './lib/region-focus.mjs';
import { parseAgentContext, markAgentEntry } from './lib/conversation.mjs';

const conv = ref(null),
  regionChip = ref(null),
  pageActive = ref(false),
  redirecting = ref(false);
const returnLabel = ref('总览');
const headerStatus = ref('正在连接'),
  connected = ref(false),
  inboxCount = ref(0),
  hasError = ref(false),
  navigating = ref(false);
let pendingReference = null;

onLoad((options) => {
  returnLabel.value = previousPageLabel(getCurrentPages());
  const o = options || {};
  if (
    o.source === 'company' ||
    o.alertPrompt !== undefined ||
    o.prompt !== undefined ||
    o.safetyReference !== undefined ||
    o.environmentWindow !== undefined ||
    o.energyWindow !== undefined
  ) {
    redirecting.value = true;
    uni.redirectTo({
      url:
        '/pages/agent/dashboard?' +
        Object.keys(o)
          .map((key) => `${key}=${encodeURIComponent(o[key])}`)
          .join('&'),
    });
    return;
  }
  pendingReference = parseAgentContext(o, { company: false }).reference;
  uni.setNavigationBarTitle({ title: '办公室 Agent' });
});
// onLoad 先于组件挂载：暂存引用，挂载后经 staging 队列进 hydration 消费
onMounted(() => {
  markAgentEntry('office', 'mounted');
  if (pendingReference) conv.value?.setReference(pendingReference);
});
onShow(() => {
  pageActive.value = true;
  uni.setNavigationBarTitle({ title: '办公室 Agent' });
});
onHide(() => {
  pageActive.value = false;
});
function openWorkbench() {
  if (!focusRegion.value) {
    regionChip.value?.show();
    return;
  }
  if (!conv.value) {
    uni.showToast({ title: '正在恢复对话，请稍后重试', icon: 'none' });
    return;
  }
  conv.value.openRegion(focusRegion.value);
}
function returnToOffice() {
  backToParent();
}
</script>
<style scoped lang="scss">
@import './styles/tokens';
/* 宿主环境屏蔽：客户小程序全局 app.wxss 带 uni-app 模板元素级规则
   view{font-size:28rpx;line-height:1.8} / input,text{font-size:30rpx}，
   元素自身命中的规则优先于继承——会把所有不带字号类的 text/input 撑成 15px。
   组件必须对宿主全局样式中立：元素级 font-size/line-height 一律改回继承。 */
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.agent-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $agent-color-surface-page;
  color: $agent-color-text-primary;
}
.agent-conv {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
