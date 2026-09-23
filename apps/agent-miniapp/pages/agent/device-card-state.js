import { acSummary } from './ac-draft.js';

export function stateText(action, state) {
  if (action.kind === "access") return "门状态未知";
  if (state == null) return '状态未知';
  if (action.kind !== 'ac') return state === true ? '开启' : '关闭';
  return acSummary(state) || '状态未知';
}

// 执行结果自带回读时刻的权威状态（confirm 响应 observedStates）：
// 覆盖普通状态查询里可能更旧的"最后已知值"；只取非空项，空项保留查询结果。
export function mergeObservedStates(states, observedStates) {
  if (!observedStates) return states
  const merged = { ...states }
  for (const [id, state] of Object.entries(observedStates)) if (state != null) merged[id] = state
  return merged
}

// 只有空调有可编辑参数（温度/模式/风速）；门禁一次执行即开一次门，无参数可配，长按不激活面板。
export function cardConfigurable(action, phase, { readonly = false, disabled = false } = {}) {
  return !readonly && !disabled && phase === 'pending' && action.kind === 'ac';
}

export function reduceCardHold(state, event) {
  if (state === 'committed') return event === 'end' || event === 'cancel' ? 'released' : state;
  if (state === 'released' || state === 'cancelled') return event === 'start' ? 'tracking' : state;
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
