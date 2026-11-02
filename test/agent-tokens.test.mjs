// 校验物联助手三个 token 来源保持一致：
// pages/agent/styles/_tokens.scss（SCSS 编译期）、tokens.css（CSS 变量）、colors.js（JS 字面量）。
// 防止三者漂移；任一处增删改颜色都必须同步另外两处。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(root, p), 'utf8')

const scss = read('pages/agent/styles/_tokens.scss')
const css = read('pages/agent/styles/tokens.css')
const { AGENT_COLORS } = await import(join(root, 'pages/agent/styles/colors.js'))

const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())

test('每个 SCSS $agent-color-* 变量在 tokens.css 中有同值 --agent-*', () => {
  const pairs = [...scss.matchAll(/\$agent-color-([\w-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\));/g)]
  assert.ok(pairs.length >= 10, '应至少解析出 10 个颜色变量')
  for (const [, name, value] of pairs) {
    const v = value.toLowerCase()
    const decl = new RegExp(`--agent-${name}:\\s*([^;]+);`).exec(css)
    assert.ok(decl, `tokens.css 缺少 --agent-${name}`)
    assert.equal(decl[1].trim().toLowerCase(), v, `--agent-${name} 值不一致`)
  }
})

test('AGENT_COLORS 与 tokens.css 一一对应', () => {
  for (const [key, value] of Object.entries(AGENT_COLORS)) {
    const name = kebab(key)
    const decl = new RegExp(`--agent-${name}:\\s*([^;]+);`).exec(css)
    assert.ok(decl, `tokens.css 缺少 --agent-${name}`)
    assert.equal(decl[1].trim().toLowerCase(), value.toLowerCase(), `AGENT_COLORS.${key} 值不一致`)
  }
})

test('SCSS 三元组变量与 CSS var 一致', () => {
  for (const [, name, value] of scss.matchAll(/\$agent-([\w-]*rgb):\s*([\d,\s]+);/g)) {
    const decl = new RegExp(`--agent-${name}:\\s*([^;]+);`).exec(css)
    assert.ok(decl, `tokens.css 缺少 --agent-${name}`)
    assert.equal(decl[1].trim(), value.trim(), `--agent-${name} 值不一致`)
  }
})

test('token 文件自身不引入已废弃的深绿品牌色', () => {
  assert.ok(!/176b54/i.test(scss), 'tokens.scss 不应再含深绿')
  assert.ok(!/176b54/i.test(css), 'tokens.css 不应再含深绿')
})
