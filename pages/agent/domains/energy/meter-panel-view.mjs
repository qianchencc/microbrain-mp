const DAY = 86400000;
const OFFSET = 8 * 3600000;
const localIso = (ms) => new Date(ms + OFFSET).toISOString().replace('Z', '+08:00');
const dateMs = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('请选择有效日期');
  const ms = Date.parse(value + 'T00:00:00+08:00');
  if (!Number.isFinite(ms) || localIso(ms).slice(0, 10) !== value)
    throw new Error('请选择有效日期');
  return ms;
};

export function meterPanelQuery(selection, nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) throw new Error('当前时间不可用');
  const today = localIso(nowMs).slice(0, 10);
  const { preset = '7d', kind = 'statistics', scope = { level: 'all' } } = selection;
  let fromMs,
    toMs = nowMs;
  if (preset === '7d' || preset === '30d') fromMs = nowMs - (preset === '7d' ? 7 : 30) * DAY;
  else if (preset === 'month') fromMs = dateMs(today.slice(0, 7) + '-01');
  else if (preset === 'day' || preset === 'custom') {
    const start = preset === 'day' ? selection.date : selection.fromDate;
    const end = preset === 'day' ? selection.date : selection.toDate;
    fromMs = dateMs(start);
    const endMs = dateMs(end);
    if (endMs < fromMs || end > today) throw new Error('请选择起止顺序正确且不晚于今天的日期');
    toMs = Math.min(endMs + DAY, nowMs);
  } else throw new Error('请选择时间跨度');
  if (fromMs >= toMs) throw new Error('结束时间须晚于开始时间');
  if (kind !== 'statistics' && kind !== 'comparison') throw new Error('请选择统计或时间对比');
  const query = { kind, from: localIso(fromMs), to: localIso(toMs), scopeLevel: scope.level };
  if (kind === 'comparison') query.axis = 'time';
  if (scope.level !== 'all') {
    const field = { floor: 'floor', location: 'meterId', nameMatch: 'text' }[scope.level];
    if (!field || typeof scope[field] !== 'string' || !scope[field].trim())
      throw new Error('请选择计量范围');
    query[field] = scope[field].trim();
  }
  return query;
}

export function meterPanelScopes(devices = []) {
  const meters = devices.filter((device) => device.kind === 'energy');
  const floors = [
    ...new Set(meters.map((device) => /^(\d+楼)/.exec(device.location || '')?.[1]).filter(Boolean)),
  ];
  floors.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  return [
    { key: 'all', label: '全部电表', scope: { level: 'all' } },
    ...floors.map((floor) => ({
      key: 'floor:' + floor,
      label: floor,
      scope: { level: 'floor', floor },
    })),
    ...meters.map((meter) => ({
      key: 'location:' + meter.id,
      label: meter.location || meter.name,
      scope: { level: 'location', meterId: meter.id },
    })),
  ];
}
