// 观察面共用呈现助手（ObservationCard / 区域抽屉观察 pane）：只格式化 runtime 给出的原始事实，不编造取值。

import { modeLabels } from '../actions/ac-draft.js';
import { safetySubtypeOfName } from '../../device-art/catalog.js';

export { safetySubtypeOfName };

const OBSERVE_STALE_MS = 24 * 3600 * 1000;

const SAFETY_SUBTYPES = { smoke: '烟感', water: '水浸', gas: '燃气' };
const ENV_KEYS = [
  ['temp', '温度', '°C'],
  ['humidity', '湿度', '%'],
  ['pm25', 'PM2.5', 'µg/m³'],
  ['pm101', 'PM10', 'µg/m³'],
  ['pm10', 'PM1.0', 'µg/m³'],
];

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function fmtDateTime(iso) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return '';
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtShanghaiDateTime(iso) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return '';
  return new Date(time + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

export function stateObservationLabel(snapshot, deviceId) {
  if (!snapshot || snapshot.status === 'empty') return '';
  const status = String(snapshot.status || '').toLowerCase();
  if (status === 'unavailable' || snapshot.cache?.status === 'unavailable') return '状态暂不可用';
  const labels = [];
  if (deviceId ? snapshot.missingDeviceIds?.includes(deviceId) : snapshot.missingDeviceIds?.length)
    labels.push(deviceId ? '本轮样本缺失' : '状态信息不完整');
  const sampledAt =
    snapshot.observedAtByDevice?.[deviceId] ?? snapshot.observedAt ?? snapshot.reportedAt;
  const time = fmtShanghaiDateTime(sampledAt);
  if (time) labels.push(`采样 ${time}`);
  return labels.join(' · ');
}

export function ageHint(iso, nowMs = Date.now()) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return '';
  const age = Math.max(0, nowMs - time);
  if (age < 60 * 1000) return '1 分钟内';
  if (age < 3600 * 1000) return `${Math.floor(age / 60000)} 分钟前`;
  if (age < 24 * 3600 * 1000) return `${Math.floor(age / 3600000)} 小时前`;
  if (age < 30 * 24 * 3600 * 1000) return `${Math.floor(age / 86400000)} 天前`;
  return `${Math.floor(age / (30 * 86400000))} 个月前`;
}

export const videoOnline = (value) => (value === true ? true : value === false ? false : null);
export const videoStateText = (online) =>
  online === true ? '在线' : online === false ? '离线' : '状态未知';

// 视频「查看画面」按钮文案：区分播放页未部署 / 取流中 / 可播 / 离线 / 未知。
export function videoViewLabel(online, playerReady, fetching) {
  if (fetching) return '正在取流…';
  if (!playerReady) return '播放页接入中';
  return online === true ? '查看画面' : online === false ? '已离线' : '状态未知';
}

// PM2.5 国标分级（µg/m³）：≤35 优、≤75 良、≤115 轻度污染、更高按中度污染起。
export function pm25Zone(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 35) return '优';
  if (value <= 75) return '良';
  if (value <= 115) return '轻度污染';
  return '中度污染';
}

// 舒适度对应的语义色调：good/ok/warn/bad，供标签着色。
export function pm25ZoneTone(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 35) return 'good';
  if (value <= 75) return 'ok';
  if (value <= 115) return 'warn';
  return 'bad';
}

// 湿度舒适区间（%）：≤40 偏干、40-60 舒适、60-70 偏湿、>70 潮湿。
export function humidityZone(value) {
  if (!Number.isFinite(value)) return '';
  if (value <= 40) return '偏干';
  if (value <= 60) return '舒适';
  if (value <= 70) return '偏湿';
  return '潮湿';
}

const ENV_ZONE = { pm25: pm25Zone, humidity: humidityZone };

export function environmentCells(reading) {
  if (!reading || typeof reading !== 'object') return [];
  return ENV_KEYS.flatMap(([key, label, unit]) => {
    const value = finite(reading[key]);
    if (value === null) return [];
    const zone = ENV_ZONE[key] ? ENV_ZONE[key](value) : '';
    return [{ key, label: `${label}:`, value: `${value}${unit}${zone ? ` · ${zone}` : ''}` }];
  });
}

export const environmentSource = (reading) =>
  reading?.source === 'shadow' ? '平台影子值' : reading?.source === 'device' ? '设备实时读' : '';

export function energyPowerText(reading) {
  const power = finite(reading?.totalActivePower);
  return power !== null ? `${power} kW` : reading ? '读数不全' : '暂无读数';
}

export function energyCurrentCells(reading) {
  return ['ia', 'ib', 'ic'].flatMap((key, index) => {
    const value = finite(reading?.[key]);
    return value === null ? [] : [{ key: `I${'abc'[index]}`, value: `${value} A` }];
  });
}

// 能耗读数允许陈旧：readTime 缺失或超过一天即标陈旧（标注不是拒绝）。
export function energyStale(reading, nowMs = Date.now()) {
  const time = Date.parse(reading?.readTime || '');
  return !Number.isFinite(time) || nowMs - time > OBSERVE_STALE_MS;
}

// 判定唯一实现移入 device-art/catalog.js（resolveDeviceArtwork 选图共用），此处仅转出口。

export const safetySubtypeText = (subtype) => SAFETY_SUBTYPES[subtype] || '安全';

// 空调巡检/调温行：指令与回读是不同事实。adjusted 只承诺「已下发调温指令」，
// 调后温度只写平台权威快照的回读值（afterSetpoint），不从指令目标反推设备已达目标值；
// 平台读数可能与现场面板（半度设定、事后手动改回）不一致，如实标注为平台回读。
const AC_DISPOSITIONS = {
  adjustable: '可调',
  unknown: '已下发',
  not_dispatched: '这次未调整',
};
const acAdjustedText = (target) =>
  Number.isFinite(target) ? `已下发调到${target}℃` : '已下发调温指令';
export const acDispositionText = (device, target) => {
  if (device.disposition === 'not_needed') return '已检查';
  if (device.disposition === 'satisfied') return '已下发';
  return (
    (device.disposition === 'adjusted'
      ? acAdjustedText(target)
      : AC_DISPOSITIONS[device.disposition]) || '已下发'
  );
};
export const acReadbackText = (device) =>
  finite(device?.afterSetpoint) !== null ? `平台回读 ${device.afterSetpoint}℃` : '';
export const acStateText = (device) =>
  [
    device.power === 'on' ? '开机' : device.power === 'off' ? '关机' : '电源未知',
    modeLabels[device.mode] || device.mode || '模式未知',
    Number.isFinite(device.setpoint) ? `${device.setpoint}℃` : '设定未知',
  ].join(' · ');
export const acDotOf = (device) =>
  device.disposition === 'adjustable' ? 'on' : device.disposition === 'not_needed' ? 'off' : 'warn';
export function acInspectionMeta(device, block) {
  const readback = acReadbackText(device);
  const target = block?.criteria?.setpoint?.value;
  return `${acDispositionText(device, target)} · ${block?.mode === 'adjust_to_26' ? '检查前：' : ''}${acStateText(device)}${readback ? ` · ${readback}` : ''}`;
}
