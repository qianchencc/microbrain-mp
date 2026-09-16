import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const dist = fileURLToPath(new URL('../unpackage/dist/build/mp-weixin', import.meta.url))
const WEIXIN_UPLOAD_LIMIT = 4 * 1024 * 1024

async function packageSize(path) {
	const entry = await stat(path)
	if (!entry.isDirectory()) return entry.size
	const children = await readdir(path)
	return (await Promise.all(children.map(child => packageSize(join(path, child))))).reduce((sum, size) => sum + size, 0)
}

test('微信构建产物低于真机调试 4MB 上传上限', async () => {
	const size = await packageSize(dist)
	assert.ok(size < WEIXIN_UPLOAD_LIMIT, `构建产物 ${size}B 超过 ${WEIXIN_UPLOAD_LIMIT}B`)
})

test('真机构建不得把后端指向本机 loopback 地址', async () => {
	const config = await readFile(join(dist, 'config/index.js'), 'utf8')
	assert.doesNotMatch(config, /127\.0\.0\.1|localhost/)
})
