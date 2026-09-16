# agent-miniapp notes

This directory is the standalone native WeChat mini-program for the IoT Agent.

## Recovery constraints

- The directory was recovered on 2026-09-15 from Codex session history after an untracked source directory was deleted.
- Do not use `agent-miniapp-restored` as an implementation baseline. It mixed multiple shell outputs into single files and is retained only as accident evidence.
- `RECOVERY.md` records the accepted recovery baseline and verification gates.
- Before replacing a recovered component, compare it with the historical session evidence or a later intentional change. A compiling accident reconstruction is not evidence of correctness.

## Verification

Run both suites after source changes:

```sh
npm test
npm run test:weixin
```

The second command validates the actual compiled mini-program bundle without browser encoding globals. It also enforces the WeChat DevTools real-device preview/upload 4MB source-size ceiling via `test/compiled-package.test.mjs`; keep bundled assets sized to their rendered dimensions rather than shipping oversized originals. Real-device debugging cannot use loopback; `config/index.js` must point at the Mac's current LAN IP and the runtime must listen on `HOST=0.0.0.0` (see `README.md`). The authoritative backend startup recipe (full env vars incl. `AGENT_DEV_IDENTITY`, token refresh, failure symptoms) lives in the runtime repo's `AGENTS.md` under 生产接入备忘 · 3201. The Agent avatar is a fixed inline SVG and must not regain per-conversation random generation; the `core-js/actual/atob.js` import used by Markdown remains required for native startup.

Import `unpackage/dist/build/mp-weixin` into WeChat DevTools for native visual and interaction checks.
