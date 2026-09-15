import { acSummary } from './ac-draft.js';

export function stateText(action, state) {
  if (action.kind === "access") return "门状态未知";
  if (state == null) return '状态未知';
  if (action.kind !== 'ac') return state === true ? '开启' : '关闭';
  return acSummary(state) || '状态未知';
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
