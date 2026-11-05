import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDetailView, taskExecutionSummaryView, taskLabel, taskSettled, taskCalendarMarks, deviceTimelineItems } from '../pages/agent/lib/tasks.mjs'
import * as taskViews from '../pages/agent/lib/tasks.mjs'

test('确认单仅共享相同成员和一致指令的设备清单，阶段差异与原始动作保留', () => {
 const devices = [
  { deviceId: 'a', deviceName: '照明开关-26楼-3回路格栅灯', kind: 'lighting' },
  { deviceId: 'b', deviceName: '照明开关-26楼-2回路格栅灯', kind: 'lighting' },
 ]
 const phase = (power, members = devices) => ({ actions: members.map(d => ({ ...d, command: { closeOrOpen: power } })),
  preflight: { includedScopes: devices.map(d => d.deviceName), excludedScopes: [], excludedCount: 0 } })
 const phases = [phase(1), phase(0, [...devices].reverse())]
 const original = JSON.stringify(phases)
 const layout = taskViews.proposalDeviceLayout(phases)
 assert.deepEqual(layout.sharedActions.map(d => d.deviceId), ['a', 'b'])
 assert.deepEqual(layout.scopes, [[], []], '逐设备名单不是另一份范围摘要')
 assert.equal(JSON.stringify(phases), original, '仅做展示，不裁剪未来控制动作')
 assert.equal(taskViews.proposalDeviceLayout([phase(1), phase(0, [devices[0]])]).sharedActions, null)
 const mixed = phase(0); mixed.actions[0].command.closeOrOpen = 1
 assert.equal(taskViews.proposalDeviceLayout([phase(1), mixed]).sharedActions, null)
 const excluded = phase(0); excluded.preflight.excludedScopes = ['会议室']; excluded.preflight.excludedCount = 1
 assert.equal(taskViews.proposalDeviceLayout([phase(1), excluded]).sharedActions, null)
 const read = { ...phase(0), read: { alertDays: 1 } }
 assert.equal(taskViews.proposalDeviceLayout([phase(1), read]).sharedActions, null)
 const scoped = phase(1); scoped.preflight.includedScopes = ['26楼已核验照明范围']
 assert.deepEqual(taskViews.proposalDeviceLayout([scoped]).scopes, [['26楼已核验照明范围']])
})

test('同一任务在详情与日程使用普通词，待确认结果不会变成完成', () => {
 const device = outcome => ({ id: outcome, kind: 'ac', name: '空调', outcome, target: { power: 'off' }, details: { receipt: 'ACCEPTED' } })
 const task = { agentSource: 'company', status: 'executing', executionActive: false, interval: { startsAt: '2026-10-26T00:00:00+08:00', endsAt: '2026-10-26T23:59:00+08:00' },
  phases: [{ id: 'p1', at: '2026-10-26T00:30:00+08:00', status: 'unconfirmed', devices: [device('verified'), device('unconfirmed'), device('unknown')] }] }
 const view = taskDetailView(task)
 assert.equal(view.statusText, '进行中')
 assert.equal(view.statusText, taskLabel(task.status))
 assert.deepEqual(view.phases[0].devices.map(d => d.resultText), ['已完成', '已下发', '已下发'])
 assert.equal(view.phases[0].statusText, '已下发')
 const event = { taskId: 't', phaseId: 'p1', at: task.phases[0].at, device: device('unconfirmed'), outcome: 'unconfirmed', details: { receipt: 'ACCEPTED' }, target: { power: 'off' } }
 assert.equal(deviceTimelineItems([event])[0].faded, false)
 assert.equal(taskDetailView({ ...task, status: 'future_code' }).statusText, '状态待更新')
 assert.equal(taskSettled({ status: 'failed' }), true)
 assert.equal(taskSettled({ status: 'unknown' }), true)
 assert.deepEqual(taskCalendarMarks([{ ...task, status: 'unknown' }], '2026-10-26', '2026-10-26'), [{ date: '2026-10-26', abnormal: false }])
})

