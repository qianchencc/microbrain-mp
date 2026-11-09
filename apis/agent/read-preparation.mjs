import { cancelRead, readIdentityChanged } from '../../utils/agent-read-scope.mjs';

// A preparing response is not data. Keep the caller's last view until ready.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const preparationCodes = new Set([
  'ACCOUNT_IDENTITY_PREPARING',
  'TASK_READ_PREPARING',
  'IOT_SCOPE_PREPARING',
  'DEVICE_STATE_PREPARING',
  'ENERGY_HISTORY_PREPARING',
  'ENVIRONMENT_HISTORY_PREPARING',
]);
let visibilityGeneration = 0,
  subscribedUni = null;
function subscribeVisibility() {
  if (typeof uni === 'undefined' || typeof uni.onAppHide !== 'function' || subscribedUni === uni)
    return;
  uni.onAppHide(() => {
    visibilityGeneration++;
  });
  subscribedUni = uni;
}
function currentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1];
}
export function captureActivity() {
  subscribeVisibility();
  const generation = visibilityGeneration;
  const page = currentPage();
  return () => {
    const current = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    return generation === visibilityGeneration && (!page || current[current.length - 1] === page);
  };
}
export function createPreparedReader(getScope) {
  const now = Date.now;
  return async function read(load, options = {}) {
    const identity = getScope(),
      visible = options.activityBound ? () => true : captureActivity(),
      deadline = now() + 180_000;
    const ensureActive = () => {
      if (identity !== getScope()) throw readIdentityChanged();
      if (!visible() || options.isActive?.() === false) throw cancelRead('inactive');
    };
    let attempts = 0;
    while (true) {
      if (options.snapshot !== false || attempts > 0) ensureActive();
      let body,
        servicePending = false;
      try {
        body = await load();
      } catch (error) {
        if (error.status !== 503 || !preparationCodes.has(error.data?.code)) throw error;
        body = error.data;
        servicePending = true;
      }
      if (options.snapshot !== false || servicePending || attempts > 0) ensureActive();
      const preparing =
        servicePending ||
        (options.snapshot !== false &&
          (body?.status === 'preparing' || body?.cache?.status === 'preparing'));
      const unavailable =
        options.snapshot !== false &&
        (body?.status === 'unavailable' || body?.cache?.status === 'unavailable');
      if (!preparing && !unavailable) return body;
      if (unavailable || now() >= deadline || attempts++ >= 180) {
        const error = new Error(
          body?.message ||
            body?.cache?.lastError?.message ||
            (preparing ? '数据准备中，请稍后重试' : '数据暂不可用，请稍后重试')
        );
        error.code = servicePending
          ? body.code
          : preparing
            ? 'AGENT_READ_PREPARING'
            : 'AGENT_READ_UNAVAILABLE';
        error.data = body;
        if (servicePending) error.status = 503;
        throw error;
      }
      // One visible-page attempt per second at most. No retry of transport, 4xx,
      // or other 5xx failures, and no upstream force/synchronization parameter.
      const delay = Math.min(
        5000,
        Math.max(1000, Number(body?.cache?.retryAfterMs ?? body?.retryAfterMs) || 1000)
      );
      const remaining = deadline - now();
      if (remaining <= 0) continue;
      await wait(Math.min(delay, remaining));
    }
  };
}
