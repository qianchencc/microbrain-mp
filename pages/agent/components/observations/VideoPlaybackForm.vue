<template>
  <view class="playback-form">
    <text class="camera">{{ device.name }}</text
    ><text class="location">{{ device.location }}</text>
    <text class="caption">录像开始 · 上海时间</text>
    <view class="pickers"
      ><picker
        mode="date"
        :value="dates.fromDate"
        @change="dates.fromDate = $event.detail.value"
        ><view
          >{{ dates.fromDate }}
          <uni-icons
            type="down"
            size="10"
            color="var(--agent-text-muted)" /></view></picker
      ><picker
        mode="time"
        :value="dates.fromTime"
        @change="dates.fromTime = $event.detail.value"
        ><view
          >{{ dates.fromTime }}
          <uni-icons
            type="down"
            size="10"
            color="var(--agent-text-muted)" /></view></picker
    ></view>
    <text class="caption">录像结束</text>
    <view class="pickers"
      ><picker
        mode="date"
        :value="dates.toDate"
        @change="dates.toDate = $event.detail.value"
        ><view
          >{{ dates.toDate }}
          <uni-icons
            type="down"
            size="10"
            color="var(--agent-text-muted)" /></view></picker
      ><picker
        mode="time"
        :value="dates.toTime"
        @change="dates.toTime = $event.detail.value"
        ><view
          >{{ dates.toTime }}
          <uni-icons
            type="down"
            size="10"
            color="var(--agent-text-muted)" /></view></picker
    ></view>
    <text class="note">单次最长三天</text>
    <text
      v-if="error"
      class="error"
      >{{ error }}</text
    >
    <button
      class="open-recording"
      :disabled="!ready || busy"
      hover-class="pressed"
      @tap="open"
      >{{ ready ? '查看这段录像' : '播放页接入中' }}
      <uni-icons
        type="right"
        size="12"
        color="#fff"
    /></button>
  </view>
</template>
<script setup>
import { reactive, ref } from 'vue';
import {
  defaultPlaybackDates,
  playbackDates,
  playbackWindowDates,
} from '../../lib/observations.mjs';
const props = defineProps({
  device: { type: Object, required: true },
  ready: Boolean,
  busy: Boolean,
});
const emit = defineEmits(['open']);
const dates = reactive(
    props.device.beginTime && props.device.endTime
      ? playbackWindowDates(props.device)
      : defaultPlaybackDates()
  ),
  error = ref('');
function open() {
  error.value = '';
  try {
    emit('open', playbackDates(dates));
  } catch (cause) {
    error.value = cause.message;
  }
}
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text {
  font-size: inherit;
  line-height: inherit;
}
.playback-form {
  padding: 0 20px 24px;
  font-size: $agent-font-size-compact;
  color: var(--agent-text-secondary);
}
.camera,
.location,
.caption,
.note,
.error {
  display: block;
}
.camera {
  font-weight: 600;
  font-size: 15px;
}
.location {
  margin-top: 5px;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.caption {
  margin: 22px 0 8px;
  font-size: 11px;
  color: var(--agent-text-muted);
}
.pickers {
  display: flex;
  gap: 10px;
}
.pickers picker {
  flex: 1;
}
.pickers view {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border: 1px solid var(--agent-line);
  border-radius: 9px;
  background: linear-gradient(145deg, var(--agent-surface), var(--agent-tint));
}
.note {
  color: var(--agent-text-muted);
  font-size: 11px;
  line-height: 1.7;
  margin-top: 18px;
}
.error {
  color: var(--agent-warning-deep);
  margin-top: 12px;
}
.open-recording {
  margin: 22px 0 0;
  padding: 0;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $agent-space-small;
  border-radius: $agent-radius-medium;
  background: linear-gradient(155deg, var(--agent-accent), var(--agent-accent-deep));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.31),
    0 4px 10px -6px rgba(var(--agent-ink-rgb), 0.5);
  color: white;
  font-size: 13px;
  line-height: 1.3;
}
.open-recording::after {
  border: 0;
}
.open-recording[disabled] {
  opacity: 0.45;
  color: white;
}
.pressed {
  opacity: 0.75;
}
</style>
