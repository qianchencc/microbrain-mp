import test from 'node:test'
import assert from 'node:assert/strict'
import { createEnergyPanel, shiftDate } from '../pages/agent/lib/energy.mjs'

globalThis.uni = globalThis.uni || { showToast() {} }
const day = '2026-11-05'
const report = (meterId = 'meter-a', usage = 8) => ({
  latestCompleteDay: shiftDate(day, -1), latestSampleTime: `${day}T10:00:00+08:00`,
  days: Array.from({ length: 180 }, (_, index) => ({ date: shiftDate(day, index - 180), usage, complete: true })),
  meters: [{ id: meterId, name: meterId, daily: {} }],
  comparison: { currentDay: { date: day, usage: 3, meterUsage: { [meterId]: 3 } } },
  cache: { status: 'fresh', updatedAt: `${day}T10:00:00+08:00` },
})
function fixture(daily, notice) {
  const context = { active: true, bounded: false, focusDate: '' }
  let scope = 'a'
  const positions = []
  const panel = createEnergyPanel({
    read: () => context, api: { ready: async () => {}, daily, meter: async () => { throw new Error('unexpected meter request') } },
    identity: { current: () => scope, isCurrent: value => value === scope },
    notice,
    position: (kind, value) => positions.push([kind, value]), clock: () => day,
  })
  return { panel, context, positions, setScope: value => { scope = value } }
}

test('同身份重开保留选中历史，刷新失败保留原始数据和时间，不把缺样补零', async () => {
  let failure = false
  const snapshot = report()
  snapshot.days[20].usage = null
  const { panel } = fixture(async () => { if (failure) throw new Error('network lost'); return snapshot })
  await panel.init()
  const selected = snapshot.days[20].date
  panel.jump(selected)
  panel.hide()
  await panel.show()
  assert.equal(panel.state.selected, selected)
  assert.equal(panel.state.strip.find(item => item.date === selected).usage, null)
  failure = true
  await panel.init(true)
  assert.equal(panel.state.report.cache.updatedAt, snapshot.cache.updatedAt)
  assert.equal(panel.state.error, '逐日能耗暂不可用')
  assert.equal(panel.state.selected, selected)
})

test('授权电表集合变化清除旧明细和历史，不让旧电表留在新统计中', async () => {
  let snapshot = report('meter-a')
  const { panel } = fixture(async () => snapshot)
  await panel.init()
  snapshot = { ...report('meter-b', 20), days: [{ date: shiftDate(day, -1), usage: 20, complete: true }] }
  await panel.init(true)
  assert.deepEqual(Object.keys(panel.state.meterDaily), ['meter-b'])
  assert.equal(panel.state.strip.find(item => item.date === shiftDate(day, -2)).usage, null)
  assert.equal(panel.state.strip.find(item => item.date === shiftDate(day, -1)).usage, 20)
})

test('切换账号后在途首屏不得写回旧数据，下一次读取只展示新身份', async () => {
  let resolve
  const pending = new Promise(yes => { resolve = yes })
  let first = true
  const { panel, setScope } = fixture(() => { if (first) { first = false; return pending }; return Promise.resolve(report('meter-b')) })
  const loading = panel.init()
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  setScope('b')
  resolve(report('meter-a'))
  await loading
  assert.equal(panel.state.report, null)
  await panel.init()
  assert.deepEqual(Object.keys(panel.state.meterDaily), ['meter-b'])
})

test('固定统计面板限制在返回边界内选择，收起期间在途结果不能落位', async () => {
  let resolve
  const pending = new Promise(yes => { resolve = yes })
  const { panel, context } = fixture(() => pending)
  context.bounded = true
  const loading = panel.init()
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  panel.hide()
  resolve(report())
  await loading
  assert.equal(panel.state.report, null)
  assert.equal(panel.state.loading, false)
  await panel.show()
  const selected = panel.state.selected
  panel.jump('2099-01-01')
  assert.equal(panel.state.selected, selected)
})

test('能耗面板隐藏后真实403仍清除保留事实，不向下一视图通知', async () => {
  let hold = false, reject, entered;
  const started = new Promise(resolve => { entered = resolve });
  const notices = [];
  const { panel } = fixture(() => {
    if (!hold) return Promise.resolve(report());
    return new Promise((_resolve, fail) => { reject = fail; entered(); });
  }, cause => notices.push(cause));
  await panel.init();
  assert.equal(panel.state.report.meters[0].id, 'meter-a');
  hold = true;
  const work = panel.init(true);
  await started;
  panel.hide();
  reject(Object.assign(Error('forbidden'), { status: 403 }));
  await work;
  assert.equal(panel.state.report, null);
  assert.deepEqual(panel.state.strip, []);
  assert.deepEqual(panel.state.historyCache, {});
  assert.deepEqual(notices, []);
});
