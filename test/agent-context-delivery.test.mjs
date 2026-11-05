import test from 'node:test'
import assert from 'node:assert/strict'
import { createContextDelivery } from '../pages/agent/lib/conversation.mjs'

const oldRef = { type: 'safety_event', ledger: 'gas', eventId: 'old', deviceId: 'gas-a' }
const nextRef = { type: 'safety_event', ledger: 'gas', eventId: 'new', deviceId: 'gas-b' }
function harness() {
 let draft = { text: '我正在处理旧告警', reference: oldRef, scope: 'alice', editing: false }
 const decisions = []
 const delivery = createContextDelivery({ read: () => draft, write: value => { draft = value },
  confirm: () => new Promise(resolve => decisions.push(resolve)), isActive: scope => scope === draft.scope })
 return { delivery, decisions, read: () => draft, change: value => { draft = { ...draft, ...value } } }
}

test('取消新告警时正文与引用同时保留，确认后同时替换', async () => {
 const h = harness()
 const declined = h.delivery.receive({ reference: nextRef, prompt: '核实新告警' })
 h.decisions.shift()(false)
 assert.equal(await declined, false)
 assert.equal(h.read().text, '我正在处理旧告警')
 assert.deepEqual(h.read().reference, oldRef)
 const accepted = h.delivery.receive({ reference: nextRef, prompt: '核实新告警' })
 h.decisions.shift()(true)
 assert.equal(await accepted, true)
 assert.equal(h.read().text, '核实新告警')
 assert.deepEqual(h.read().reference, nextRef)
})

test('旧确认迟到、换身份和用户改写草稿都不能覆盖当前输入', async () => {
 const h = harness()
 const first = h.delivery.receive({ reference: oldRef, prompt: '较早入口' })
 const second = h.delivery.receive({ reference: nextRef, prompt: '较新入口' })
 h.decisions[1](true)
 assert.equal(await second, true)
 h.decisions[0](true)
 assert.equal(await first, false)
 assert.equal(h.read().text, '较新入口')
 const rotated = h.delivery.receive({ reference: oldRef, prompt: '不应跨账号' })
 h.change({ scope: 'bob', text: '新账号草稿', reference: null })
 h.decisions[2](true)
 assert.equal(await rotated, false)
 assert.equal(h.read().text, '新账号草稿')
 const edited = h.delivery.receive({ reference: nextRef, prompt: '不应覆盖后来输入' })
 h.change({ text: '用户后来写的内容' })
 h.decisions[3](true)
 assert.equal(await edited, false)
 assert.equal(h.read().text, '用户后来写的内容')
})

test('相同告警与问题不重复确认，销毁后旧确认不能写回', async () => {
 const h = harness()
 assert.equal(await h.delivery.receive({ reference: oldRef, prompt: h.read().text }), true)
 assert.equal(h.decisions.length, 0)
 const pending = h.delivery.receive({ reference: nextRef, prompt: '新告警' })
 h.delivery.invalidate()
 h.decisions[0](true)
 assert.equal(await pending, false)
 assert.deepEqual(h.read().reference, oldRef)
})
