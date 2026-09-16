import { acSummary } from './ac-draft.js';

export function stateText(action, state) {
  if (action.kind === "access") return "门状态未知";
  if (state == null) return '状态未知';
  if (action.kind !== 'ac') return state === true ? '开启' : '关闭';
  return acSummary(state) || '状态未知';
}

export function reduceCardHold(state, event) {
  if (state === 'committed' || state === 'cancelled') return event === 'start' ? 'tracking' : state;
  if (event === 'complete') return 'committed';
  if (event === 'start') return 'tracking';
  if (event === 'cancel') return 'cancelled';
  if (event === 'end') return 'idle';
  return state;
}

export function receiptPhase(action, outcome, state) {
  if (outcome === 'UNSELECTED') return 'unselected';
  if (action.kind === 'access') return outcome === 'ACCEPTED' ? 'accepted' : 'failed';
  if (outcome === 'ALREADY_SATISFIED') return 'complete';
  if (outcome !== 'ACCEPTED') return 'failed';
  const reached = state != null && Object.entries(action.command).every(([key, value]) =>
    key === 'closeOrOpen' ? state === (value === 1) : state[key] === value);
  return reached ? 'complete' : 'accepted';
}

// 只读/禁用卡片被点击时必须给出原因与出路；静默无反应会被用户当成"坏了"
// （2026-09-17 预览环境"卡片完全无法交互"实为草案被退役后整卡静默转只读）。
export function tapBlockHint(phase, { readonly = false, disabled = false } = {}) {
  if (phase === 'cancelled') return '草案已取消，发送新指令可重新下达';
  if (phase === 'expired') return '草案已过期，重新核验后可继续调整';
  if (disabled) return '正在处理，请稍候';
  if (readonly) return '该操作当前不可修改';
  return '';
}
