const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const clone = (value) => JSON.parse(JSON.stringify(value));

// Cached content is presentation only. Authority is never persisted with it.
export function createConversationRecovery({ getScope, getBackend, storage, now = Date.now }) {
  const versions = new Map(),
    accepted = new Map(),
    memory = new Map();
  let activeScope = '',
    activeBackend = '',
    sequence = 0;
  const keyOf = (scope, source) =>
    `agent-conversation-view:v1:${encodeURIComponent(getBackend())}:${scope}:${source}`;
  const current = (ticket) => {
    try {
      return (
        Boolean(ticket) &&
        ticket.scope === getScope() &&
        ticket.key === keyOf(ticket.scope, ticket.source) &&
        versions.get(ticket.key) === ticket.version
      );
    } catch {
      return false;
    }
  };
  const forget = (ticket) => {
    if (!ticket || versions.get(ticket.key) !== ticket.version) return false;
    versions.set(ticket.key, ticket.version + 1);
    accepted.delete(ticket.key);
    memory.delete(ticket.key);
    try {
      storage.removeStorageSync(ticket.key);
    } catch {
      /* Storage failure cannot grant authority. */
    }
    return true;
  };
  const save = (ticket, view) => {
    if (
      !current(ticket) ||
      !view?.id ||
      view.source !== ticket.source ||
      !Array.isArray(view.turns)
    )
      return false;
    try {
      const held = { savedAt: now(), view: clone(view) };
      memory.set(ticket.key, held);
      try {
        storage.setStorageSync(ticket.key, held);
      } catch {
        /* Memory remains usable when device storage is full. */
      }
    } catch {
      return false;
    }
    return true;
  };
  return {
    open(source) {
      const scope = getScope(),
        backend = getBackend();
      if (activeScope && (activeScope !== scope || activeBackend !== backend)) {
        for (const key of versions.keys()) {
          try {
            storage.removeStorageSync(key);
          } catch {
            /* Old identity remains inaccessible. */
          }
        }
        versions.clear();
        accepted.clear();
        memory.clear();
      }
      activeScope = scope;
      activeBackend = backend;
      const key = keyOf(scope, source),
        version = ++sequence;
      versions.set(key, version);
      accepted.delete(key);
      const ticket = { scope, source, key, version, preview: null };
      let held = memory.get(key);
      if (!held) {
        try {
          held = storage.getStorageSync(key);
        } catch {
          /* No cached preview. */
        }
      }
      if (
        held &&
        Number.isFinite(held.savedAt) &&
        held.savedAt <= now() &&
        now() - held.savedAt < MAX_AGE_MS &&
        held.view?.id &&
        held.view.source === source &&
        Array.isArray(held.view.turns)
      ) {
        try {
          ticket.preview = clone(held.view);
        } catch {
          /* Malformed cache cannot block a real restore. */
        }
      }
      return ticket;
    },
    current,
    accept(ticket, view) {
      if (
        !current(ticket) ||
        !view?.id ||
        view.source !== ticket.source ||
        !Array.isArray(view.turns)
      )
        return false;
      accepted.set(ticket.key, ticket.version);
      save(ticket, view);
      return true;
    },
    canMutate(ticket) {
      return current(ticket) && accepted.get(ticket.key) === ticket.version;
    },
    retain(ticket, view) {
      return this.canMutate(ticket) && save(ticket, view);
    },
    forget,
  };
}
