import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const transitionSource = readFileSync(new URL('../uni_modules/uni-transition/components/uni-transition/uni-transition.vue', import.meta.url), 'utf8')
const sheetSource = readFileSync(new URL('../pages/agent/components/DeviceSheet.vue', import.meta.url), 'utf8')
const draftSheetSource = readFileSync(new URL('../pages/agent/components/DraftSheetLayer.vue', import.meta.url), 'utf8')
const draftCardSource = readFileSync(new URL('../pages/agent/components/ActionDraftCard.vue', import.meta.url), 'utf8')

test('项目通用 uni-transition 入场不依赖会被开发者工具延迟的定时器', () => {
	const open = transitionSource.match(/open\(\) \{([\s\S]*?)\/\/ 关闭过度动画/)?.[1]
	assert.ok(open)
	assert.doesNotMatch(open, /setTimeout/, 'uni-popup 会先显示遮罩；内容层动画若等待 timer 会停在 translateY(100%) 屏外')
	assert.match(open, /animation\.run\([\s\S]*?this\.transform = ''/, 'animationData 接管动画时，声明式样式必须已回到最终帧')
})

test('Agent 面板进退场、横杆拖拽和遮罩由同一组件控制', () => {
 assert.doesNotMatch(sheetSource, /<uni-popup\b|lang="wxs"|ownerInstance|change:surface-reset/)
 assert.match(sheetSource, /@touchstart\.stop="onTouchStart"/)
 assert.match(sheetSource, /@touchmove\.stop\.prevent="onTouchMove"/)
 assert.match(sheetSource, /@touchend\.stop="onTouchEnd"/)
 assert.match(sheetSource, /@tap\.stop="dismissFromMask"/)
 assert.match(sheetSource, /transform: open\.value \? `translateY\(\$\{dragY\.value\}px\)` : 'translateY\(100%\)'/)
 assert.match(sheetSource, /opacity: open\.value \? Math\.max\(0, 1 - dragY\.value \/ 500\) : 0/)
 assert.match(sheetSource, /\.sheet-root\s*\{[^}]*pointer-events:none/)
 assert.match(sheetSource, /\.sheet-root--open \.sheet-mask\s*\{[^}]*pointer-events:auto/)
})

test('操作草案不再携带已退役的模拟数据源文案', () => {
	assert.doesNotMatch(draftCardSource, /simulation|模拟状态/)
})

test('设备面板确认浮层不重复占用底部安全区', () => {
	assert.match(draftSheetSource, /\.confirm-float \{ padding:14px 20px 10px; background:linear-gradient\(to bottom, rgba\(252,253,252,0\), #fcfdfc 42%\); \}/)
})
