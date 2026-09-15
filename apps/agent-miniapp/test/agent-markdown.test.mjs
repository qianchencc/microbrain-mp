import test from 'node:test'
import assert from 'node:assert/strict'
import {renderMarkdown} from '../pages/agent/markdown.mjs'

test('代码块和行内代码有独立样式且转义内容', () => {
 for (const source of ['```html\n<script>alert(1)</script>```']) {
  const html = renderMarkdown(source)
  assert.match(html,/<pre style="[^"]*overflow-x:auto/)
  assert.match(html,/<code style="font-size:13px">&lt;script&gt;/)
  assert.doesNotMatch(html,/<script>/)
 }
 assert.match(renderMarkdown('`<b>`'),/<code style="font-size:13px">&lt;b&gt;<\/code>/)
})

test('表格、图片和标题使用与原版对应的内联样式', () => {
 const html = renderMarkdown('# 标题\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![x](y.png)')
 assert.match(html,/<h1 style="[^"]*line-height:1.5/)
 assert.match(html,/<table style="display:block;overflow-x:auto/)
 assert.match(html,/<td style="padding:6px 12px;/)
 assert.match(html,/<img [^>]*style="max-width:100%"/)
})

test('普通回答不允许原始 HTML 或脚本链接', () => {
 const html = renderMarkdown('<img src=x onerror=alert(1)>[b](javascript:alert(2))')
 assert.doesNotMatch(html,/<img|href="javascript:/)
 assert.match(html,/&lt;img/)
 assert.equal(renderMarkdown(''),'')
})