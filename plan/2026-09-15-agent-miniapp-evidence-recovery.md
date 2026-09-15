# Agent mini-program evidence recovery closure

Date: 2026-09-15

## Outcome

The canonical standalone native mini-program at `apps/agent-miniapp` has been restored from independently verifiable Codex session history. The damaged `agent-miniapp-restored` reconstruction was not accepted as the baseline.

The pre-replacement accident reconstruction is preserved at:

`/.recovery/agent-miniapp-accident-reconstruction-2026-09-15`

Detailed provenance, native startup requirements, and acceptance boundaries are recorded in `apps/agent-miniapp/RECOVERY.md`.

## Verification

- Historical target: the 2026-09-15 09:47 Asia/Shanghai run with 31 passing source tests.
- Restored source: `npm test` passes 31/31.
- Native output: `npm run test:weixin` builds successfully and passes the compiled startup regression without host-provided browser encoding globals.
- WeChat DevTools: the canonical compiled directory opens as a native mini-program, restores the persisted conversation, and reports zero runtime errors.
- Structural scan: Vue component boundaries and JavaScript syntax are valid; captured shell/tool output is absent from source files.

## Recovery-specific correction

The UTF-8 package root is not a startup polyfill. `pages/agent/avatar.js` must import `text-encoding-utf-8/src/polyfill.js` before `blobatar/internal`; otherwise the compiled mini-program fails when `TextEncoder` is absent.

## Not part of this closure

Old failed Agent messages visible after launch are restored backend conversation data. Validating or correcting the runtime's device-selection/control behavior is a separate business closure and should not be conflated with source recovery.
