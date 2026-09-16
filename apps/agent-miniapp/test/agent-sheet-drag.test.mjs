import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldDismissSheet } from '../pages/agent/sheet-drag.mjs'

test('拖过面板高 25% 无论动量如何都收起；向上拖不收起', () => {
	assert.equal(shouldDismissSheet(200, 0, 700), true)   // 200 > 175
	assert.equal(shouldDismissSheet(160, 0, 700), false)  // 160 < 175
	assert.equal(shouldDismissSheet(-220, 0, 700), false)
})

test('带位移的向下轻扫收起；向上甩（flick 为负）不收起', () => {
	assert.equal(shouldDismissSheet(40, 1.2, 700), true)
	assert.equal(shouldDismissSheet(-30, -0.9, 700), false)
})

test('鼠标点击合成的高速度微抖（位移≈0）不收起', () => {
	assert.equal(shouldDismissSheet(2, 1.5, 700), false)
	assert.equal(shouldDismissSheet(0, 4, 700), false)
})

test('小位移低速度弹回', () => {
	assert.equal(shouldDismissSheet(12, 0.2, 700), false)
})

test('panelHeight 缺省兜底（800px → 200px 阈值）', () => {
	assert.equal(shouldDismissSheet(220, 0), true)
	assert.equal(shouldDismissSheet(190, 0), false)
})
