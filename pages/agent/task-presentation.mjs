const labels = { pending: '未开始', pending_confirmation: '待确认', scheduled: '未开始', executing: '进行中', completed: '已完成', verified: '已完成', observed: '已检查', satisfied: '无需调整', partial: '部分完成', failed: '未完成', missed: '未完成', interrupted: '未完成', unconfirmed: '结果待确认', unknown: '结果待确认', cancelled: '已取消', expired: '已过期' }
export const taskStatusText = status => labels[String(status || '').toLowerCase()] || '状态待更新'
export const taskNeedsDetails = status => ['failed', 'partial', 'missed', 'interrupted', 'unconfirmed', 'unknown'].includes(status)
export const taskStatusTone = status => ['completed', 'verified', 'satisfied', 'observed'].includes(status) ? 'ok'
 : status === 'executing' ? 'active' : taskNeedsDetails(status) ? 'warn' : 'wait'

// 判定只读原始事实，中文标签不能参与完成、颜色或淡化判断。
export function deviceResultView(device) {
 const { outcome, details = {} } = device
 if (outcome === 'verified') return { text: '已完成', tone: 'ok', settled: true }
 if (outcome === 'satisfied') return { text: '无需调整', tone: 'ok', settled: true }
 if (outcome === 'observed') return { text: '已检查', tone: 'ok', settled: true }
 if (outcome === 'pending') return { text: '未开始', tone: 'wait', settled: false }
 if (outcome === 'not_dispatched') return { text: '这次未调整', tone: 'wait', settled: false }
 if (outcome === 'unconfirmed' && details?.receipt === 'ACCEPTED' && !details.requiresVerification && !details.timedOut) return { text: '指令已发送', tone: 'warn', settled: false }
 if (['unknown', 'unconfirmed'].includes(outcome)) return { text: '结果待确认', tone: 'warn', settled: false }
 return { text: '未完成', tone: 'warn', settled: false }
}

export function deviceResultReason(device) {
 const known = { unconfirmed: device.details?.receipt === 'ACCEPTED' ? '指令已发送，是否完成还没确认。' : '暂时没有足够信息确认结果。', unknown: '暂时没有足够信息确认结果。', not_dispatched: '这次没有调整设备。', rejected: '设备平台没有接受这次操作。', unreadable: '暂时没读到设备状态。', missing: '这台设备当前无法操作。' }
 return [known[device.outcome] || taskStatusText(device.outcome), device.reason, device.details?.reason,
  device.details ? `操作记录：\n${JSON.stringify(device.details, null, 2)}` : ''].filter(Boolean).join('\n\n')
}
