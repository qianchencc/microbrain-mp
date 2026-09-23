import test from 'node:test'
import assert from 'node:assert/strict'
import { cardConfigurable, mergeObservedStates, receiptPhase, reduceCardHold, stateText } from '../pages/agent/device-card-state.js'
import { acTemperatureStep, commonSetting, editSettings, operationLabel } from '../pages/agent/ac-draft.js'
import { computeDeviceGrid, createDraftRailItems, createDraftGroups, firstRowBelowFold, remainingBelowFold } from '../pages/agent/action-draft-presentation.js'
import { deviceLocationLabel, resolveDeviceArtwork } from '../pages/agent/device-art/catalog.js'
import { createFieldEchoGuard } from '../pages/agent/field-echo-guard.mjs'
import { resolveKeyboardDock } from '../pages/agent/keyboard-dock.mjs'

test('受理和达到目标分开，门禁没有物理完成态', () => {
 const ac = {kind:'ac',command:{temperature:25}}
 assert.equal(receiptPhase(ac,'ACCEPTED',{temperature:24}),'accepted')
 assert.equal(receiptPhase(ac,'ACCEPTED',{temperature:25}),'complete')
 assert.equal(receiptPhase({kind:'access'},'ACCEPTED',true),'accepted')
 assert.equal(receiptPhase(ac,'UNSELECTED',{temperature:25}),'unselected')
 assert.equal(stateText({kind:'lighting'},null),'状态未知')
})
test('批量编辑保留未修改参数，关闭目标清除运行参数修改', () => {
 const actions = [{id:'a',deviceId:'one',command:{temperature:24}},{id:'b',deviceId:'two',command:{temperature:26}}]
 const states = {one:{power:'on',fanSpeed:'low'},two:{power:'on',fanSpeed:'high'}}
 assert.equal(commonSetting(actions,states,{},'temperature'),'')
 const edits = editSettings({},actions,'temperature',25,states)
 assert.deepEqual(edits,{a:{temperature:25},b:{temperature:25}})
 assert.deepEqual(editSettings(edits,actions,'power','off',states),{a:{power:'off'},b:{power:'off'}})
})
test('门禁无参数可配：一次执行即开一次门，operation 文案固定', () => {
 assert.equal(operationLabel({kind:'access',command:{controlType:2}}),'开门一次')
 // count 残留不复活：服务端不接受门禁参数修改，文案不展示次数
 assert.equal(operationLabel({kind:'access',command:{controlType:2,count:3}}),'开门一次')
})
test('长按配置只服务空调：门禁卡在待确认相位也不可配置', () => {
 const access = {kind:'access',command:{controlType:2}}
 const ac = {kind:'ac',command:{temperature:25}}
 assert.equal(cardConfigurable(access,'pending'),false)
 assert.equal(cardConfigurable(ac,'pending'),true)
 assert.equal(cardConfigurable(ac,'complete'),false)
 assert.equal(cardConfigurable(ac,'pending',{readonly:true}),false)
 assert.equal(cardConfigurable(ac,'pending',{disabled:true}),false)
})
test('空调温度步长恒为整数：服务端下发或旧草案残留的半步参数一律按 1 取整', () => {
 assert.equal(acTemperatureStep([{parameters:{temperature:{min:16,max:30,step:1}}}]),1)
 assert.equal(acTemperatureStep([{parameters:{temperature:{min:16,max:30,step:0.5}}}]),1)
 assert.equal(acTemperatureStep([{}]),1)
 // 多台空调取最大步长，仍不小于 1
 assert.equal(acTemperatureStep([{parameters:{temperature:{step:1}}},{parameters:{temperature:{step:2}}}]),2)
})
test('超过四张保留三张及全部入口，分组不丢未选设备', () => {
 const actions = Array.from({length:7},(_,i) => ({id:String(i),kind:'lighting',location:'会议室'}))
 const rail = createDraftRailItems(actions)
 assert.equal(rail.length,4)
 assert.equal(rail[3].hiddenCount,4)
 assert.equal(createDraftGroups(actions,['0'])[0].items.length,7)
})
test('卡片复用原图且省去重复位置', () => {
 assert.equal(resolveDeviceArtwork({kind:'ac'}).src,'/static/device-art/central-ac-cassette.png')
 assert.equal(resolveDeviceArtwork({kind:'access'}).src,'/static/device-art/access-sliding-door.png')
 assert.equal(deviceLocationLabel({deviceName:'空调-会议室',location:'空调-会议室'}),'')
})
test('设备网格保持 119px 卡片规格并按可用宽度计算列数', () => {
 assert.deepEqual(computeDeviceGrid(320),{columns:2,trackWidth:250})
 assert.deepEqual(computeDeviceGrid(375),{columns:2,trackWidth:250})
 assert.deepEqual(computeDeviceGrid(430),{columns:3,trackWidth:381})
 assert.deepEqual(computeDeviceGrid(768),{columns:5,trackWidth:643})
})
test('滚动浮标计数：视口底缘下完整隐藏的行才算「还有 N 台」，为 0 隐藏、回滚重现', () => {
 const groups = [
  { key:'a', label:'A', items:[1,2,3] },        // 1 行，行顶 29
  { key:'b', label:'B', items:[1,2,3,4,5,6] },  // 2 行，行顶 258 / 450
  { key:'c', label:'C', items:[1,2,3,4] },      // 2 行，行顶 679 / 871（末行仅 1 台）
 ]
 assert.equal(remainingBelowFold(groups, 3, 0, 0), 0)      // 视口未测量 → 不显示
 assert.equal(remainingBelowFold(groups, 3, 0, 400), 7)    // B 组第二行 3 台 + C 组两行 4 台
 assert.equal(remainingBelowFold(groups, 3, 200, 400), 4)  // 下滚后只剩 C 组
 assert.equal(remainingBelowFold(groups, 3, 700, 400), 0)  // 到底 → 淡出
 assert.equal(remainingBelowFold(groups, 3, 0, 400), 7)    // 回滚 → 重新出现
 assert.equal(firstRowBelowFold(groups, 3, 0, 400), 450)
 assert.equal(firstRowBelowFold(groups, 3, 700, 400), null)
})
test('回读权威状态覆盖更旧的最后已知值，空项不回退', () => {
 const lastKnown = { a: true, b: true }
 const observed = { a: false, b: null }
 assert.deepEqual(mergeObservedStates(lastKnown, observed), { a: false, b: true })
 assert.deepEqual(mergeObservedStates(lastKnown, undefined), { a: true, b: true })
 assert.equal(mergeObservedStates(lastKnown, null), lastKnown)
 assert.equal(mergeObservedStates(lastKnown, undefined), lastKnown)
})
test('输入回声守卫：打字回流不写回，程序性改写才落原生层', () => {
 const guard = createFieldEchoGuard('')
 // 打字（含拼音组合中态）回流是同值回声，禁止写 :value
 guard.track("suo'you'd")
 assert.equal(guard.shouldWrite("suo'you'd"), false)
 guard.track('打开所有灯')
 assert.equal(guard.shouldWrite('打开所有灯'), false)
 // 发送后父级清空——非回声，必须写回清空原生字段
 assert.equal(guard.shouldWrite(''), true)
 // 清空后再写同值也不重复写
 assert.equal(guard.shouldWrite(''), false)
 // 恢复草稿等非空程序性写入放行
 guard.track('abc')
 assert.equal(guard.shouldWrite('已保存的草稿'), true)
})
test('回声守卫 plan：目标值恰等于已写入值时两步强制写，否则发送清空进不了原生层', () => {
 const guard = createFieldEchoGuard('')
 // 打字只进 track，:value 保持 ''；发送后父级清空 '' 与已写入值相同——单步写会被 Vue 跳过
 guard.track('打开所有灯')
 assert.deepEqual(guard.plan('', ''), ['打开所有灯', ''])
 // 已写过目标值：后续同值不再重复写
 assert.deepEqual(guard.plan('', ''), [])
 // 常规程序性改写单步直达
 guard.track('abc')
 assert.deepEqual(guard.plan('已保存的草稿', ''), ['已保存的草稿'])
 // 回声抑制不变：打字回流计划为空
 guard.track('xyz')
 assert.deepEqual(guard.plan('xyz', ''), [])
})
test('长按完成只提交意图，触摸序列结束后才允许打开面板', () => {
 let state = reduceCardHold('idle','start')
 state = reduceCardHold(state,'complete')
 assert.equal(state,'committed', '手指仍按住时不得打开 popup')
 assert.equal(reduceCardHold(state,'complete'),'committed', '定时器与原生 longpress 重复完成必须幂等')
 assert.equal(reduceCardHold(state,'end'),'released', '正常抬手后才允许打开')
 assert.equal(reduceCardHold(state,'cancel'),'released', '已提交后的系统 touchcancel 也必须兑现，而非撤销')
 assert.equal(reduceCardHold('tracking','cancel'),'cancelled')
 assert.equal(reduceCardHold('cancelled','complete'),'cancelled')
})
test('视口测量在节点尚未挂载时有界重试，量到非零高度即落值', async () => {
 const { createViewportMeasurer } = await import('../pages/agent/list-viewport.mjs')
 let calls = 0, applied = 0
 // 前三次查询模拟 popup 子树尚未挂载（rect 为 null/0），第四次才返回真实高度
 const measurer = createViewportMeasurer({
  query: cb => cb(++calls >= 4 ? { height: 560 } : null),
  apply: h => { applied = h },
  active: () => true,
  delay: 1,
 })
 measurer.schedule()
 await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(applied, 560, 'popup 挂载完成前测量为空不得放弃——否则浮标计数恒为 0 永远不显示')
 assert.ok(calls >= 4)

 // 面板已关（active=false）时应停止重试，不再空转
 calls = 0; applied = 0
 const inactive = createViewportMeasurer({
  query: cb => { calls++; cb(null) },
  apply: h => { applied = h },
  active: () => false,
  delay: 1,
 })
 inactive.schedule()
 await new Promise(resolve => setTimeout(resolve, 30))
 assert.equal(applied, 0)
 assert.equal(calls, 1, '非激活态下不得继续重试')
 inactive.dispose()
})

test('键盘停靠归一化：duration 跨端单位统一为毫秒并封顶', () => {
 assert.deepEqual(resolveKeyboardDock({ detail: { height: 291, duration: 0.25 } }), { height: 291, durationMs: 250 })
 assert.deepEqual(resolveKeyboardDock({ detail: { height: 291, duration: 250 } }), { height: 291, durationMs: 250 })
 assert.deepEqual(resolveKeyboardDock({ detail: { height: 0 } }), { height: 0, durationMs: 0 })
 assert.deepEqual(resolveKeyboardDock({ detail: { height: 291, duration: 5 } }), { height: 291, durationMs: 400 })
 assert.deepEqual(resolveKeyboardDock(undefined), { height: 0, durationMs: 0 })
})
