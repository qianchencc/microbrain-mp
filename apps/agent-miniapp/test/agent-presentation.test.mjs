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