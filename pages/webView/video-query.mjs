// uni-app 页面参数可能已解码；视频页重新组装时必须保护时区的 + 和名称中的 &。
const decode = value => { try { return decodeURIComponent(String(value)) } catch { return String(value) } }
export function videoPageUrl(options) {
 // 一个JSON目标区分页面尚未解码与已经解码，保留名称本来的%2F。
 if (options.videoTarget) {
  let target
  try { target = JSON.parse(String(options.videoTarget)) } catch { target = JSON.parse(decode(options.videoTarget)) }
  options = { ...options, deviceId: target.deviceId, name: target.name, loc: target.loc }
 }
 const [path, hash] = decode(options.path).split('#')
 const query = []
 for (const key of ['deviceId', 'source', 'mode', 'name', 'loc', 'api', 'beginTime', 'endTime', 'eventTime', 'token', 'tenantCode', 'timestamp']) {
  if (options[key] == null) continue
  const value = ['token', 'tenantCode', 'timestamp', 'deviceId', 'name', 'loc'].includes(key) ? String(options[key]) : decode(options[key])
  query.push(`${key}=${encodeURIComponent(value)}`)
 }
 return path + (path.includes('?') ? '&' : '?') + query.join('&') + (hash ? '#' + hash : '')
}
