import { applyEvent } from './conversation.mjs';
import { createPresentation } from './presentation.mjs';

const tasksOf = (turn) => (turn.tasks?.length ? turn.tasks : turn.task ? [turn.task] : []);
const sameIds = (left, right) =>
  left.length === right.length && left.every((id) => right.includes(id));
const proposalKey = (task) => task.changeId || task.cancellationId || task.taskId;
const conciseTaskDiscardError = (error) => {
  const raw = String(error?.data?.message || error?.message || '').trim();
  const message = raw.split(/\r?\n/, 1)[0] || '服务暂时不可用';
  return `放弃失败：${message.length > 48 ? `${message.slice(0, 48)}…` : message}`;
};

// Owns transport, selection serialization and confirmation fences. UI effects never decide business success.
export function createConversationOperations({
  read,
  api,
  effects,
  createState = (value) => value,
}) {
  const state = createState({
    running: false,
    busy: false,
    error: '',
    recovery: '',
    confirmingTaskId: '',
  });
  const desired = new Map(),
    synced = new Map(),
    inflight = new Map(),
    confirming = new Set();
  let generation = 0,
    confirmationVersion = 0,
    request = null,
    presentation = null,
    runVersion = 0;
  const capture = () => ({
    generation,
    source: read().source,
    scope: read().scope,
    conversationId: read().conversationId,
  });
  function current(ticket) {
    const context = read();
    return (
      !context.disposed &&
      ticket.generation === generation &&
      ticket.source === context.source &&
      ticket.scope === context.scope &&
      ticket.conversationId === context.conversationId
    );
  }
  const draftTurn = (id) => read().turns.find((turn) => turn.draft?.draftId === id);
  const taskFor = (key) =>
    read()
      .turns.flatMap(tasksOf)
      .find((task) => proposalKey(task) === key);
  const settleSelection = (id) => inflight.get(id) ?? Promise.resolve();
  const changed = () => effects.changed();
  const rememberDraft = (draft) => {
    if (!synced.has(draft.draftId)) synced.set(draft.draftId, draft.selectedActionIds ?? []);
  };
  const canRestore = (allowTaskCreation) =>
    !request && (!confirming.size || allowTaskCreation) && !read().disposed;
  const snapshotFence = () => confirmationVersion;
  const snapshotCurrent = (fence) => fence === confirmationVersion;

  async function run(turn, content) {
    const ticket = capture(),
      version = ++runVersion;
    state.running = true;
    state.error = '';
    effects.follow(true);
    presentation = createPresentation((event) => {
      if (!current(ticket) || version !== runVersion) return;
      applyEvent(turn, event, read().turns);
      if (event.type === 'action.proposed') {
        rememberDraft(event);
        effects.rememberDraft(event);
        for (const previous of read().turns)
          if (previous !== turn && previous.draft?.draftId === event.draftId) {
            previous.draft = null;
            previous.result = null;
          }
      }
      effects.follow();
    });
    const pendingPresentation = presentation;
    const pending = api.streamMessage(
      ticket.conversationId,
      content,
      (event) => pendingPresentation.push(event),
      turn.focusRegion?.id,
      ticket.source,
      turn.reference
    );
    request = pending;
    let interrupted = false,
      resync = false;
    try {
      await pending.promise;
      await pendingPresentation.settle();
    } catch (error) {
      if (!current(ticket) || version !== runVersion) return;
      if (error.data?.code === 'CONVERSATION_AWAITING_CONFIRMATION') {
        const index = read().turns.indexOf(turn);
        if (index >= 0) read().turns.splice(index, 1);
        effects.notice('toast', '设备指令执行中，请稍候');
        resync = true;
      } else if (error.transport) {
        // A disconnected stream is not a cancellation. Restore the authoritative terminal state.
        interrupted = true;
      } else if (turn.running) {
        if (error.data?.conversationId === ticket.conversationId && error.data?.turnId)
          turn.serverId = error.data.turnId;
        turn.error = error.message;
      }
    } finally {
      if (version === runVersion) request = null;
      if (current(ticket) && version === runVersion) {
        turn.running = interrupted;
        state.running = interrupted;
        if (!interrupted && !read().active && turn.text) effects.unread();
        changed();
      }
    }
    if (resync && current(ticket)) await effects.restore();
  }

  function select(turn, selected) {
    const live = draftTurn(turn.draft?.draftId);
    if (read().blocked || live?.draft.status !== 'PENDING_CONFIRMATION') return;
    if (Date.parse(live.draft.expiresAt) <= Date.now()) {
      live.draft.status = 'EXPIRED';
      effects.notice('toast', '草案已过期，请重新核验');
      changed();
      return;
    }
    const id = live.draft.draftId,
      ticket = capture();
    live.draft.selectedActionIds = selected;
    desired.set(id, selected);
    if (inflight.has(id)) return;
    const work = (async () => {
      await Promise.resolve(); // Install the worker before an unchanged selection can finish synchronously.
      try {
        while (desired.has(id) && current(ticket)) {
          const selection = desired.get(id),
            target = draftTurn(id);
          desired.delete(id);
          if (!target) break;
          if (sameIds(selection, synced.get(id) ?? [])) continue;
          try {
            const result = await api.updateSelection(
              id,
              target.draft.revision,
              selection,
              ticket.source
            );
            if (!current(ticket)) return;
            const live = draftTurn(id);
            if (!live) return;
            Object.assign(live.draft, result);
            synced.set(id, selection);
            // A response for an earlier click must not undo a newer optimistic selection.
            live.draft.selectedActionIds = desired.get(id) ?? selection;
          } catch (error) {
            if (!current(ticket)) return;
            const live = draftTurn(id);
            if (live && synced.has(id)) live.draft.selectedActionIds = synced.get(id);
            effects.notice(
              'selection',
              error.data?.message || error.message || '服务端未返回具体原因'
            );
            desired.delete(id);
            if (canRestore(false)) await effects.restore();
            break;
          }
        }
      } finally {
        if (inflight.get(id) === work) inflight.delete(id);
        if (current(ticket)) changed();
      }
    })();
    inflight.set(id, work);
  }

  async function draftCommand(turn, command) {
    const id = turn.draft?.draftId;
    if (
      read().blocked ||
      !id ||
      (['restore', 'cancel', 'confirm'].includes(command) &&
        turn.draft.status !== 'PENDING_CONFIRMATION')
    )
      return;
    const ticket = capture();
    state.busy = true;
    let resync = false,
      confirmationError = '';
    try {
      await settleSelection(id);
      if (!current(ticket)) return;
      const live = draftTurn(id);
      if (!live) return;
      if (command === 'confirm') {
        if (live.draft.status !== 'PENDING_CONFIRMATION' || !live.draft.selectedActionIds.length)
          return;
        live.draft.status = 'EXECUTING';
        confirming.add(id);
        confirmationVersion += 1;
        changed();
        const result = await api.confirmAction(id, live.draft.revision, ticket.source);
        if (!current(ticket)) return;
        const target = draftTurn(id);
        if (target) {
          target.result = result;
          target.draft.status = result.status;
        }
      } else if (command === 'restore') {
        const result = await api.restoreAction(id, live.draft.revision, ticket.source);
        if (current(ticket) && draftTurn(id)) Object.assign(draftTurn(id).draft, result);
      } else if (command === 'cancel') {
        const result = await api.cancelAction(id, ticket.source);
        if (current(ticket) && draftTurn(id)) draftTurn(id).draft.status = result.status;
      } else if (command === 'revalidate') {
        const result = await api.revalidateAction(id, live.draft.revision, ticket.source);
        if (current(ticket) && draftTurn(id)) {
          Object.assign(draftTurn(id).draft, result);
          draftTurn(id).roster = result.inventory;
          draftTurn(id).result = null;
        }
      } else {
        const summary = await api.retrySummary(id, ticket.source);
        if (current(ticket) && draftTurn(id)?.result) draftTurn(id).result.summary = summary;
      }
    } catch (error) {
      if (!current(ticket)) return;
      const live = draftTurn(id);
      if (command === 'confirm' && ['REJECTED', 'INTERRUPTED'].includes(error.data?.status)) {
        if (live) {
          live.result = error.data;
          live.draft.status = error.data.status;
        }
      } else if (command === 'confirm') {
        const reason = error.data?.message || error.message;
        confirmationError = reason
          ? `${reason}；请重新读取执行回执`
          : '未取得执行结果或具体原因，请重新读取回执';
        effects.notice('confirmation', confirmationError, id);
        resync = true;
      } else if (command === 'restore') {
        effects.notice('restore', error.data?.message || error.message || '服务端未返回具体原因');
        resync = canRestore(false);
      } else state.error = error.message;
    } finally {
      if (current(ticket)) {
        if (confirming.delete(id)) confirmationVersion += 1;
        state.busy = false;
        changed();
        effects.follow();
      }
    }
    if (resync && current(ticket)) {
      await effects.restore();
      if (current(ticket) && confirmationError) state.error = confirmationError;
    }
  }

  async function taskCommand(task, discard = false) {
    if (read().blocked || task?.status !== 'PENDING_CONFIRMATION') return;
    const ticket = capture(),
      key = proposalKey(task);
    const { taskId, changeId, cancellationId } = task;
    state.busy = true;
    state.error = '';
    state.recovery = '';
    if (!discard) state.confirmingTaskId = key;
    confirming.add(key);
    confirmationVersion += 1;
    changed();
    let resync = false;
    try {
      const result = changeId
        ? await api[discard ? 'discardTaskChange' : 'confirmTaskChange'](
            changeId,
            task.version,
            ticket.source
          )
        : cancellationId
          ? await api[discard ? 'discardTaskCancellation' : 'confirmTaskCancellation'](
              cancellationId,
              task.version,
              ticket.source
            )
          : discard
            ? await api.discardTask(taskId, ticket.source)
            : await api.confirmTask(taskId, task.version, ticket.source);
      if (!current(ticket)) return;
      const live = taskFor(key);
      if (live) {
        live.status = cancellationId && !discard ? result.proposalStatus : result.status;
        if (discard) live.confirmation = null;
        if (!discard) {
          live.confirmation = null;
          if (!cancellationId && !changeId) {
            live.created = true;
            if (result.taskId) live.taskId = result.taskId;
            if (result.planId) {
              live.planId = result.planId;
              live.nextAt = result.nextAt;
              live.nextCheckpointAt = result.nextCheckpointAt;
            }
          }
        }
      }
      if (!discard) {
        effects.tasksChanged();
        resync = Boolean(changeId);
        if (cancellationId)
          for (const previous of read().turns)
            for (const item of tasksOf(previous)) {
              if (item.taskId === taskId && !item.cancellationId) item.status = result.status;
            }
      }
    } catch (error) {
      if (!current(ticket)) return;
      const code = error.data?.code;
      if (!discard && code === 'TASK_CONFIRMATION_STOPPED') state.recovery = '已停止本次任务确认';
      else if (!discard && code === 'TASK_RECONFIRM_REQUIRED')
        state.recovery = '核实完成：提案已更新，请重新确认';
      else if (!discard && ['TASK_EXPIRED', 'TASK_TIME_PASSED'].includes(code))
        state.recovery = error.data?.message || '原定时间已过，请指定新的执行时间';
      else if (discard) effects.notice('toast', conciseTaskDiscardError(error));
      else state.error = error.data?.message || error.message;
      resync = !discard;
    } finally {
      if (current(ticket)) {
        if (confirming.delete(key)) confirmationVersion += 1;
        state.confirmingTaskId = '';
        state.busy = false;
        changed();
        effects.follow();
      }
    }
    if (resync && current(ticket)) await effects.restore();
  }

  async function stop() {
    const ticket = capture(),
      turn = read().turns.at(-1);
    if (!turn) return;
    ++runVersion;
    presentation?.cancel();
    request?.abort();
    request = null;
    turn.running = false;
    turn.error = read().taskConfirmationRunning ? '' : '本次回答已停止';
    for (const activity of turn.activities)
      if (['running', 'searching'].includes(activity.status)) activity.status = 'skipped';
    state.running = false;
    if (ticket.conversationId) {
      try {
        await api.cancelRun(ticket.conversationId, ticket.source);
      } catch {
        /* Restore reconciles cancellation with server state. */
      }
      if (current(ticket)) await effects.restore();
    }
  }

  function reset() {
    ++generation;
    ++confirmationVersion;
    ++runVersion;
    presentation?.cancel();
    request?.abort();
    request = null;
    desired.clear();
    synced.clear();
    inflight.clear();
    confirming.clear();
    Object.assign(state, {
      running: false,
      busy: false,
      error: '',
      recovery: '',
      confirmingTaskId: '',
    });
  }

  return {
    state,
    run,
    select,
    rememberDraft,
    canRestore,
    snapshotFence,
    snapshotCurrent,
    hasRequest: () => Boolean(request),
    reset,
    stop,
    restoreDraft: (turn) => draftCommand(turn, 'restore'),
    confirmDraft: (turn) => draftCommand(turn, 'confirm'),
    cancelDraft: (turn) => draftCommand(turn, 'cancel'),
    revalidateDraft: (turn) => draftCommand(turn, 'revalidate'),
    retryAnswer: (turn) => draftCommand(turn, 'summary'),
    confirmTask: (task) => taskCommand(task),
    discardTask: (task) => taskCommand(task, true),
  };
}
