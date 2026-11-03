// 报告预览的空调巡检区块投影：只读保存事实，指令与回读分开表述，
// 估算永远标注为估算（非电表实测），未知/未确认/失败按原样保留，不补成功。
import { acDispositionText, acReadbackText, acStateText, fmtShanghaiDateTime } from '../observations/observation-view.mjs'

const PHASE_OUTCOMES = {
  COMPLETED: { text: '完成', tone: 'ok' },
  FAILED: { text: '失败', tone: 'fail' },
  PARTIAL: { text: '部分完成', tone: 'warn' },
  INTERRUPTED: { text: '中断', tone: 'fail' },
  MISSED: { text: '错过', tone: 'fail' },
  SKIPPED: { text: '跳过', tone: 'muted' },
}

const acTargetOf = block => {
  if (Number.isFinite(block?.criteria?.setpoint?.value)) return block.criteria.setpoint.value
  return Number.isFinite(block?.target) ? block.target : null
}

const acActionText = (device, target) => (device.disposition === 'unconfirmed'
  ? '已下发，未确认回读' : acDispositionText(device, target))

export function acInspectionSectionView(block) {
  const adjust = block?.mode === 'adjust_to_26'
  const target = acTargetOf(block)
  const outcome = PHASE_OUTCOMES[block?.outcome] || PHASE_OUTCOMES[block?.status] || null
  const rows = (block?.devices || []).map((device, index) => ({
    key: device.deviceId || `${index}`,
    name: device.name || device.deviceId || '未知设备',
    location: device.location || '',
    stateText: acStateText(device),
    actionText: acActionText(device, target),
    readbackText: acReadbackText(device),
    reason: device.reason || '',
    tone: device.disposition === 'adjusted' ? 'ok' : device.disposition === 'not_needed' ? 'muted' : 'warn',
  }))
  return {
    title: adjust ? '空调调温检查' : '空调巡检',
    timeText: block?.at ? `检查时间 ${fmtShanghaiDateTime(block.at)}` : '',
    modeText: adjust
      ? `符合条件时调整到目标 ${target ?? 26}℃（只调整开机、制冷且设定温度更低的空调）`
      : '只读检查，不调整空调',
    outcomeText: outcome?.text || '',
    outcomeTone: outcome?.tone || '',
    rows,
    estimate: acEstimateView(block?.energyEstimate),
  }
}

export function acEstimateView(estimate) {
  if (!estimate) return null
  const round1 = value => Math.round(value * 10) / 10
  const assumptionTexts = []
  if (Number.isFinite(estimate.assumptions?.ratePerDegree)) assumptionTexts.push(`每升高 1℃ 约节电 ${round1(estimate.assumptions.ratePerDegree * 100)}%`)
  if (Number.isFinite(estimate.assumptions?.powerKw)) assumptionTexts.push(`单台功率 ${estimate.assumptions.powerKw}kW`)
  if (Number.isFinite(estimate.assumptions?.pricePerKwh)) assumptionTexts.push(`电价 ${estimate.assumptions.pricePerKwh} 元/度`)
  if (Number.isFinite(estimate.baseline?.averageSetpoint)) assumptionTexts.push(`调前平均设定 ${estimate.baseline.averageSetpoint}℃`)
  if (Number.isFinite(estimate.baseline?.target)) assumptionTexts.push(`统一目标 ${estimate.baseline.target}℃`)
  if (Number.isFinite(estimate.baseline?.averageRise)) assumptionTexts.push(`平均调升 ${estimate.baseline.averageRise}℃`)
  if (Number.isFinite(estimate.coverage?.adjusted)) assumptionTexts.push(`实际调节 ${estimate.coverage.adjusted} 台`)
  if (Number.isFinite(estimate.coverage?.estimated)) assumptionTexts.push(`参与估算 ${estimate.coverage.estimated} 台`)
  return {
    badge: '估算 · 非电表实测',
    valueText: Number.isFinite(estimate.value) ? `≈ ${estimate.value} ${estimate.unit || '度'}` : '',
    costText: Number.isFinite(estimate.costValue) ? `折合电费约 ¥${estimate.costValue}` : '',
    reasonText: estimate.reason || '',
    calculationText: estimate.calculation || '',
    assumptionTexts,
    potentialText: estimate.potential === true ? '可调节潜力估算，设备未实际调节' : '',
  }
}
