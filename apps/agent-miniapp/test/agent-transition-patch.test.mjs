import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { patchUniTransitionSource } from '../scripts/patch-uni-transition.mjs'

const source = readFileSync(new URL('../node_modules/@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue', import.meta.url), 'utf8')

test('uni-transition 入场不依赖真机调试会延迟的 80ms timer', () => {
 const patched = patchUniTransitionSource(source)
 const open = patched.match(/open\(\) \{([\s\S]*?)\/\/ 关闭过度动画/)?.[1]
 assert.ok(open)
 assert.doesNotMatch(open, /setTimeout/)
 assert.match(open, /animation\.run\([\s\S]*this\.transform = ''/)
 assert.equal(patchUniTransitionSource(patched), patched, '补丁必须幂等')
})
