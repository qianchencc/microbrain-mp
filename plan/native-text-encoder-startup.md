# Native startup encoding compatibility

## Follow-up: atob

The next physical-device scan failed with `atob is not defined` from markdown-it/entities initialization. The earlier compiled test incorrectly supplied Node atob/btoa and therefore masked this second startup failure; its success was not proof of full phone compatibility.

- `markdown.mjs` now imports only `core-js/actual/atob.js` before MarkdownIt, from pinned core-js 3.50.0.
- The compiled test no longer provides atob, btoa, TextEncoder, TextDecoder or Buffer. It verifies actual compiled vendor loading, avatar generation and Markdown rendering (including HTML entities and Unicode).
- Before this fix the corrected compiled test reproduced the exact atob ReferenceError. After the fix `npm run test:weixin` and all 23 source tests passed. Phone rescan remains pending. Backend connectivity configuration is still unchanged.

## Initial TextEncoder Fix

2026-09-08: Android physical-device startup failed with `ReferenceError: TextEncoder is not defined`. `blobatar/internal` creates its encoder at module evaluation, aborting page initialization.

- `apps/agent-miniapp/pages/agent/avatar.js` now imports the standalone UTF-8 polyfill from pinned `text-encoding-utf-8@1.0.2` before the avatar dependency. This initializes inside the compiled vendor bundle; no generated-code patch or handwritten encoder is needed. Existing native encoding APIs are preserved.
- Source regression removes TextEncoder, TextDecoder and Buffer before loading the real avatar module. Results match native encoding for ASCII, Chinese, supplementary characters and a lone surrogate.
- Compiled regression loads the actual vendor and avatar CommonJS modules in an isolated context without encoding APIs, using platform entry-point stubs. It verifies the same rendered SVG layers, not private export names. Run `npm run test:weixin` to rebuild and check this path.
- Validation: 23 source tests and 1 compiled test passed. Build succeeded. Output total 1,276,202 bytes, below the reported 4MB limit. Physical-device rescan is pending.

## Connectivity Resolved on Computer; Phone Retest Pending

After explicit user approval, the existing runtime watcher was restarted with only HOST changed from 127.0.0.1 to 0.0.0.0. Existing model credentials, mock backend, database and other environment settings were preserved without logging their values. Backend source defaults were not modified. No run or draft execution was active before restart.

The miniapp development URL is now http://192.168.30.117:3200/api. Both localhost and this LAN address returned HTTP 200 for the existing user's conversation restore endpoint, and history was retained. No device control was sent. Current watcher PID is 86771, worker PID 86773; verify these before managing processes. Log remains in the existing iot-runtime-TuwfLi temporary directory.

This exposes the development service on local network interfaces and is only for a trusted development network. Keep the release identity guard. Wi-Fi IP may change; do not treat it as a production endpoint. Phone rescan/reachability remains to be confirmed; computer-side LAN checks do not establish phone connectivity.

Suggested skill: diagnosing-bugs if another startup error appears after rescan.
> **历史记录（2026-09-14）：** 本文记录的是一次旧局域网地址验收。独立测试项目当前已切换到桌面微信开发者工具可用的 `127.0.0.1:3200`；不要恢复本文中的 `192.168.30.117`，正式嵌入再使用客户网关和小程序登录态。
