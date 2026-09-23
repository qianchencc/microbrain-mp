import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dist = new URL('../unpackage/dist/build/mp-weixin/pages/agent/components/', import.meta.url)

test('设备卡 before→after 为纵向两行单行省略，禁止横向 flex 压缩成逐字竖排', async () => {
	const [wxml, wxss] = await Promise.all([
		readFile(new URL('DeviceActionCard.wxml', dist), 'utf8'),
		readFile(new URL('DeviceActionCard.wxss', dist), 'utf8'),
	])
	const change = wxss.match(/\.change\s*\{[^}]*\}/)?.[0] ?? ''
	assert.doesNotMatch(change, /display:flex|flex-wrap/, '.change 不得再用可换行 flex 行承载文本')
	assert.match(wxss, /\.from[\w.-]*,\s*\.to[\w.-]*\s*\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis[^}]*\}/, 'from/to 必须各自单行省略')
	assert.match(wxml, /class="arrow[\w -]*">→</, '目标行以文本箭头引导，不依赖字体图标')
	assert.doesNotMatch(wxml, /arrowthinright/)
})
