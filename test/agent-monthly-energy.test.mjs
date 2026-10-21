import test from 'node:test'
import assert from 'node:assert/strict'
import { monthlyEnergyWindows, readMonthlyEnergy, monthlyEnergyView } from '../pages/agent/monthly-energy-view.mjs'
const now = () => new Date('2026-10-25T18:00:00+08:00')
const report = (span, value, ids = ['a','b']) => ({
 kind: 'statistics', params: { span: { requested: span, observed: { from: span.from, to: span.to } } },
 total: { value, unit: '度' }, coverage: { meters: ids.length, dataMeters: ids.length, noData: [], partial: [], truncated: false },
 meters: ids.map(id => ({ id, status: 'ok', observed: { fromSample: { readTime: span.from }, toSample: { readTime: span.to } } }))
})
const put = (states, span, value) => { states[span.from + '/' + span.to] = value }
async function load(windows, request) { const states = {}; await readMonthlyEnergy(windows, request, (key, value) => { states[key] = value }); return states }

test('每月1日08:00起算，白天截止已到达的08:00采样，三期同日同刻且本月只读取一次', async () => {
 const windows = monthlyEnergyWindows(now()), calls = []
 const states = await load(windows, async query => { calls.push(query); return report({ from: query.from, to: query.to }, 10) })
 assert.equal(calls.length, 3)
 assert.deepEqual(calls.map(q => [q.from,q.to]), [
  ['2026-10-01T08:00:00.000+08:00','2026-10-25T08:00:00.000+08:00'],
  ['2026-09-01T08:00:00.000+08:00','2026-09-25T08:00:00.000+08:00'],
  ['2025-10-01T08:00:00.000+08:00','2025-10-25T08:00:00.000+08:00']])
 assert.ok(calls.every(q => q.kind === 'statistics' && q.scopeLevel === 'all' && q.grain === 'month'))
 const view = monthlyEnergyView(windows, states)
 assert.equal(view.current.value, 10)
 assert.equal(view.pairs[0].pct, '0%')
 assert.equal(view.pairs[0].summary, '与上月同期持平')
})

test('跨年、短月及闰年保持有效日期，短月两侧使用共同截止日期', () => {
 const jan = monthlyEnergyWindows(new Date('2026-01-25T00:15:00+08:00'))
 assert.equal(jan.pairs[0].baseline.from.slice(0,10),'2025-12-01')
 const mar = monthlyEnergyWindows(new Date('2026-03-31T18:00:00+08:00'))
 assert.equal(mar.current.to.slice(0,10),'2026-03-31')
 assert.equal(mar.pairs[0].current.to.slice(0,10),'2026-03-28')
 assert.equal(mar.pairs[0].baseline.to.slice(0,10),'2026-02-28')
 assert.equal(mar.pairs[0].shortened,true)
 const leap = monthlyEnergyWindows(new Date('2024-02-29T10:00:00+08:00'))
 assert.equal(leap.pairs[1].current.to.slice(0,10),'2024-02-28')
 assert.equal(leap.pairs[1].baseline.to.slice(0,10),'2023-02-28')
})

test('环比与同比按总量独立计算，正负与简短描述对应，不将变少称为已节能', async () => {
 const windows = monthlyEnergyWindows(now())
 const states = await load(windows, async q => report(q, q.from.startsWith('2026-10') ? 100 : q.from.startsWith('2026-09') ? 80 : 125))
 const view = monthlyEnergyView(windows, states)
 assert.equal(view.pairs[0].pct, '↑ 25%'); assert.equal(view.pairs[0].summary,'较上月同期多用 20 度')
 assert.equal(view.pairs[1].pct, '↓ 20%'); assert.equal(view.pairs[1].summary,'较去年同期少用 25 度')
 assert.equal(view.pairs[0].aWidth,100); assert.equal(view.pairs[1].bWidth,100)
})

