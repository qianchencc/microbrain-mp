import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldDismissSheet } from '../pages/agent/sheet-drag.mjs'

test('拖过约 1/3 高度（>200px）无论动量如何都收起', () => {
	assert.equal(shouldDismissSheet(220, 0), true)
	assert.equal(shouldDismissSheet(-220, 0), true)
})

test('带位移的向下轻扫收起；向上甩（flick 为负）不收起', () => {
	assert.equal(shouldDismissSheet(40, 1.2), true)
	assert.equal(shouldDismissSheet(-30, -0.9), false)
})

test('鼠标点击合成的高速度微抖（位移≈0）不收起', () => {
	assert.equal(shouldDismissSheet(2, 1.5), false)
	assert.equal(shouldDismissSheet(0, 4), false)
})

test('小位移低速度弹回', () => {
	assert.equal(shouldDismissSheet(12, 0.2), false)
})
