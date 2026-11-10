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

export function environmentChartPoints(report, key) {
  if (report.resolution && report.resolution !== 'raw') {
    return (report.buckets || []).map((bucket) => ({
      at: bucket.at,
      value: Number.isFinite(bucket.values?.[key]) ? bucket.values[key] : null,
      ref: bucket,
    }));
  }
  return environmentTrendPoints(report.samples || [], key);
}

export function mergeEnvironmentHistory(previous, incoming) {
  if (incoming.resolution) {
    const complete = incoming.coverage?.complete === true;
    const count = incoming.coverage?.readSamples ?? 0;
    return {
      ...incoming,
      samples: incoming.samples || [],
      nextPage: null,
      status: complete ? (count ? 'available' : 'empty') : 'partial',
      coverageComplete: complete,
    };
  }
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

const dateMs = (value) => Date.parse(value + 'T00:00:00+08:00');
const dateText = (ms) => new Date(ms + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);

export function environmentRangeLimits(from, today) {
  return { min: from, max: dateText(Math.min(dateMs(today), dateMs(from) + 179 * DAY_MS)) };
}

export function environmentDateRange(current, field, value, today) {
  const from = field === 'from' ? (value > today ? today : value) : current.from;
  const limits = environmentRangeLimits(from, today);
  const desiredEnd = field === 'to' ? value : current.to;
  return { from, to: desiredEnd < from ? from : desiredEnd > limits.max ? limits.max : desiredEnd };
}

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
const axisLabel = (ms, dayScale, crossYear) => {
  const p = shanghaiParts(ms);
  if (!dayScale) return timeLabel(ms);
  return `${crossYear ? String(p.year).slice(2) + '/' : ''}${p.month}/${p.day}`;
};

// Tick labels are laid out in physical pixels, independently of the number of chart points.
export function environmentTrendTicks(window, { width = 360, padLeft, padRight } = {}) {
  const start = Date.parse(window?.from || '');
  const end = Date.parse(window?.to || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const leftPad = padLeft ?? (32 / 360) * width;
  const rightPad = padRight ?? (10 / 360) * width;
  const plotWidth = Math.max(1, width - leftPad - rightPad);
  const span = Math.max(1, end - start);
  const dayScale = span > DAY_MS;
  const crossYear = shanghaiParts(start).year !== shanghaiParts(end).year;
  const maxTicks = Math.max(2, Math.min(6, Math.floor(plotWidth / (crossYear ? 60 : 48))));
  const candidateTimes = [];
  if (dayScale && span > 45 * DAY_MS) {
    const p = shanghaiParts(start);
    for (let month = p.month; ; month++) {
      const at = Date.UTC(p.year, month, 1) - SHANGHAI_OFFSET_MS;
      if (at >= end) break;
      if (at > start) candidateTimes.push(at);
    }
  } else {
    const steps = dayScale
      ? [1, 2, 3, 7, 14, 30].map((days) => days * DAY_MS)
      : [15 * 60e3, 30 * 60e3, 36e5, 2 * 36e5, 3 * 36e5, 6 * 36e5, 12 * 36e5];
    const step = steps.find((value) => span / value <= maxTicks - 1) || steps.at(-1);
    for (
      let at = Math.ceil((start + SHANGHAI_OFFSET_MS) / step) * step - SHANGHAI_OFFSET_MS;
      at < end;
      at += step
    )
      if (at > start) candidateTimes.push(at);
  }
  const tickOf = (at, edge) => {
    const label = axisLabel(at, dayScale, crossYear);
    const x = leftPad + ((at - start) / span) * plotWidth;
    const textWidth = label.length * 6;
    const labelLeft = edge === 'start' ? x : edge === 'end' ? x - textWidth : x - textWidth / 2;
    return {
      at,
      label,
      left: (x / width) * 100,
      edge,
      labelLeft,
      labelRight: labelLeft + textWidth,
    };
  };
  const first = tickOf(start, 'start');
  if (start === end) return [first];
  const last = tickOf(end, 'end');
  const ticks = [first];
  const candidates = candidateTimes.map((at) => tickOf(at, 'center'));
  for (let slot = 1; slot < maxTicks - 1; slot++) {
    const target = start + (span * slot) / (maxTicks - 1);
    const tick = candidates
      .filter(
        (candidate) =>
          candidate.labelLeft >= ticks.at(-1).labelRight + 8 &&
          candidate.labelRight + 8 <= last.labelLeft
      )
      .reduce(
        (best, candidate) =>
          !best || Math.abs(candidate.at - target) < Math.abs(best.at - target) ? candidate : best,
        null
      );
    if (tick) ticks.push(tick);
  }
  ticks.push(last);
  return ticks;
}
