import test from 'node:test'
import assert from 'node:assert/strict'
import { avatarLayers } from '../pages/agent/avatar.js'

test('Agent 使用稳定品牌头像，不随会话随机变形', () => {
 const first = avatarLayers('会议室😀')
 const second = avatarLayers('另一条会话')
 assert.deepEqual(first, second)
 assert.match(first.body, /^data:image\/svg\+xml;charset=utf-8,/) 
 assert.match(first.eyes, /^data:image\/svg\+xml;charset=utf-8,/)
 assert.match(decodeURIComponent(first.body), /#176b54/)
})