test('去年缺数或请求失败不补零，不影响本月与上月结果；保留具体错误', async () => {
 const windows = monthlyEnergyWindows(now())
 const states = await load(windows, async q => {
  if(q.from.startsWith('2025')) throw new Error('HTTP 503：历史采样读取失败')
  return report(q, q.from.startsWith('2026-10') ? 100 : 80)
 })
 const view = monthlyEnergyView(windows,states)
 assert.equal(view.current.value,100);assert.equal(view.pairs[0].pct,'↑ 25%')
 assert.equal(view.pairs[1].pct,'—');assert.equal(view.pairs[1].b.value,null)
 assert.match(view.pairs[1].summary,/503/)
})

test('两侧电表集合变化、采样日不齐或读取截断均不能生成虚假同比', async () => {
 const windows=monthlyEnergyWindows(now())
 for (const change of [r => {r.meters[1].id='c'},r => {r.meters[0].observed.toSample.readTime='2025-10-24T18:00:00+08:00'},r=>{r.coverage.truncated=true}]) {
  const states=await load(windows,async q=>report(q,100))
  const key=windows.pairs[1].baseline;change(states[key.from+'/'+key.to].report)
  const view=monthlyEnergyView(windows,states)
  assert.equal(view.pairs[1].pct,'—');assert.equal(view.pairs[0].pct,'0%')
 }
})

test('缺月初边界不将跨月读数差冒充本月总用电；部分覆盖明确为已取得用电', async () => {
 const windows=monthlyEnergyWindows(now()),states=await load(windows,async q=>report(q,100))
 const current=states[windows.current.from+'/'+windows.current.to].report
 current.meters[0].observed.fromSample.readTime='2026-09-30T20:00:00+08:00'
 assert.equal(monthlyEnergyView(windows,states).current.value,null)
 assert.match(monthlyEnergyView(windows,states).current.note,/月初/)
 current.meters[0].observed.fromSample.readTime=windows.current.from
 current.coverage.truncated=true
 assert.equal(monthlyEnergyView(windows,states).title,'本月已取得用电')
 assert.equal(monthlyEnergyView(windows,states).pairs[0].pct,'—')
})

test('零基期仍显示差额度，不除零；可见舍入后没有带符号零', async () => {
 const windows=monthlyEnergyWindows(now()),states=await load(windows,async q=>report(q,q.from.startsWith('2026-10')?0.001:0))
 const view=monthlyEnergyView(windows,states)
 assert.equal(view.pairs[0].pct,'—');assert.match(view.pairs[0].note,/基期为零/)
 assert.equal(view.pairs[0].summary,'与上月同期持平')
 assert.equal(view.pairs[0].direction,'')
})

test('读取有明确授权失败标记，供宿主清空整组数据；月初空窗口不发统计请求', async () => {
 const windows=monthlyEnergyWindows(now())
 const states=await load(windows,async()=>{throw Object.assign(new Error('授权撤销'),{status:403})})
 assert.ok(Object.values(states).every(state=>state.denied))
 let calls=0
 await load(monthlyEnergyWindows(new Date('2026-10-01T00:00:00+08:00')),async()=>{calls++})
 assert.equal(calls,0)
})

test('UTC时间戳按上海日期核对，合法同日采样不被误判为前一天', async () => {
 const windows=monthlyEnergyWindows(new Date('2026-10-25T00:30:00+08:00'))
 const states=await load(windows,async q=>{
  const r=report(q,100)
  r.params.span.observed.to=new Date(q.to).toISOString()
  for(const m of r.meters) {
   m.observed.fromSample.readTime=new Date(q.from).toISOString()
   m.observed.toSample.readTime=new Date(q.to).toISOString()
  }
  return r
 })
 const view=monthlyEnergyView(windows,states)
 assert.equal(view.pairs[0].pct,'0%')
 assert.equal(view.cutoff,'2026.10.24 20:00')
})

