#!/usr/bin/env node
/** Local-only migration evidence planner. It never writes the source or calls a network. */
import fs from 'node:fs'
import crypto from 'node:crypto'

export const DENYLIST = new Set([
  'write', 'control', 'scanner', 'notification', 'admin_apply',
  'device_control', 'production_write', 'runtime_scan'
])

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function validateRecords(records, { source = 'local-fixture', retry = false } = {}) {
  const errors = []
  const accepted = []
  const seen = new Set()
  let previous = 0
  for (const [index, record] of records.entries()) {
    const at = index + 1
    if (!record || typeof record !== 'object') { errors.push({ at, code: 'record_not_object' }); break }
    const { id, version, sequence } = record
    if (typeof id !== 'string' || !id) { errors.push({ at, code: 'identity_missing' }); break }
    if (!Number.isInteger(version) || version < 1) { errors.push({ at, code: 'version_invalid', id }); break }
    if (!Number.isInteger(sequence) || sequence < 1) { errors.push({ at, code: 'sequence_invalid', id }); break }
    if (DENYLIST.has(String(record.operation ?? record.payload?.kind ?? '').toLowerCase())) { errors.push({ at, code: 'unsupported_write', operation: record.operation ?? record.payload?.kind }); break }
    const key = `${id}@${version}`
    if (seen.has(key)) {
      if (retry) continue
      errors.push({ at, code: 'duplicate_identity_version', key }); break
    }
    if (sequence <= previous) { errors.push({ at, code: 'sequence_not_increasing', sequence, previous }); break }
    seen.add(key); previous = sequence
    accepted.push({ id, version, sequence, payloadHash: hash(record.payload ?? null) })
  }
  return { source, mode: 'dry-run', accepted, errors, stopped: errors.length > 0, sourceOverwritten: false }
}

export function buildRecoveryPlan(records, validation) {
  const last = validation.accepted.at(-1)?.sequence ?? 0
  return records.filter(r => Number.isInteger(r?.sequence) && r.sequence > last)
    .map(r => ({ id: r.id, version: r.version, sequence: r.sequence, action: 'append-only' }))
}

export function normalizeShadow(value) {
  if (Array.isArray(value)) return value.map(normalizeShadow)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const key of Object.keys(value).sort()) {
    if (key === 'timestamp' || key === 'traceId' || key === 'requestId') continue
    const normalizedKey = key.toLowerCase().replaceAll('-', '_')
    if (DENYLIST.has(normalizedKey) || [...DENYLIST].some(d => normalizedKey.includes(d))) continue
    out[normalizedKey] = normalizeShadow(value[key])
  }
  return out
}

export function compareShadow(reference, candidate) {
  const left = normalizeShadow(reference)
  const right = normalizeShadow(candidate)
  return { equal: JSON.stringify(left) === JSON.stringify(right), reference: left, candidate: right, denied: [...DENYLIST] }
}

export function ownerRestartTrace(events) {
  return events.map((event, index) => ({ step: index + 1, owner: event.owner, event: event.event, restart: Boolean(event.restart) }))
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const input = process.argv[2]
  if (!input) { console.error('usage: node tools/migration-ticket-21.mjs <records.jsonl>'); process.exit(2) }
  const records = fs.readFileSync(input, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
  const validation = validateRecords(records)
  const output = { validation, recovery: buildRecoveryPlan(records, validation), planHash: hash(validation.accepted) }
  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}
