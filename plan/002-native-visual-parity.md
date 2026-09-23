# Native Visual Parity

> Historical standalone-shell parity record. It is not the current product plan; use [`docs/README.md`](../docs/README.md) for the production entry.

This record aligned `apps/agent-miniapp` with the earlier H5 reference. Remaining standalone parity gaps do not block customer-mainline feature work unless they reproduce a current customer defect.

## Implemented

- Native message grouping: shared avatar column, heading/thinking lattice, collapsible trace and ordinary Markdown rendering.
- Original four product images, original display-name/location rules, state arrows, accepted vs reached distinction, cancelled strikeout, access cards without state badge.
- Three-card overflow rail, edge fade, all-device selection filters/grouping, pending full select, read-only history.
- Shared uni-popup/uni-transition sheet with handle and touch dismissal. Swiper keeps list/config in one sheet.
- AC/door configuration, same-type scope, capability-aware options/limits, revision-aware parameter PATCH, no control execution on save.
- Sliding segments, local animated grouping menu, safe-area-aware custom header, Blobatar 2.7.0 identity matching H5's conversation seed and native gaze layers.

## Verified So Far

- Native compilation passes; 17 tests pass (including short/long hold, movement, multi-touch, cancellation and partial receipts).
- Simulator restores history and displays original artwork and message layout. Native message submission generated a new meeting-room AC draft without execution; trace collapsed, elapsed time shown.
- All-device sheet opens; grouping dropdown opens, switches from location to kind, and preserves device groups. No simulator errors at last inspection.
- A gesture test resulted in deselecting the newly generated AC action, not configuring it. The test draft expired afterward. No control confirmation was sent and no original conversation history was cleared.

## Still To Validate / Finish

- Simulator long press and single-device AC save are verified via agent-browser CDP. 500ms hold opens the AC editor, release does not toggle selection, increment changes 25 to 25.1, save closes the sheet and persists revision 4 with temperature 25.1, PENDING_CONFIRMATION and result null. Screenshot: plan/evidence/native-parity/ac-editor.png. Real-phone touch and batch edits remain pending.
- Final sheet dismissal and swiper transitions at multiple viewport sizes, with no backdrop flash. Frame-by-frame motion comparison remains pending.
- Ordered presentation is implemented for batched events (minimum 180ms running indication; completion and next node in one handoff). Frame-level comparison remains pending.
- Composer sizing/keyboard avoidance comparison; completion/receipt spacing and all error/empty/disabled states.
- Historical elapsed seconds now derive from existing server event timestamps and saved startedAt. The earlier assumption that restore had no timing information was incorrect; no backend change was necessary. Legacy events with no timestamps omit the count.
- Voice is not present in the H5 reference and is not silently included as a new feature. WechatSI remains a separate platform-authorized integration.

Historical continuation used `emil-design-eng` for motion/visual checks. New business slices now target the customer mini-program; use this shell only for regression evidence.

## Latest Browser-Sheet Alignment

- Icon alignment: native parameter step controls now use original Lucide Plus/Minus SVG geometry, removing nested circle glyphs. Composer uses original outline Send icon. Assets were serialized from installed @lucide/vue 1.40.0 icon nodes; no dependency was added. Compilation passed; composer-icons.png verifies the native send icon. Step-control native screenshot still needs refresh.

- Live success trace now verified: tool runs then completes, response appears, and processing record collapses continuously to height zero (~200ms). See live-trace-answer.json. Terminal ordering, failure handoff and sheet dismissal have separate evidence; no device controls were executed.
- Prior backend final-answer failures stopped reproducing after the local development service reloaded. Temporary stack-only diagnostic was removed; no permanent backend fix or root-cause claim is made.

- Fixed terminal presentation ordering: run.completed and run.awaiting_confirmation now wait behind queued tool events, as run.failed already did. Previously batched delivery could show completed thinking before the remaining running nodes. A failing public controller test reproduced it; the fix passes all 18 tests and keeps message.delta immediate. Native rendered live-turn validation remains pending.

- Resumed with desktop unlocked. Rendered close-animation sampling passed at 320x568: native AX click, requestAnimationFrame measurements show y increasing from 45.45 to 567.17, mask opacity decreasing from 1 to 0.00159, exactly one mask until both nodes disappear. Active sampled movement spans 283ms plus initial frame interval, consistent with 300ms transition. Raw evidence: sheet-exit-rendered.json. SDK offset-based sheet-motion.json is NOT valid animation evidence (local coordinates were constant).
- CDP input remains unsafe for native coordinate mapping: it opened a clear-history confirmation, which was cancelled immediately through native AX. No history was cleared. Use CDP only for rendered inspection and latest native AX indices for clicks. Automatic SDK screenshots timed out in this resumed environment; do not claim they produced fresh screenshots.

