import test from 'node:test'
import assert from 'node:assert/strict'
import { sheetDraftFrom } from '../pages/agent/draft-sheet.mjs'

test('只有待确认草案能停留在面板上，状态推进即关闭', () => {
 const turns = [
  { draft: { draftId: 'a', status: 'PENDING_CONFIRMATION' } },
  { draft: { draftId: 'b', status: 'EXECUTING' } },
  { draft: { draftId: 'c', status: 'EXPIRED' } },
  { draft: null },
 ]
 assert.equal(sheetDraftFrom(turns, 'a').draftId, 'a')
 assert.equal(sheetDraftFrom(turns, 'b'), null)
 assert.equal(sheetDraftFrom(turns, 'c'), null)
 assert.equal(sheetDraftFrom(turns, 'missing'), null)
 assert.equal(sheetDraftFrom(turns, ''), null)
})
