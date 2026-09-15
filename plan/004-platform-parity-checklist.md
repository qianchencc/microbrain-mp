# Platform Parity Acceptance

> **2026-09-14 scope note:** Desktop WeChat Developer Tools acceptance is now actionable. Physical-phone checks remain separately unverified but are not required to complete the current desktop mini-program acceptance.

Reference: ../iot-agent-runtime/web final components. Implementation: apps/agent-miniapp only. Evidence details remain in 002-native-visual-parity.md, not duplicated here.

| Area | Evidence / Remaining Gate |
| --- | --- |
| Native project | Independent uni-app compile to WXML/WXSS; test AppID; no web-view or customer login dependency |
| Message grouping | Native screenshots show shared avatar/heading/trace/ordinary answer column |
| Artwork/card semantics | Original PNG assets and shared presentation helpers; card parity tests cover arrows, accepted vs reached, cancellation, door without state badge. ac-state-wrap.png verifies intact Chinese parameter labels in the fixed-width native AC card |
| Tool handoff | live-trace-failure.json: connector extends while next node runs; terminal ordering controller regression passes |
| Answer collapse | live-trace-answer.json: answer appears and trace height reaches zero continuously |
| Draft editing | Native long hold, AC/door same-kind batch save, server revisions verified without control execution |
| Device browser | Native selection filters, full selection persistence, embedded configuration and bidirectional swiper verified |
| Sheet close | sheet-exit-rendered.json: monotonic downward movement, one fading mask, final removal |
| Short screen | 320x568 scrollable settings with save control inside viewport; 390x844 screenshots from earlier checks |
| Icons | Send screenshot refreshed; stepper-native.png verifies original-style plus/minus in native editor. Native buttons changed 26 -> 26.1 -> 26 and restored unchanged/disabled-save state |
| Markdown | Original heading/table/image/code styles ported to inline rich-text HTML; escaping and script-link tests pass. Native 320px answer renders table and JSON code. markdown-scroll-end.png verifies renderer scroll-to-end: clientWidth 241, scrollWidth 276, scrollLeft 35.5. Actual phone gesture remains unverified |
| Keyboard | Public keyboardheightchange event test passes. Physical soft keyboard and configuration-input panning not yet verified |
| Physical touch | Real-phone long hold/drag/edge scrolling not yet verified |
| Execution | Native single-AC confirmation -> one mock operation -> accepted receipt -> completed Agent summary verified; execution-acceptance.md. No physical controls. Loading spinner frame capture remains separate from completed-state evidence |

## Necessary Native Differences

- Custom header reserves the WeChat status bar and capsule. Service status is a separate compact row to avoid capsule overlap.
- Slider and switch use native uni-app controls; semantics align, but their thumb geometry and platform touch feel are not pixel-identical to web controls.
- Native rich-text handles Markdown output without browser DOM APIs. Complex long tables/code blocks have not had an exhaustive rendering check.
- Development localhost works only in the simulator. A phone requires a reachable authorized backend; release identity/HTTPS setup is not configured by this migration.
- Voice is absent from the H5 reference and has not been added. WechatSI registration and authorization are separate from visual parity.

This is an acceptance checklist, not a completion declaration. Do not convert unverified rows to passed based on compilation alone.
