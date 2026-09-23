import test from 'node:test'
import assert from 'node:assert/strict'
import { createTurn, applyEvent, restoreTurns } from '../pages/agent/conversation.mjs'
import { rosterLiveStats, rosterGroups, rosterStateView, rosterActionView, rosterLiveView } from '../pages/agent/device-roster.js'

const light = { deviceId: 'l1', kind: 'lighting', name: '照明开关-26楼会议室-1回路格栅灯', location: '26楼会议室-照明', state: false, command: { closeOrOpen: 1 }, disposition: 'operate' }
const litLight = { deviceId: 'l2', kind: 'lighting', name: '照明开关-26楼会议室-2回路格栅灯', location: '26楼会议室-照明', state: true, disposition: 'excluded' }
const ac = { deviceId: 'a1', kind: 'ac', name: '空调-26研究院、农旅1号', location: '26楼研究院', state: { power: 'off' }, command: { power: 'on', mode: 'cool', temperature: 26, fanSpeed: 'low' }, disposition: 'operate' }
const door = { deviceId: 'd1', kind: 'access', name: '门禁-26楼档案室', location: '26楼档案室', state: null, command: { controlType: 2 }, disposition: 'operate' }
const unread = { deviceId: 'l3', kind: 'lighting', name: '智慧照明-未知位置灯', location: '', state: null, disposition: 'none' }
const standby = { deviceId: 'l4', kind: 'lighting', name: '照明开关-备用灯', location: '26楼会议室-照明', state: false, command: { closeOrOpen: 1 }, disposition: 'standby' }

const draft = {
	actions: [
		{ id: 'act-l1', deviceId: 'l1', kind: 'lighting', command: { closeOrOpen: 1 } },
		{ id: 'act-a1', deviceId: 'a1', kind: 'ac', command: { power: 'on', mode: 'cool', temperature: 26, fanSpeed: 'low' } },
		{ id: 'act-d1', deviceId: 'd1', kind: 'access', command: { controlType: 2 } },
		{ id: 'act-l4', deviceId: 'l4', kind: 'lighting', command: { closeOrOpen: 1 } },
	],
	selectedActionIds: ['act-l1', 'act-a1', 'act-d1'],
}

test('活统计：拟执行跟随勾选变化，不动=清单内未选+不在草案', () => {
	assert.deepEqual(rosterLiveStats([light, litLight, ac, door, unread, standby], draft), { total: 6, operate: 3, idle: 3 })
	const allSelected = { ...draft, selectedActionIds: draft.actions.map(a => a.id) }
	assert.deepEqual(rosterLiveStats([light, litLight, ac, door, unread, standby], allSelected), { total: 6, operate: 4, idle: 2 })
	assert.deepEqual(rosterLiveStats([light], null), { total: 1, operate: 0, idle: 1 })
})

test('位置第一分组，组内保持发现顺序，operateCount 走活 join', () => {
	const groups = rosterGroups([ac, light, litLight, standby, door, unread], draft)
	assert.deepEqual(groups.map(g => g.location), ['26楼研究院', '26楼会议室-照明', '26楼档案室', '其他位置'])
	assert.deepEqual(groups[1].items.map(i => i.deviceId), ['l1', 'l2', 'l4'])
	assert.equal(groups[1].operateCount, 1)
	assert.equal(groups[0].operateCount, 1)
})

test('状态槽：照明色点+布尔词、空调复合摘要、门禁诚实占位、未读状态未知', () => {
	assert.deepEqual(rosterStateView(light), { text: '已关闭', dot: 'off' })
	assert.deepEqual(rosterStateView(litLight), { text: '已点亮', dot: 'on' })
	assert.deepEqual(rosterStateView(ac), { text: '关闭', dot: null })
	assert.deepEqual(rosterStateView(door), { text: '—', dot: null })
	assert.deepEqual(rosterStateView(unread), { text: '状态未知', dot: 'off' })
	const runningAc = rosterStateView({ ...ac, state: { power: 'on', mode: 'cool', temperature: 25, fanSpeed: 'low' } })
	assert.equal(runningAc.text, '制冷 · 25°C · 低风')
})

test('状态槽被 confirm 回读覆盖：observedStates 非空胜出', () => {
	const observed = { l1: true, a1: { power: 'on', mode: 'cool', temperature: 26, fanSpeed: 'low' }, d1: null }
	assert.equal(rosterStateView(light, observed).text, '已点亮')
	assert.equal(rosterStateView(ac, observed).text, '制冷 · 26°C · 低风')
	assert.equal(rosterStateView(door, observed).text, '—')
})

test('处置槽迁移链：勾选给 → 目标（读活指令），未选/不在草案给降饱和词', () => {
	assert.equal(rosterActionView(light, draft).text, '→ 打开')
	assert.equal(rosterActionView(ac, draft).text, '→ 制冷 · 26° · 低风')
	assert.equal(rosterActionView(door, draft).text, '→ 开门一次')
	assert.equal(rosterActionView(standby, draft).text, '未选择')
	assert.equal(rosterActionView(litLight, draft).text, '已排除')
	assert.equal(rosterActionView(unread, draft).text, '不动')
	assert.equal(rosterActionView({ ...light, command: { closeOrOpen: 0 } }, draft).text, '→ 打开')
})

test('处置槽跟随活指令：空调调温实时回流到目标摘要', () => {
	const edited = { ...draft, actions: draft.actions.map(a => a.id === 'act-a1' ? { ...a, command: { ...a.command, temperature: 27 } } : a) }
	assert.equal(rosterActionView(ac, edited).text, '→ 制冷 · 27° · 低风')
	const close = { ...draft, actions: draft.actions.map(a => a.id === 'act-a1' ? { ...a, command: { power: 'off' } } : a) }
	assert.equal(rosterActionView(ac, close).text, '→ 关闭')
})

test('行视图：短名取末段、标记优先 artwork 裸图否则退回 code 徽章', () => {
	const view = rosterLiveView(light, draft)
	assert.equal(view.name, '1回路格栅灯')
	assert.equal(view.marker.code, 'LGT')
	assert.equal(view.marker.src, '/static/device-art/lighting-grille-luminaire.png')
	assert.equal(rosterLiveView(ac, draft).marker.src, '/static/device-art/central-ac-cassette.png')
	assert.equal(rosterLiveView(door, draft).marker.src, '/static/device-art/access-sliding-door.png')
	assert.equal(rosterLiveView({ ...unread, kind: 'environment' }, draft).marker.src, null)
	assert.equal(rosterLiveView({ ...unread, kind: 'environment' }, draft).marker.code, 'DEV')
	assert.equal(rosterLiveView(light, draft).quiet, false)
	assert.equal(rosterLiveView(litLight, draft).quiet, true)
})

test('inventory 落在轮次上并随恢复重放', () => {
	const turn = createTurn('t1', '开灯开门')
	applyEvent(turn, { type: 'action.proposed', draftId: 'd1', actions: [], selectedActionIds: [], inventory: [light, ac, door] })
	assert.equal(turn.roster.length, 3)
	const restored = restoreTurns([{ id: 't1', content: '开灯开门', events: [{ type: 'action.proposed', draftId: 'd1', actions: [], selectedActionIds: [], inventory: [light, ac, door] }] }])
	assert.equal(restored[0].roster.length, 3)
	assert.equal(restored[0].roster[0].deviceId, 'l1')
	const bare = createTurn('t2', '问答')
	applyEvent(bare, { type: 'action.proposed', draftId: 'd2', actions: [] })
	assert.equal(bare.roster, null)
})
