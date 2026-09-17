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

test('微信构建保留每次菜单点击独立触发的重开请求', async () => {
	const [pageJs, layerJs, sheetJs] = await Promise.all([
		readFile(new URL('../index.js', dist), 'utf8'),
		readFile(new URL('DraftSheetLayer.js', dist), 'utf8'),
		readFile(new URL('DeviceSheet.js', dist), 'utf8'),
	])
	assert.match(pageJs, /"open-request":\w+\.value/)
	assert.match(layerJs, /openRequest:\{type:Number,default:0\}/)
	assert.match(sheetJs, /openRequest:\{type:Number,default:0\}/)
	assert.match(sheetJs, /\[\w+\.open,\w+\.openRequest\]/)
})

test('全部设备面板保持确定高度链，不把可交互内容压成零高', async () => {
	const wxss = await readFile(new URL('DraftSheetLayer.wxss', dist), 'utf8')
	assert.match(wxss, /\.pages[^}]*height:auto/)
})

test('可配置设备卡保留滚动取消，并由原生长按可靠完成参数配置', async () => {
	const wxml = await readFile(new URL('DeviceActionCard.wxml', dist), 'utf8')
	assert.match(wxml, /bindtouchstart=/)
	assert.match(wxml, /bindtouchmove=/)
	assert.match(wxml, /bindtouchend=/)
	assert.match(wxml, /bindlongpress=/)
	assert.doesNotMatch(wxml, /catchtouch(?:start|move|end)=/)
})

test('全部设备使用单一固定规格网格，并以页面轨道进入参数编辑器', async () => {
	const [wxml, wxss] = await Promise.all([
		readFile(new URL('DraftSheetLayer.wxml', dist), 'utf8'),
		readFile(new URL('DraftSheetLayer.wxss', dist), 'utf8'),
	])
	assert.equal(wxml.match(/<device-action-card/g)?.length, 1)
	assert.match(wxml, /devices-surface/)
	assert.match(wxml, /editor-surface/)
	assert.match(wxml, /header-viewport/)
	assert.match(wxss, /grid device-action-card[^}]*width:119px/)
	assert.match(wxss, /editor-surface[^}]*translate\(100%\)/)
	assert.match(wxss, /editing .*editor-surface[^}]*translate\(0\)/)
	assert.match(wxss, /pages[^}]*isolation:isolate/)
	assert.match(wxss, /devices-surface[^}]*z-index:0/)
	assert.match(wxss, /editor-surface[^}]*z-index:1[^}]*background:#fcfdfc/)
	assert.doesNotMatch(wxml, /<swiper/)
})

test('滚动浮标编译进面板：scroll-view 回传位置、浮标与底缘渐隐按剩余数显隐', async () => {
	const [wxml, wxss, assets] = await Promise.all([
		readFile(new URL('DraftSheetLayer.wxml', dist), 'utf8'),
		readFile(new URL('DraftSheetLayer.wxss', dist), 'utf8'),
		readFile(new URL('../../../common/assets.js', dist), 'utf8'),
	])
	assert.match(wxml, /bindscroll=/)
	assert.match(wxml, /scroll-top=/)
	assert.match(wxml, /scroll-with-animation/)
	assert.match(wxml, /cue-float/)
	assert.match(wxml, /scroll-fade/)
	assert.match(assets, /chevron-down\.svg/)
	assert.match(wxss, /\.cue-float[^}]*position:absolute/)
	assert.match(wxss, /\.cue-float\.off[^}]*pointer-events:none/)
	assert.match(wxss, /\.scroll-fade[^}]*pointer-events:none/)
	assert.match(wxss, /\.group-title[^}]*line-height:17px/)
})
