import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const transitionPath = fileURLToPath(new URL('../node_modules/@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue', import.meta.url))
const marker = '// Agent miniapp: submit the WeChat animation without a timer and keep declarative style at its final state.'

export function patchUniTransitionSource(source) {
 if (source.includes(marker)) return source
 const openStart = source.indexOf('\t\t\topen() {')
 const closeStart = source.indexOf('\t\t\t// 关闭过度动画', openStart)
 if (openStart < 0 || closeStart < 0) throw new Error('Unsupported @dcloudio/uni-ui uni-transition source; open() not found')
 const open = source.slice(openStart, closeStart)
 const timerBlock = /this\.\$nextTick\(\(\) => \{\s*\/\/ TODO 定时器保证动画完全执行[^\n]*\n\s*this\.timer = setTimeout\(\(\) => \{[\s\S]*?\}, 80\)\s*\}\)/
 const replacement = `this.$nextTick(() => {
\t\t\t\t\t${marker}
\t\t\t\t\tthis.animation = createAnimation(this.config, this)
\t\t\t\t\tthis.tranfromInit(false).step()
\t\t\t\t\tthis.animation.run(() => {
\t\t\t\t\t\tthis.$emit('change', {
\t\t\t\t\t\t\tdetail: this.isShow
\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t\t// animationData owns the active transition; transformStyles must already describe the final frame.
\t\t\t\t\tthis.transform = ''
\t\t\t\t\tthis.opacity = this.styleInit(false).opacity || 1
\t\t\t\t})`
 const patchedOpen = open.replace(timerBlock, replacement)
 if (patchedOpen === open) throw new Error('Unsupported @dcloudio/uni-ui uni-transition source; 80ms open timer not found')
 return source.slice(0, openStart) + patchedOpen + source.slice(closeStart)
}

const source = readFileSync(transitionPath, 'utf8')
const patched = patchUniTransitionSource(source)
if (patched !== source) writeFileSync(transitionPath, patched)
