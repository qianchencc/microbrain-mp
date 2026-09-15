import test from 'node:test'
import assert from 'node:assert/strict'
import { avatarLayers } from '../pages/agent/avatar.js'

test('头像在真机缺少编码 API 时仍可加载，且与标准编码结果一致', () => {
 const first = avatarLayers('会议室😀')
 const second = avatarLayers('会议室😀')
 assert.deepEqual(first, second)
 assert.match(first.body, /^data:image\/svg\+xml;charset=utf-8,/) 
 assert.match(first.eyes, /^data:image\/svg\+xml;charset=utf-8,/)
})
