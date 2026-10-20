import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

// 包体保护：微信预览/上传限制为单包 2M。此前设备图未压缩 + 无分包导致预览失败。
test('device-art 图片保持压缩尺寸', () => {
  const dir = resolve(root, 'static/device-art')
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.png')) continue
    const size = statSync(resolve(dir, name)).size
    assert.ok(size < 80 * 1024, `${name} 超过 80KB，请压缩后再提交（320px 宽调色板 PNG）`)
  }
})

test('mp-html 不携带未使用的 katex/latex 插件', () => {
  const katex = resolve(root, 'uni_modules/zero-markdown-view/components/mp-html/latex/katex.min.js')
  assert.ok(!existsSync(katex), 'katex.min.js 回来了：本应用不渲染公式，请从 mp-html 插件中移除 latex')
  const src = readFileSync(resolve(root, 'uni_modules/zero-markdown-view/components/mp-html/mp-html.vue'), 'utf8')
  assert.doesNotMatch(src, /latex/, 'mp-html 插件列表不得重新引入 latex')
})

test('agent 页面保持在分包内，主包 pages 不含 agent 路径', () => {
  const raw = readFileSync(resolve(root, 'pages.json'), 'utf8').replace(/\/\/[^\n]*/g, '')
  const pages = JSON.parse(raw)
  assert.ok(
    pages.subPackages?.some(sp => sp.root === 'pages/agent' && sp.pages.some(p => p.path === 'index')),
    'pages/agent 必须以分包形式声明，否则主包超限导致预览失败'
  )
  assert.ok(
    pages.pages.every(p => !p.path.startsWith('pages/agent')),
    'pages/agent 页面不得回到主包 pages 数组'
  )
})
