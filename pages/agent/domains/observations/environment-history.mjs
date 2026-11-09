import { fmtShanghaiDateTime } from './observation-view.mjs';

const hasTime = (sample) =>
  typeof sample.recordedAt === 'string' && Number.isFinite(Date.parse(sample.recordedAt));
const metricEligible = (sample) =>
  hasTime(sample) &&
  sample.quality?.timeUnknown !== true &&
  sample.quality?.conflicted !== true &&
  sample.quality?.source == null;

export function environmentSampleIdentity(sample) {
  return JSON.stringify([
    sample.sourceIdMissing === true,
    sample.id ?? null,
    sample.recordedAt ?? ['unknown', sample.originalRecordedAt ?? null],
    sample.deviceCode ?? null,
  ]);
}

export function environmentTrendPoints(samples, key) {
  return samples.filter(hasTime).map((sample) => ({
    at: sample.recordedAt,
    value:
      metricEligible(sample) && Number.isFinite(sample.values?.[key]) ? sample.values[key] : null,
    ref: sample,
  }));
}

export function mergeEnvironmentHistory(previous, incoming) {
  const byIdentity = new Map();
  for (const sample of previous?.samples || [])
    byIdentity.set(environmentSampleIdentity(sample), sample);
  for (const sample of incoming.samples || [])
    byIdentity.set(environmentSampleIdentity(sample), sample);
  const samples = [...byIdentity.values()].sort((left, right) => {
    const a = hasTime(left) ? Date.parse(left.recordedAt) : Infinity;
    const b = hasTime(right) ? Date.parse(right.recordedAt) : Infinity;
    return (
      (a === b ? 0 : a - b) ||
      environmentSampleIdentity(left).localeCompare(environmentSampleIdentity(right))
    );
  });
  const quality = {
    unknownTimeSamples: 0,
    invalidValueSamples: 0,
    missingValueSamples: 0,
    conflictedSamples: 0,
    unverifiedQualitySamples: 0,
  };
  const metricDefinitions = incoming.metrics || previous?.metrics || [];
  const metricKeys = metricDefinitions.map((metric) => metric.key);
  const known = [];
  for (const sample of samples) {
    if (!hasTime(sample) || sample.quality?.timeUnknown === true) quality.unknownTimeSamples++;
    else known.push(sample);
    if (sample.quality?.invalidValues === true) quality.invalidValueSamples++;
    if (
      sample.quality?.missingValues === true ||
      (sample.quality?.invalidValues !== true &&
        metricKeys.some((key) => sample.values?.[key] == null))
    )
      quality.missingValueSamples++;
    if (sample.quality?.conflicted === true) quality.conflictedSamples++;
    if (sample.quality?.source != null) quality.unverifiedQualitySamples++;
  }
  const nextPage = incoming.nextPage ?? null;
  const complete =
    incoming.coverage?.complete === true &&
    nextPage === null &&
    (!Number.isFinite(incoming.totalElements) || samples.length === incoming.totalElements) &&
    Object.values(quality).every((count) => count === 0);
  const metrics = metricDefinitions.map((metric) => {
    let count = 0,
      min = null,
      peak = null;
    for (const sample of known) {
      const value = sample.values?.[metric.key];
      if (!metricEligible(sample) || !Number.isFinite(value)) continue;
      count++;
      if (min === null || value < min) min = value;
      if (peak === null || value > peak.value) peak = { value, at: sample.recordedAt };
    }
    return { ...metric, count, min, peak };
  });
  return {
    ...incoming,
    samples,
    metrics,
    nextPage,
    observedAt: quality.unknownTimeSamples ? null : (known.at(-1)?.recordedAt ?? null),
    status: complete ? (samples.length ? 'available' : 'empty') : 'partial',
    coverageComplete: complete,
    coverage: {
      ...incoming.coverage,
      ...quality,
      complete,
      truncated: nextPage !== null,
      readSamples: samples.length,
      from: known[0]?.recordedAt ?? null,
      to: known.at(-1)?.recordedAt ?? null,
    },
  };
}

