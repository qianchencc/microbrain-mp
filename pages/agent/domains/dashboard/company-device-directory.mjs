import { resolveDeviceArtwork, safetySubtypeOfName } from '../../device-art/catalog.js';

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
const TYPE_TAIL =
  /(电表|水浸感应器|燃气感应器|光电感烟探测器|感应器|探测器|传感器|开关|智慧空调|空调|门禁|监控|摄像头|摄像机)$/u;

function locationKey(device) {
  if (device.location?.trim()) return device.location.trim();
  const name = (device.name || '').trim();
  const segments = name
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length > 1) {
    const rest = segments.slice(1);
    return rest.length > 1 ? rest.slice(0, -1).join('-') : rest[0];
  }
  return name.replace(TYPE_TAIL, '').trim() || '未标位置';
}

function typeLabel(device) {
  if (device.kind === 'safety') {
    const subtype = device.subtype || safetySubtypeOfName(device.name);
    if (subtype) return SUBTYPE_LABEL[subtype] || subtype;
  }
  return KIND_LABEL[device.kind] || '设备';
}

function addGroup(groups, label, device) {
  if (!groups.has(label)) groups.set(label, []);
  groups.get(label).push(device);
}

// Prepare both views when directory facts change, never when a grouping button is tapped.
export function prepareCompanyDeviceDirectory(devices) {
  const items = [],
    locations = new Map(),
    kinds = new Map();
  for (const device of devices) {
    const location = locationKey(device),
      type = typeLabel(device);
    const row = {
      id: device.id,
      kind: device.kind,
      key: `${device.kind}:${device.id}`,
      name: device.name,
      location:
        device.location?.trim() || (location === device.name?.trim() ? '未标位置' : location),
      typeLabel: type,
      artwork: resolveDeviceArtwork({
        ...device,
        deviceName: device.name,
        location: device.location || device.name,
      }),
      searchText: [device.name, location, type, KIND_LABEL[device.kind]]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(),
    };
    items.push(row);
    addGroup(locations, location, row);
    addGroup(kinds, type, row);
  }
  const groups = (entries) => [...entries].map(([label, members]) => ({ label, items: members }));
  return { items, groups: { location: groups(locations), kind: groups(kinds) } };
}

export function filterCompanyDeviceDirectory(directory, { kind, query = '' }) {
  const needle = query.trim().toLocaleLowerCase();
  if (kind === 'catalog' && !needle) return directory;
  const items = directory.items.filter(
    (device) =>
      (kind === 'catalog' || device.kind === kind) &&
      (!needle || device.searchText.includes(needle))
  );
  const matches = new Set(items.map((device) => device.key));
  const filterGroups = (groups) =>
    groups.flatMap((group) => {
      const members = group.items.filter((device) => matches.has(device.key));
      return members.length ? [{ label: group.label, items: members }] : [];
    });
  return {
    items,
    groups: {
      location: filterGroups(directory.groups.location),
      kind: filterGroups(directory.groups.kind),
    },
  };
}
