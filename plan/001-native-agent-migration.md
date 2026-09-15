# Native Agent Migration

Decision (updated): the client is an independent native WeChat mini-program in apps/agent-miniapp, compiled with Vue 3 uni-app. It no longer depends on the customer application's login or AppID. Do not wrap the H5 client in web-view. The sibling iot-agent-runtime remains the backend; its H5 client is a visual reference only and is frozen for new features.

Standalone extraction: see apps/agent-miniapp/README.md for build and verification. Future native work targets that project; the original pages/agent copy is preserved as integration history, not a second active implementation. Independent compilation and four tests pass. The user-selected test AppID is persisted in the standalone manifest. DevTools now opens the native page, connects to the runtime and restores history, receipts and Agent summary. The earlier customer-membership/import blocker is resolved for local simulation; new execution and real-device acceptance remain pending.

## First Slice

Restore the current six-hour server conversation; submit text with wx.request chunked NDJSON; retain each reply's trace, text, draft and receipt; select any draft subset with revision-aware updates; explicitly confirm or cancel; display and restore the server-generated Agent summary. Manual clearing must use the server conversation endpoint. Stop only affects model generation, never confirmed device execution.

Reuse existing apis/agent and pages/agent work. All existing unrelated edits and customer pages remain untouched. Expected scope: approximately 500-800 edited lines, no new runtime dependency. No fixed device names, IDs or lamp-specific operation labels. First-slice parameter editing remains model-driven text revision; do not present nonexistent graphical editors.

## Migration Follow-ups

1. Native device artwork/cards and capability-specific configuration: AC fields and door count; shared uni-popup, native swiper for list/config pages, long press, selection and full select.
2. WechatSI voice composer: touch recording, cancellation, permission/start races, empty result handling and keyboard avoidance. Reuse customer plugin registration, do not call it from H5.
3. Motion parity, status formatting and compact native top/composer bars, checked in developer tools and on a phone.

## Acceptance and Boundaries

First slice must compile for mp-weixin, pass existing stream tests and replay tests at the native conversation projection boundary. Developer-tool verification is not a substitute for real-device validation. Record any unavailable verification explicitly.

Development loopback currently targets the local runtime and only works on this machine's simulator. A phone needs a reachable development address; release requires the customer's HTTPS request domain and upstream identity. Do not change the customer's deployment or security settings to bypass this requirement.

No claim of whole-migration completion until follow-ups pass. No automatic deletion of H5 or customer pages.

## Handoff: 2026-09-06

First-slice code is implemented in pages/agent/index.vue, pages/agent/conversation.mjs, pages/agent/components and apis/agent/index.js. It retains per-turn drafts/results, supports revision-aware subset selection, confirmation/cancellation/revalidation, restores server history and polls execution summaries. Text can revise parameters; graphical editors are not migrated yet.

Verification: Node 22 `npm run test:agent` passes 4/4 public projection and UTF-8 streaming tests. HBuilderX's bundled Vue 3 compiler generated unpackage/dist/build/mp-weixin, including native Agent WXML/JSON and its registered components. Existing customer pages emit Vue default-import and platform/style warnings; these were not changed.

Local build: run the bundled node_modules/@dcloudio/vite-plugin-uni/bin/uni.js with `build -p mp-weixin` from /Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite, setting UNI_INPUT_DIR to this repo and UNI_OUTPUT_DIR to its unpackage/dist/build/mp-weixin. The working directory matters: it activates HBuilderX dependency resolution. Running from this repo fails to resolve bundled Vue.

Native UI acceptance is blocked: WeChat DevTools refused to open the compiled project with code 10, stating the logged-in user is not a developer of this mini-program. Use an authorized account or have the owner grant developer access. AppID, security settings and customer login were not changed. No real-device/end-to-end acceptance, upload, or physical device execution was performed.

Next: unblock DevTools access and verify restore -> query -> draft selection -> confirm/cancel -> server summary -> relaunch restoration, then the native card/configuration follow-up above. Existing dirty changes were preserved; no mixed-worktree commit was made.

Suggested skills: implement for the next business slice; emil-design-eng for native interaction adaptation; handoff for acceptance records. Keep browser-only primitives out of native pages.
