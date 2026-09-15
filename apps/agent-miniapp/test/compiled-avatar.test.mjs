import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { avatarLayers } from '../pages/agent/avatar.js'
import { renderMarkdown } from '../pages/agent/markdown.mjs'

test('微信构建产物缺少浏览器编码 API 时仍能加载头像和 Markdown', () => {
 const noop = () => ({})
 const context = vm.createContext({
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Page:noop, Component:noop, Behavior:noop, App:noop, getApp:noop,
  getCurrentPages:() => [], wx:{getSystemInfoSync:() => ({platform:'android'})},
  exports:{}
 })
 context.global = context
 assert.equal(vm.runInContext('typeof TextEncoder', context), 'undefined')
 assert.equal(vm.runInContext('typeof atob', context), 'undefined')
 assert.equal(vm.runInContext('typeof btoa', context), 'undefined')
 const root = new URL('../unpackage/dist/build/mp-weixin/', import.meta.url)
 const load = file => vm.runInContext(`(function(exports, require) {\n${readFileSync(new URL(file, root), 'utf8')}\n})(exports, global.require)`, context)
 load('common/vendor.js')
 const vendor = context.exports
 context.exports = {}
 context.require = name => {
  assert.equal(name, '../../common/vendor.js')
  return vendor
 }
 load('pages/agent/avatar.js')
 assert.equal(JSON.stringify(context.exports.avatarLayers('会议室😀')), JSON.stringify(avatarLayers('会议室😀')))
 context.exports = {}
 load('pages/agent/markdown.js')
 const answer = '会议室 **已受理** &amp; &#x1F600;\n\n`<灯>`'
 assert.equal(context.exports.renderMarkdown(answer), renderMarkdown(answer))
})
