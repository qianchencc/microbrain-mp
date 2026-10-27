#!/usr/bin/env node
// 交付准备（内部工具，自身不进交付）：把某个提交导出成一个"干净单提交"仓库。
// 干净 = 只含生产内容：排除计划/研究/票据/agent 上下文/内部工具 —— 规则由 .gitattributes 的
// export-ignore 定义（git archive 已应用），本脚本再做一次显式核对，防止规则被改坏。
//
// 用法：
//   node tools/deliver.mjs                      # 以 HEAD 生成 /tmp/deliver-<sha>，并打印后续合并/推送命令
//   node tools/deliver.mjs --ref <sha|branch>   # 指定来源
//   node tools/deliver.mjs --out <dir>          # 指定输出目录（默认临时目录，保留供核对）
//   node tools/deliver.mjs --message <text>     # 覆盖提交信息
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

// 与 check-delivery.mjs 同一套禁止路径；命中即说明 .gitattributes 漏了东西。
const FORBIDDEN = [
 [/^(plan|docs|test|tools)\//, '计划/研究/回归/内部工具'],
 [/^\.scratch\//, '本地票据'],
 [/(^|\/)AGENTS\.md$/, 'agent 上下文'],
 [/^CONTEXT\.md$/, '领域上下文'],
 [/^pages\/agent\/proto-[^/]*\.html$/, '交互原型'],
 [/^scripts\/(agent-target-\d+-probe\.ts|obs-audit\.py)$/, '诊断探针'],
 [/^README\.md$/, '内部 README（含交接链接）'],
]

function main(argv) {
 const opts = { ref: 'HEAD', out: '', message: '' }
 for (let i = 0; i < argv.length; i++) {
  const key = argv[i]
  if (key === '--ref') opts.ref = argv[++i]
  else if (key === '--out') opts.out = argv[++i]
  else if (key === '--message') opts.message = argv[++i]
  else { console.error(`未知参数：${key}`); return 2 }
 }
 const source = git(['rev-parse', '--short', opts.ref])
 const dirty = git(['status', '--porcelain'])
 if (dirty) console.warn(`注意：工作区有未提交改动，交付只取 ${source} 的内容。\n`)

 const out = opts.out || mkdtempSync(join(tmpdir(), `deliver-${source}-`))
 if (existsSync(join(out, '.git'))) { console.error(`输出目录已有仓库：${out}`); return 2 }
 const tar = join(tmpdir(), `deliver-${source}.tar`)
 execFileSync('git', ['archive', '--format=tar', '-o', tar, opts.ref])
 execFileSync('mkdir', ['-p', out])
 execFileSync('tar', ['-xf', tar, '-C', out])
 execFileSync('git', ['init', '-q'], { cwd: out })
 execFileSync('git', ['add', '-A'], { cwd: out })
 execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', opts.message || `deliver: ${source} snapshot`], { cwd: out })

 const files = git(['ls-files'], out).split('\n').filter(Boolean)
 const hits = files.filter(path => FORBIDDEN.some(([re]) => re.test(path)))
 console.log(`来源 ${source} → ${out}`)
 console.log(`提交 ${git(['rev-parse', '--short', 'HEAD'], out)}，文件 ${files.length} 个`)
 if (hits.length) {
  console.error(`\n仍有内部产物（${hits.length}）：`)
  for (const path of hits.slice(0, 20)) console.error(`  ${path}`)
  console.error('先修 .gitattributes 的 export-ignore 再交付。')
  return 1
 }
 console.log('核对通过：无计划/研究/票据/agent 上下文/原型/探针/内部 README。\n')
 console.log('后续（在客户仓库执行，不在此代跑）：')
 console.log(`  git fetch ${out} HEAD`)
 console.log('  git merge --allow-unrelated-histories FETCH_HEAD   # 或只取需要的提交')
 console.log('  git ls-tree -r --name-only HEAD | grep -E "^(plan|docs|\\.scratch|test|tools)/|AGENTS\\.md$|^CONTEXT\\.md$"   # 必须为空')
 return 0
}

process.exitCode = main(process.argv.slice(2))
