import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversationRecovery } from '../pages/agent/lib/conversation.mjs'

const view = (text = '已有回答', source = 'office') => ({ id: 'c1', source, turns: [{ id: 't1', text }], phase: 'idle' })
function fixture() {
 const data = new Map()
 let scope = 'alice', backend = 'backend-a', time = 1_000
 const storage = { getStorageSync: key => data.get(key), setStorageSync: (key, value) => data.set(key, structuredClone(value)), removeStorageSync: key => data.delete(key) }
 const options = { getScope: () => { if (!scope) throw Error('logged out'); return scope }, getBackend: () => backend, storage, now: () => time }
 return { data, storage, open: () => createConversationRecovery(options), scope: value => { scope = value }, backend: value => { backend = value }, advance: value => { time += value } }
}

test('重开立即显示已有会话，但本次后端对齐前始终只读', () => {
 const f = fixture(), first = f.open(), initial = first.open('office')
 first.accept(initial, view())
 const reopened = f.open(), ticket = reopened.open('office')
 assert.equal(ticket.preview.turns[0].text, '已有回答')
 assert.equal(reopened.canMutate(ticket), false)
 assert.equal(reopened.accept(ticket, view('后端新回答')), true)
 assert.equal(reopened.canMutate(ticket), true)
 assert.equal(reopened.open('office').preview.turns[0].text, '后端新回答')
})

test('账号、后端与办公室公司来源不会共用对话', () => {
 const f = fixture(), cache = f.open(), first = cache.open('office')
 cache.accept(first, view())
 assert.equal(cache.open('company').preview, null)
 f.scope('bob'); assert.equal(cache.open('office').preview, null); assert.equal(cache.canMutate(first), false)
 f.scope('alice'); f.backend('backend-b'); assert.equal(cache.open('office').preview, null)
})

test('清除后迟到读取不能回填旧会话，新读取也不会被旧清理删掉', () => {
 const f = fixture(), cache = f.open(), old = cache.open('office')
 cache.accept(old, view())
 const pending = cache.open('office')
 cache.forget(pending)
 assert.equal(cache.accept(pending, view('迟到内容')), false)
 assert.equal(f.open().open('office').preview, null)
 const fresh = cache.open('office'); cache.accept(fresh, view('新会话'))
 assert.equal(cache.forget(pending), false)
 assert.equal(f.open().open('office').preview.turns[0].text, '新会话')
})

test('重开更新代际，不接收旧页面响应或旧页面继续操作', () => {
 const f = fixture(), cache = f.open(), old = cache.open('office')
 cache.accept(old, view())
 const fresh = cache.open('office')
 assert.equal(cache.canMutate(old), false)
 assert.equal(cache.accept(old, view('旧响应')), false)
 assert.equal(cache.accept(fresh, view('新响应')), true)
 assert.equal(f.open().open('office').preview.turns[0].text, '新响应')
})

test('过期内容不展示，设备存储失败也不阻断真实后端对齐', () => {
 const f = fixture(), cache = f.open(), ticket = cache.open('office')
 cache.accept(ticket, view()); f.advance(6 * 60 * 60 * 1000)
 assert.equal(f.open().open('office').preview, null)
 f.storage.setStorageSync = () => { throw Error('quota') }
 const fresh = cache.open('office')
 assert.equal(cache.accept(fresh, view('仍可使用')), true)
 assert.equal(cache.canMutate(fresh), true)
 assert.equal(cache.open('office').preview.turns[0].text, '仍可使用')
})

test('缓存是独立的展示副本，退出后不能保存或继续操作', () => {
 const f = fixture(), cache = f.open(), ticket = cache.open('office'), original = view()
 cache.accept(ticket, original); original.turns[0].text = '外部修改'
 const reopened = cache.open('office'); reopened.preview.turns[0].text = '预览修改'
 assert.equal(f.open().open('office').preview.turns[0].text, '已有回答')
 f.scope(''); assert.equal(cache.canMutate(ticket), false); assert.equal(cache.retain(ticket, original), false)
 cache.forget(reopened); f.scope('alice'); assert.equal(f.open().open('office').preview, null)
})
