import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dist = new URL('../unpackage/dist/build/mp-weixin/pages/agent/components/', import.meta.url)
const uniPopupDist = new URL('../unpackage/dist/build/mp-weixin/node-modules/@dcloudio/uni-ui/lib/uni-popup/', import.meta.url)
const uniTransitionDist = new URL('../unpackage/dist/build/mp-weixin/node-modules/@dcloudio/uni-ui/lib/uni-transition/', import.meta.url)

test('微信构建使用 uni-popup 承担遮罩与过渡，仅在横杆保留渲染层手势', async () => {
	const [wxml, json, js, popupJson, transitionJs] = await Promise.all([
		readFile(new URL('DeviceSheet.wxml', dist), 'utf8'),
		readFile(new URL('DeviceSheet.json', dist), 'utf8'),
		readFile(new URL('DeviceSheet.js', dist), 'utf8'),
		readFile(new URL('uni-popup.json', uniPopupDist), 'utf8'),
		readFile(new URL('uni-transition.js', uniTransitionDist), 'utf8'),
	])
	assert.match(json, /uni-popup/)
	assert.match(wxml, /<uni-popup/)
	assert.match(js, /"is-mask-click":!0/)
	assert.match(popupJson, /uni-transition/)
	assert.doesNotMatch(transitionJs, /setTimeout/, '真机调试会延迟 transition 的 80ms 入场 timer，面板会卡在屏外直到下一次点击')
	assert.match(wxml, /module="sheetGesture"/)
	assert.doesNotMatch(wxml, /sheetGesture\.maskStart/)
	assert.match(wxml, /catchtouchstart="\{\{sheetGesture\.handleStart\}\}"/)
	assert.match(wxml, /catchtouchmove="\{\{sheetGesture\.handleMove\}\}"/)
	assert.match(wxml, /catchtouchend="\{\{sheetGesture\.handleEnd\}\}"/)
	assert.doesNotMatch(js, /__dragLog/)
	// ensureOpen/stopReopen 是 setup 内部函数名，会被压缩改名；断言压缩后仍稳定的特征：
	// JS 层调用 popup.open('bottom')、350ms 未可见则重试的定时器、以及取消重试的 clearTimeout。
	assert.match(js, /open\("bottom"\)/)
	assert.match(js, /setTimeout\([\s\S]{0,300},350\)/)
	assert.match(js, /clearTimeout/)
	// 重试按真实 popup 状态对账：showPopup && showTrans 均为真才视为物理层仍在展示并校正影子态
	assert.match(js, /showPopup[\s\S]{0,60}showTrans/)
	// 拖拽收起保留松手位移交给外层 slide-bottom（先回写 translateY(0) 会叠出「上窜再收起」的反向运动）；
	// 位移随 popup 子树 v-if 卸载消失，无需复位。resetHandle 只保留在未达阈值的回弹分支。
	assert.match(wxml, /if \(dismiss\)\s*\{[^}]*callMethod\('dismissFromHandle'\)[^}]*\}\s*else resetHandle\(ownerInstance\)/)
	assert.doesNotMatch(wxml, /if \(dismiss\)\s*\{[^}]*resetHandle/)
	// 底部锚定面板只允许下拉；上拉必须保持 translateY(0)，不得抬起底缘漏出背景
	assert.match(wxml, /handleOffset\s*=\s*delta\s*>\s*0\s*\?\s*Math\.round\(delta\)\s*:\s*0/)
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

test('可配置设备卡保留滚动取消，且长按等原触摸序列结束后才打开面板', async () => {
	const [wxml, js] = await Promise.all([
		readFile(new URL('DeviceActionCard.wxml', dist), 'utf8'),
		readFile(new URL('DeviceActionCard.js', dist), 'utf8'),
	])
	assert.match(wxml, /bindtouchstart=/)
	assert.match(wxml, /bindtouchmove=/)
	assert.match(wxml, /bindtouchend=/)
	assert.match(wxml, /bindlongpress=/)
	assert.doesNotMatch(wxml, /catchtouch(?:start|move|end)=/)
	assert.match(js, /"released"===\w+[\s\S]{0,80}"configure"/, 'configure 必须由 released terminal 状态触发，不得在手指仍按住时挂载 popup')
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
