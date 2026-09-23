import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const transitionSource = readFileSync(new URL('../uni_modules/uni-transition/components/uni-transition/uni-transition.vue', import.meta.url), 'utf8')
const popupSource = readFileSync(new URL('../uni_modules/uni-popup/components/uni-popup/uni-popup.vue', import.meta.url), 'utf8')
const sheetSource = readFileSync(new URL('../pages/agent/components/DeviceSheet.vue', import.meta.url), 'utf8')
const draftCardSource = readFileSync(new URL('../pages/agent/components/ActionDraftCard.vue', import.meta.url), 'utf8')

test('客户版 uni-transition 入场不依赖会被开发者工具延迟的定时器', () => {
	const open = transitionSource.match(/open\(\) \{([\s\S]*?)\/\/ 关闭过度动画/)?.[1]
	assert.ok(open)
	assert.doesNotMatch(open, /setTimeout/, 'uni-popup 会先显示遮罩；内容层动画若等待 timer 会停在 translateY(100%) 屏外')
	assert.match(open, /animation\.run\([\s\S]*?this\.transform = ''/, 'animationData 接管动画时，声明式样式必须已回到最终帧')
})

test('客户版底部面板保留每次打开前的渲染层位移复位与重开请求', () => {
	for (const marker of ['openRequest', 'surfaceReset', 'change:surface-reset', "open('bottom')", '350']) {
		assert.ok(sheetSource.includes(marker), `DeviceSheet.vue 缺少 ${marker}`)
	}
})

test('操作草案不再携带已退役的模拟数据源文案', () => {
	assert.doesNotMatch(draftCardSource, /simulation|模拟状态/)
})
