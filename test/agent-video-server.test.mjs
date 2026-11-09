import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

test('the video server serves the deployed decoder when the customer SDK origin is unavailable', async t => {
 const directory = await mkdtemp(join(tmpdir(), 'video-sdk-'))
 t.after(() => rm(directory, { recursive: true, force: true }))
 await copyFile(new URL('../deploy/h5player/serve.mjs', import.meta.url), join(directory, 'serve.mjs'))
 await mkdir(join(directory, 'sdk/playctrl1simd'), { recursive: true })
 await writeFile(join(directory, 'sdk/playctrl1simd/Decoder.js'), '/*' + 'decoder resource '.repeat(200) + '*/self.decoderReady = true;')
 const reservation = createServer()
 reservation.listen(0, '127.0.0.1')
 await once(reservation, 'listening')
 const port = reservation.address().port
 await new Promise(resolve => reservation.close(resolve))
 const offline = 'data:text/javascript,' + encodeURIComponent('globalThis.fetch = async () => new Response("Unavailable", {status:503})')
 const child = spawn(process.execPath, ['--import', offline, join(directory, 'serve.mjs')], {
  env: { ...process.env, PORT: String(port), SDK_ROOT: '' }, stdio: ['ignore', 'pipe', 'pipe'],
 })
 t.after(async () => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  child.kill()
  await exited
 })
 await once(child.stdout, 'data', { signal: AbortSignal.timeout(5000) })
 const origin = `http://127.0.0.1:${port}`
 const response = await fetch(origin + '/owner/static/h5player/playctrl1simd/Decoder.js', { headers: { 'accept-encoding': 'gzip' } })
 assert.equal(response.status, 200)
 assert.match(response.headers.get('content-type'), /javascript/)
 assert.equal(response.headers.get('content-encoding'), 'gzip')
 assert.match(response.headers.get('vary'), /Accept-Encoding/i)
 const self = {}
 runInNewContext(await response.text(), { self })
 assert.equal(self.decoderReady, true, 'The delivered decoder must still be executable after decompression')
 const cached = await fetch(origin + '/owner/static/h5player/playctrl1simd/Decoder.js', { headers: { 'if-none-match': response.headers.get('etag') } })
 assert.equal(cached.status, 304, 'An unchanged decoder must be revalidated without downloading its body again')
 assert.equal(await cached.text(), '')
 const head = await fetch(origin + '/owner/static/h5player/playctrl1simd/Decoder.js', { method: 'HEAD' })
 assert.equal(head.status, 200)
 assert.equal(await head.text(), '')
 const missing = await fetch(origin + '/owner/static/h5player/not-mirrored.js')
 assert.equal(missing.status, 502, 'a missing mirror retains the upstream proxy and its explicit failure')
 assert.equal((await missing.json()).code, 'SDK_RESOURCE_UNAVAILABLE')
 assert.equal((await fetch(origin + '/api/agent/devices/camera/video-stream?source=company')).status, 401)
 assert.equal((await fetch(origin + '/api/admin/config')).status, 404)
})
