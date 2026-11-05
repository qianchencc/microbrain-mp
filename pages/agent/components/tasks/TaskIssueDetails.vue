<template>
  <view class="issue-page">
    <button
      v-if="!backInHeader"
      class="issue-back"
      aria-label="返回上一页"
      @tap="$emit('close')"
      ><uni-icons
        type="back"
        size="15"
        color="var(--agent-text-muted)"
      /><text>返回</text></button
    >
    <scroll-view
      class="issue-scroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <text class="issue-title">{{ issue.title || '查看原因' }}</text>
      <text
        class="issue-reason"
        selectable
        >{{ issue.reason || '暂时没有更多说明' }}</text
      >
    </scroll-view>
    <button
      class="issue-copy"
      @tap="copy"
      >复制完整内容</button
    >
  </view>
</template>
<script setup>
const props = defineProps({ backInHeader: Boolean, issue: { type: Object, required: true } });
defineEmits(['close']);
function copy() {
  uni.setClipboardData({
    data: `${props.issue.title || '查看原因'}\n\n${props.issue.reason || '暂时没有更多说明'}`,
    fail: () => uni.showToast({ title: '暂时没能复制，请重试', icon: 'none' }),
  });
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
button {
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
}
button::after {
  border: 0;
}
.issue-page {
  height: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 20px 16px;
  color: $agent-color-text-secondary;
}
.issue-back {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  color: $agent-color-text-muted;
  font-size: $agent-font-size-compact;
}
.issue-scroll {
  height: 0;
  min-height: 0;
  flex: 1;
}
.issue-title {
  display: block;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 650;
}
.issue-reason {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.7;
  padding-bottom: 24px;
}
.issue-copy {
  min-height: 44px;
  margin-top: 12px;
  border: 1px solid $agent-color-line;
  border-radius: 8px;
  color: $agent-color-accent;
  font-size: $agent-font-size-compact;
}
</style>
