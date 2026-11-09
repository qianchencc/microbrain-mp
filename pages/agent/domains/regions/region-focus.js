import { computed, ref } from 'vue';
import { listRegions, markRegionSeen } from '@/apis/agent/observations';
import {
  getAgentStorageScope,
  isAgentStorageScope,
  waitForAgentSession,
} from '@/utils/agent-session';
import { isReadCancelled } from '../../../../utils/agent-read-scope.mjs';

export const regions = ref([]);
export const focusRegionId = ref('');
export const regionsLoading = ref(false);
export const regionsError = ref('');
export const focusRegion = computed(
  () => regions.value.find((region) => region.id === focusRegionId.value) || null
);
let owner = '';
let sequence = 0;
let loadedAt = 0,
  inFlight = null;
const storageKey = (scope) => 'agent-focus-region:' + scope;
const directoryKey = (scope) => 'agent-region-directory:v1:' + scope;
const denied = (error) =>
  [401, 403].includes(error.status ?? error.statusCode) || error.code === 'AGENT_SESSION_EXPIRED';
const validDirectory = (value) =>
  Array.isArray(value) &&
  value.every(
    (region) => region && typeof region.id === 'string' && typeof region.name === 'string'
  );

function readLocal(key) {
  try {
    return uni.getStorageSync(key);
  } catch {
    return undefined;
  }
}
function writeLocal(key, value) {
  try {
    uni.setStorageSync(key, value);
  } catch {
    /* Storage is optional; backend data stays usable. */
  }
}
function clearDirectory(scope) {
  regions.value = [];
  focusRegionId.value = '';
  loadedAt = 0;
  regionsLoading.value = false;
  regionsError.value = '';
  if (scope) {
    try {
      uni.removeStorageSync(directoryKey(scope));
    } catch {
      /* Keep the in-memory denial effective. */
    }
  }
}
function useDirectory(scope, rows) {
  const previous = new Map(regions.value.map((region) => [region.id, region.attention]));
  const directory = rows.map(({ id, name }) => ({ id, name }));
  regions.value = directory.map((region) => ({
    ...region,
    attention: previous.get(region.id),
  }));
  const saved = readLocal(storageKey(scope));
  focusRegionId.value =
    regions.value.find((region) => region.id === saved)?.id || regions.value[0]?.id || '';
  writeLocal(storageKey(scope), focusRegionId.value);
  return directory;
}
function refreshAttention(scope, request, options) {
  listRegions(undefined, {
    ...options,
    isActive: () => request === sequence && options.isActive?.() !== false,
  })
    .then((latest) => {
      if (request !== sequence || options.isActive?.() === false || !isAgentStorageScope(scope))
        return;
      if (!validDirectory(latest.regions)) throw new Error('区域目录响应无效');
      const directory = useDirectory(scope, latest.regions);
      writeLocal(directoryKey(scope), { regions: directory, loadedAt });
      const attention = new Map(
        (latest.regions || []).map((region) => [region.id, region.attention])
      );
      regions.value = regions.value.map((region) => ({
        ...region,
        attention: attention.get(region.id),
      }));
    })
    .catch((error) => {
      if (request === sequence && isAgentStorageScope(scope) && denied(error)) {
        clearDirectory(scope);
        if (options.isActive?.() !== false) regionsError.value = error.message || '区域访问已失效';
      }
    });
}

export async function loadRegionFocus(options = {}) {
  const consumerActive = options.viewActive || options.isActive || (() => true);
  if (owner && !isAgentStorageScope(owner)) {
    ++sequence;
    clearDirectory('');
    owner = '';
    inFlight = null;
  }
  try {
    await waitForAgentSession();
  } catch (error) {
    ++sequence;
    clearDirectory(owner);
    owner = '';
    inFlight = null;
    if (consumerActive()) {
      regionsError.value = error.message || '区域暂不可用';
    }
    throw error;
  }
  if (!consumerActive()) return;
  const scope = getAgentStorageScope();
  if (scope !== owner) {
    ++sequence;
    clearDirectory('');
    owner = scope;
    inFlight = null;
    const saved = readLocal(directoryKey(scope));
    if (
      saved &&
      Number.isFinite(saved.loadedAt) &&
      saved.loadedAt > 0 &&
      validDirectory(saved.regions)
    ) {
      useDirectory(scope, saved.regions);
      loadedAt = saved.loadedAt;
    }
  }
  if (inFlight?.scope === scope && inFlight.active()) {
    inFlight.consumers.add(consumerActive);
    return loadedAt ? undefined : inFlight.promise;
  }
  const request = ++sequence;
  const consumers = new Set([consumerActive]);
  const active = () => [...consumers].some((consumer) => consumer());
  regionsLoading.value = !regions.value.length;
  regionsError.value = '';
  const promise = Promise.resolve().then(async () => {
    try {
      const result = await listRegions('directory', {
        ...options,
        isActive: () => request === sequence && active(),
      });
      if (request !== sequence || !active() || !isAgentStorageScope(scope)) return;
      if (!validDirectory(result.regions)) throw new Error('区域目录响应无效');
      const directory = useDirectory(scope, result.regions);
      const observed = Date.parse(result.cache?.updatedAt);
      loadedAt = Number.isFinite(observed) ? observed : Date.now();
      writeLocal(directoryKey(scope), { regions: directory, loadedAt });
      refreshAttention(scope, request, { ...options, isActive: active });
    } catch (error) {
      if (isReadCancelled(error)) throw error;
      if (request === sequence) {
        if (!isAgentStorageScope(scope) || denied(error)) clearDirectory(scope);
        // Hidden callers may clear revoked data, but cannot notify or repaint another page.
        if (active()) {
          regionsError.value = error.message || '区域暂不可用';
        }
      }
      throw error;
    } finally {
      if (request === sequence) regionsLoading.value = false;
      if (inFlight?.request === request) inFlight = null;
    }
  });
  inFlight = { scope, promise, request, consumers, active };
  if (loadedAt) {
    // A refresh failure is recorded above; it must not block an already usable directory.
    promise.catch(() => {});
    return;
  }
  return promise;
}

export function selectFocusRegion(id) {
  if (
    regionsLoading.value ||
    owner !== getAgentStorageScope() ||
    !regions.value.some((region) => region.id === id)
  )
    return false;
  focusRegionId.value = id;
  writeLocal(storageKey(owner), id);
  return true;
}

export async function acknowledgeRegion(id) {
  const scope = getAgentStorageScope();
  if (!id || scope !== owner || !regions.value.some((region) => region.id === id)) return;
  await markRegionSeen(id);
  if (scope === getAgentStorageScope())
    regions.value = regions.value.map((region) =>
      region.id === id ? { ...region, attention: false } : region
    );
}

const composeKey = (scope) => 'agent-compose-prefill:' + scope;

// 工作台“新建任务”回到对话时的一次性输入预填：写入当前身份作用域，Agent 页 onShow 消费一次即清除。
export function queueComposePrefill(text) {
  const scope = getAgentStorageScope();
  if (!scope || !text) return;
  uni.setStorageSync(composeKey(scope), text);
}

export function consumeComposePrefill() {
  const scope = getAgentStorageScope();
  if (!scope) return '';
  const text = uni.getStorageSync(composeKey(scope));
  if (text) uni.removeStorageSync(composeKey(scope));
  return typeof text === 'string' ? text : '';
}
