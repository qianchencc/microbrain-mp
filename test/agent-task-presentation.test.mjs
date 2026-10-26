import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDetailView, taskExecutionSummaryView } from '../pages/agent/task-detail-view.mjs'
import { taskLabel, taskSettled, taskCalendarMarks } from '../pages/agent/task-calendar.mjs'
import { deviceTimelineItems } from '../pages/agent/device-timeline-view.mjs'

test('同一任务在详情与日程使用普通词，待确认结果不会变成完成', () => {
 const device = outcome => ({ id: outcome, kind: 'ac', name: '空调', outcome, target: { power: 'off' }, details: { receipt: 'ACCEPTED' } })
 const task = { agentSource: 'company', status: 'executing', executionActive: false, interval: { startsAt: '2026-10-26T00:00:00+08:00', endsAt: '2026-10-26T23:59:00+08:00' },
  phases: [{ id: 'p1', at: '2026-10-26T00:30:00+08:00', status: 'unconfirmed', devices: [device('verified'), device('unconfirmed'), device('unknown')] }] }
 const view = taskDetailView(task)
 assert.equal(view.statusText, '进行中')
 assert.equal(view.statusText, taskLabel(task.status))
 assert.deepEqual(view.phases[0].devices.map(d => d.resultText), ['已完成', '指令已发送', '结果待确认'])
 assert.equal(view.phases[0].statusText, '结果待确认')
 const event = { taskId: 't', phaseId: 'p1', at: task.phases[0].at, device: device('unconfirmed'), outcome: 'unconfirmed', details: { receipt: 'ACCEPTED' }, target: { power: 'off' } }
 assert.equal(deviceTimelineItems([event])[0].faded, false)
 assert.equal(taskDetailView({ ...task, status: 'future_code' }).statusText, '状态待更新')
 assert.equal(taskSettled({ status: 'failed' }), true)
 assert.equal(taskSettled({ status: 'unknown' }), true)
 assert.deepEqual(taskCalendarMarks([{ ...task, status: 'unknown' }], '2026-10-26', '2026-10-26'), [{ date: '2026-10-26', abnormal: true }])
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
 assert.equal(view.statusText, '结果待确认')
 assert.equal(view.status, 'completed')
 assert.equal(view.phases[0].statusText, '结果待确认')
 assert.equal(view.phases[1].devices[0].resultText, '结果待确认')
 assert.match(view.phases[1].devices[0].resultReason, /暂时没读到足够的数据/)
 assert.match(view.rulesText, /不开机、不改模式和风速/)
 assert.match(view.rulesText, /汇总本月电量/)
 assert.equal(view.occurrenceText, '以后的安排')
 assert.equal(view.progressText, '已结束1次 · 正在做1次 · 还有0次安排')
 assert.equal(taskLabel('completed'), '已结束')
 assert.equal(taskDetailView({ status: 'completed', phases: [{ ...ac, devices: [{ id: 'ac1', outcome: 'verified' }] }] }).statusText, '已完成')
 const rules = taskDetailView({ status: 'scheduled', phases: [30, 60].map(cadenceMinutes => ({ ...ac, read: { ac: { mode: 'adjust_to_26', cadenceMinutes } } })) }).rulesText
 assert.equal(rules.match(/不开机/g).length, 1)
 assert.equal(rules.match(/只调整开着/g).length, 1)
 assert.match(rules, /每 30 分钟/)
 assert.match(rules, /每 60 分钟/)
})
