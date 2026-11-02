const entries = new Map()
let sequence = 0

export function beginAgentEntry(source) {
 const entry = { entry: ++sequence, source, startedAt: Date.now(), stages: [], finished: false }
 entries.set(source, entry)
 return entry.entry
}
export function markAgentEntry(source, stage) {
 let entry = entries.get(source)
 if (!entry || stage === 'activated' && entry.finished) { beginAgentEntry(source); entry = entries.get(source) }
 if (entry.stages.some(item => item.stage === stage)) return
 const sample = { entry: entry.entry, source, stage, elapsedMs: Date.now() - entry.startedAt }
 entry.stages.push(sample)
 if (stage === 'rendered') entry.finished = true
 if (process.env.NODE_ENV === 'development') console.debug('[agent-entry]', sample)
}
export function getAgentEntryTimings(source) { return entries.get(source)?.stages.map(item => ({ ...item })) || [] }
