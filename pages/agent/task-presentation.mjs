const labels = { pending: '未开始', pending_confirmation: '待确认', scheduled: '未开始', executing: '进行中', completed: '已结束', verified: '已完成', observed: '已检查', satisfied: '无需调整', partial: '部分完成', failed: '未完成', missed: '未完成', interrupted: '未完成', dispatched: '指令已发送', unconfirmed: '暂无结果', unknown: '暂无结果', unavailable: '暂无结果', cancelled: '已取消', expired: '已过期' }
export const taskStatusText = status => labels[String(status || '').toLowerCase()] || '状态待更新'
export const taskNeedsDetails = status => ['failed', 'partial', 'missed', 'interrupted', 'dispatched', 'unconfirmed', 'unknown', 'unavailable'].includes(status)
export const taskStatusTone = status => ['verified', 'satisfied', 'observed'].includes(status) ? 'ok'
 : status === 'executing' ? 'active' : taskNeedsDetails(status) ? 'warn' : 'wait'

// 平台已受理但还没有执行结果确认：只说“指令已发送”这个事实，不承诺设备已生效；
// 受理之外的信息不足时写“暂无结果”，不写需要理解核验流程的抽象状态。
const dispatched = device => device.outcome === 'unconfirmed' && device.details?.receipt === 'ACCEPTED'
 && !device.details?.requiresVerification && !device.details?.timedOut

// 判定只读原始事实，中文标签不能参与完成、颜色或淡化判断。
export function deviceResultView(device) {
 const { outcome } = device
 if (outcome === 'verified') return { text: '已完成', tone: 'ok', settled: true }
 if (outcome === 'satisfied') return { text: '无需调整', tone: 'ok', settled: true }
 if (outcome === 'observed') return { text: '已检查', tone: 'ok', settled: true }
 if (outcome === 'pending') return { text: '未开始', tone: 'wait', settled: false }
 if (outcome === 'not_dispatched') return { text: '这次未调整', tone: 'wait', settled: false }
 if (dispatched(device)) return { text: '指令已发送', tone: 'warn', settled: false }
 if (['unknown', 'unconfirmed', 'unavailable'].includes(outcome)) return { text: '暂无结果', tone: 'warn', settled: false }
 return { text: '未完成', tone: 'warn', settled: false }
}

// 面向非专业读者的一句话说明：只写已发生的事实与核对方式，不贴原始报文或编号。
export function deviceResultReason(device, target) {
 const action = !device.target?.observe && target && target !== '目标未指定' ? `「${target}」` : ''
 const known = { unconfirmed: device.details?.receipt === 'ACCEPTED' ? `已向设备发送${action}指令，平台已受理。暂时无法确认设备是否已执行，以现场实际情况为准。` : '这次操作没有得到结果确认，以现场实际情况为准。',
  unknown: '暂时没有足够信息确认结果，以现场实际情况为准。', unavailable: '暂时没读到设备数据，无法确认结果。', not_dispatched: '这次没有操作这台设备。',
  rejected: '设备平台没有接受这次操作。', unreadable: '暂时没读到设备状态。', missing: '这台设备当前无法操作。' }
 return [known[device.outcome] || taskStatusText(device.outcome), device.reason, device.details?.reason].filter(Boolean).join('\n\n')
}

// completed只表示执行流程结束；有设备事实时，才进一步表达目标结果。
export function taskResultStatus(record) {
 if (!['completed', 'unconfirmed', 'unknown', 'unavailable'].includes(record.status)) return record.status
 const phaseDevices = (record.phases || []).flatMap(phase => phase.devices || [])
 const devices = phaseDevices.length ? phaseDevices : record.devices || []
 const unconfirmed = devices.filter(device => ['unconfirmed', 'unknown', 'unavailable'].includes(device.outcome))
 if (unconfirmed.length) return unconfirmed.every(dispatched) ? 'dispatched' : 'unconfirmed'
 return devices.length && devices.every(device => deviceResultView(device).settled) ? 'verified' : record.status
}
