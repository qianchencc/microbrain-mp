# Standalone IoT Agent Mini-program

This directory is a self-contained HBuilderX Vue 3 uni-app project. Open it independently of the customer application. It has one native page, no customer store/login, no customer AppID, and no web-view. The backend remains a separately running iot-agent-runtime service.

## Local development

The build script uses HBuilderX's bundled Node runtime for the Vue 3 compiler, so the result does not depend on the shell's default Node version:

```sh
npm test
npm run build:weixin
```

Set `UNI_COMPILER_DIR` if the bundled compiler is installed elsewhere, or `UNI_NODE_BIN` when its Node executable is in a non-standard location. Import `unpackage/dist/build/mp-weixin` into WeChat DevTools. manifest.json uses the test AppID selected in the local DevTools; it is not the customer AppID. On another account, select that account's test number and update manifest.json.

The development build connects to the Mac's current LAN address `192.168.30.63:3200` with a fixed LOCAL development identity, preserving that identity's existing server conversation. For real-device debugging, run the runtime with `HOST=0.0.0.0 PORT=3200`, keep the phone on the same Wi-Fi subnet, and update `config/index.js` whenever the Mac's LAN address changes; `127.0.0.1`/`localhost` can only address the phone itself. The development identity is refused in trial/release builds. Production authentication and HTTPS deployment are deliberately not configured.

The composer includes a text/voice toggle, hold-to-talk, swipe-up cancellation and a lazy WechatSI recognition adapter. WechatSI is not registered for this test AppID: actual recognition requires the AppID owner to authorize the plugin and register it under mp-weixin.plugins (the customer project uses WechatSI 0.3.9, provider wx069ba97219f66d99). Until then, holding the voice surface shows an unavailable message and text input remains usable. Recognition results submit as text without clearing a saved text draft. The native page includes text, history, draft selection/confirmation/cancellation, execution summaries, original device artwork, grouped browsing, and AC/door editors. Visual and gesture acceptance is tracked in ../../plan/002-native-visual-parity.md; implementation is not equivalent to completed real-device acceptance.

## Verification

2026-09-06: 4 tests passed and mp-weixin compilation completed. The user selected a test AppID in DevTools; it is now persisted in manifest.json. The independent project opens successfully in the simulator at pages/agent/index, displays service online, and restores existing server history, receipts and Agent summary. DevTools reports 0 errors and 6 warnings. New command execution and real-device behavior have not been verified in this check. No customer AppID, login, or security preferences were modified.