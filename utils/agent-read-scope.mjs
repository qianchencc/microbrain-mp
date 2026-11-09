// Read cancellation is control flow, not a login or backend failure.
export const cancelRead = (reason = 'inactive') =>
  Object.assign(new Error('读取已取消'), { code: 'AGENT_READ_CANCELLED', reason });
export const readIdentityChanged = () =>
  Object.assign(new Error('登录身份已变化，请重新读取'), { code: 'AGENT_IDENTITY_CHANGED' });
export const isReadCancelled = (error) => error?.code === 'AGENT_READ_CANCELLED';

const denied = (error) =>
  [401, 403].includes(error?.status ?? error?.statusCode) ||
  error?.code === 'AGENT_SESSION_EXPIRED';

// Owns publication, not transport or business facts. A hidden generation never revives.
export function createReadScope({ identity, ready, active = () => true, context = () => '' }) {
  let generation = 0,
    disposed = false;
  const slots = new Map();
  const clearers = new Map();
  let knownIdentity;
  try {
    knownIdentity = identity();
  } catch {
    /* Initial session is not ready. */
  }
  const safely = (check) => {
    try {
      return check();
    } catch {
      return false;
    }
  };
  const invalidate = (key) => {
    if (key === undefined) ++generation;
    else slots.delete(key);
  };
  const identityChanged = () => {
    let next;
    try {
      next = identity();
    } catch {
      /* An expired session also clears held data. */
    }
    if (next === knownIdentity) return;
    const hadIdentity = knownIdentity !== undefined;
    knownIdentity = next;
    if (hadIdentity) {
      invalidate();
      for (const clear of new Set(clearers.values())) clear();
    }
  };
  async function run(key, load, handlers = {}) {
    if (disposed || !safely(active)) return { status: 'cancelled' };
    identityChanged();
    if (handlers.denied) clearers.set(key, handlers.denied);
    let owner;
    try {
      owner = identity();
    } catch {
      /* Session readiness may still be pending. */
    }
    const capturedContext = JSON.stringify(context());
    const ticket = {},
      epoch = generation;
    slots.set(key, ticket);
    const sameIdentity = () => safely(() => identity() === owner);
    const sameContext = () => safely(() => JSON.stringify(context()) === capturedContext);
    const viewActive = () =>
      !disposed &&
      epoch === generation &&
      safely(active) &&
      (owner === undefined || sameIdentity()) &&
      sameContext();
    const current = () => viewActive() && slots.get(key) === ticket;
    try {
      handlers.start?.();
      let value;
      try {
        if (ready) await ready();
        if (!current()) return { status: 'cancelled' };
        owner = identity();
        knownIdentity = owner;
        value = await load({
          isActive: current,
          viewActive,
          activityBound: true,
          publish: (apply) => {
            if (!current()) return false;
            apply();
            return true;
          },
        });
      } catch (error) {
        const publishable = current();
        // A real denial may clear retained data after hide, never a newer identity/read.
        if (denied(error) && sameIdentity() && sameContext() && slots.get(key) === ticket)
          handlers.denied?.(error);
        if (!publishable || isReadCancelled(error)) return { status: 'cancelled' };
        handlers.error?.(error);
        return { status: 'error', error };
      }
      if (!current()) return { status: 'cancelled' };
      await handlers.data?.(value);
      if (!current()) return { status: 'cancelled' };
      return { status: 'value', value };
    } finally {
      if (current()) handlers.finish?.();
      if (slots.get(key) === ticket) slots.delete(key);
    }
  }
  return {
    run,
    invalidate,
    identityChanged,
    isActive: () => !disposed && safely(active),
    dispose: () => {
      disposed = true;
      invalidate();
      clearers.clear();
    },
  };
}