test('未对齐请求的采样仍为部分覆盖；实际最新采样作为三期共同截止时刻', async () => {
 const windows=monthlyEnergyWindows(new Date('2026-10-25T21:00:00+08:00')),states=await load(windows,async q=>{
  const r=report(q,100)
  const earlier=q.to.replace('20:00','08:00')
  for(const meter of r.meters)meter.observed.toSample.readTime=earlier
  r.params.span.observed.to=earlier
  return r
 })
 const view=monthlyEnergyView(windows,states)
 assert.equal(view.title,'本月已取得用电')
 assert.equal(view.pairs[0].pct,'—')
 const sampled=monthlyEnergyWindows(now(),'2026-10-25T08:00:00+08:00')
 assert.equal(sampled.current.to,'2026-10-25T08:00:00.000+08:00')
 assert.equal(sampled.pairs[0].baseline.to,'2026-09-25T08:00:00.000+08:00')
 assert.equal(sampled.pairs[1].baseline.to,'2025-10-25T08:00:00.000+08:00')
 const good=monthlyEnergyView(sampled,await load(sampled,async q=>report(q,100)))
 assert.equal(good.pairs[0].pct,'0%')
 assert.equal(good.title,'本月总用电')
 assert.equal(monthlyEnergyWindows(now(),'2026-10-10T08:00:00+08:00').current.to,sampled.current.to)
 assert.equal(monthlyEnergyWindows(now(),'2026-10-25T20:00:00+08:00').current.to,sampled.current.to)
})


test('08:00与20:00之间不请求不存在的任意时刻，凌晨沿用前晚20:00', async () => {
 for (const [clock, cutoff] of [
  ['2026-10-20T07:59:59+08:00', '2026-10-19T20:00:00.000+08:00'],
  ['2026-10-20T08:00:00+08:00', '2026-10-20T08:00:00.000+08:00'],
  ['2026-10-20T13:45:00+08:00', '2026-10-20T08:00:00.000+08:00'],
  ['2026-10-20T19:59:59+08:00', '2026-10-20T08:00:00.000+08:00'],
  ['2026-10-20T20:00:00+08:00', '2026-10-20T20:00:00.000+08:00'],
  ['2026-10-21T03:00:00+08:00', '2026-10-20T20:00:00.000+08:00']
 ]) {
  const windows=monthlyEnergyWindows(new Date(clock))
  assert.equal(windows.current.from,'2026-10-01T08:00:00.000+08:00')
  assert.equal(windows.current.to,cutoff)
  const view=monthlyEnergyView(windows,await load(windows,async q=>report(q,100)))
  assert.equal(view.current.complete,true)
  assert.equal(view.current.note,'')
  assert.equal(view.pairs[0].pct,'0%')
  assert.equal(view.pairs[1].pct,'0%')
 }
})

test('凌晨接受前晚实际采样，交接时允许上一采样周期，停更多天或非采样时刻不缩短本月', () => {
 const early=new Date('2026-10-21T06:00:00+08:00')
 assert.equal(monthlyEnergyWindows(early,'2026-10-20T20:00:00+08:00').current.to,'2026-10-20T20:00:00.000+08:00')
 const evening=new Date('2026-10-20T20:10:00+08:00')
 assert.equal(monthlyEnergyWindows(evening,'2026-10-20T08:00:00+08:00').current.to,'2026-10-20T08:00:00.000+08:00')
 for(const stale of ['2026-10-18T20:00:00+08:00','2026-10-20T17:00:00+08:00']) {
  assert.equal(monthlyEnergyWindows(evening,stale).current.to,'2026-10-20T20:00:00.000+08:00')
 }
})

