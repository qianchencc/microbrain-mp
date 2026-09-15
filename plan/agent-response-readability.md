# Agent response readability

## Follow-up After Unchanged Phone Output

The next user screenshot still had a dense paragraph. The runner assembles the current system prompt each run; no persisted system-prompt restore path was found. This does not prove the exact model request contents of the screenshot, which were not logged.

Replaced permissive layout guidance with `replyLayout`, used in both the initial system prompt and the no-tools final-answer context. Two or more independent operations require bullets; statuses and user decisions belong outside the operation list. Simple answers remain prose. No post-processing or scenario-specific answers were added.

Two isolated live-model trials used fixed, user-provided scenario facts through the actual runner/model provider, with tools removed and all device callbacks blocked. No session history was stored or device accessed. The first output made everything a list; after tightening categories, the mixed response had two operation bullets, a separate state/exclusion paragraph and a final choice paragraph. The single-fact response remained one sentence. The model still placed the lighting exclusion in the state paragraph rather than beside its operation: grouping improved, but not every layout instruction was followed. This is not a full live device-workflow acceptance test.

Typecheck and 42 tests passed during this refinement. Temporary repeatable copy probe: `/tmp/iot-reply-check.LZd066/check.mjs` (uses existing runtime environment without printing credentials; watcher PID may change).

2026-09-08: User requested more scannable multi-action replies without turning simple replies into templates.

Changed only the general system prompt in `../iot-agent-runtime/src/agent/pi-runner.ts`: removed the blanket Markdown ban; permit short unordered lists for multiple independent operations, with blank lines around lists. Keep exclusions next to their operation, group already-satisfied state explanations separately, and put necessary user decisions last. Simple answers remain short prose. No nested lists, tables, decorative headings/bold, repeated card inventories, or scenario-specific canned responses.

Preserved existing scope/state truthfulness, confirmation boundaries and execution-summary instructions. No frontend rewrite or output post-processing. Existing stored responses remain unchanged.

Verification: runtime typecheck and 42 tests passed; LAN health endpoint returned ok after watcher reload. No live model phrasing evaluation or user device control was performed. Observe the next naturally occurring mixed-operation reply to assess the wording; tests do not establish model style compliance.

Suggested skill: better-writing for further output-guidance refinement.