test('47次任务先展示最近记录和真实进度，错误原文仍可取回，分类不重复相加', () => {
 const reason = '读取空调状态：等待响应超时（编号 4f441c2c-a4ad-4883-b71e-02bc6fa5f5bd）'
 const phases = Array.from({ length: 47 }, (_, i) => ({ id: `p${i}`, at: new Date(Date.parse('2026-10-26T00:30:00+08:00') + i * 1800000).toISOString(), status: i < 30 ? 'failed' : 'pending', failureReason: i < 30 ? reason : null, devices: [] }))
 const view = taskDetailView({ status: 'executing', phases, nextAt: '2026-10-27T00:00:00+08:00' })
 assert.deepEqual(view.previewPhases.map(p => p.id), ['p29', 'p30', 'p31'])
 assert.equal(view.progressText, '已结束30次 · 还有17次安排')
 assert.equal(view.phases[0].failureReason, reason)
 assert.equal(view.nextText, '2026-10-26 15:30')
 const summary = taskExecutionSummaryView({ checkpoints: 2, devices: { total: 1, adjusted: 0, satisfied: 0, skipped: 0, failed: 1, unknown: 1, unverified: 0 } })
 assert.equal(summary.devicesText, '涉及1台设备')
})

test('流程结束不冒充目标确认，读取不足不当作执行失败，多阶段要求和进行中次数完整', () => {
 const at = '2026-10-26T00:30:00+08:00'
 const ac = { id: 'p1', at, status: 'completed', read: { ac: { mode: 'adjust_to_26' } }, devices: [{ id: 'ac1', kind: 'ac', outcome: 'unconfirmed', details: { receipt: 'ACCEPTED' } }] }
 const agent = { id: 'p2', at, status: 'executing', read: { agent: { objective: '汇总本月电量' } }, devices: [{ id: 'meter', outcome: 'unavailable' }] }
 const view = taskDetailView({ status: 'completed', occurrence: { virtual: true }, phases: [ac, agent] })
 assert.equal(view.statusText, '已下发')
 assert.equal(view.status, 'completed')
 assert.equal(view.phases[0].statusText, '已下发')
 assert.equal(view.phases[1].devices[0].resultText, '已下发')
 assert.equal(view.phases[1].devices[0].resultReason, '', '没有回传时不追加不确定说明')
 assert.match(view.rulesText, /不开机、不改模式和风速/)
 assert.match(view.rulesText, /汇总本月电量/)
 assert.equal(view.occurrenceText, '以后的安排')
 assert.equal(view.progressText, '已结束1次 · 正在做1次 · 还有0次安排')
 assert.equal(taskLabel('completed'), '已结束')
 assert.equal(taskDetailView({ status: 'completed', phases: [{ ...ac, devices: [{ id: 'ac1', outcome: 'verified' }] }] }).statusText, '已完成')
 const reportPhases = [{ at, observations: [{ type: 'ac_inspection', mode: 'adjust_to_26', devices: [
  { deviceId: 'ac1', name: '空调A', setpoint: 25.5, disposition: 'adjusted', afterSetpoint: 26, outcome: 'verified' },
  { deviceId: 'ac2', name: '空调B', setpoint: 24, disposition: 'adjusted', outcome: 'verified' },
 ] }] }]
 const energy = taskExecutionSummaryView({ checkpoints: 1, devices: { total: 2, adjusted: 2, satisfied: 0, skipped: 0, failed: 0, unknown: 0, unverified: 0 },
  energyImpact: { status: 'estimated', basis: 'assumption', value: 1, unit: '度', cost: { value: 0.8, unit: '元' }, deviceCount: 2, baseline: { averageSetpoint: 24.75, target: 26, averageRise: 1.25 }, assumptions: { ratePerDegree: 0.07, powerKw: 2.5, pricePerKwh: 0.8 }, coverage: { adjusted: 2, estimated: 2 }, from: at, to: at } }, reportPhases)?.energy
 assert.equal(energy.devices.rows[0].before, '25.5℃', '调前保留分数度原值')
 assert.equal(energy.devices.rows[0].after, '平台回读 26℃', '调后写平台回读事实，不写指令目标')
 assert.equal(energy.devices.rows[1].after, '目标 26℃', '缺回读事实时如实标注为目标值')
 const rules = taskDetailView({ status: 'scheduled', phases: [30, 60].map(cadenceMinutes => ({ ...ac, read: { ac: { mode: 'adjust_to_26', cadenceMinutes } } })) }).rulesText
 assert.equal(rules.match(/不开机/g).length, 1)
 assert.equal(rules.match(/只调整开着/g).length, 1)
 assert.match(rules, /每 30 分钟/)
 assert.match(rules, /每 60 分钟/)
})
