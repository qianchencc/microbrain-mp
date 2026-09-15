import test from 'node:test'
import assert from 'node:assert/strict'
import {CARD_HOLD_DELAY, CARD_HOLD_PROGRESS, createCardPress} from '../pages/agent/card-press.mjs'
const touch = {identifier:1,clientX:10,clientY:10}
function setup(t) {
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']})
 const events = []
 const press = createCardPress({allowed:()=>true,configure:()=>events.push('configure'),select:()=>events.push('select'),progress:value=>events.push(value)})
 t.after(press.dispose)
 return {press,events}
}
test('长按完成识别和圆环后配置一次，抬手不切换选中',t=>{
 const {press,events} = setup(t)
 press.start([touch]); t.mock.timers.tick(CARD_HOLD_DELAY + CARD_HOLD_PROGRESS - 1)
 assert.equal(events.includes('configure'),false)
 t.mock.timers.tick(1)
 assert.equal(events.at(-2),360)
 assert.equal(events.at(-1),'configure')
 press.end(); press.tap()
 assert.equal(events.filter(e=>e==='configure').length,1)
 assert.equal(events.includes('select'),false)
})
test('短按只选择，抬手后不再触发配置',t=>{
 const {press,events} = setup(t)
 press.start([touch]); t.mock.timers.tick(100); press.end(); press.tap(); t.mock.timers.tick(600)
 assert.equal(events.at(-1),'select')
 assert.equal(events.includes('configure'),false)
})
test('开始滑动前的短暂触碰不出现长按圈',t=>{
 const {press,events} = setup(t)
 press.start([touch]); t.mock.timers.tick(100)
 press.move([{...touch,clientX:19}]); t.mock.timers.tick(600)
 assert.deepEqual(events.filter(value => typeof value === 'number' || typeof value === 'string'),[])
})
test('原生 pageX/pageY 坐标的滑动也取消长按',t=>{
 const {press,events} = setup(t)
 const native = {identifier:1,pageX:10,pageY:10}
 press.start([native]); press.move([{...native,pageX:30}]); t.mock.timers.tick(600); press.end(); press.tap()
 assert.equal(events.includes('configure'),false)
 assert.equal(events.includes('select'),false)
})
test('取消滑动后下一次短按仍正常选择',t=>{
 const {press,events} = setup(t)
 press.start([touch]); press.move([{...touch,clientX:30}]); press.end()
 press.start([touch]); t.mock.timers.tick(100); press.end(); press.tap()
 assert.equal(events.at(-1),'select')
})
for (const reason of ['move','multi','cancel']) test(reason+'取消后既不配置也不选择',t=>{
 const {press,events} = setup(t)
 press.start([touch]); t.mock.timers.tick(200)
 if(reason==='move') press.move([{...touch,clientX:25}])
 if(reason==='multi') press.start([touch,{...touch,identifier:2}])
 if(reason==='cancel') press.cancel()
 t.mock.timers.tick(600); press.end(); press.tap()
 assert.equal(events.includes('configure'),false)
 assert.equal(events.includes('select'),false)
})
