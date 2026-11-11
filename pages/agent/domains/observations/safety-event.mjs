export function safetyEventReference(record) {
  if (
    !record ||
    !['gas', 'flooding', 'smoke'].includes(record.ledger) ||
    typeof record.eventId !== 'string' ||
    !record.eventId.trim() ||
    typeof record.deviceId !== 'string' ||
    !record.deviceId.trim()
  )
    return null;
  return {
    type: 'safety_event',
    ledger: record.ledger,
    eventId: record.eventId,
    deviceId: record.deviceId,
  };
}

export function referenceTitle(reference) {
  return (
    {
      energy_report: '电量报告引用',
      safety_event: '安全台账引用',
      environment_window: '环境历史引用',
      customer_alert: '客户告警引用',
      task_plan: '周期计划引用',
      task: '任务引用',
      report: '检查点报告引用',
    }[reference?.type] || '记录引用'
  );
}

export function safetyHistoryDateRange(current, field, value, earliest, today) {
  if (!earliest || earliest > today) return { from: '', to: today };
  let from = field === 'reset' ? earliest : field === 'from' ? value : current.from || earliest;
  let to = field === 'reset' ? today : field === 'end' ? value : current.to || today;
  from = from < earliest ? earliest : from > today ? today : from;
  to = to < from ? from : to > today ? today : to;
  return { from, to };
}
