// 执行回执页脚的单一事实来源（ActionPanel / ActionDraftCard / DraftSheetLayer 共用）。
// 是否执行中只认草案权威状态 EXECUTING——绝不由「缺 message」或总结生成中推断出执行中；
// 终态文案优先采用后端规范化 result.message（按回执计数生成），缺失时按逐条回执证据推导
// 真实兜底：受理≠物理成功（已受理只说已下发），未知/超时≠失败也不算已下发，
// 取消/过期未执行就是未执行；聚合状态只是线索，逐条回执才是证据。

const EXECUTING_NOTICE = { kind: 'executing', text: '正在执行，请稍候' };

const STATUS_NOTICES = {
  ACCEPTED: '已下发',
  PARTIALLY_ACCEPTED: '部分已下发，未全部成功',
  REJECTED: '未受理',
  NO_CHANGE: '无需操作',
  INTERRUPTED: '下发结果未知',
  CANCELLED: '操作已取消，未执行',
  EXPIRED: '核验已过期，未执行',
};

// 逐条回执按证据归类：已下发（含参数级部分受理）/设备已证实/已达标/未知/被拒/未执行。
const OUTCOME_CLASSES = {
  dispatched: ['ACCEPTED'],
  partial: ['PARTIALLY_ACCEPTED'],
  applied: ['DEVICE_APPLIED'],
  satisfied: ['ALREADY_SATISFIED'],
  unknown: ['UNKNOWN', 'TIMEOUT', 'DISPATCHED_UNKNOWN'],
  refused: ['REJECTED'],
  skipped: ['NOT_DISPATCHED'],
};

function receiptEvidence(draft, result) {
  const counts = {
    dispatched: 0,
    applied: 0,
    partial: 0,
    satisfied: 0,
    unknown: 0,
    refused: 0,
    skipped: 0,
  };
  const kinds = new Map((draft?.actions || []).map((action) => [action.id, action.kind]));
  for (const receipt of result?.receipts || []) {
    if (!receipt || receipt.outcome === 'UNSELECTED') continue;
    const fields = receipt.fields?.length ? receipt.fields : receipt.response?.fields;
    const records = Array.isArray(fields) && fields.length ? fields : [receipt];
    for (const record of records) {
      let outcome = String(record?.outcome || '')
        .trim()
        .toUpperCase();
      if (outcome === 'UNSELECTED') continue;
      const access = kinds.get(receipt.actionId) === 'access';
      if (access && outcome === 'DEVICE_APPLIED') outcome = 'ACCEPTED';
      else if (
        !access &&
        outcome === 'ACCEPTED' &&
        result.readback?.[receipt.actionId] === 'confirmed'
      )
        outcome = 'DEVICE_APPLIED';
      const category = Object.keys(OUTCOME_CLASSES).find((key) =>
        OUTCOME_CLASSES[key].includes(outcome)
      );
      counts[category || 'unknown'] += 1;
    }
  }
  return counts;
}

// 旧记录缺 message 时的兜底：从逐条回执推导，聚合状态只做最后线索。
function evidenceNotice(draft, result, status) {
  const evidence = receiptEvidence(draft, result);
  const dispatched = evidence.dispatched + evidence.applied + evidence.partial;
  const refused = evidence.refused + evidence.skipped;
  // 未知传输不是已下发证据：零受理而存在未知时只说结果未知（可附未受理项），不说部分已下发。
  if (!dispatched && evidence.unknown)
    return { kind: 'attention', text: refused ? '下发结果未知，有未受理项' : '下发结果未知' };
  if (dispatched && evidence.unknown)
    return { kind: 'attention', text: '部分指令已下发，其余下发结果未知' };
  if (dispatched && refused) return { kind: 'attention', text: '部分指令已下发，其余未受理' };
  if (evidence.partial) return { kind: 'attention', text: '部分已下发，未全部成功' };
  if (!dispatched && evidence.satisfied && refused)
    return { kind: 'attention', text: '无需操作，有未受理项' };
  if (refused) return { kind: 'attention', text: '未受理' };
  if (evidence.applied && !evidence.dispatched) return { kind: 'sent', text: '已完成' };
  if (dispatched) return { kind: 'sent', text: '已下发' };
  if (evidence.satisfied) return { kind: 'sent', text: '无需操作' };
  const text = STATUS_NOTICES[status];
  return text ? { kind: toneFor(status), text } : null;
}

// 未知与不完整结果需要说明，但不是仍在执行；已下发与无需操作使用中性确认色。
const toneFor = (status) =>
  ['PARTIALLY_ACCEPTED', 'REJECTED', 'INTERRUPTED'].includes(status) ? 'attention' : 'sent';

/**
 * @param {object|null} draft 权威草案（status 为后端 ActionDraftStatus）
 * @param {object|null} result 规范化执行结果（与 confirm/restore 同一投影）
 * @returns {{kind:'executing'|'attention'|'sent', text:string}|null 非执行终态无真相时返回 null
 */
export function executionNotice(draft, result) {
  if (draft?.status === 'EXECUTING') return EXECUTING_NOTICE;
  const message = typeof result?.message === 'string' ? result.message.trim() : '';
  if (message) return { kind: toneFor(result?.status ?? draft?.status), text: message };
  return evidenceNotice(draft, result, result?.status ?? draft?.status);
}