test('月初08:00前不显示上个月数据或异常重试，08:00本身也不请求零时长区间', async () => {
 for(const clock of ['2026-10-01T06:00:00+08:00','2026-10-01T08:00:00+08:00']) {
  const windows=monthlyEnergyWindows(new Date(clock),'2026-09-30T20:00:00+08:00')
  let calls=0
  const states=await load(windows,async()=>{ calls++ })
  const view=monthlyEnergyView(windows,states)
  assert.equal(windows.current.from,'2026-10-01T08:00:00.000+08:00')
  assert.equal(calls,0)
  assert.equal(view.current.pending,false)
  assert.equal(view.current.value,null)
  assert.equal(view.current.note,'本月用电待首个采样区间完成')
  assert.ok(Object.values(states).every(state=>!state.error))
 }
})

test('展开逐表对比按稳定ID配对完整列表，以增量排序且明细与两期合计一致', async () => {
 const windows=monthlyEnergyWindows(now())
 const states=await load(windows,async q=>{
  const current=q.from.startsWith('2026-10'), r=report(q,current?120:95,current?['a','b','c']:['c','b','a'])
  const values=current?{a:100,b:20,c:0}:{a:80,b:5,c:10}
  for(const m of r.meters)Object.assign(m,{name:'电表'+m.id,areaName:'26楼'+m.id,value:values[m.id]})
  return r
 })
 const pair=monthlyEnergyView(windows,states).pairs[0]
 assert.deepEqual(pair.rows.map(r=>[r.id,r.a.value,r.b.value,r.delta,r.pctText]),[
  ['a',100,80,20,'+25%'],['b',20,5,15,'+300%'],['c',0,10,-10,'-100%']
 ])
 assert.equal(pair.rows[0].name,'电表a')
 assert.equal(pair.rows[0].location,'26楼a')
 assert.equal(pair.rows.reduce((sum,r)=>sum+r.a.value,0),pair.a.value)
 assert.equal(pair.rows.reduce((sum,r)=>sum+r.b.value,0),pair.b.value)
 assert.match(pair.a.detailLabel,/08:00/)
})

test('逐表保留单侧缺数及集合差异，部分采样不计算变化，零基期只给差额', async () => {
 const windows=monthlyEnergyWindows(now())
 const states=await load(windows,async q=>{
  const current=q.from.startsWith('2026-10'), r=report(q,100,current?['a','b','c','d']:['c','b','a','e'])
  for(const m of r.meters)Object.assign(m,{name:'同名电表',value:current?20:10})
  if(!current) {
   r.meters.find(m=>m.id==='b').value=0
   r.meters.find(m=>m.id==='c').observed.toSample.readTime='2026-09-24T20:00:00+08:00'
  }
  return r
 })
 const pair=monthlyEnergyView(windows,states).pairs[0], rows=new Map(pair.rows.map(r=>[r.id,r]))
 assert.equal(rows.size,5)
 assert.equal(rows.get('a').delta,10)
 assert.equal(rows.get('b').deltaText,'+20')
 assert.equal(rows.get('b').pctText,'—')
 assert.match(rows.get('b').note,/基期为零/)
 assert.equal(rows.get('c').delta,null)
 assert.match(rows.get('c').note,/采样不完整/)
 assert.equal(rows.get('d').b.value,null)
 assert.equal(rows.get('e').a.value,null)
 assert.equal(rows.get('d').delta,null)
 assert.equal(rows.get('e').delta,null)
 assert.deepEqual(pair.rows.slice(0,2).map(r=>r.id),['b','a'])
 const base=states[pair.baseline.from+'/'+pair.baseline.to].report
 base.coverage.truncated=true
 assert.ok(monthlyEnergyView(windows,states).pairs[0].rows.every(r=>r.delta===null))
})

