import test from 'node:test'
import assert from 'node:assert/strict'
import { receiptPhase, reduceCardHold, stateText } from '../pages/agent/device-card-state.js'
import { commonSetting, editSettings } from '../pages/agent/ac-draft.js'
import { computeDeviceGrid, createDraftRailItems, createDraftGroups } from '../pages/agent/action-draft-presentation.js'
import { deviceLocationLabel, resolveDeviceArtwork } from '../pages/agent/device-art/catalog.js'

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
test('门禁默认一次，显式次数保持，只有不同次数的批量目标显示多种', () => {
 const actions = [{id:'a',kind:'access',command:{}},{id:'b',kind:'access',command:{count:1}}]
 assert.equal(commonSetting(actions,{}, {},'count'),'')
 assert.deepEqual(editSettings({},actions,'count',2),{a:{count:2},b:{count:2}})
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
test('原生长按一旦提交，随后的 touchcancel 不得撤销配置', () => {
 let state = reduceCardHold('idle','start')
 state = reduceCardHold(state,'complete')
 state = reduceCardHold(state,'cancel')
 assert.equal(state,'committed')
 assert.equal(reduceCardHold(state,'complete'),'committed')
 assert.equal(reduceCardHold('tracking','cancel'),'cancelled')
 assert.equal(reduceCardHold('cancelled','complete'),'cancelled')
})
