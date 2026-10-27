#!/usr/bin/env node
// 客户交付边界检查（内部工具，本身不随交付进入客户仓库）。
// 用法：
//   node tools/check-delivery.mjs --base origin/新世纪办公室   合并前：列出会进入客户仓库的禁止路径
//   node tools/check-delivery.mjs --tree <ref>                检查准备交付的分支/提交树是否干净
//   node tools/check-delivery.mjs --worktree                  检查当前工作区（含未跟踪文件）是否有禁止路径
// 退出码 1 表示存在禁止交付路径。
import { execFileSync } from 'node:child_process'

const RULES = [
 [/^plan\//, '内部计划与交接（技能产出）'],
 [/^docs\//, '内部研究/ADR/验收底稿'],
 [/^\.scratch\//, '本地票据与规格'],
 [/^test\//, '内部回归测试'],
 [/(^|\/)AGENTS\.md$/, 'agent 上下文文件'],
 [/^CONTEXT\.md$/, '领域上下文'],
 [/^tools\//, '内部工具（含本脚本）'],
 [/^pages\/agent\/proto-[^/]*\.html$/, '交互原型（位于生产目录内，最易被顺带复制）'],
]

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)

function paths(mode, ref) {
 if (mode === 'tree') return git('ls-tree', '-r', '--name-only', ref)
 if (mode === 'worktree') return [...git('ls-files'), ...git('ls-files', '--others', '--exclude-standard')]
 return git('diff', '--name-only', '--diff-filter=AMR', `${ref}...HEAD`)
}

function main(argv) {
 let mode = 'base', ref = 'origin/新世纪办公室'
 for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tree') { mode = 'tree'; ref = argv[++i] }
  else if (argv[i] === '--worktree') mode = 'worktree'
  else if (argv[i] === '--base') ref = argv[++i]
  else { console.error(`未知参数：${argv[i]}`); return 2 }
 }
 if (mode !== 'worktree' && !ref) { console.error('缺少 ref'); return 2 }

 const list = paths(mode, ref), hits = new Map()
 for (const path of list) {
  const rule = RULES.find(([re]) => re.test(path))
  if (!rule) continue
  if (!hits.has(rule[1])) hits.set(rule[1], [])
  hits.get(rule[1]).push(path)
 }
 const label = mode === 'worktree' ? '当前工作区（含未跟踪）' : mode === 'tree' ? `提交树 ${ref}` : `合并 ${ref}...HEAD`
 const total = [...hits.values()].reduce((sum, rows) => sum + rows.length, 0)
 console.log(`客户交付检查：${label}，共 ${list.length} 条路径，禁止交付 ${total} 条`)
 if (!total) { console.log('通过：没有内部产物会进入客户仓库。'); return 0 }
 for (const [why, rows] of hits) {
  console.log(`\n${why}：${rows.length} 条`)
  for (const row of rows.slice(0, 8)) console.log(`  ${row}`)
  if (rows.length > 8) console.log(`  …另 ${rows.length - 8} 条`)
 }
 return 1
}

process.exitCode = main(process.argv.slice(2))
