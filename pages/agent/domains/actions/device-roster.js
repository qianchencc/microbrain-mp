import { acSummary, operationLabel } from './ac-draft.js';
import { resolveDeviceArtwork, deviceDisplayName } from '../../device-art/catalog.js';

// 设备清单（action.proposed.inventory）：inventory 存提案时刻原始事实；
// 处置槽由活草案 join 推导——勾选/空调调温实时回流，清单是草案的活视图而非快照。
// 状态槽只来自观测：entry.state（提案时）被 result.observedStates（confirm 回读）覆盖，
// 执行后清单自然成为对账表；绝不由指令反推。文案单一来源：acSummary/operationLabel/deviceDisplayName。

const actionFor = (entry, draft) =>
  draft?.actions?.find((a) => a.deviceId === entry.deviceId) ?? null;
const isSelected = (entry, draft) => {
  const action = actionFor(entry, draft);
  return Boolean(action && draft?.selectedActionIds?.includes(action.id));
};

// 速览条：共找到=清单设备数；拟执行=清单内被勾选数（活 join）；不动=其余。
export function rosterLiveStats(entries = [], draft) {
  const operate = entries.filter((entry) => isSelected(entry, draft)).length;
  return { total: entries.length, operate, idle: entries.length - operate };
}

// 位置第一分组（同地址合并为一组），组内保持发现顺序；缺位置归入「其他位置」。
export function rosterGroups(entries = [], draft) {
  const groups = [];
  const byLocation = new Map();
  for (const entry of entries) {
    const location = String(entry.location ?? '').trim() || '其他位置';
    let group = byLocation.get(location);
    if (!group) {
      group = { location, items: [] };
      byLocation.set(location, group);
      groups.push(group);
    }
    group.items.push(entry);
  }
  for (const group of groups)
    group.operateCount = group.items.filter((item) => isSelected(item, draft)).length;
  return groups;
}

// 状态槽（迁移链「现状」侧）：照明=色点+布尔词；空调=acSummary 去「开启 · 」前缀；
// 门禁天然无可观状态给「—」；未读到一律「状态未知」。observed 为 confirm 回读覆盖源。
export function rosterStateView(entry, observed) {
  const state = observed?.[entry.deviceId] ?? entry.state;
  if (entry.kind === 'access') return { text: '—', dot: null };
  if (state == null) return { text: '状态未知', dot: entry.kind === 'lighting' ? 'off' : null };
  if (entry.kind === 'ac') {
    const summary = acSummary(state);
    return { text: summary ? summary.replace(/^开启 · /, '') : '状态未知', dot: null };
  }
  return { text: state === true ? '已点亮' : '已关闭', dot: state === true ? 'on' : 'off' };
}

// 处置槽（迁移链「意图」侧）：草案内已勾选 → `→ ${operationLabel(活指令)}`（调温实时回流）；
// 草案内未勾选 → 未选择；不在草案 → 按快照 disposition 给 已排除/不动。
export function rosterActionView(entry, draft) {
  const action = actionFor(entry, draft);
  if (!action) return { text: entry.disposition === 'excluded' ? '已排除' : '不动', quiet: true };
  if (!draft?.selectedActionIds?.includes(action.id)) return { text: '未选择', quiet: true };
  const target = operationLabel(action);
  if (action.kind === 'ac') {
    const compact = target.replace(/^开启 · /, '').replace(/°C/g, '°');
    return { text: compact === '关闭' ? '→ 关闭' : `→ ${compact}`, quiet: false };
  }
  if (action.kind === 'access') return { text: `→ ${target}`, quiet: false };
  return { text: `→ ${target === '开启' ? '打开' : '关闭'}`, quiet: false };
}

// 行视图：[类型标记] 短名 …… ●现状 → 意图。
// 标记优先 artwork.src 裸图（栅格灯/灯带/中央空调/门禁有真实插画），无图时退回 code 徽章。
export function rosterLiveView(entry, draft, observed) {
  const artwork = resolveDeviceArtwork({
    kind: entry.kind,
    deviceName: entry.name,
    location: entry.location,
  });
  const action = rosterActionView(entry, draft);
  return {
    key: entry.deviceId,
    marker: { src: artwork.src ?? null, code: artwork.code },
    name: deviceDisplayName(entry.name),
    state: rosterStateView(entry, observed),
    action,
    quiet: action.quiet,
  };
}
