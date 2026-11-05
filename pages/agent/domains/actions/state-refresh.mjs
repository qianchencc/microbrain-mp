export function createStateRefresh(refresh, { autoCooldownMs = 15000 } = {}) {
  let timer;
  let lastAutoAt = -Infinity;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return {
    run() {
      cancel();
      return refresh();
    },
    auto() {
      const now = Date.now();
      if (now - lastAutoAt < autoCooldownMs) return;
      lastAutoAt = now;
      cancel();
      return refresh();
    },
    after(delayMs) {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        void refresh();
      }, delayMs);
    },
    cancel,
  };
}
