import { isReadCancelled } from '../../../../utils/agent-read-scope.mjs';

// 历史能耗补块的稳定日期划分与有限并发队列。
// 历史月不会因窗口结束日改变而重新准备：整月读取（自然月天数，最多31天），
// 只有最新未闭合月截止当前完整日。队列只保留仍被选中/可见范围需要的块；
// 离开目标的在途等待经 isActive 取消，迟到结果不写回、不当作失败。
const DAY_MS = 864e5;
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(ms) && isoDate(ms) === value;
};
const monthStartOf = (date) => date.slice(0, 7) + '-01';
const monthEndOf = (date) => {
  const start = new Date(monthStartOf(date) + 'T00:00:00Z');
  start.setUTCMonth(start.getUTCMonth() + 1);
  return isoDate(start.getTime() - DAY_MS);
};

// 单个日期归属的固定补块：
// - 已闭合月：整个自然月（days=月长，end=月末），同月任一天得到同一 key；
// - 最新未闭合月：月初至 latestCompleteDay，今天以后不补块。
export function energyHistoryBlock(date, latestCompleteDay) {
  if (!validDate(date) || !validDate(latestCompleteDay) || date > latestCompleteDay) return null;
  const start = monthStartOf(date);
  const monthEnd = monthEndOf(date);
  const end = monthEnd <= latestCompleteDay ? monthEnd : latestCompleteDay;
  const days =
    Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / DAY_MS) + 1;
  return { key: `${start}..${end}`, start, end, days };
}

// 同身份重开时只凭新 report 已返回的授权电表集合比较：顺序无关、ID 去重；
// 集合变化必须丢弃旧明细/旧历史合计，避免越权或过时数据继续展示。
export function energyMeterSetChanged(previousMeters, nextMeters) {
  const ids = (meters) =>
    [...new Set((meters || []).map((meter) => meter?.id).filter(Boolean))].sort();
  const before = ids(previousMeters),
    after = ids(nextMeters);
  return before.length !== after.length || before.some((id, index) => id !== after[index]);
}

// 跨上海日或显式刷新后，条带内已加载、且早于首屏窗口的旧日期重新具备问 backend 的资格。
// 返回稳定块并带 force，供面板只在选中/可视需求命中时重读；同一天普通重开不返回。
export function energyHistoryRecheckBlocks(
  days,
  latestCompleteDay,
  { retainedDay = '', currentDay = '', force = false, recentDays = 30 } = {}
) {
  if (!validDate(latestCompleteDay)) return [];
  if (!force && (!retainedDay || !currentDay || retainedDay === currentDay)) return [];
  const windowDays = Math.max(1, Math.floor(Number(recentDays) || 30));
  const recentFrom = isoDate(
    Date.parse(latestCompleteDay + 'T00:00:00Z') - (windowDays - 1) * DAY_MS
  );
  const blocks = new Map();
  for (const day of days || []) {
    if (!day || day.pending || !validDate(day.date) || day.date >= recentFrom) continue;
    const block = energyHistoryBlock(day.date, latestCompleteDay);
    if (block) blocks.set(block.key, { ...block, force: true });
  }
  return [...blocks.values()].sort((a, b) => (a.start < b.start ? -1 : 1));
}

// 有限并发补块队列：setWanted 用当前完整需求替换队列（选中块排最前）；
// 未开始且已无需求的块移除；在途但已无需求的块立即失活（其加载方通过 isActive 中止），
// 其迟到结果被丢弃。完成/失败的块按 key 记账，避免同一窗口反复排队；失败由 forget 重试。
export function createEnergyHistoryQueue({ concurrency = 2, load, onResult, onError } = {}) {
  if (typeof load !== 'function') throw new Error('历史补块队列需要加载函数');
  const limit = Math.max(1, Math.floor(Number(concurrency) || 1));
  const items = new Map();
  let pending = [],
    wantedBlocks = [],
    wanted = new Set(),
    settled = new Set();
  let running = 0,
    pumping = false;

  const isActive = (item) =>
    item.state === 'running' && !item.cancelled && wanted.has(item.key) && !settled.has(item.key);

  function refreshPending() {
    const next = [],
      kept = new Set();
    for (const block of wantedBlocks) {
      if (settled.has(block.key) || kept.has(block.key)) continue;
      kept.add(block.key);
      let item = items.get(block.key);
      if (!item) {
        item = { block: { ...block }, key: block.key, state: 'queued', cancelled: false };
        items.set(item.key, item);
      }
      if (item.state === 'queued' && wanted.has(item.key)) next.push(item);
    }
    for (const [key, item] of items) {
      if (item.state === 'queued' && !kept.has(key)) items.delete(key);
    }
    pending = next;
  }

  function pump() {
    if (pumping) return;
    pumping = true;
    try {
      refreshPending();
      while (running < limit) {
        const item = pending.shift();
        if (!item) break;
        void run(item);
      }
    } finally {
      pumping = false;
    }
  }

  async function run(item) {
    item.state = 'running';
    running += 1;
    let result, failure;
    try {
      result = await load(item.block, () => isActive(item));
    } catch (error) {
      failure = error;
    }
    running -= 1;
    if (items.get(item.key) === item) items.delete(item.key);
    const stillWanted = wanted.has(item.key) && !item.cancelled;
    try {
      if (failure) {
        if (stillWanted && !isReadCancelled(failure)) {
          settled.add(item.key);
          onError?.(item.block, failure);
        }
      } else if (stillWanted) {
        settled.add(item.key);
        onResult?.(item.block, result);
      }
    } finally {
      pump();
    }
  }

  function setWanted(blocks) {
    const list = [],
      seen = new Set();
    for (const block of blocks || []) {
      if (!block?.key || seen.has(block.key)) continue;
      seen.add(block.key);
      list.push({ ...block });
    }
    wantedBlocks = list;
    wanted = seen;
    for (const item of items.values()) {
      if (item.state === 'running' && !wanted.has(item.key)) item.cancelled = true;
    }
    pump();
  }

  // 已完成或已失败结算的块（含条带保留的历史）不再自动重排；显式 force/跨日
  // 若需重读，由调用方先 forget 再按新需求 setWanted。
  function isSettled(key) {
    return settled.has(typeof key === 'string' ? key : key?.key);
  }

  // 失败块重试入口：删除完成记账后由下一次 setWanted 重新申请。
  function forget(keys) {
    for (const entry of Array.isArray(keys) ? keys : [keys]) {
      const key = typeof entry === 'string' ? entry : entry?.key;
      if (key) settled.delete(key);
    }
  }

  // 关闭/换身份/重新初始化：取消全部在途等待并丢弃尚未开始的块；
  // 已完成数据由面板自己的 strip 保留，不在这里清除。
  function reset() {
    for (const item of items.values()) if (item.state === 'running') item.cancelled = true;
    for (const [key, item] of items) if (item.state === 'queued') items.delete(key);
    pending = [];
    wantedBlocks = [];
    wanted = new Set();
    settled.clear();
  }

  return { setWanted, forget, isSettled, reset };
}