test('去年全部缺数仍可展开本月全部电表，错期间或未知单位响应不能泄露为有效对照', async () => {
 const windows=monthlyEnergyWindows(now()), states=await load(windows,async q=>{
  const r=report(q,100,['a','b'])
  for(const m of r.meters)Object.assign(m,{name:'电表'+m.id,value:50})
  if(q.from.startsWith('2025')) {
   r.coverage.dataMeters=0;r.coverage.noData=['a','b'];r.coverage.truncated=true;r.total.value=null
   for(const m of r.meters) {m.status='noData';m.value=null;m.observed={}}
  }
  return r
 })
 const year=monthlyEnergyView(windows,states).pairs[1]
 assert.equal(year.rows.length,2)
 assert.ok(year.rows.every(r=>r.a.value===50 && r.b.value===null && r.delta===null && r.pctText==='—' && /对照无有效数据/.test(r.note)))
 const baseline=states[year.baseline.from+'/'+year.baseline.to].report
 for(const invalidate of [()=>{baseline.params.span.requested={...year.baseline,from:'2025-09-01T08:00:00+08:00'}},()=>{baseline.params.span.requested=year.baseline;baseline.total.unit='未知'}]) {
  invalidate()
  assert.ok(monthlyEnergyView(windows,states).pairs[1].rows.every(r=>r.b.value===null))
 }
})

test('匹配期间但单位未知的独有电表仍保留，错期响应不能注入无关电表名单', async () => {
 const windows=monthlyEnergyWindows(now()),states=await load(windows,async q=>{
  const current=q.from.startsWith('2026-10'),r=report(q,100,current?['a']:['a','other'])
  for(const m of r.meters)Object.assign(m,{name:'电表'+m.id,value:50})
  if(!current)r.total.unit='未知'
  return r
 })
 let pair=monthlyEnergyView(windows,states).pairs[0]
 const other=pair.rows.find(r=>r.id==='other')
 assert.ok(other)
 assert.equal(other.b.value,null)
 assert.equal(other.delta,null)
 assert.match(other.note,/单位未确认/)
 states[pair.baseline.from+'/'+pair.baseline.to].report.params.span.requested={from:'2026-08-01T08:00:00+08:00',to:pair.baseline.to}
 pair=monthlyEnergyView(windows,states).pairs[0]
 assert.deepEqual(pair.rows.map(r=>r.id),['a'])
})

test('快照准备中应答不渲染为空数据：轮询到就绪后按真实报告呈现，超时保留准备中文案', async () => {
 const windows = monthlyEnergyWindows(now())
 const publishes = []
 let clock = 0
 const seen = {}
 await readMonthlyEnergy(windows, async q => {
  seen[q.from] = (seen[q.from] || 0) + 1
  if (q.from.startsWith('2026-10') && seen[q.from] <= 2) return { status: 'preparing', message: '电表数据准备中，请稍后重试', retryAfterMs: 2000 }
  return report(q, 100)
 }, (key, value) => { publishes.push([key, value]) }, { sleep: async () => { clock += 2000 }, now: () => clock, deadlineMs: 120000 })
 const states = Object.fromEntries(publishes)
 const currentKey = windows.current.from + '/' + windows.current.to
 assert.equal(states[currentKey].report.total.value, 100)
 assert.ok(publishes.some(([k, v]) => k === currentKey && v.preparing === true), '准备中状态须先发布，不能直接落在空数据')
 const preparingView = monthlyEnergyView(windows, { [currentKey]: { preparing: true, message: '电表数据准备中' } })
 assert.equal(preparingView.current.pending, true)
 assert.match(preparingView.current.note, /准备中/)
 assert.equal(monthlyEnergyView(windows, states).current.value, 100)

 clock = 0
 const timeoutStates = {}
 await readMonthlyEnergy(windows, async () => ({ status: 'preparing', message: '电表数据准备中，请稍后重试', retryAfterMs: 2000 }),
  (key, value) => { timeoutStates[key] = value }, { sleep: async () => { clock += 2000 }, now: () => clock, deadlineMs: 6000 })
 assert.match(timeoutStates[currentKey].error, /准备中/)
 assert.equal(monthlyEnergyView(windows, timeoutStates).current.value, null)
})
