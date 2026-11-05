<template>
  <view
    v-if="items.length"
    class="activity"
    aria-label="Agent 处理进度"
  >
    <view
      v-for="(item, index) in items"
      :key="item.id"
      class="activity__item"
    >
      <view class="activity__rail">
        <view class="activity__marker">
          <view
            v-if="item.kind === 'idea'"
            class="activity__badge activity__badge--idea"
            ><view class="activity__idea-dot"
          /></view>
          <view
            v-else-if="item.status === 'completed'"
            class="activity__badge activity__badge--done"
            ><view class="activity__check"
          /></view>
          <view
            v-else-if="item.status === 'failed'"
            class="activity__badge activity__badge--failed"
            ><view class="activity__cross"
          /></view>
          <view
            v-else-if="isActive(item)"
            class="activity__pulse"
          />
          <view
            v-else-if="item.status === 'skipped'"
            class="activity__muted"
          />
          <view
            v-else
            class="activity__idle"
          />
        </view>
        <view
          v-if="index < items.length - 1"
          class="activity__line"
        />
      </view>
      <view class="activity__content">
        <view
          class="activity__title"
          :class="{ 'activity__title--idea': item.kind === 'idea' }"
        >
          <text>{{ item.label || labels[item.tool] || '处理设备请求' }}</text>
          <text
            v-if="stateWord(item)"
            class="activity__state"
            :class="'activity__state--' + item.status"
            >{{ stateWord(item) }}</text
          >
        </view>
        <view
          v-if="item.summary"
          class="activity__summary"
          >{{ plain(item.summary) }}</view
        >
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const labels = {
  find_device_candidates: '检索设备候选',
  inspect_device_capabilities: '核验设备能力',
  read_device_states: '查询设备状态',
  propose_action_draft: '生成操作草案',
};

// 台账行是紧凑过程文字：去掉行内 markdown 记号，保留原文文字本身。
const plain = (text) =>
  String(text ?? '').replace(/\*\*([^*]+)\*\*|`([^`]+)`/g, (_m, bold, code) => bold ?? code ?? '');
const isActive = (item) => ['running', 'searching'].includes(item.status);
const stateWord = (item) =>
  isActive(item)
    ? '进行中'
    : item.status === 'failed'
      ? '未完成'
      : item.status === 'skipped'
        ? '已跳过'
        : '';
</script>

<style lang="scss" scoped>
@import '../../styles/tokens';

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
.activity {
  margin: 28rpx 0 32rpx;

  &__item {
    display: flex;
  }

  // 标记列：图标占固定格，连线 flex:1 随内容高度拉伸，天然连到下一节点。
  &__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40rpx;
    flex: 0 0 40rpx;
  }

  &__marker {
    width: 40rpx;
    height: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__badge {
    width: 32rpx;
    height: 32rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: activity-pop 200ms cubic-bezier(0.23, 1, 0.32, 1) both;

    &--done {
      background: $agent-color-success-faint;
    }
    &--failed {
      background: $agent-color-error-faint;
    }
    &--idea {
      background: $agent-color-warning-faint;
    }
  }

  &__idea-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background: $agent-color-warning;
  }

  &__check {
    width: 10rpx;
    height: 6rpx;
    border-left: 3rpx solid $agent-color-success;
    border-bottom: 3rpx solid $agent-color-success;
    transform: translateY(-1rpx) rotate(-45deg);
  }

  &__cross {
    position: relative;
    width: 12rpx;
    height: 12rpx;

    &::before,
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 3rpx;
      height: 12rpx;
      border-radius: 2rpx;
      background: $agent-color-error;
    }
    &::before {
      transform: translate(-50%, -50%) rotate(45deg);
    }
    &::after {
      transform: translate(-50%, -50%) rotate(-45deg);
    }
  }

  &__pulse {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background: $agent-color-accent;
    animation: activity-pulse 1.6s ease-in-out infinite;
  }

  &__muted {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background: $agent-color-text-faint;
  }

  &__idle {
    width: 14rpx;
    height: 14rpx;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2rpx dashed $agent-color-line;
  }

  &__line {
    flex: 1;
    width: 2rpx;
    min-height: 10rpx;
    background: rgba(var(--agent-shadow-rgb), 0.08);
  }

  &__content {
    min-width: 0;
    flex: 1;
    padding: 0 0 26rpx 12rpx;
  }

  &__item:last-child &__content {
    padding-bottom: 2rpx;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 10rpx;
    min-height: 40rpx;
    font-size: 26rpx;
    font-weight: 600;
    line-height: 40rpx;
    color: $agent-color-text-primary;

    &--idea {
      color: $agent-color-warning-deep;
    }
  }

  &__state {
    font-size: 20rpx;
    font-weight: 400;
    letter-spacing: 1rpx;
    color: $agent-color-accent;

    &--failed {
      color: $agent-color-error;
    }
    &--skipped {
      color: $agent-color-text-faint;
    }
  }

  // 结果收进浅色 chip，而不是裸露的第二行文字。
  &__summary {
    margin-top: 10rpx;
    padding: 12rpx 16rpx;
    border-radius: 14rpx;
    background: rgba(var(--agent-shadow-rgb), 0.05);
    font-size: 23rpx;
    line-height: 1.6;
    color: $agent-color-text-secondary;
  }
}

@keyframes activity-pop {
  0% {
    opacity: 0;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes activity-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.82);
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity__badge,
  .activity__pulse {
    animation: none;
  }
}
</style>
