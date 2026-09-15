# 2026-09-15 recovery baseline

This project was rebuilt from independently verifiable historical evidence. The damaged `agent-miniapp-restored` directory was not treated as the baseline.

## Accepted evidence

- Codex session history from 2026-09-06 through the morning of 2026-09-15, including full file snapshots and successful patch applications.
- The historical 2026-09-15 09:47 (Asia/Shanghai) test run: 31 source tests passed.
- Existing plans that record native touch, startup compatibility, and visual-parity decisions.
- Native compiled output loaded in WeChat DevTools on 2026-09-15 with zero runtime errors.

The damaged reconstruction was used only to locate candidate fragments. Files containing concatenated command output, tool wrappers, or multiple Vue components were rejected and replaced from clean evidence.

## Verification result

- `npm test`: 31/31 passed, with the same externally observable test names as the historical morning run.
- `npm run test:weixin`: build passed and the compiled avatar/Markdown startup test passed without `TextEncoder`, `TextDecoder`, `atob`, `btoa`, or `Buffer` supplied by the host.
- Source integrity: every Vue file has one template and one script; JavaScript syntax checks pass; no captured tool-output markers remain.
- WeChat DevTools: native page loaded, restored server conversation rendered, and the debugger showed zero errors.

## Important native startup details

- Recovery note (superseded on 2026-09-15): the recovered avatar originally required `text-encoding-utf-8` before `blobatar/internal`. The production Agent now uses one fixed branded inline SVG, so neither dependency belongs in the native bundle.
- Markdown must install the `atob` compatibility layer before MarkdownIt initialization.

## Remaining acceptance boundary

The recovery establishes the last evidence-backed source and native startup state. Live IoT actions still depend on the separately running runtime and customer/mock device data; old failed messages restored from server history do not indicate a mini-program rendering failure.
