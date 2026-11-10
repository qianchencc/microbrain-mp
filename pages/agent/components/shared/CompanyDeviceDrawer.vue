<template>
  <view class="cdrawer">
    <view class="gmodes">
      <button
        v-for="mode in modes"
        :key="mode.key"
        class="gmode"
        :class="{ active: groupBy === mode.key }"
        @tap="groupBy = mode.key"
        >{{ mode.label }}</button
      >
      <text class="gcount">{{ devices.length }} 台</text>
    </view>
    <scroll-view
      class="dscroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
    >
      <view
        v-for="group in groups"
        :key="group.label"
        class="dgroup"
      >
        <button
          class="ghead"
          hover-class="none"
          :aria-expanded="!collapsed.has(group.label)"
          :aria-label="`${collapsed.has(group.label) ? '展开' : '收起'}${group.label}，${group.items.length}台设备`"
          @tap="toggle(group.label)"
          ><text class="gtitle">{{ group.label }}</text
          ><text class="gcount">{{ group.items.length }} 台</text
          ><image
            class="gcaret"
            :class="{ 'gcaret--up': !collapsed.has(group.label) }"
            src="/static/chevron-down.svg"
            aria-hidden="true"
          />
        </button>
        <view
          class="greveal"
          :class="{ 'greveal--open': !collapsed.has(group.label) }"
          :aria-hidden="collapsed.has(group.label)"
        >
          <view class="greveal-inner">
            <view class="dgrid">
              <view
                v-for="device in group.items"
                :key="device.kind + ':' + device.id"
                class="dcard"
              >
                <view class="dart"
                  ><image
                    v-if="artOf(device).src"
                    :src="artOf(device).src"
                    mode="aspectFit" /><view
                    v-else-if="artOf(device).variant === 'video'"
                    class="art-cam"
                    ><view class="art-cam__lens" /></view
                  ><view
                    v-else-if="artOf(device).variant === 'observe'"
                    class="art-sensor" /><uni-icons
                    v-else
                    type="gear"
                    size="28"
                    color="var(--agent-text-faint)"
                /></view>
                <view class="dcopy">
                  <text class="dname">{{ device.name }}</text>
                  <text class="dloc">{{ locationText(device) }}</text>
                  <text
                    v-if="typeLabel(device)"
                    class="dstate"
                    >{{ typeLabel(device) }}</text
                  >
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <text
        v-if="!devices.length"
        class="dempty"
        >该类别下暂无设备</text
      >
      <view class="dtail" />
    </scroll-view>
  </view>
</template>
<script setup>
import { computed, ref } from 'vue';
import { resolveDeviceArtwork, safetySubtypeOfName } from '../../device-art/catalog.js';

const props = defineProps({ devices: { type: Array, default: () => [] }, kind: String });

const modes = [
  { key: 'location', label: '位置' },
  { key: 'kind', label: '类型' },
];
const groupBy = ref('location');
const collapsed = ref(new Set());

const KIND_LABEL = {
  environment: '环境传感器',
  energy: '电表',
  safety: '消防安全',
  ac: '空调',
  lighting: '照明',
  access: '门禁',
  video: '视频监控',
};
const SUBTYPE_LABEL = { gas: '燃气', smoke: '烟感', water: '水浸', flooding: '水浸' };
// 先保留来源明确的位置；只有缺位置时才从设备名称推导空间分组。
const TYPE_TAIL =
  /(电表|水浸感应器|燃气感应器|光电感烟探测器|感应器|探测器|传感器|开关|智慧空调|空调|门禁|监控|摄像头|摄像机)$/u;
