import test from 'node:test'
import assert from 'node:assert/strict'
import {createPresentation} from '../pages/agent/presentation.mjs'

test('结束状态不会越过尚未展示完成的工具事件', async () => {
 for (const terminal of ['run.completed','run.awaiting_confirmation','run.failed']) {
  const received=[]
  const presentation=createPresentation(event=>received.push(event.type),1)
  presentation.push({type:'tool.started'})
  presentation.push({type:'tool.completed'})
  presentation.push({type:terminal})
  presentation.push({type:'message.delta'})
  assert.deepEqual(received,['message.delta'])
  await presentation.settle()
  assert.deepEqual(received,['message.delta','tool.started','tool.completed',terminal])
  presentation.cancel()
 }
})

test('批量轨迹保持运行、完成、下一节点顺序，正文不被动画阻塞', async () => {
 const received = []
 const p = createPresentation(event => received.push(event.type),1)
 p.push({type:'tool.started'})
 p.push({type:'tool.completed'})
 p.push({type:'tool.started'})
 p.push({type:'message.delta'})
 assert.deepEqual(received,['message.delta'])
 await p.settle()
 assert.deepEqual(received,['message.delta','tool.started','tool.completed','tool.started'])
 p.cancel()
})
test('卸载后不再重放等待中的轨迹', async () => {
 const received = []
 const p = createPresentation(event => received.push(event.type),1)
 p.push({type:'tool.started'})
 p.cancel()
 await p.settle()
 assert.deepEqual(received,[])
})
import {createDraftBaseline, draftBaselineChanged} from '../pages/agent/action-draft-presentation.js'

test('草案基线：勾选或指令偏离发布快照即判定有改动', () => {
 const draft = {
  selectedActionIds: ['a', 'b'],
  actions: [
   { id: 'a', command: { temperature: 26, mode: 'cool' } },
   { id: 'b', command: { closeOrOpen: 1 } },
  ],
 }
 const baseline = createDraftBaseline(draft)
 assert.equal(draftBaselineChanged(draft, baseline), false)

 // 勾选集合不同
 assert.equal(draftBaselineChanged({ ...draft, selectedActionIds: ['a'] }, baseline), true)

 // 指令字段被修改
 const edited = { ...draft, actions: [{ ...draft.actions[0], command: { temperature: 25, mode: 'cool' } }, draft.actions[1]] }
 assert.equal(draftBaselineChanged(edited, baseline), true)

 // 字段被加回基线值后恢复无改动
 const powerOffThenOn = { ...draft, actions: [{ ...draft.actions[0], command: { power: 'off' } }, draft.actions[1]] }
 assert.equal(draftBaselineChanged(powerOffThenOn, baseline), true)

 // 缺基线时按无改动处理（按钮不显示）
 assert.equal(draftBaselineChanged(draft, null), false)
})
