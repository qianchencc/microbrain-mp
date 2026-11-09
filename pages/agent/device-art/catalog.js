const artwork = Object.freeze({
  'access-door': Object.freeze({
    key: 'access-door',
    code: 'DOOR',
    label: '门禁 / 电动门',
    src: '/static/device-art/access-sliding-door.png',
    variant: 'access-door',
  }),
  'ac-central': Object.freeze({
    key: 'ac-central',
    code: 'AC',
    label: '空调 / 中央空调',
    src: '/static/device-art/central-ac-cassette.png',
    variant: 'central-ac',
  }),
  'generic-device': Object.freeze({
    key: 'generic-device',
    code: 'DEV',
    label: '设备',
    src: null,
    variant: 'generic',
  }),
  'lighting-generic': Object.freeze({
    key: 'lighting-generic',
    code: 'LGT',
    label: '照明 / 设备',
    src: null,
    variant: 'generic',
  }),
  'lighting-grille': Object.freeze({
    key: 'lighting-grille',
    code: 'LGT',
    label: '照明 / 格栅灯',
    src: '/static/device-art/lighting-grille-luminaire.png',
    variant: 'grille',
  }),
  'lighting-linear': Object.freeze({
    key: 'lighting-linear',
    code: 'LGT',
    label: '照明 / 灯带',
    src: '/static/device-art/lighting-linear-luminaire.png',
    variant: 'linear',
  }),
  'video-camera': Object.freeze({
    key: 'video-camera',
    code: 'CAM',
    label: '视频监控',
    src: '/static/device-art/video-dome-camera.png',
    variant: 'video',
  }),
  'environment-sensor': Object.freeze({
    key: 'environment-sensor',
    code: 'ENV',
    label: '环境传感器',
    src: '/static/device-art/environment-air-quality-sensor.png',
    variant: 'observe',
  }),
  'energy-meter': Object.freeze({
    key: 'energy-meter',
    code: 'ENG',
    label: '能耗计量',
    src: '/static/device-art/energy-digital-meter.png',
    variant: 'observe',
  }),
  'safety-smoke': Object.freeze({
    key: 'safety-smoke',
    code: 'SAFE',
    label: '安全 / 烟感',
    src: '/static/device-art/safety-smoke-detector.png',
    variant: 'observe',
  }),
  'safety-gas': Object.freeze({
    key: 'safety-gas',
    code: 'SAFE',
    label: '安全 / 燃气',
    src: '/static/device-art/safety-gas-detector.png',
    variant: 'observe',
  }),
  'safety-water': Object.freeze({
    key: 'safety-water',
    code: 'SAFE',
    label: '安全 / 水浸',
    src: '/static/device-art/safety-water-leak-sensor.png',
    variant: 'observe',
  }),
  'safety-sensor': Object.freeze({
    key: 'safety-sensor',
    code: 'SAFE',
    label: '安全传感器',
    src: null,
    variant: 'observe',
  }),
});

const artworkRules = [
  { key: 'lighting-linear', terms: ['灯带', '线性灯'] },
  { key: 'lighting-grille', terms: ['格栅灯', '栅格灯'] },
];

export function resolveDeviceArtwork(device = {}) {
  if (device.kind === 'access') return artwork['access-door'];
  const explicitKey = String(device.visualKey ?? '').trim();
  if (Object.hasOwn(artwork, explicitKey)) return artwork[explicitKey];
  if (device.kind === 'ac') return artwork['ac-central'];
  if (device.kind === 'video') return artwork['video-camera'];
  if (device.kind === 'environment') return artwork['environment-sensor'];
  if (device.kind === 'energy') return artwork['energy-meter'];
  if (device.kind === 'safety') {
    // 上游可能不投影 subtype：与 runtime domain.safetySubtypeOf 同一判定，按设备名兜底。
    const raw = device.subtype === 'flooding' ? 'water' : device.subtype;
    const subtype = raw || safetySubtypeOfName(`${device.deviceName ?? ''} ${device.name ?? ''}`);
    return artwork[`safety-${subtype}`] ?? artwork['safety-sensor'];
  }

  const haystack = normalize(`${device.deviceName ?? ''} ${device.location ?? ''}`);
  const matchedRule = artworkRules.find(({ terms }) =>
    terms.some((term) => haystack.includes(term))
  );
  if (matchedRule) return artwork[matchedRule.key];
  if (device.kind === 'lighting') return artwork['lighting-generic'];
  return artwork['generic-device'];
}

// 与 runtime domain.safetySubtypeOf 同一判定：烟 / 水浸 / 燃气。
// 观察面经 observation-view.mjs 转出口供台账/详情行复用，勿另写近义正则。
export function safetySubtypeOfName(name) {
  const text = String(name || '');
  if (/烟/.test(text)) return 'smoke';
  if (/水浸/.test(text)) return 'water';
  if (/燃气/.test(text)) return 'gas';
  return '';
}

export function deviceDisplayName(deviceName) {
  const normalized = String(deviceName ?? '')
    .normalize('NFKC')
    .trim();
  if (!normalized) return '未命名设备';
  return (
    normalized
      .split(/\s*-\s*/u)
      .filter(Boolean)
      .at(-1) ?? normalized
  );
}

export function deviceLocationLabel(device = {}) {
  const location = String(device.location ?? '').trim();
  if (
    !location ||
    [device.deviceName, deviceDisplayName(device.deviceName)].some(
      (name) => normalize(String(name ?? '')) === normalize(location)
    )
  )
    return '';
  return location;
}

function normalize(value) {
  return value.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase('zh-CN');
}
