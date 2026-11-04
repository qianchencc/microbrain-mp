#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repo = process.cwd()
const roots = ['pages/agent', 'apis/agent', 'test']
const extensions = ['.js', '.mjs', '.vue']
const sourceExtensions = new Set(extensions)
const privatePageModules = new Set([
  'conversation.mjs', 'presentation.mjs', 'composer-drafts.mjs', 'context-link.mjs',
  'task-calendar.mjs', 'task-detail-view.mjs', 'task-presentation.mjs', 'region-calendar.mjs',
  'region-timeline.mjs', 'device-timeline-view.mjs', 'region-device-view.mjs', 'region-sample-tasks.mjs',
  'observation-view.mjs', 'safety-event.mjs', 'video-playback-window.mjs',
  'energy-daily-view.mjs', 'energy-chart.mjs', 'energy-business-view.mjs', 'energy-comparison-view.mjs',
  'meter-report-view.mjs', 'meter-panel-view.mjs', 'monthly-energy-view.mjs',
  'ac-draft.js', 'action-draft-presentation.js', 'device-card-state.js', 'device-roster.js',
  'execution-result-view.js',
  'state-refresh.mjs', 'list-viewport.mjs', 'navigation.mjs', 'region-focus.js', 'agent-menu.mjs',
  'timeline-geometry.mjs', 'timeline-svg.mjs',
])
const errors = []
const files = []

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(file)
  }
}
for (const root of roots) walk(path.join(repo, root))

function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(from), specifier)
  const candidates = [base, ...extensions.map(extension => base + extension), ...extensions.map(extension => path.join(base, `index${extension}`))]
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null
}

const graph = new Map(files.map(file => [file, new Set()]))
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const importPattern = /(?:from|import\s*\(|import)\s*['"]([^'"]+)['"]/g
  let match
  while ((match = importPattern.exec(source))) {
    const specifier = match[1]
    const relative = path.relative(repo, file)
    const isTest = relative.startsWith('test/')
    const privateTestSeam = isTest && source.includes('@boundary-private-test-seam')
    const normalized = specifier.split('?')[0]
    const isAgentBarrel = normalized === '@/apis/agent' || normalized === '@/apis/agent/index.js' || normalized.endsWith('/apis/agent/index.js')
    const isPrivateAgentAdapter = normalized.includes('/apis/agent/') && /(?:request|ndjson|agent-read-cache|report-download|conversation-source|idle-watchdog|stream-errors|index)\.(?:mjs|js)$/.test(normalized)
    const isPageCaller = relative.startsWith('pages/agent/components/') || relative.endsWith('.vue') || isTest
    const privatePageImport = specifier.startsWith('.') && privatePageModules.has(path.basename(normalized))
    if (isAgentBarrel && !(isTest && privateTestSeam)) {
      errors.push(`${relative}: import Agent API through a domain entrypoint, not ${specifier}`)
    }
    if (isPrivateAgentAdapter && !(isTest && privateTestSeam)) {
      errors.push(`${relative}: direct Agent adapter import requires an explicit private test seam marker`)
    }
    if (isPageCaller && privatePageImport && !normalized.includes('/lib/') && !(isTest && privateTestSeam)) {
      errors.push(`${relative}: import page implementation through a domain entrypoint, not ${specifier}`)
    }
    if (specifier.includes('/pages/agent/proto-') || specifier.endsWith('/proto-')) {
      errors.push(`${relative}: production code must not import prototype material (${specifier})`)
    }
    const target = resolveImport(file, specifier)
    if (target && graph.has(target)) graph.get(file).add(target)
  }
}

let sequence = 0
const stack = []
const active = new Set()
const index = new Map()
const lowlink = new Map()
function visit(file) {
  index.set(file, sequence)
  lowlink.set(file, sequence)
  sequence += 1
  stack.push(file)
  active.add(file)
  for (const dependency of graph.get(file)) {
    if (!index.has(dependency)) {
      visit(dependency)
      lowlink.set(file, Math.min(lowlink.get(file), lowlink.get(dependency)))
    } else if (active.has(dependency)) {
      lowlink.set(file, Math.min(lowlink.get(file), index.get(dependency)))
    }
  }
  if (lowlink.get(file) === index.get(file)) {
    const component = []
    let member
    do {
      member = stack.pop()
      active.delete(member)
      component.push(member)
    } while (member !== file)
    if (component.length > 1) errors.push(`circular dependency: ${component.map(item => path.relative(repo, item)).join(' -> ')}`)
  }
}
for (const file of files) if (!index.has(file)) visit(file)

if (errors.length) {
  console.error(errors.map(error => `✖ ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`Agent boundaries OK (${files.length} source files; no API barrel imports, prototype imports, or cycles)`)
}
