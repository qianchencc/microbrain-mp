import test from 'node:test'
import assert from 'node:assert/strict'
import { energyHistoryBlock, energyMeterSetChanged, energyHistoryRecheckBlocks, createEnergyHistoryQueue } from '../pages/agent/lib/energy.mjs'

const deferred = () => {
 let resolve, reject
 const promise = new Promise((res, rej) => { resolve = res; reject = rej })
 return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const block = (start, end = start) => ({ key: `${start}..${end}`, start, end })

function harness(options = {}) {
 const calls = [], results = [], errors = []
 const queue = createEnergyHistoryQueue({
  concurrency: options.concurrency ?? 2,
  load: (item, isActive) => {
   const pending = deferred()
   calls.push({ block: item, isActive, pending })
   return pending.promise
  },
  onResult: item => { results.push(item.key) },
  onError: (item, error) => { errors.push({ key: item.key, error }) },
 })
 return { queue, calls, results, errors }
}

test('历史补块按自然月固定：同月不同日同键，整月 end=月末 days=月长', () => {
 const july = energyHistoryBlock('2026-07-02', '2026-08-16')
 assert.deepEqual(july, { key: '2026-07-01..2026-07-31', start: '2026-07-01', end: '2026-07-31', days: 31 })
 const sameMonth = energyHistoryBlock('2026-07-20', '2026-08-16')
 assert.equal(sameMonth.key, july.key)
})

test('最新未闭合块截止 latestCompleteDay；更早可见月仍按完整自然月读取；未来日不补块', () => {
 const current = energyHistoryBlock('2026-08-05', '2026-08-16')
 assert.deepEqual(current, { key: '2026-08-01..2026-08-16', start: '2026-08-01', end: '2026-08-16', days: 16 })
 const edge = energyHistoryBlock('2026-02-20', '2026-08-16')
 assert.deepEqual(edge, { key: '2026-02-01..2026-02-28', start: '2026-02-01', end: '2026-02-28', days: 28 })
 assert.equal(energyHistoryBlock('2026-02-01', '2026-08-16').key, edge.key)
 assert.equal(energyHistoryBlock('2026-08-17', '2026-08-16'), null)
 assert.equal(energyHistoryBlock('2026-02-30', '2026-08-16'), null)
})

test('闰年2月保持月末与天数，不超过31天窗口', () => {
 const february = energyHistoryBlock('2028-02-10', '2028-03-01')
 assert.deepEqual(february, { key: '2028-02-01..2028-02-29', start: '2028-02-01', end: '2028-02-29', days: 29 })
})

test('授权电表集合按排序 ID 比较：仅顺序变化保留，增删/清空/首次出现均要求清旧准备', () => {
 const meters = ids => ids.map(id => ({ id }))
 assert.equal(energyMeterSetChanged(meters(['b', 'a']), meters(['a', 'b'])), false)
 assert.equal(energyMeterSetChanged(meters(['a', 'a']), meters(['a'])), false)
 assert.equal(energyMeterSetChanged(meters(['a']), meters(['a', 'b'])), true)
 assert.equal(energyMeterSetChanged(meters(['a', 'b']), meters(['b'])), true)
 assert.equal(energyMeterSetChanged(meters(['a']), []), true)
 assert.equal(energyMeterSetChanged([], meters(['a'])), true)
 assert.equal(energyMeterSetChanged([], []), false)
 assert.equal(energyMeterSetChanged(undefined, []), false)
})

test('跨上海日/显式刷新后已加载旧块才可重读 backend；同日普通重开与首屏近30天不重排', () => {
 const days = [
  { date: '2026-07-05', pending: false },
  { date: '2026-07-20', pending: false },
  { date: '2026-08-05', pending: false },
  { date: '2026-06-15', pending: true },
 ]
 const base = { retainedDay: '2026-08-16', currentDay: '2026-08-17' }
 const crossed = energyHistoryRecheckBlocks(days, '2026-08-16', base)
 assert.deepEqual(crossed.map(block => block.key), ['2026-07-01..2026-07-31'])
 assert.equal(crossed[0].force, true)
 assert.deepEqual(energyHistoryRecheckBlocks(days, '2026-08-16', { ...base, currentDay: '2026-08-16' }), [])
 assert.deepEqual(energyHistoryRecheckBlocks(days, '2026-08-16', { retainedDay: '2026-08-16', currentDay: '2026-08-16', force: true }).map(block => block.key), ['2026-07-01..2026-07-31'])
 assert.deepEqual(energyHistoryRecheckBlocks(days, '2026-08-16', { retainedDay: '', currentDay: '2026-08-17' }), [])
})

test('重读资格按日期边界：pending 不入选，条带保留的已加载/失败旧日按稳定月块入选', () => {
 const days = [
  { date: '2026-07-31', pending: false },
  { date: '2026-08-05', pending: false },
  { date: '2026-07-10', pending: false, failed: true },
  { date: '2026-06-30', pending: true },
  { date: '2026-05-10', pending: false, failed: true },
 ]
 const blocks = energyHistoryRecheckBlocks(days, '2026-08-31', { retainedDay: '2026-08-31', currentDay: '2026-09-01' })
 assert.deepEqual(blocks.map(block => block.key), ['2026-05-01..2026-05-31', '2026-07-01..2026-07-31'])
 assert.ok(blocks.every(block => block.force === true))
})

test('同块去重：重复需求只加载一次，完成后不再因同一需求重载', async () => {
 const { queue, calls } = harness({ concurrency: 1 })
 const a = block('2026-06-01', '2026-06-30'), b = block('2026-05-01', '2026-05-31')
 queue.setWanted([a, a, b])
 assert.equal(calls.length, 1)
 calls[0].pending.resolve({})
 await flush()
 assert.equal(calls.length, 2)
 assert.equal(queue.isSettled(a.key), true)
 queue.setWanted([a, b])
 assert.equal(calls.length, 2)
})

test('有限并发：同时在途不超过上限，完成后才启动下一块', async () => {
 const { queue, calls } = harness({ concurrency: 2 })
 queue.setWanted([block('2026-06-01'), block('2026-05-01'), block('2026-04-01')])
 assert.equal(calls.length, 2)
 calls[0].pending.resolve({})
 await flush()
 assert.equal(calls.length, 3)
 assert.equal(calls.filter(call => call.isActive()).length, 2)
})

test('需求收缩移除未开始队列；当前目标优先，已完成块不重复排队', async () => {
 const { queue, calls } = harness({ concurrency: 1 })
 const a = block('2026-06-01'), b = block('2026-05-01'), c = block('2026-04-01')
 queue.setWanted([a, b, c])
 assert.equal(calls.length, 1)
 queue.setWanted([a])
 calls[0].pending.resolve({})
 await flush()
 assert.equal(calls.length, 1)
 queue.setWanted([c, a])
 assert.equal(calls.length, 2)
 assert.equal(calls[1].block.key, c.key)
})

test('当前目标块优先于可见预取：旧目标在途失活后先启动新目标', async () => {
 const { queue, calls } = harness({ concurrency: 1 })
 const first = block('2026-06-01'), target = block('2026-02-01'), prefetch = block('2026-01-01')
 queue.setWanted([first])
 queue.setWanted([target, prefetch])
 assert.equal(calls[0].isActive(), false)
 calls[0].pending.resolve({})
 await flush()
 assert.equal(calls[1].block.key, target.key)
})

test('离开目标的在途等待被 isActive 取消，迟到结果不写回也不触发失败', async () => {
 const { queue, calls, results, errors } = harness({ concurrency: 2 })
 const oldBlock = block('2026-06-01'), target = block('2026-03-01')
 queue.setWanted([oldBlock])
 assert.equal(calls.length, 1)
 queue.setWanted([target])
 assert.equal(calls.length, 2)
 assert.equal(calls[0].isActive(), false)
 assert.equal(calls[1].isActive(), true)
 calls[0].pending.reject(Object.assign(new Error('读取已失效'), { code: 'AGENT_READ_INVALIDATED' }))
 await flush()
 assert.deepEqual(errors, [])
 assert.deepEqual(results, [])
 calls[1].pending.resolve({})
 await flush()
 assert.deepEqual(results, [target.key])
})

test('取消后的迟到成功结果被忽略；同一块重新需要时会再次申请', async () => {
 const { queue, calls, results } = harness({ concurrency: 2 })
 const stale = block('2026-06-01'), target = block('2026-03-01')
 queue.setWanted([stale])
 queue.setWanted([target])
 calls[0].pending.resolve({ late: true })
 await flush()
 assert.deepEqual(results, [])
 queue.setWanted([target, stale])
 assert.equal(calls.filter(call => call.block.key === stale.key).length, 2)
 calls[1].pending.resolve({})
 calls[2].pending.resolve({})
 await flush()
 assert.deepEqual(results.sort(), [stale.key, target.key].sort())
})

test('真实失败只结算一次并保留重试入口；forget 后才重新申请', async () => {
 const { queue, calls, errors } = harness({ concurrency: 1 })
 const a = block('2026-06-01')
 queue.setWanted([a])
 calls[0].pending.reject(new Error('网络失败'))
 await flush()
 assert.deepEqual(errors.map(item => item.key), [a.key])
 assert.equal(queue.isSettled(a.key), true)
 queue.setWanted([a])
 assert.equal(calls.length, 1)
 queue.forget(a.key)
 assert.equal(queue.isSettled(a.key), false)
 queue.setWanted([a])
 assert.equal(calls.length, 2)
})

test('关闭/换身份重置：在途读取立即失活，迟到结果不写回；重开后按新需求重新申请', async () => {
 const { queue, calls, results } = harness({ concurrency: 1 })
 const a = block('2026-06-01')
 queue.setWanted([a])
 assert.equal(calls.length, 1)
 queue.reset()
 assert.equal(calls[0].isActive(), false)
 assert.equal(queue.isSettled(a.key), false)
 calls[0].pending.resolve({ stale: true })
 await flush()
 assert.deepEqual(results, [])
 queue.setWanted([a])
 assert.equal(calls.length, 2)
 calls[1].pending.resolve({})
 await flush()
 assert.deepEqual(results, [a.key])
})
