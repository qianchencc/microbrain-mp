import { planPresentation } from './task-presentation.mjs';
import { showAgentError } from '../../../../utils/agent-error.mjs';

// The view supplies its current identity and selection, not request epochs.
// All modal, version, stale-response and recovery rules live here.
export function createPlanManagement({
  readContext,
  updatePlan,
  api,
  confirm,
  notify,
  changed,
  createState = (value) => value,
}) {
  const state = createState({ busy: false, error: '' });
  let sequence = 0;

  function capture() {
    const context = readContext();
    return { sequence: ++sequence, source: context.source, scope: context.scope, key: context.key };
  }

  function current(ticket, plan) {
    if (ticket.sequence !== sequence) return false;
    let context;
    try {
      context = readContext();
    } catch {
      return false;
    }
    if (
      !context.active ||
      context.source !== ticket.source ||
      context.scope !== ticket.scope ||
      context.key !== ticket.key
    )
      return false;
    if (!plan) return true;
    return context.plans.some(
      (value) => value?.planId === plan.planId && value.version === plan.version
    );
  }

  function invalidate() {
    sequence += 1;
    state.busy = false;
  }

  function clearError() {
    state.error = '';
  }

  async function toggle(planId) {
    if (state.busy) return;
    const plan = readContext().plans.find((value) => value?.planId === planId);
    if (!plan) return;
    const presentation = planPresentation(plan);
    if (!presentation.canToggle) return;
    const enabled = !presentation.enabled;
    const ticket = capture();
    if (!current(ticket, plan)) return;
    const operation = enabled ? 'resume' : 'pause';
    state.busy = true;
    state.error = '';
    try {
      const result = await api.setStatus(
        plan.planId,
        plan.version,
        operation,
        ticket.source,
        enabled
      );
      if (!current(ticket, plan)) return;
      if (result?.plan) updatePlan(result.plan);
      changed(operation);
      notify(enabled ? '已继续执行' : '已暂停以后的安排');
    } catch (cause) {
      if (!current(ticket, plan)) return;
      if (cause.data?.recovery?.plan) updatePlan(cause.data.recovery.plan);
      showAgentError(cause, { fallback: '状态更新失败' });
    } finally {
      if (ticket.sequence === sequence) state.busy = false;
    }
  }

  async function pauseAll() {
    if (state.busy) return;
    const context = readContext();
    const plans = context.plans.filter((plan) => plan?.status === 'enabled' && plan.canPause);
    if (!plans.length) return;
    const ticket = capture();
    const skipped = context.plans.filter(
      (plan) => plan?.status === 'enabled' && plan.nextAt && !plan.canPause
    ).length;
    const accepted = await confirm({
      title: '暂停全部周期任务',
      content: `将暂停 ${plans.length} 个已开启周期任务，只影响以后的安排；已经安排的本次任务会继续，已做的操作保持原样。${skipped ? `另有 ${skipped} 项不能暂停，保持不变。` : ''}`,
      confirmText: '全部暂停',
      destructive: true,
    });
    if (!accepted || !current(ticket)) return;
    state.busy = true;
    state.error = '';
    let paused = 0;
    const failures = [];
    try {
      for (const plan of plans) {
        if (!current(ticket)) return;
        try {
          const result = await api.setStatus(plan.planId, plan.version, 'pause', ticket.source);
          if (!current(ticket)) return;
          if (result?.plan) updatePlan(result.plan);
          paused += 1;
        } catch (cause) {
          if (!current(ticket)) return;
          failures.push(`${plan.label || '未命名安排'}：${cause.message || '未提供原因'}`);
        }
      }
      if (!current(ticket)) return;
      changed('pause-all');
      if (failures.length) {
        state.error = `已暂停${paused}项，${failures.length}项未暂停。\n\n${failures.join('\n\n')}`;
        showAgentError(null, { fallback: '部分安排未暂停' });
      } else notify(`已暂停${paused}项`);
    } finally {
      if (ticket.sequence === sequence) state.busy = false;
    }
  }

  async function cancel(plan, { scope, date, refresh = false } = {}) {
    if (state.busy || !plan?.planId) return false;
    const ticket = capture();
    state.error = '';
    state.busy = true;
    try {
      const target = refresh ? (await api.getPlan(plan.planId, ticket.source)).plan : plan;
      if (!current(ticket)) return false;
      if (!target?.canManage) throw new Error('当前无权取消这个周期');
      const title = scope === 'all' ? '取消全部' : '取消本次';
      const accepted = await confirm({
        title,
        confirmText: title,
        destructive: true,
        content:
          scope === 'all'
            ? '取消这个周期全部尚未执行的安排；已执行或已发送的动作保持原样。'
            : '只取消这一次，后续周期照常执行。',
      });
      if (!accepted || !current(ticket)) return false;
      await api.cancelPlan(target.planId, target.version, scope, date, ticket.source);
      return current(ticket);
    } catch (cause) {
      if (!current(ticket)) return false;
      if (cause.data?.recovery?.plan) updatePlan(cause.data.recovery.plan);
      state.error = cause.message || '取消失败，请刷新后重试';
      showAgentError(cause, { fallback: '取消失败' });
      return false;
    } finally {
      if (ticket.sequence === sequence) state.busy = false;
    }
  }

  return { state, toggle, pauseAll, cancel, invalidate, clearError };
}
