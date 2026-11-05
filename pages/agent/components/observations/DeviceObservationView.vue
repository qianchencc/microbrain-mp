<template>
  <view class="device-view obs-view">
    <view class="device-hero">
      <view class="hero-art">
        <image
          v-if="device.artwork"
          :src="device.artwork"
          mode="aspectFit"
        />
        <view
          v-else-if="device.artVariant === 'video'"
          class="art-cam"
          ><view class="art-cam__lens"
        /></view>
        <view
          v-else-if="device.artVariant === 'observe'"
          class="art-sensor"
        />
        <uni-icons
          v-else
          type="gear"
          size="27"
          color="var(--agent-text-muted)"
        />
      </view>
      <view class="hero-copy"
        ><text class="hero-name">{{ device.name }}</text
        ><text class="hero-location">{{ device.kindLabel }} · {{ device.location }}</text
        ><text class="hero-state">{{ device.detail }}</text></view
      >
    </view>
    <scroll-view
      class="obs-body"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <view
        v-if="device.kind === 'video'"
        class="obs-block"
      >
        <view class="obs-head">实时画面</view>
        <view class="obs-line"
          ><view
            class="dot"
            :class="videoDot"
          /><text>{{ videoText }}</text></view
        >
        <button
          class="view-btn"
          :disabled="playDisabled"
          hover-class="view-btn--pressed"
          @tap="openPlayer"
          >{{ playLabel }}</button
        >
        <button
          class="view-btn"
          :disabled="!playerReady"
          hover-class="view-btn--pressed"
          @tap="showPlayback = !showPlayback"
          >{{ showPlayback ? '收起录像期间' : '录像回放' }}</button
        >
        <VideoPlaybackForm
          v-if="showPlayback"
          :device="device"
          :ready="playerReady"
          :busy="fetching"
          @open="openRecording"
        />
      </view>
      <view
        v-else-if="device.kind === 'environment'"
        class="obs-block"
      >
        <view class="obs-head"
          >环境读数<text
            v-if="envSource"
            class="src"
            :class="{ shadow: isShadow }"
            >{{ envSource }}</text
          ></view
        >
        <view
          v-if="envCells.length"
          class="metric-grid"
        >
          <view
            v-for="cell in envCells"
            :key="cell.key"
            class="metric"
            ><text class="metric-value">{{ cell.value }}</text
            ><text class="metric-key">{{ cell.label }}</text></view
          >
        </view>
        <view
          v-else
          class="obs-line"
          ><view class="dot warn" /><text>读数未知</text></view
        >
      </view>
      <view
        v-else-if="device.kind === 'energy'"
        class="obs-block"
      >
        <view class="obs-head">最新已知读数</view>
        <text class="energy-power">{{ energyPower }}</text>
        <view
          v-if="energyCurrents.length"
          class="energy-detail"
          ><text
            v-for="cell in energyCurrents"
            :key="cell.key"
            >{{ cell.key }} {{ cell.value }}</text
          ></view
        >
        <text
          v-if="energyTime"
          class="obs-meta"
          :class="{ stale: isStale }"
          >读于 {{ energyTime }}<text v-if="energyAge"> · {{ energyAge }}</text></text
        >
        <text
          v-else
          class="obs-meta"
          >读数时间未知</text
        >
      </view>
      <view
        v-else-if="device.kind === 'safety'"
        class="obs-block"
      >
        <view class="obs-head">安全监测</view>
        <view class="obs-line"
          ><view class="dot warn" /><text>{{ subtypeText }}台账</text></view
        >
      </view>
      <view
        v-else
        class="obs-block"
        ><view class="obs-line"
          ><view class="dot warn" /><text>{{ device.detail }}</text></view
        ></view
      >
      <view class="obs-tail" />
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { openVideoPlayer, videoPlayerReady } from '../../lib/video.mjs';
import VideoPlaybackForm from './VideoPlaybackForm.vue';
import {
  ageHint,
  energyCurrentCells,
  energyPowerText,
  energyStale,
  environmentCells,
  environmentSource,
  fmtDateTime,
  safetySubtypeOfName,
  safetySubtypeText,
  videoOnline,
  videoStateText,
  videoViewLabel,
} from '../../lib/observations.mjs';

const props = defineProps({
  device: Object,
  reading: Object,
  source: { type: String, default: 'office' },
});
const fetching = ref(false);
const showPlayback = ref(false);
const playerReady = videoPlayerReady();
const state = computed(() => props.reading?.state ?? null);

const online = computed(() => videoOnline(state.value));
const videoDot = computed(() =>
  online.value === true ? 'on' : online.value === false ? 'off' : 'warn'
);
const videoText = computed(() => videoStateText(online.value));
const playLabel = computed(() => videoViewLabel(online.value, playerReady, fetching.value));
const playDisabled = computed(() => !playerReady || online.value !== true || fetching.value);
async function openPlayer() {
  if (playDisabled.value) return;
  fetching.value = true;
  try {
    await openVideoPlayer({
      deviceId: props.device.id,
      name: props.device.name,
      location: props.device.location,
      source: props.source,
    });
  } finally {
    fetching.value = false;
  }
}
async function openRecording(window) {
  if (!playerReady || fetching.value) return;
  fetching.value = true;
  try {
    await openVideoPlayer({
      deviceId: props.device.id,
      name: props.device.name,
      location: props.device.location,
      source: props.source,
      mode: 'playback',
      ...window,
    });
  } finally {
    fetching.value = false;
  }
}

const envCells = computed(() => environmentCells(state.value));
const envSource = computed(() => environmentSource(state.value));
const isShadow = computed(() => envSource.value === '平台影子值');

