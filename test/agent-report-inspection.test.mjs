import test from 'node:test'
import assert from 'node:assert/strict'
import { acInspectionSectionView, acEstimateView } from '../pages/agent/lib/reports.mjs'

const adjustedDevice = {
  deviceId: 'ac-1', name: '大厅空调', location: '26楼', power: 'on', mode: 'cool',
  setpoint: 25, disposition: 'adjusted', outcome: 'verified', afterSetpoint: 26,
}
const rejectedDevice = {
  deviceId: 'ac-2', name: '会议室空调', power: 'on', mode: 'cool', setpoint: 24,
  disposition: 'not_dispatched', outcome: 'unknown', reason: '上游拒绝调温指令',
}
const unconfirmedDevice = {
  deviceId: 'ac-3', name: '走廊空调', power: 'off', mode: 'fan',
  disposition: 'unconfirmed', outcome: 'unconfirmed', reason: '指令已受理，尚未取得平台实测回读',
}
const estimate = {
  status: 'estimated', measured: false, label: '估算（非电表实测）',
  value: 3.2, unit: '度', costValue: 2.1, costUnit: '元',
  baseline: { averageSetpoint: 24.5, target: 26, averageRise: 1.5 },
  assumptions: { ratePerDegree: 0.05, powerKw: 0.8, pricePerKwh: 0.65 },
  coverage: { adjusted: 2, estimated: 2 },
  reason: '按调前设定温度与经验参数估算，非电表实测',
  calculation: 'kWh = Σ(target - beforeSetpoint) × ratePerDegree × powerKw × hours',
}
const block = {
  type: 'ac_inspection', at: '2026-10-12T01:00:00Z', status: 'COMPLETED', outcome: 'COMPLETED',
  mode: 'adjust_to_26', target: 26, criteria: { setpoint: { value: 26 } },
  devices: [adjustedDevice, rejectedDevice, unconfirmedDevice], energyEstimate: estimate,
}

test('报告预览空调巡检区块：指令与回读分开，设备结果按原样保留', () => {
  const view = acInspectionSectionView(block)
  assert.equal(view.title, '空调调温检查')
  assert.equal(view.outcomeText, '完成')
  assert.ok(view.timeText.includes('检查时间'))
  assert.ok(view.modeText.includes('目标 26℃'))
  const [adjusted, rejected, unconfirmed] = view.rows
  assert.equal(adjusted.actionText, '已下发调到26℃')
  assert.equal(adjusted.readbackText, '平台回读 26℃')
  assert.ok(adjusted.stateText.includes('开机'))
  assert.ok(adjusted.stateText.includes('25℃'))
  assert.equal(adjusted.tone, 'ok')
  assert.equal(rejected.actionText, '这次未调整')
  assert.equal(rejected.reason, '上游拒绝调温指令')
  assert.equal(rejected.tone, 'warn')
  assert.equal(unconfirmed.actionText, '已下发，未确认回读')
  assert.equal(unconfirmed.tone, 'warn')
})

test('调温指令目标不会被写成设备实际结果', () => {
  const view = acInspectionSectionView({
    ...block,
    devices: [{ ...adjustedDevice, afterSetpoint: undefined }],
  })
  assert.equal(view.rows[0].actionText, '已下发调到26℃')
  assert.equal(view.rows[0].readbackText, '')
  assert.ok(!view.rows[0].actionText.includes('已达到'))
})

test('估算永远是估算口径：假设参数与原因可见，不冒充实测节电', () => {
  const view = acEstimateView(estimate)
  assert.equal(view.badge, '估算 · 非电表实测')
  assert.equal(view.valueText, '≈ 3.2 度')
  assert.equal(view.costText, '折合电费约 ¥2.1')
  assert.ok(view.assumptionTexts.some(text => text.includes('每升高 1℃ 约节电 5%')))
  assert.ok(view.assumptionTexts.some(text => text.includes('单台功率 0.8kW')))
  assert.ok(view.assumptionTexts.some(text => text.includes('调前平均设定 24.5℃')))
  assert.ok(view.assumptionTexts.some(text => text.includes('实际调节 2 台')))
  assert.ok(view.calculationText.includes('ratePerDegree'))
  assert.ok(view.reasonText.includes('非电表实测'))
  assert.equal(view.potentialText, '')
})

test('缺设备或缺估算时保留空态，不补造成功内容', () => {
  const empty = acInspectionSectionView({ type: 'ac_inspection', mode: 'inspect', devices: [] })
  assert.deepEqual(empty.rows, [])
  assert.equal(empty.title, '空调巡检')
  assert.equal(empty.modeText, '只读检查，不调整空调')
  assert.equal(empty.estimate, null)
  assert.equal(acEstimateView(undefined), null)
  const potential = acEstimateView({ ...estimate, potential: true })
  assert.equal(potential.potentialText, '可调节潜力估算，设备未实际调节')
})
