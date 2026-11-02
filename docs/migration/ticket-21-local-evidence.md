# Ticket 21 — local migration evidence

Status: **implemented locally** (dry-run validation, import-plan output, normalized shadow comparison, and process-owner trace fixture). This is not a production migration and does not claim complete 66/69 parity.

## Reproducible local evidence

The only input is [`ticket-21-fixture.jsonl`](./ticket-21-fixture.jsonl). Run from the repository root:

```sh
node tools/migration-ticket-21.mjs docs/migration/ticket-21-fixture.jsonl
```

The command reads JSONL and prints JSON; it does not open a socket, contact Runtime, mutate MySQL/Redis/SQLite, or overwrite the source file. A validation error stops the import plan at the first bad record. Identity (`id`), positive integer `version`, and strictly increasing `sequence` are required. Replaying an already accepted identity/version is allowed only with `retry: true` when the module API is used; the CLI defaults to fail-closed duplicate detection.

Recovery is append-only: it contains only records with a sequence greater than the last accepted sequence. There is no in-place repair or source overwrite path.

## Shadow comparison boundary

`normalizeShadow` removes volatile `timestamp`, `traceId`, and `requestId` fields and applies an explicit denylist. The denylist is:

- `write`, `control`, `scanner`, `notification`, `admin_apply`
- `device_control`, `production_write`, `runtime_scan`

Keys containing a denylisted operation are excluded before deterministic comparison. This is a read-only comparison aid, not authorization, and must not be used to enable writes.

## Owner/restart trace

`ownerRestartTrace` accepts deterministic local events (`owner`, `event`, and optional `restart`) and numbers them in process order. It records ownership and restart boundaries only; it does not launch, stop, or supervise a production process. No production URL, token, customer data, or Runtime dependency is part of this evidence.

## Exact limits

- The fixture intentionally includes a duplicate identity/version and a control-shaped record to demonstrate stop-on-error; it is not a full migration corpus.
- No database import, network validation, process restart, or customer-production verification is implemented here.
- This evidence covers local planning behavior only and does **not** establish 66/69 parity or any production readiness claim.
