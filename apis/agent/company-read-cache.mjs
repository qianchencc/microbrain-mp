// 只用于 Company 概览/统计；不接入控制、回执、会话或视频地址。
const FRESH_MS = 60_000, PLACEHOLDER_MS = 5 * 60_000, MAX_ENTRIES = 40
const copy = value => JSON.parse(JSON.stringify(value))
export function createCompanyReadCache(getScope, now = Date.now) {
 let owner = '', generation = 0
 const entries = new Map(), jobs = new Map()
 function clear() { ++generation; entries.clear(); jobs.clear() }
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
 function peek(key) {
  scope()
  const entry = entries.get(key)
  if (!entry) return null
  const age = now() - entry.at
  if (age < 0 || age >= PLACEHOLDER_MS) { entries.delete(key); return null }
  return { value: copy(entry.value), fresh: age < FRESH_MS }
 }
 async function read(key, load, force = false) {
  const requestScope = scope(), version = generation
  const saved = peek(key)
  if (!force && saved?.fresh) return saved.value
  let job = jobs.get(key)
  if (!job) {
   job = Promise.resolve().then(load).then(value => {
    if (scope() !== requestScope || version !== generation) throw Object.assign(new Error('读取已失效，请重新读取当前身份数据'), { code: 'AGENT_READ_INVALIDATED' })
    if (value?.status !== 'preparing' && !value?.truncated && !value?.coverage?.truncated && !value?.errors?.length) put(key, value)
    else entries.delete(key)
    return value
   }).catch(error => {
    if (version === generation && ([401, 403].includes(error.status ?? error.statusCode) || ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.data?.code))) clear()
    throw error
   }).finally(() => { if (jobs.get(key) === job) jobs.delete(key) })
   jobs.set(key, job)
  }
  return copy(await job)
 }
 return { read, put, peek, clear }
}
