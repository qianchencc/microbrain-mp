const labels = {
  pending: '未开始',
  pending_confirmation: '待确认',
  scheduled: '未开始',
  executing: '进行中',
  completed: '已结束',
  verified: '已完成',
  observed: '已检查',
  satisfied: '无需调整',
  partial: '部分完成',
  failed: '未完成',
  missed: '未完成',
  interrupted: '未完成',
  dispatched: '已下发',
  unconfirmed: '已下发',
  unknown: '已下发',
  unavailable: '已下发',
  cancelled: '已取消',
  expired: '已过期',
};
export const taskStatusText = (status) =>
  labels[String(status || '').toLowerCase()] || '状态待更新';
export const taskNeedsDetails = (status) =>
  ['failed', 'partial', 'missed', 'interrupted'].includes(status);
export const taskStatusTone = (status) =>
  ['verified', 'satisfied', 'observed'].includes(status)
    ? 'ok'
    : status === 'executing'
      ? 'active'
      : taskNeedsDetails(status)
        ? 'warn'
        : 'wait';

// 控制已下发、平台没有回传执行结果时只写“已下发”：不写“暂无结果/等待核验”一类让客户以为系统没执行的描述。
const DISPATCHED = new Set(['dispatched', 'unconfirmed', 'unknown', 'unavailable']);

// 判定只读原始事实，中文标签不能参与完成、颜色或淡化判断。
export function deviceResultView(device) {
  const { outcome } = device;
  if (outcome === 'verified') return { text: '已完成', tone: 'ok', settled: true };
  if (outcome === 'satisfied') return { text: '无需调整', tone: 'ok', settled: true };
  if (outcome === 'observed') return { text: '已检查', tone: 'ok', settled: true };
  if (outcome === 'pending') return { text: '未开始', tone: 'wait', settled: false };
  if (outcome === 'not_dispatched') return { text: '这次未调整', tone: 'wait', settled: false };
  if (DISPATCHED.has(outcome)) return { text: '已下发', tone: 'wait', settled: false };
  return { text: '未完成', tone: 'warn', settled: false };
}

// 面向非专业读者的一句话说明：只写已发生的事实，回传缺失不再追加不确定说明。
export function deviceResultReason(device, target) {
  const action =
    !device.target?.observe && target && target !== '目标未指定' ? `「${target}」` : '';
  const known = {
    unconfirmed: '',
    unknown: '',
    unavailable: '',
    not_dispatched: '这次没有操作这台设备。',
    rejected: '设备平台没有接受这次操作。',
    unreadable: '暂时没读到设备状态。',
    missing: '这台设备当前无法操作。',
    failed: '这次操作没有完成。',
  };
  return [
    known[device.outcome] ?? taskStatusText(device.outcome),
    device.reason,
    device.details?.reason,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// completed只表示执行流程结束；有设备事实时，才进一步表达目标结果。
export function taskResultStatus(record) {
  if (!['completed', 'dispatched', 'unconfirmed', 'unknown', 'unavailable'].includes(record.status))
    return record.status;
  const phaseDevices = (record.phases || []).flatMap((phase) => phase.devices || []);
  const devices = phaseDevices.length ? phaseDevices : record.devices || [];
  if (devices.some((device) => DISPATCHED.has(device.outcome))) return 'dispatched';
  return devices.length && devices.every((device) => deviceResultView(device).settled)
    ? 'verified'
    : 'completed';
}
// 已结束行的结果桥：completed 只写「已结束」，有设备事实才经 taskResultStatus 表达目标结果；
// 前端不推断执行成功，只投影后端事实。
export const taskResultLabel = (record) => taskStatusText(taskResultStatus(record));

// A server capability is authoritative; nextAt alone is not a status.
export function planPresentation(plan) {
  const status = plan?.status;
  const enabled = status === 'enabled';
  const paused = status === 'paused' || status === 'disabled';
  const ended = status === 'ended' || status === 'deleted';
  const canToggle =
    status === 'enabled' ? Boolean(plan.canPause) : status === 'paused' && Boolean(plan.canResume);
  const hasCheckpoints = (plan?.template?.phases || plan?.phases || []).some(
    (phase) => phase?.read?.ac?.cadenceMinutes
  );
  return {
    enabled,
    canToggle,
    statusText: paused
      ? '已暂停'
      : status === 'deleted'
        ? '已删除'
        : ended
          ? '已结束'
          : enabled
            ? '已开启'
            : '状态待确认',
    nextAt: plan?.nextCheckpointAt || plan?.nextAt,
    nextLabel: hasCheckpoints ? '下一次检查' : '下一次执行',
    nextNote: paused
      ? '已暂停'
      : ended
        ? '已结束'
        : enabled && !plan.nextAt && !plan.nextCheckpointAt
          ? '下一次安排待更新'
          : '',
    accessSummary:
      status === 'enabled' && plan.canPause
        ? '可暂停以后的安排；本次已安排的任务会继续'
        : status === 'paused' && plan.canResume
          ? '继续前会重新检查设备权限'
          : plan?.canManage
            ? '可取消本次或全部'
            : '当前账号仅可查看',
  };
}
