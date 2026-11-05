import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversationOperations } from '../pages/agent/lib/conversation.mjs'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fixture(overrides = {}) {
  const turn = { id: 'turn', running: false, activities: [], draft: {
    draftId: 'draft', status: 'PENDING_CONFIRMATION', revision: 1,
    expiresAt: '2099-01-01T00:00:00Z', selectedActionIds: [],
  } }
  const context = { source: 'office', scope: 'account-a', conversationId: 'conversation', turns: [turn], disposed: false, active: true }
  const notices = [], changes = []
  let model, restores = 0
  model = createConversationOperations({
    read: () => ({ ...context, blocked: model.state.busy }), api: overrides,
    effects: { changed: () => changes.push(true), follow() {}, unread() {}, rememberDraft() {}, tasksChanged() {},
      notice: (...value) => notices.push(value), restore: async () => { restores++ } },
  })
  model.rememberDraft(turn.draft)
  return { model, turn, context, notices, changes, restores: () => restores }
}

test('连续勾选按版本串行落地，旧响应不能覆盖较新的本地选择，确认等待最终选区', async () => {
  const first = deferred(), second = deferred(), calls = []
  const { model, turn } = fixture({
    updateSelection: (id, revision, ids) => { calls.push(['select', revision, ids]); return calls.length === 1 ? first.promise : second.promise },
    confirmAction: async (id, revision) => { calls.push(['confirm', revision]); return { status: 'SUCCEEDED' } },
  })
  model.select(turn, ['a'])
  await flush()
  model.select(turn, ['b'])
  const confirmation = model.confirmDraft(turn)
  first.resolve({ revision: 2, selectedActionIds: ['a'] })
  await flush()
  assert.deepEqual(turn.draft.selectedActionIds, ['b'])
  assert.deepEqual(calls, [['select', 1, ['a']], ['select', 2, ['b']]])
  second.resolve({ revision: 3, selectedActionIds: ['b'] })
  await confirmation
  assert.deepEqual(calls.at(-1), ['confirm', 3])
  assert.equal(turn.draft.status, 'SUCCEEDED')
})

test('跨越确认起止的恢复快照失效；确认结果只写当前活轮次', async () => {
  const result = deferred()
  const { model, turn, context } = fixture({ confirmAction: () => result.promise })
  turn.draft.selectedActionIds = ['a']
  const before = model.snapshotFence()
  const work = model.confirmDraft(turn)
  await flush()
  assert.equal(model.snapshotCurrent(before), false)
  const during = model.snapshotFence()
  const replacement = { ...turn, draft: { ...turn.draft } }
  context.turns = [replacement]
  result.resolve({ status: 'SUCCEEDED', receipts: [{ actionId: 'a', status: 'succeeded' }] })
  await work
  assert.equal(replacement.draft.status, 'SUCCEEDED')
  assert.equal(turn.draft.status, 'EXECUTING')
  assert.equal(model.snapshotCurrent(during), false)
})

test('账号切换或销毁后旧确认不能污染新会话，重置会解除本地忙碌态', async () => {
  const result = deferred()
  const { model, turn, context } = fixture({ confirmAction: () => result.promise })
  turn.draft.selectedActionIds = ['a']
  const work = model.confirmDraft(turn)
  await flush()
  context.scope = 'account-b'
  model.reset()
  context.turns = [{ id: 'new', text: 'new account' }]
  result.resolve({ status: 'SUCCEEDED' })
  await work
  assert.deepEqual(context.turns, [{ id: 'new', text: 'new account' }])
  assert.equal(model.state.busy, false)
  assert.equal(model.canRestore(false), true)
})

test('断流保持服务端运行态，不伪造停止；显式停止才发送取消并回读', async () => {
  let cancellations = 0
  const { model, turn, restores } = fixture({
    streamMessage: () => ({ promise: Promise.reject(Object.assign(new Error('offline'), { transport: true })), abort() {} }),
    cancelRun: async () => { cancellations++ },
  })
  turn.running = true
  await model.run(turn, '检查设备')
  assert.equal(model.state.running, true)
  assert.equal(turn.running, true)
  assert.equal(cancellations, 0)
  await model.stop()
  assert.equal(cancellations, 1)
  assert.equal(model.state.running, false)
  assert.equal(turn.error, '本次回答已停止')
  assert.equal(restores(), 1)
})

test('任务重新确认信号不宣告创建成功，恢复后保留明确提示', async () => {
  const { model, context, restores } = fixture({ confirmTask: async () => { throw { data: { code: 'TASK_RECONFIRM_REQUIRED' } } } })
  const task = { taskId: 'proposal', status: 'PENDING_CONFIRMATION', version: 1 }
  context.turns = [{ task }]
  await model.confirmTask(task)
  assert.equal(task.created, undefined)
  assert.equal(task.status, 'PENDING_CONFIRMATION')
  assert.equal(model.state.recovery, '核实完成：提案已更新，请重新确认')
  assert.equal(model.state.confirmingTaskId, '')
  assert.equal(restores(), 1)
})
