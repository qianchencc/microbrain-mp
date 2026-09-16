import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dist = new URL('../unpackage/dist/build/mp-weixin/pages/agent/components/', import.meta.url)
const uniPopupDist = new URL('../unpackage/dist/build/mp-weixin/node-modules/@dcloudio/uni-ui/lib/uni-popup/', import.meta.url)

test('微信构建使用 uni-popup 承担遮罩与过渡，仅在横杆保留渲染层手势', async () => {
	const [wxml, json, js, popupJson] = await Promise.all([
		readFile(new URL('DeviceSheet.wxml', dist), 'utf8'),
		readFile(new URL('DeviceSheet.json', dist), 'utf8'),
		readFile(new URL('DeviceSheet.js', dist), 'utf8'),
		readFile(new URL('uni-popup.json', uniPopupDist), 'utf8'),
	])
	assert.match(json, /uni-popup/)
	assert.match(wxml, /<uni-popup/)
	assert.match(js, /"is-mask-click":!0/)
	assert.match(popupJson, /uni-transition/)
	assert.match(wxml, /module="sheetGesture"/)
	assert.doesNotMatch(wxml, /sheetGesture\.maskStart/)
	assert.match(wxml, /catchtouchstart="\{\{sheetGesture\.handleStart\}\}"/)
	assert.match(wxml, /catchtouchmove="\{\{sheetGesture\.handleMove\}\}"/)
	assert.match(wxml, /catchtouchend="\{\{sheetGesture\.handleEnd\}\}"/)
	assert.doesNotMatch(js, /__dragLog/)
	// ensureOpen/stopReopen 是 setup 内部函数名，会被压缩改名；断言压缩后仍稳定的特征：
	// JS 层调用 popup.open('bottom')、350ms 未可见则重试的定时器、以及取消重试的 clearTimeout。
	assert.match(js, /open\("bottom"\)/)
	assert.match(js, /setTimeout\([\s\S]{0,120},350\)/)
	assert.match(js, /clearTimeout/)
	assert.match(wxml, /if \(dismiss\)[\s\S]*resetHandle\(ownerInstance\)[\s\S]*callMethod\('dismissFromHandle'\)/)
})

test('全部设备面板保持确定高度链，不把可交互内容压成零高', async () => {
	const wxss = await readFile(new URL('DraftSheetLayer.wxss', dist), 'utf8')
	assert.match(wxss, /\.pages[^}]*height:auto/)
})
