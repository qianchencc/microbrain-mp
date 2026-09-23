// 横杆收起回归（2026-09-17 真机验收）：
// 1) 拖拽过阈值松手时，WXS 不得先把 .sheet 写回 translateY(0)——内层 300ms 回弹会与
//    uni-popup 外层 slide-bottom 叠加成「先上窜再收起」的反向运动；应保持松手位移，
//    交给 popup.close() 的外层动画从当前位置继续带下屏。
// 2) DraftSheetLayer 在 emit('close') 同帧即失去 draft，但面板还有 300ms 下滑动画；
//    渲染必须读最后一次非空的 renderDraft 快照，否则标题/编辑器在动画前卸载，
//    表现为「瞬间消失+一闪」。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sheetSrc = readFileSync(new URL('../pages/agent/components/DeviceSheet.vue', import.meta.url), 'utf8')
const layerSrc = readFileSync(new URL('../pages/agent/components/DraftSheetLayer.vue', import.meta.url), 'utf8')

// 抽出 <script module="sheetGesture" lang="wxs"> 在 Node 中直接执行真实手势逻辑
function loadWxs() {
	const code = sheetSrc.match(/<script module="sheetGesture"[^>]*>([\s\S]*?)<\/script>/)?.[1]
	assert.ok(code, 'DeviceSheet.vue 缺少 sheetGesture WXS 模块')
	const mod = { exports: {} }
	new Function('module', 'exports', code)(mod, mod.exports)
	return mod.exports
}

function createOwner() {
	const writes = [], calls = []
	const owner = {
		selectComponent: () => ({ setStyle: style => writes.push(style) }),
		callMethod: name => calls.push(name),
	}
	return { owner, writes, calls }
}

const drag = (wxs, owner, { from = 100, to = 450, moveMs = 50, threshold = 150 } = {}) => {
	wxs.handleStart({ touches: [{ clientY: from }], timeStamp: 0 }, owner)
	wxs.handleMove({ touches: [{ clientY: to }], timeStamp: moveMs }, owner)
	wxs.handleEnd({ changedTouches: [{ clientY: to }], currentTarget: { dataset: { threshold } }, timeStamp: moveMs + 10 }, owner)
}

test('拖拽过阈值松手：发起收起且不回写 translateY(0)，保留松手位移交给外层动画', () => {
	const wxs = loadWxs()
	const { owner, writes, calls } = createOwner()
	drag(wxs, owner) // 位移 350 > 阈值 150，判定收起
	assert.deepEqual(calls, ['dismissFromHandle'], '过阈值松手必须通知逻辑层收起')
	const last = writes.at(-1)
	assert.equal(last?.transform, 'translateY(350px)', '收起路径不应把内层位移弹回 0，应冻结在松手位置')
})

test('过阈值收起后再次打开：必须由 WXS 清除复用节点的残留内联位移', () => {
 const template = sheetSrc.match(/<template>([\s\S]*)<\/template>/)?.[1]
 const script = sheetSrc.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
 assert.match(template, /:surface-reset="surfaceReset"[^>]*:change:surface-reset="sheetGesture\.resetSurface"/, 'sheet 必须绑定渲染层 prop observer')
 assert.match(script, /surfaceReset\.value\+\+\s*\n\s*await nextTick\(\)/, '每次打开必须先通知 WXS 清理、再调用 popup.open')
 const wxs = loadWxs()
 const { owner, writes } = createOwner()
 drag(wxs, owner)
 assert.equal(writes.at(-1)?.transform, 'translateY(350px)')
 wxs.resetSurface(2, 1, owner)
 assert.deepEqual(writes.at(-1), { transition: 'none', transform: 'translateY(0px)' })
})

test('未过阈值松手：保留回弹行为，写回 translateY(0)', () => {
	const wxs = loadWxs()
	const { owner, writes, calls } = createOwner()
	drag(wxs, owner, { from: 100, to: 140, moveMs: 200 }) // 位移 40 < 阈值，速度 0.2 不构成轻扫
	assert.deepEqual(calls, [], '未过阈值不应收起')
	const last = writes.at(-1)
	assert.equal(last?.transform, 'translateY(0px)', '弹回应复位到原点')
	assert.match(last?.transition ?? '', /transform 300ms/, '弹回应带 300ms 过渡')
})

test('横杆上拉完全不移动：底部锚定面板不得抬离屏底', () => {
	const wxs = loadWxs()
	const { owner, writes } = createOwner()
	wxs.handleStart({ touches: [{ clientY: 500 }], timeStamp: 0 }, owner)
	wxs.handleMove({ touches: [{ clientY: 100 }], timeStamp: 50 }, owner)
	assert.equal(writes.at(-1)?.transform, 'translateY(0px)', '上拉不应产生任何负位移或露出底部背景')
})

test('触摸取消：同样回弹复位，不触发收起', () => {
	const wxs = loadWxs()
	const { owner, writes, calls } = createOwner()
	wxs.handleStart({ touches: [{ clientY: 100 }], timeStamp: 0 }, owner)
	wxs.handleMove({ touches: [{ clientY: 400 }], timeStamp: 50 }, owner)
	wxs.handleCancel({ changedTouches: [{ clientY: 400 }] }, owner)
	assert.deepEqual(calls, [])
	assert.equal(writes.at(-1)?.transform, 'translateY(0px)')
})

test('DraftSheetLayer 渲染冻结：模板只读 renderDraft，open 仍由 props.draft 实时驱动', () => {
	const template = layerSrc.match(/<template>([\s\S]*)<\/template>/)?.[1]
	assert.ok(template, '缺少 template 块')
	const stripped = template.replaceAll('renderDraft.', '')
	assert.doesNotMatch(stripped, /\bdraft\./, '模板不得直接读 props.draft——emit(\'close\') 同帧草案即空，裸读会让内容在收起动画前卸载')

	const script = layerSrc.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
	assert.ok(script, '缺少 script setup 块')
	assert.match(script, /renderDraft/, '缺少 renderDraft 渲染快照')
	assert.match(script, /Boolean\(props\.draft\)/, 'open 必须由 props.draft 实时驱动，收起信号不能延迟')
})
