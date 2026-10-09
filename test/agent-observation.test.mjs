import test from 'node:test'
import assert from 'node:assert/strict'
import { isObservationKind, regionDeviceGroups } from '../pages/agent/region-device-view.mjs'
import { applyEvent, createTurn, restoreTurns } from '../pages/agent/conversation.mjs'
import { energyStale, videoViewLabel, environmentCells, fmtShanghaiDateTime } from '../pages/agent/observation-view.mjs'

const videoDevice = { id: 'video-1', kind: 'video', name: '视频监控-26楼走廊', location: '26楼运营走廊' }
const envDevice = { id: 'env-1', kind: 'environment', name: '环境传感器-26楼', location: '26楼' }
const energyDevice = { id: 'meter-1', kind: 'energy', name: '26楼运营部电表', location: '26楼' }
const safetyDevice = { id: 'fire-1', kind: 'safety', name: '27楼茶水间燃气感应器', location: '27楼茶水间' }
const lightDevice = { id: 'light-1', kind: 'lighting', name: '照明开关-会议室', location: '会议室' }

const readings = {
 'video-1': { state: true },
 'env-1': { state: { temp: 26, humidity: 57, pm25: 34, source: 'device' } },
 'meter-1': { state: { readTime: '2024-09-11T00:30:00.000Z', ia: 1.25, ib: 1.1, ic: 1.2, totalActivePower: 2.5 } },
 'fire-1': { state: null },
 'light-1': { state: true },
}

const devices = [videoDevice, envDevice, energyDevice, safetyDevice, lightDevice]
const all = groups => groups.flatMap(group => group.items)
const itemOf = (groups, id) => all(groups).find(item => item.id === id)

test('计量历史的日期按上海时区，不受手机所在时区影响', () => {
 assert.equal(fmtShanghaiDateTime('2025-05-26T23:00:33Z'), '2025-05-27 07:00')
 assert.equal(fmtShanghaiDateTime('2025-05-27T07:00:33+08:00'), '2025-05-27 07:00')
})

test('实时原始 PM 字段按客户定义显示，历史原值不会被标签修正重写', () => {
 const reading = { pm101: 20, pm10: 4, pm25: 7 }
 assert.deepEqual(environmentCells(reading).map(cell => [cell.label, cell.value]), [['PM2.5', '7'], ['PM10', '20'], ['PM1.0', '4']])
 assert.deepEqual(reading, { pm101: 20, pm10: 4, pm25: 7 })
})

test('观察设备状态语义：视频在线/离线不冒充开-关，四类观察只读呈现', () => {
 const groups = regionDeviceGroups(devices, readings, 'kind', '')
 assert.equal(itemOf(groups, 'video-1').detail, '在线')
 assert.equal(itemOf(groups, 'video-1').status, 'on')
 assert.equal(itemOf(groups, 'env-1').detail, '26°C · 湿度 57% · PM2.5 34')
 assert.equal(itemOf(groups, 'env-1').status, 'observe')
 assert.match(itemOf(groups, 'meter-1').detail, /2\.5 kW · 读于 09-11/)
 assert.match(itemOf(groups, 'fire-1').detail, /仅告警台账/)
 assert.equal(itemOf(groups, 'light-1').detail, '开启')

 const offline = regionDeviceGroups([videoDevice], { 'video-1': { state: false } }, 'kind', '')
 assert.equal(itemOf(offline, 'video-1').detail, '离线')
 assert.equal(itemOf(offline, 'video-1').status, 'off')
 const unknown = regionDeviceGroups([videoDevice], {}, 'kind', '')
 assert.equal(itemOf(unknown, 'video-1').detail, '在线状态未知')
})

test('状态分组观察类并入"仅观察"，影子读数如实标注来源', () => {
 const groups = regionDeviceGroups(devices, readings, 'status', '')
 const labels = groups.map(group => group.label)
 assert.ok(labels.includes('仅观察'))
 assert.ok(!labels.includes('状态未知'))
 assert.deepEqual(groups.find(group => group.label === '仅观察').items.map(item => item.id).sort(), ['env-1', 'fire-1', 'meter-1', 'video-1'])
 assert.deepEqual(groups.find(group => group.label === '运行中').items.map(item => item.id), ['light-1'])

 const shadow = regionDeviceGroups([envDevice], { 'env-1': { state: { temp: 26, source: 'shadow' } } }, 'kind', '')
 assert.equal(itemOf(shadow, 'env-1').detail, '26°C · 平台影子')
})

test('observation.reported 事件进入轮次并随恢复重建，不产生草案', () => {
 const turn = createTurn('t1', '摄像头在线吗')
 applyEvent(turn, {
  type: 'observation.reported', observedAt: '2026-09-28T03:00:00.000Z',
  blocks: [
   { type: 'video', devices: [{ deviceId: 'video-1', name: '摄像头', location: '26楼', online: true }] },
   { type: 'alerts', windowDays: 365, total: 0, latest: { time: '2024-04-20T07:10:01.000Z', deviceName: '燃气感应器', type: 'gas', report: false }, records: [] },
  ],
 })
 assert.equal(turn.observations.length, 1)
 assert.equal(turn.observations[0].blocks[1].type, 'alerts')
 assert.equal(turn.draft, null)

 const [restored] = restoreTurns([{ id: 't1', content: '摄像头在线吗', events: [{ type: 'observation.reported', blocks: [{ type: 'safety', devices: [{ deviceId: 'fire-1', name: '燃气感应器', location: '27楼', subtype: 'gas' }] }] }] }])
 assert.equal(restored.observations.length, 1)
 assert.equal(restored.observations[0].blocks[0].devices[0].subtype, 'gas')
})

test('能耗陈旧如实标注、查看画面按钮三态分层', () => {
 assert.equal(energyStale({ readTime: '2024-09-11T00:30:00.000Z' }), true, '一年前的读数是陈旧的')
 assert.equal(energyStale({ readTime: new Date(Date.now() - 3600e3).toISOString() }), false)
 assert.equal(energyStale(null), true, '缺读数也算陈旧/未知')

 // 播放页未部署 → 置灰接入中；已部署 → 在线可播；取流中/离线/未知各自独立文案，失败不冒称离线。
 assert.equal(videoViewLabel(true, false, false), '播放页接入中')
 assert.equal(videoViewLabel(true, true, false), '查看画面')
 assert.equal(videoViewLabel(true, true, true), '正在取流…')
 assert.equal(videoViewLabel(false, true, false), '已离线')
 assert.equal(videoViewLabel(null, true, false), '状态未知')
 assert.equal(isObservationKind('video'), true)
 assert.equal(isObservationKind('lighting'), false)
})
