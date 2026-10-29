import test from 'node:test'
import assert from 'node:assert/strict'
import { receiptPhase } from '../pages/agent/lib/actions.mjs'

test('照明执行回执不随之后查询到的开关状态改写', () => {
 const action = { kind: 'lighting', command: { closeOrOpen: 1 } }
 assert.equal(receiptPhase(action, 'ACCEPTED', true), 'accepted')
 assert.equal(receiptPhase(action, 'ACCEPTED', false), 'accepted')
 assert.equal(receiptPhase(action, 'ALREADY_SATISFIED', false), 'complete')
 assert.equal(receiptPhase({ kind: 'ac', command: { power: 'on' } }, 'ACCEPTED', 'confirmed'), 'complete')
})