function locationKey(device) {
  if (device.location?.trim()) return device.location.trim();
  const name = (device.name || '').trim();
  const segs = name
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length > 1) {
    const rest = segs.slice(1);
    return rest.length > 1 ? rest.slice(0, -1).join('-') : rest[0];
  }
  const stripped = name.replace(TYPE_TAIL, '').trim();
  return stripped || '未标位置';
}
function typeLabel(device) {
  if (device.kind === 'safety') {
    const subtype = device.subtype || safetySubtypeOfName(device.name);
    if (subtype) return SUBTYPE_LABEL[subtype] || subtype;
  }
  return KIND_LABEL[device.kind] || '设备';
}
// 设备图与区域抽屉共用 catalog；保留 subtype，消防设备按实际类别选图。
function artOf(device) {
  return resolveDeviceArtwork({
    ...device,
    deviceName: device.name,
    location: device.location || device.name,
  });
}
function locationText(device) {
  if (device.location?.trim()) return device.location.trim();
  const key = locationKey(device);
  return key === device.name?.trim() ? '未标位置' : key;
}
const groups = computed(() => {
  const map = new Map();
  for (const device of props.devices) {
    const key = groupBy.value === 'location' ? locationKey(device) : typeLabel(device);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(device);
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }));
});
function toggle(label) {
  const next = new Set(collapsed.value);
  next.has(label) ? next.delete(label) : next.add(label);
  collapsed.value = next;
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
  line-height: 1.3;
}
button::after {
  border: 0;
}
.cdrawer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--agent-text-primary);
  font-size: 13px;
}
.gmodes {
  display: flex;
  align-items: center;
  gap: $agent-space-small;
  padding: 10px 16px;
  border-bottom: 1px solid var(--agent-line);
  flex-shrink: 0;
}
.gmode {
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
}
.gmode.active {
  background: $agent-color-accent;
  color: #fff;
}
.gcount {
  margin-left: auto;
  font-size: 11px;
  color: var(--agent-text-muted);
}
.dscroll {
  flex: 1;
  min-height: 0;
  height: 0;
  padding: 0 16px;
  box-sizing: border-box;
}
.dgroup {
  margin-top: 14px;
}
.ghead {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 8px 0;
  margin-bottom: 0;
  text-align: left;
  font-size: $agent-font-size-compact;
  font-weight: 600;
  color: var(--agent-text-primary);
}
.gtitle {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}
.gcount {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: var(--agent-text-muted);
}
.gcaret {
  display: block;
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  transition: transform 160ms ease;
}
.gcaret--up {
  transform: rotate(180deg);
}
.greveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 180ms cubic-bezier(0.4, 0, 0.2, 1);
}
.greveal--open {
  grid-template-rows: 1fr;
}
.greveal-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .greveal,
  .gcaret {
    transition: none;
  }
}
.dgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.dcard {
  border: 1px solid var(--agent-line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--agent-surface-page);
}
.dart {
  height: 64px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    155deg,
    var(--agent-tint),
    var(--agent-surface-page) 52%,
    var(--agent-tint)
  );
}
.dart image {
  width: 92%;
  height: 92%;
}
.art-sensor {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(160deg, var(--agent-surface-page), var(--agent-tint));
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -3px 6px rgba(var(--agent-shadow-rgb), 0.18),
    0 4px 10px -5px rgba(var(--agent-ink-rgb), 0.5);
  position: relative;
}
.art-sensor::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 32%, var(--agent-chart), var(--agent-accent-deep) 70%);
}
.art-sensor::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 19px;
  right: 5px;
  height: 1px;
  background: rgba(var(--agent-shadow-rgb), 0.25);
}
.art-cam {
  width: 44px;
  height: 26px;
  position: relative;
  border-radius: 7px;
  background: linear-gradient(160deg, var(--agent-accent-deep), var(--agent-text-primary));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}
.art-cam::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 8px;
  width: 7px;
  height: 10px;
  border-radius: 1px 3px 3px 1px;
  background: var(--agent-accent-deep);
}
.art-cam__lens {
  position: absolute;
  left: 8px;
  top: 7px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 32%,
    var(--agent-chart),
    var(--agent-accent-deep) 55%,
    var(--agent-text-primary)
  );
}
.dcopy {
  padding: 7px 9px 9px;
  min-width: 0;
}
.dname {
  display: block;
  font-size: $agent-font-size-compact;
  font-weight: 600;
  color: $agent-color-text-primary;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dloc {
  display: block;
  font-size: 10px;
  color: var(--agent-text-muted);
  margin-top: 3px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dstate {
  display: block;
  font-size: 10px;
  color: var(--agent-text-muted);
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px solid var(--agent-line);
}
.dempty {
  display: block;
  padding: 35px 0;
  text-align: center;
  color: var(--agent-text-muted);
  font-size: 11px;
}
.dtail {
  height: 28px;
}
</style>
