import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const runtime = 'http://127.0.0.1:3210'
const sdkOrigin = 'https://ncim.577119.com'
const sdkPrefix = '/owner/static/h5player/'
const files = new Map([
 ['/', ['index.html', 'text/html; charset=utf-8']],
 ['/index.html', ['index.html', 'text/html; charset=utf-8']],
 ['/player.html', ['index.html', 'text/html; charset=utf-8']],
 ['/player.js', ['player.js', 'text/javascript; charset=utf-8']],
])

function json(response, status, body) {
 response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
 response.end(JSON.stringify(body))
}

createServer(async (request, response) => {
 const controller = new AbortController()
 response.on('close', () => { if (!response.writableEnded) controller.abort() })
 let stage = 'route'
 try {
  const url = new URL(request.url, 'http://video-player')
  if (!['GET', 'HEAD'].includes(request.method)) {
   return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: '播放服务仅接受 GET 或 HEAD 请求' })
  }
  if (url.pathname === '/healthz') return json(response, 200, { service: 'iot-video-player', status: 'ok' })
  const file = files.get(url.pathname)
  if (file) {
   stage = 'page'
   const content = await readFile(new URL(file[0], import.meta.url))
   response.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
   return response.end(request.method === 'HEAD' ? undefined : content)
  }
  let target, headers = {}
  if (url.pathname.startsWith(sdkPrefix) && /^\/owner\/static\/h5player\/[a-zA-Z0-9_./-]+$/.test(url.pathname)) {
   stage = 'sdk'
   try {
    const content = await readFile(new URL('sdk/' + url.pathname.slice(sdkPrefix.length), import.meta.url))
    const contentType = url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8'
     : url.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
    return response.end(request.method === 'HEAD' ? undefined : content)
   } catch (error) {
    if (error.code !== 'ENOENT') throw error
   }
   target = new URL(url.pathname, sdkOrigin)
  } else if (/^\/api\/agent\/devices\/[^/]+\/video-stream$/.test(url.pathname)) {
   stage = 'stream'
   const authorization = request.headers.authorization || ''
   const tenant = request.headers.tenantcode || ''
   if (!/^Bearer\s+\S+$/i.test(authorization) || /^Bearer\s+local-(development|test)$/i.test(authorization) || !tenant.trim() || tenant.toUpperCase() === 'LOCAL') {
    return json(response, 401, { code: 'UNAUTHORIZED', message: '播放取流需要有效的登录凭据和园区标识，请重新进入' })
   }
   target = new URL(url.pathname + url.search, runtime)
   headers = { Authorization: authorization, Tenantcode: tenant }
  } else {
   return json(response, 404, { code: 'NOT_FOUND', message: '播放服务未提供该资源或接口' })
  }
  const upstream = await fetch(target, {
   method: request.method, headers, redirect: 'error',
   signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
  })
  if (stage === 'sdk' && !upstream.ok) {
   return json(response, 502, { code: 'SDK_RESOURCE_UNAVAILABLE', message: `播放器 SDK 资源读取失败：上游 HTTP ${upstream.status}` })
  }
  response.writeHead(upstream.status, {
   'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
   'cache-control': 'no-store',
   'referrer-policy': 'no-referrer',
  })
  if (request.method === 'HEAD' || !upstream.body) return response.end()
  await pipeline(Readable.fromWeb(upstream.body), response)
 } catch (error) {
  if (controller.signal.aborted) return
  if (response.headersSent) return response.destroy()
  const reason = error.name === 'TimeoutError' ? '连接超时' : (error.cause?.code || error.code || error.name || '原因未确认')
  json(response, 502, { code: 'VIDEO_SERVICE_UNAVAILABLE', message: `${stage === 'sdk' ? '播放器 SDK 资源' : stage === 'stream' ? '播放取流后端' : '播放页面'}读取失败：${reason}` })
 }
}).listen(Number(process.env.PORT || 9415), '127.0.0.1', () => {
 console.log('iot-video-player listening on loopback port ' + (process.env.PORT || 9415))
})
