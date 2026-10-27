// 身份隔离的 Agent 读取快照：Company 概览/统计/安全台账、两端任务与周期安排列表、通知列表。
// 不接入控制、草案、回执、会话或视频地址；stale 快照不得支撑确认、执行、已读或控制。
const FRESH_MS = 60_000, PLACEHOLDER_MS = 5 * 60_000, MAX_ENTRIES = 40
const copy = value => JSON.parse(JSON.stringify(value))
const asMatcher = match => typeof match === 'function' ? match : key => key === match
export function createAgentReadCache(getScope, now = Date.now) {
 let owner = '', generation = 0
 const entries = new Map(), jobs = new Map(), epochs = new Map()
 function clear() { ++generation; entries.clear(); jobs.clear(); epochs.clear() }
 function scope() {
  let next
  try { next = getScope() } catch (error) { clear(); owner = ''; throw error }
  if (owner !== next) { clear(); owner = next }
  return next
 }
 function put(key, value) {
  scope()
  entries.delete(key)
  entries.set(key, { value: copy(value), at: now() })
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value)
 }
 // 历史日历月等不会自变的窗口按调用方给的 TTL 复用；未给时沿用 60 秒 / 5 分钟口径。
 function peek(key, options = {}) {
  const freshMs = options.freshMs ?? FRESH_MS, staleMs = options.staleMs ?? PLACEHOLDER_MS
  scope()
  const entry = entries.get(key)
  if (!entry) return null
  const age = now() - entry.at
  if (age < 0 || age >= staleMs) { entries.delete(key); return null }
  return { value: copy(entry.value), fresh: age < freshMs }
 }
 function epochOf(key) { return epochs.get(key) || 0 }
 // 定点作废：写操作只丢弃受影响的读取，不连带清空无关概览快照。
 // 在途读取同样作废，否则它完成时会把作废前的旧结果写回。
 function drop(match) {
  scope()
  const hit = asMatcher(match)
  for (const key of [...entries.keys()]) if (hit(key)) entries.delete(key)
  for (const key of jobs.keys()) if (hit(key)) epochs.set(key, epochOf(key) + 1)
 }
 async function read(key, load, options = {}) {
  const force = options === true || options.force === true
  const requestScope = scope(), version = generation
  const saved = peek(key, options)
  if (!force && saved?.fresh) return saved.value
  let job = jobs.get(key)
  if (!job) {
   const jobEpoch = epochOf(key)
   job = Promise.resolve().then(load).then(value => {
    if (scope() !== requestScope || version !== generation) throw Object.assign(new Error('读取已失效，请重新读取当前身份数据'), { code: 'AGENT_READ_INVALIDATED' })
    if (epochOf(key) === jobEpoch && value?.status !== 'preparing' && !value?.truncated && !value?.coverage?.truncated && !value?.errors?.length) put(key, value)
    else entries.delete(key)
    return value
   }).catch(error => {
    if (version === generation && ([401, 403].includes(error.status ?? error.statusCode) || ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.data?.code))) clear()
    throw error
   }).finally(() => {
    if (jobs.get(key) === job) { jobs.delete(key); epochs.delete(key) }
   })
   jobs.set(key, job)
  }
  return copy(await job)
 }
 return { read, put, peek, drop, clear }
}