- Composer keyboard-event test passed on native simulator: viewport 320x568, injected public keyboardheightchange height 216 -> page 320x352, composer bottom 340; height 0 restores 568. This tests the event contract, not a physical soft keyboard.
- Frame sampling was prepared in /tmp/native-automator.At2foQ/motion.cjs but NOT executed: native window access reported that the Mac is locked and automatic unlock failed. Manual unlock is needed for native close-click/frame verification. Do not mark motion complete based on existing resting-state screenshots.

- Native filters verified: clear all -> selected empty -> unselected 29 -> select all -> unselected empty. Server read confirmed selected 29/29, revision 18, result null.
- Native-window close click removed the sheet and backdrop; SDK XPath tap/trigger on the slotted close button was unreliable, so it is not used as proof of a product defect. A native click followed by SDK WXML inspection confirmed the sheet root was gone. Final resting state screenshot: sheet-closed.png. Frame-level exit motion remains unverified.
- 320x568 simulator verification: embedded AC controls scroll fully, save button bounds x195/y514/w105/h42 remain within 568px height. Matched H5's <=740px product-image height 105px and kept status words intact. Screenshot ac-small-scrolled.png. ac-navigation.png now contains the small-screen top view, not the earlier 390px view.

- Official miniprogram-automator verified the actual native editor. Fixed collapsed embedded content by declaring ParameterEditor virtualHost, so flex sizing reaches the root view instead of stopping at a custom-component host.
- Reproduced a second-long-hold defect: swiper was at page 1 before release, then returned to page 0 on release. Card touchend now stops propagation; programmatic swiper changes are not reflected back as touch navigation. Removed experimental gesture-lock state. The simplified implementation passed AC -> back -> door long hold, release remaining on page 1, swipeTo(0), swipeTo(1).
- Native batch save verified: both access actions count 5, all 27 AC actions temperature 26, other type unchanged, backend revision 9, PENDING_CONFIRMATION, result null. No control was confirmed. The 5-count increase control was disabled and the timing labels showed 0/5/10/15/20 seconds.
- Evidence: all-devices.png, door-embedded.png, ac-navigation.png and door-swiped.png under plan/evidence/native-parity. ac-batch-editor.png captured the old navigation defect, not a successful editor view.
- Continue with plan/003-native-verification-handoff.md for the working native automation path. Desktop CDP input remains unreliable; official SDK input works.

- Receipt parity: failed AC fields are named, door attempt counts retained, non-success receipts use a warning icon, executing receipts animate, and cancelled/expired/no-change drafts explicitly state that no control was sent. Public receipt tests now total 17 passing tests.
- Expiry scheduling now resumes after parameter mutations and handles the next pending draft after expiring the earliest one. Revalidation refreshes displayed device states. These lifecycle changes still need simulator interaction verification.

- Added H5-equivalent all/selected/unselected count filters and operation grouping. Full selection belongs to the footer; embedded configuration has its own device-settings title.
- Fixed embedded editor height ownership: the sheet body can shrink, the return row remains fixed, and configuration takes the remaining swiper height. This prevents the fixed 70vh editor plus return row from clipping the save area on short screens. Simulator viewport verification remains pending.
- All 16 tests passed after the filter change. Native input automation remains unreliable: CDP input hangs while reads succeed, and native accessibility click did not revalidate the expired test draft. No command execution occurred. Prefer screenshot-coordinate native interaction or a fresh DevTools session for the next verification; do not infer success from attempted clicks.

## Continuation Corrections

Fixed sheet drag dismissal rebounding before exit, reset gesture state on cancellation, and matched the H5 rule that only an explicit draft power-off blocks AC parameter edits (not a currently-off device). Temperature slider uses scaled integer ticks with 0.1-degree API values. Invalid door counts no longer create an unbounded timeline. Composer now matches H5 dimensions and square stop glyph, with native keyboard-height handling. Compilation passes; native gesture/keyboard verification is still outstanding.

Long-press handling is now in card-press.mjs and cancels on second-finger entry/system cancellation as well as movement. Tests prove a full progress signal precedes configure and release does not select. A new 29-action mixed door/AC test draft was generated without execution. CDP input later hung on native switches; cancelled pending CLI commands and stopped the owned native-parity daemon, leaving source and conversation intact. The owned H5 screenshot session was closed. The DevTools app was restarted with loopback CDP port 9222 for verification; it is not a public endpoint. H5 reference screenshot is in plan/evidence/native-parity/h5-reference.png.