export function environmentHistoryNotice(report) {
  const reasons = [];
  if (report.cache?.lastError) reasons.push(report.cache.lastError);
  const coverage = report.coverage || {};
  if (coverage.invalidValueSamples) reasons.push(`${coverage.invalidValueSamples}条采样含无效值`);
  if (coverage.missingValueSamples) reasons.push(`${coverage.missingValueSamples}条采样存在缺测`);
  if (coverage.conflictedSamples)
    reasons.push(`${coverage.conflictedSamples}条采样存在冲突，未计入趋势`);
  if (coverage.unverifiedQualitySamples)
    reasons.push(`${coverage.unverifiedQualitySamples}条来源质量未核实`);
  if (
    !reasons.length &&
    !coverage.unknownTimeSamples &&
    coverage.complete !== true &&
    report.nextPage === null
  )
    reasons.push('采样尚未读齐，请重新读取');
  return reasons.join('；');
}

// 环境历史窗口与坐标轴刻度：所有日界/时刻标签统一按 Asia/Shanghai 计算，
// 与后端 window 契约（timezone=Asia/Shanghai）一致，不随手机本地时区漂移。
const SHANGHAI_OFFSET_MS = 8 * 36e5;
const DAY_MS = 864e5;
const pad2 = (value) => String(value).padStart(2, '0');

const shanghaiParts = (ms) => {
  const d = new Date(ms + SHANGHAI_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
};

// 窗口行：起止都带上海时间；同年省略年份，跨年各自带年份。
export function environmentWindowLabel(window) {
  const fromText = fmtShanghaiDateTime(window?.from);
  const toText = fmtShanghaiDateTime(window?.to);
  if (!fromText || !toText) return '';
  const crossYear = fromText.slice(0, 4) !== toText.slice(0, 4);
  const short = (text) => (crossYear ? text : text.slice(5));
  return `${short(fromText)} 至 ${short(toText)}`;
}

const timeLabel = (ms) => {
  const p = shanghaiParts(ms);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
};
const axisLabel = (ms, dayScale) => {
  const p = shanghaiParts(ms);
  const day = `${p.month}/${p.day}`;
  if (!dayScale) return timeLabel(ms);
  return p.hour === 0 && p.minute === 0 ? day : `${day} ${timeLabel(ms)}`;
};

// x 轴刻度：跨天按北京日界每天一个刻度（窗口过长时隔天/隔周），
// 短窗按均匀步长给 HH:mm；起止边界补刻度，间距过近的与相邻刻度合并。
// 返回 [{ at, label }]，at 为毫秒时间戳，组件用图表 xOf 换算 left 百分比。
export function environmentTrendTicks(window, { width = 360, padLeft = 32, padRight = 10 } = {}) {
  const fromMs = Date.parse(window?.from || '');
  const toMs = Date.parse(window?.to || '');
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return [];
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  const span = Math.max(1, end - start);
  const plotWidth = Math.max(1, width - padLeft - padRight);
  const xOf = (at) => padLeft + ((at - start) / span) * plotWidth;

  const ticks = [];
  const push = (at, label) => {
    const last = ticks.at(-1);
    if (last && Math.abs(xOf(at) - xOf(last.at)) < 18) {
      if (label.length > last.label.length) last.label = label;
      return;
    }
    ticks.push({ at, label });
  };

  if (span <= DAY_MS) {
    const target = 6;
    const step =
      [15 * 60e3, 30 * 60e3, 3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3].find(
        (candidate) => span / candidate <= target
      ) || 12 * 3600e3;
    const count = Math.max(1, Math.ceil(span / step));
    for (let i = 0; i <= count; i += 1)
      push(start + (span * i) / count, axisLabel(start + (span * i) / count, false));
  } else {
    const dayScale = true;
    const spanDays = span / DAY_MS;
    const stepDays = spanDays <= 14 ? 1 : spanDays <= 45 ? 2 : 7;
    const stepMs = stepDays * DAY_MS;
    for (
      let t = Math.ceil((start + SHANGHAI_OFFSET_MS) / DAY_MS) * DAY_MS - SHANGHAI_OFFSET_MS;
      t < end;
      t += stepMs
    )
      if (t > start) push(t, axisLabel(t, dayScale));
    push(start, axisLabel(start, dayScale));
    push(end, axisLabel(end, dayScale));
    ticks.sort((a, b) => a.at - b.at);
  }
  return ticks.map((tick) => ({ ...tick, left: (xOf(tick.at) / width) * 100 }));
}
