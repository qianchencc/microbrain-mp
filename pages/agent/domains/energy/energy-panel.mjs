import {
  shiftDate,
  shanghaiToday,
  mergeStripDays,
  padStripDays,
  markStripFailed,
  STRIP_PAGE_DAYS,
  fixedEnergyContext,
  fixedEnergyWindow,
  meterStatisticsDailyView,
  mergeHistoryCache,
} from './energy-daily-view.mjs';
import {
  energyHistoryBlock,
  energyMeterSetChanged,
  energyHistoryRecheckBlocks,
  createEnergyHistoryQueue,
} from './energy-history-queue.mjs';

const failureMessage = (cause, fallback) =>
  cause?.data?.cache?.lastError?.message || cause?.data?.message || cause?.message || fallback;
const SPAN_DAYS = 180,
  PAD_DAYS = 90;

// One owner for retained daily history, fixed report bounds, demand queues and identity invalidation.
export function createEnergyPanel({
  read,
  api,
  identity,
  position,
  createState = (value) => value,
  clock = shanghaiToday,
}) {
  const today = clock();
  const state = createState({
    today,
    report: null,
    strip: [],
    meterDaily: {},
    selected: '',
    latestCompleteDay: '',
    latestSampleTime: '',
    error: '',
    loading: false,
    bounds: null,
    historyCache: {},
  });
  let boundedJob = null,
    boundedContextKey = '',
    panelMode = '',
    retainedDay = '',
    scope = '';
  let historyRecheck = new Map(),
    selectedDemand = null,
    visibleDemand = null,
    requestId = 0,
    visible = true;
  const active = () => visible && read().active;
  const historyQueue = createEnergyHistoryQueue({
    concurrency: 2,
    load: (block, wanted) => fetchWindow(block.days, block.end, block.force === true, wanted),
    onResult: applyHistoryBlock,
    onError: failHistoryBlock,
  });

  function clearData() {
    Object.assign(state, {
      report: null,
      strip: [],
      meterDaily: {},
      historyCache: {},
      selected: '',
      bounds: null,
    });
    historyRecheck = new Map();
    retainedDay = '';
  }
  function mergeReport(next, replace = true) {
    if (replace || !state.report) {
      state.report = next;
      state.latestCompleteDay = next.latestCompleteDay || '';
      state.latestSampleTime = next.latestSampleTime || '';
    } else {
      // History only fills cells: it cannot replace current-window comparison, basis or cache metadata.
      const meters = (state.report.meters || []).map((meter) => {
        const extra = (next.meters || []).find((item) => item.id === meter.id);
        return extra
          ? { ...meter, daily: { ...(extra.daily || {}), ...(meter.daily || {}) } }
          : meter;
      });
      state.report = { ...state.report, meters };
    }
    state.strip = mergeStripDays(state.strip, next.days || []);
    if (!replace || (!read().bounded && next.cache?.status === 'fresh'))
      state.historyCache = mergeHistoryCache(state.historyCache, next.days, next.cache);
    if (next.truncated) {
      const missing = new Set(
        (next.days || []).filter((day) => day.usage == null).map((day) => day.date)
      );
      state.strip = state.strip.map((day) =>
        missing.has(day.date) ? { ...day, failed: true } : day
      );
    }
    const currentDay =
      !read().bounded && replace && next.comparison?.currentDay?.date === today
        ? next.comparison.currentDay
        : null;
    if (!read().bounded && replace)
      state.strip = mergeStripDays(state.strip, [
        {
          date: today,
          usage: currentDay?.usage ?? null,
          complete: false,
          coveredMeters: currentDay?.coveredMeters ?? 0,
          expectedMeters: currentDay?.expectedMeters ?? 0,
        },
      ]);
    const meters = { ...state.meterDaily };
    for (const meter of next.meters || []) {
      meters[meter.id] = {
        id: meter.id,
        name: meter.name,
        location: meter.location,
        daily: { ...(meters[meter.id]?.daily || {}), ...(meter.daily || {}) },
      };
      if (!read().bounded && replace) {
        const usage = currentDay?.meterUsage?.[meter.id] ?? null;
        meters[meter.id].daily[today] = {
          usage,
          status: usage == null ? 'not_computable' : 'comparable',
        };
      }
    }
    state.meterDaily = meters;
  }
  async function fetchWindow(days, end, force = false, wanted = null) {
    const current = requestId;
    await api.ready();
    return api.daily(
      { days, ...(end ? { end } : {}) },
      {
        force: force === true,
        isActive: () => current === requestId && active() && (!wanted || wanted()),
      }
    );
  }
  async function fetchMeter(request, force = false) {
    const current = requestId;
    await api.ready();
    return api.meter(request, {
      force: force === true,
      isActive: () => current === requestId && active(),
    });
  }
  async function init(force = false) {
    const current = ++requestId;
    historyQueue.reset();
    selectedDemand = null;
    visibleDemand = null;
    state.loading = true;
    state.error = '';
    try {
      await api.ready();
      if (current !== requestId || !active()) return;
      if (read().bounded) {
        panelMode = 'bounded';
        await initBounded(current, force);
        return;
      }
      const nextScope = identity.current(),
        samePanel = panelMode === 'daily' && scope === nextScope,
        dayNow = clock();
      const crossedDay = Boolean(retainedDay && retainedDay !== dayNow);
      if (!samePanel) clearData();
      else if (force || crossedDay) {
        const recheck = energyHistoryRecheckBlocks(state.strip, state.latestCompleteDay || today, {
          retainedDay,
          currentDay: dayNow,
          force,
          recentDays: STRIP_PAGE_DAYS,
        });
        historyRecheck = new Map(recheck.map((block) => [block.key, block]));
      }
      panelMode = 'daily';
      scope = nextScope;
      const next = await fetchWindow(STRIP_PAGE_DAYS, undefined, force);
      if (current !== requestId || !active() || nextScope !== identity.current()) return;
      if (samePanel && state.report && energyMeterSetChanged(state.report.meters, next.meters))
        clearData();
      mergeReport(next);
      retainedDay = dayNow;
      const edge = state.latestCompleteDay || today;
      state.strip = padStripDays(state.strip, shiftDate(edge, -(SPAN_DAYS - 1)), edge);
      if (state.selected) jump(state.selected);
      else if (read().focusDate) jump(read().focusDate);
      else {
        state.selected = edge || next.days?.at(-1)?.date || today;
        position('center', state.selected);
        setSelectedDemand(shiftDate(state.selected, -45), shiftDate(state.selected, 15));
      }
    } catch (cause) {
      if (current === requestId) {
        if (!identity.isCurrent(scope) || [401, 403].includes(cause.status)) clearData();
        state.error = failureMessage(cause, '逐日能耗暂不可用');
      }
    } finally {
      if (current === requestId) state.loading = false;
    }
  }

  async function initBounded(current, force) {
    const job = { ctx: null, scope: '', queue: [], requested: new Set(), pumping: false };
    boundedJob = job;
    await api.ready();
    if (current !== requestId || job !== boundedJob || !active()) return;
    job.scope = identity.current();
    const contextKey = JSON.stringify(read().initialQuery || null);
    if (boundedContextKey !== contextKey || scope !== job.scope) clearData();
    boundedContextKey = contextKey;
    scope = job.scope;
    if (read().initialQuery) {
      job.ctx = fixedEnergyContext(read().initialQuery);
      if (!job.ctx) {
        state.error = '该计量对象的统计范围无效';
        return;
      }
      state.bounds = { min: job.ctx.minDate, max: job.ctx.maxDate };
      state.strip = padStripDays(state.strip, job.ctx.minDate, job.ctx.maxDate);
      const span =
        Math.round((Date.parse(job.ctx.maxDate) - Date.parse(job.ctx.minDate)) / 864e5) + 1;
      const request = fixedEnergyWindow(job.ctx, span <= 90 ? span : STRIP_PAGE_DAYS);
      const raw = await fetchMeter(request, force),
        next = meterStatisticsDailyView(raw, job.ctx);
      if (
        current !== requestId ||
        job !== boundedJob ||
        !active() ||
        job.scope !== identity.current()
      )
        return;
      mergeReport(next);
      if (span <= 90) resolveBoundedPending(job.ctx.minDate, job.ctx.maxDate);
    } else {
      const next = await fetchWindow(STRIP_PAGE_DAYS, undefined, force);
      if (
        current !== requestId ||
        job !== boundedJob ||
        !active() ||
        job.scope !== identity.current()
      )
        return;
      state.bounds = { min: next.days?.[0]?.date || '', max: next.days?.at(-1)?.date || '' };
      mergeReport(next);
      if (state.bounds.min) {
        state.strip = padStripDays(state.strip, state.bounds.min, state.bounds.max);
        resolveBoundedPending(state.bounds.min, state.bounds.max);
      }
    }
    state.selected =
      [...state.strip].reverse().find((day) => !day.pending && !day.failed && day.usage != null)
        ?.date ||
      state.bounds?.max ||
      '';
    position('center', state.selected);
  }
  function boundedChunkEnd(date) {
    const diff = Math.round((Date.parse(state.bounds.max) - Date.parse(date)) / 864e5);
    return shiftDate(state.bounds.max, -90 * Math.floor(diff / 90));
  }
  function boundedChunkFrom(end) {
    const start = shiftDate(end, -89);
    return start < state.bounds.min ? state.bounds.min : start;
  }
  function resolveBoundedPending(from, to) {
    state.strip = state.strip.map((day) =>
      day.pending && day.date >= from && day.date <= to ? { ...day, pending: false } : day
    );
  }
  function ensureBoundedDay(date) {
    const job = boundedJob;
    if (
      !job?.ctx ||
      !state.bounds ||
      job.requested.has(date) ||
      !state.strip.find((day) => day.date === date)?.pending
    )
      return;
    const end = boundedChunkEnd(date);
    for (let date = boundedChunkFrom(end); date <= end; date = shiftDate(date, 1))
      job.requested.add(date);
    job.queue.push(end);
    void pumpBounded(job);
  }
  async function pumpBounded(job) {
    if (job.pumping) return;
    job.pumping = true;
    const current = requestId;
    while (job.queue.length && active()) {
      const end = job.queue.shift(),
        request = fixedEnergyWindow(job.ctx, 90, end);
      if (!request) continue;
      try {
        const raw = await fetchMeter(request),
          next = meterStatisticsDailyView(raw, job.ctx);
        if (
          current !== requestId ||
          job !== boundedJob ||
          !active() ||
          job.scope !== identity.current()
        )
          break;
        mergeReport(next, false);
        resolveBoundedPending(boundedChunkFrom(end), end);
        if (!state.strip.some((day) => day.failed)) state.error = '';
      } catch (cause) {
        if (current !== requestId || job !== boundedJob || !active()) break;
        if (!identity.isCurrent(job.scope) || [401, 403].includes(cause.status)) {
          boundedJob = null;
          clearData();
          state.error = failureMessage(cause, '电表统计暂不可用');
          break;
        }
        const from = boundedChunkFrom(end);
        for (let date = from; date <= end; date = shiftDate(date, 1)) job.requested.delete(date);
        state.strip = markStripFailed(state.strip, from, end);
        state.error = failureMessage(cause, '电表统计暂不可用');
        if (['AGENT_READ_PREPARING', 'ACCOUNT_IDENTITY_PREPARING'].includes(cause.code)) {
          job.queue = [];
          break;
        }
      }
    }
    job.pumping = false;
  }
  function selectBounded(date) {
    if (!state.bounds || date < state.bounds.min || date > state.bounds.max) return;
    state.selected = date;
    ensureBoundedDay(date);
    position('center', date);
  }
  function resumeBounded() {
    if (!active() || boundedJob) return;
    if (!identity.isCurrent(scope)) {
      clearData();
      return init();
    }
    const scopeNow = identity.current();
    if (state.report && state.bounds && scope === scopeNow) {
      boundedJob = {
        ctx: read().initialQuery ? fixedEnergyContext(read().initialQuery) : null,
        scope: scopeNow,
        queue: [],
        requested: new Set(),
        pumping: false,
      };
      if (state.selected) ensureBoundedDay(state.selected);
      return;
    }
    return init();
  }

  function setSelectedDemand(from, to) {
    selectedDemand = { from, to };
    scheduleHistory();
  }
  const blockTouchesRange = (block, range) =>
    Boolean(range?.from && range?.to && range.from <= block.end && range.to >= block.start);
  function blockHasPending(block, byDate) {
    for (let date = block.start; date <= block.end; date = shiftDate(date, 1))
      if (byDate.get(date)?.pending) return true;
    return false;
  }
  function scheduleHistory() {
    if (read().bounded || !state.strip.length) return;
    const dayNow = clock();
    if (retainedDay && retainedDay !== dayNow) {
      for (const block of energyHistoryRecheckBlocks(
        state.strip,
        state.latestCompleteDay || today,
        { retainedDay, currentDay: dayNow, recentDays: STRIP_PAGE_DAYS }
      )) {
        historyQueue.forget(block.key);
        historyRecheck.set(block.key, block);
      }
      retainedDay = dayNow;
    }
    const edge = state.latestCompleteDay || today,
      first = state.strip[0].date;
    const byDate = new Map(state.strip.map((day) => [day.date, day])),
      blocks = new Map();
    const addDay = (date) => {
      if (date < first || !byDate.get(date)?.pending) return;
      const block = energyHistoryBlock(date, edge);
      if (!block) return;
      historyQueue.forget(block.key);
      if (!blocks.has(block.key)) blocks.set(block.key, block);
    };
    const selectedBlock = state.selected ? energyHistoryBlock(state.selected, edge) : null;
    const selectedRecheck = selectedBlock ? historyRecheck.get(selectedBlock.key) : null;
    if (selectedBlock && blockHasPending(selectedBlock, byDate)) {
      historyQueue.forget(selectedBlock.key);
      blocks.set(selectedBlock.key, selectedRecheck || selectedBlock);
    } else if (selectedRecheck && !historyQueue.isSettled(selectedBlock.key))
      blocks.set(selectedBlock.key, selectedRecheck);
    for (const range of [selectedDemand, visibleDemand]) {
      if (!range?.from || !range?.to) continue;
      const to = range.to > edge ? edge : range.to;
      for (let date = to; date >= range.from; date = shiftDate(date, -1)) addDay(date);
    }
    for (const [key, block] of historyRecheck) {
      if (key === selectedBlock?.key || historyQueue.isSettled(key)) continue;
      if (blockTouchesRange(block, selectedDemand) || blockTouchesRange(block, visibleDemand))
        blocks.set(key, block);
    }
    historyQueue.setWanted([...blocks.values()]);
  }
  function applyHistoryBlock(block, next) {
    if (!active() || !identity.isCurrent(scope) || !next) return;
    const first = state.strip[0]?.date,
      last = state.strip.at(-1)?.date;
    if (!first || !last) return;
    const days = (next.days || []).filter((day) => day.date >= first && day.date <= last);
    const meters = (next.meters || []).map((meter) => ({
      ...meter,
      daily: Object.fromEntries(
        Object.entries(meter.daily || {}).filter(([date]) => date >= first && date <= last)
      ),
    }));
    mergeReport({ ...next, days, meters }, false);
    const from = block.start < first ? first : block.start,
      to = block.end > last ? last : block.end;
    state.strip = state.strip.map((day) =>
      day.pending && day.date >= from && day.date <= to
        ? { ...day, pending: false, failed: true }
        : day
    );
    if (!state.strip.some((day) => day.failed)) state.error = '';
    historyRecheck.delete(block.key);
  }
  function failHistoryBlock(block, cause) {
    if (!active() || !identity.isCurrent(scope)) return;
    if ([401, 403].includes(cause.status)) {
      historyQueue.reset();
      clearData();
    } else state.strip = markStripFailed(state.strip, block.start, block.end);
    state.error = failureMessage(cause, '逐日能耗暂不可用');
    if (['AGENT_READ_PREPARING', 'ACCOUNT_IDENTITY_PREPARING'].includes(cause.code))
      historyQueue.reset();
    historyRecheck.delete(block.key);
  }
  function visibleRange(range) {
    if (read().bounded || !range?.first || !state.strip.length) return;
    const first = state.strip[0].date;
    if (range.first < shiftDate(first, 20)) {
      state.strip = padStripDays(state.strip, shiftDate(first, -PAD_DAYS), shiftDate(first, -1));
      const added = state.strip.findIndex((day) => day.date === first);
      if (added > 0) position('prepend', added);
    }
    visibleDemand = { from: shiftDate(range.first, -15), to: range.last };
    scheduleHistory();
  }
  function retry() {
    if (read().bounded) {
      if (!state.bounds || !state.selected || !boundedJob) return;
      const end = boundedChunkEnd(state.selected),
        from = boundedChunkFrom(end);
      state.strip = state.strip.map((day) =>
        day.failed && day.date >= from && day.date <= end
          ? { ...day, failed: false, pending: true }
          : day
      );
      for (let date = from; date <= end; date = shiftDate(date, 1))
        boundedJob.requested.delete(date);
      ensureBoundedDay(state.selected);
      return;
    }
    const from = shiftDate(state.selected, -15),
      to = shiftDate(state.selected, 15),
      forgotten = new Set();
    state.strip = state.strip.map((day) =>
      day.failed && day.date >= from && day.date <= to
        ? { ...day, failed: false, pending: true }
        : day
    );
    for (let date = from; date <= to; date = shiftDate(date, 1)) {
      const block = energyHistoryBlock(date, state.latestCompleteDay || today);
      if (block && !forgotten.has(block.key)) {
        forgotten.add(block.key);
        historyQueue.forget(block.key);
      }
    }
    setSelectedDemand(from, to);
  }
  function jump(date) {
    if (read().bounded) {
      selectBounded(date);
      return;
    }
    if (date > today) return;
    const first = state.strip[0]?.date;
    if (first && date < first) {
      state.strip = padStripDays(state.strip, shiftDate(date, -15), shiftDate(first, -1));
      const added = state.strip.findIndex((day) => day.date === first);
      if (added > 0) position('prepend', added);
    }
    select(date);
    position('center', date);
  }
  function select(date) {
    if (read().bounded) {
      selectBounded(date);
      return;
    }
    state.selected = date;
    setSelectedDemand(shiftDate(date, -45), shiftDate(date, 15));
  }
  function invalidate() {
    ++requestId;
    boundedJob = null;
    historyQueue.reset();
    selectedDemand = null;
    visibleDemand = null;
    state.loading = false;
  }
  function hide() {
    visible = false;
    invalidate();
  }
  function show() {
    visible = true;
    return read().bounded ? resumeBounded() : read().active ? init() : undefined;
  }
  function update() {
    if (active()) return init();
    invalidate();
    if (read().bounded && read().active) clearData();
  }
  function focus(date) {
    if (!date) return;
    if (!read().bounded) state.selected = date;
    if (read().active) jump(date);
  }
  return { state, init, show, hide, update, focus, jump, select, visibleRange, retry };
}
