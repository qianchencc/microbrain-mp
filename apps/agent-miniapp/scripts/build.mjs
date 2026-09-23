import './patch-uni-transition.mjs'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const compiler = process.env.UNI_COMPILER_DIR || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite'
const entry = path.join(compiler, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js')
const bundledNode = path.resolve(compiler, '../node/node')
const compilerNode = process.env.UNI_NODE_BIN || (existsSync(bundledNode) ? bundledNode : process.execPath)
if (!existsSync(entry)) throw new Error('Install HBuilderX Vue 3 compiler or set UNI_COMPILER_DIR')
const result = spawnSync(compilerNode, [entry, 'build', '-p', 'mp-weixin'], {
  cwd: compiler,
  stdio: 'inherit',
  env: { ...process.env, UNI_INPUT_DIR: root, UNI_OUTPUT_DIR: path.join(root, 'unpackage/dist/build/mp-weixin'), UNI_PLATFORM: 'mp-weixin' }
})
if (result.error) throw result.error
process.exit(result.status ?? 1)