const energyReading = computed(() =>
  state.value && typeof state.value === 'object' ? state.value : null
);
const energyPower = computed(() => energyPowerText(energyReading.value));
const energyCurrents = computed(() => energyCurrentCells(energyReading.value));
const energyTime = computed(() => fmtDateTime(energyReading.value?.readTime));
const energyAge = computed(() => ageHint(energyReading.value?.readTime));
const isStale = computed(() => energyStale(energyReading.value));

const subtypeText = computed(() => safetySubtypeText(safetySubtypeOfName(props.device?.name)));
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
}
button::after {
  border: 0;
}
.device-view {
  height: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.device-hero {
  display: flex;
  gap: 12px;
  padding: 10px 20px 14px;
  align-items: center;
}
.hero-art {
  width: 76px;
  height: 70px;
  flex-shrink: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(155deg, var(--agent-tint), var(--agent-surface-page));
  box-shadow:
    inset 0 1px 0 #ffffffb3,
    0 4px 12px -8px rgba(var(--agent-shadow-rgb), 0.3);
}
.hero-art image {
  width: 90%;
  height: 90%;
}
.hero-copy {
  min-width: 0;
  flex: 1;
}
.hero-name,
.hero-location,
.hero-state {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hero-name {
  color: var(--agent-text-primary);
  font-size: 13px;
  font-weight: 700;
}
.hero-location {
  margin-top: 4px;
  color: var(--agent-text-muted);
  font-size: 10px;
}
.hero-state {
  margin-top: 7px;
  color: var(--agent-text-secondary);
  font-size: 11px;
}
.obs-body {
  height: 0;
  flex: 1;
  min-height: 0;
  padding: 0 20px;
  box-sizing: border-box;
}
.obs-block {
  padding: 12px 0 14px;
  border-top: 1px solid var(--agent-line);
}
.obs-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 600;
  color: var(--agent-text-secondary);
}
.src {
  padding: 2px 7px;
  border-radius: 8px;
  background: var(--agent-accent-faint);
  color: var(--agent-accent-deep);
  font-size: 9px;
  font-weight: 600;
}
.src.shadow {
  background: var(--agent-warning-faint);
  color: var(--agent-warning-deep);
}
.obs-line {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  margin-top: 10px;
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
}
.dot {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  border-radius: 50%;
}
.dot.on {
  background: var(--agent-success);
  box-shadow: 0 0 0 3px var(--agent-success-faint);
}
.dot.off {
  background: var(--agent-text-faint);
}
.dot.warn {
  background: $agent-color-warning;
}
.view-btn {
  margin-top: 12px;
  width: 100%;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(155deg, var(--agent-accent), var(--agent-accent-deep));
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 4px 12px -5px rgba(var(--agent-ink-rgb), 0.55);
  transition: transform 130ms cubic-bezier(0.23, 1, 0.32, 1);
}
.view-btn[disabled] {
  background: linear-gradient(155deg, var(--agent-tint), var(--agent-line));
  color: var(--agent-text-muted);
  font-weight: 500;
  box-shadow: none;
}
.view-btn--pressed:not([disabled]) {
  transform: scale(0.97);
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $agent-space-small;
  margin-top: 10px;
}
.metric {
  padding: 9px 10px 8px;
  border-radius: 8px;
  background: var(--agent-surface);
  box-shadow: inset 0 0 0 0.5px var(--agent-line);
}
.metric-value {
  display: block;
  color: var(--agent-accent-deep);
  font-size: 15px;
  font-weight: 700;
}
.metric-key {
  display: block;
  margin-top: 2px;
  color: var(--agent-text-muted);
  font-size: 9px;
}
.energy-power {
  display: block;
  margin-top: 10px;
  color: var(--agent-accent-deep);
  font-size: 20px;
  font-weight: 700;
}
.energy-detail {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  color: var(--agent-text-secondary);
  font-size: 10px;
}
.obs-meta {
  display: block;
  margin-top: 8px;
  color: var(--agent-text-muted);
  font-size: 10px;
}
.obs-meta.stale {
  color: $agent-color-warning;
}
.obs-tail {
  height: 24px;
}
.art-cam {
  width: 46px;
  height: 28px;
  position: relative;
  border-radius: 7px;
  background: linear-gradient(160deg, var(--agent-text-secondary), var(--agent-text-primary));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 5px 12px -6px rgba(var(--agent-ink-rgb), 0.65);
}
.art-cam::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 9px;
  width: 7px;
  height: 10px;
  border-radius: 1px 3px 3px 1px;
  background: linear-gradient(90deg, var(--agent-text-primary), var(--agent-text-secondary));
}
.art-cam__lens {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 32%,
    var(--agent-text-faint),
    var(--agent-accent-deep) 55%,
    var(--agent-text-primary)
  );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}
.art-sensor {
  width: 30px;
  height: 30px;
  position: relative;
  border-radius: 50%;
  background: linear-gradient(160deg, var(--agent-surface-page), var(--agent-line));
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -3px 6px rgba(var(--agent-shadow-rgb), 0.18),
    0 4px 10px -5px rgba(var(--agent-ink-rgb), 0.5);
}
.art-sensor::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 11px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 32%,
    var(--agent-text-faint),
    var(--agent-accent-deep) 70%
  );
  box-shadow: 0 0 4px rgba(var(--agent-shadow-rgb), 0.33);
}
.art-sensor::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 20px;
  right: 6px;
  height: 1px;
  background: rgba(var(--agent-shadow-rgb), 0.25);
}
@media (prefers-reduced-motion: reduce) {
  .view-btn {
    transition: none;
  }
}
</style>
