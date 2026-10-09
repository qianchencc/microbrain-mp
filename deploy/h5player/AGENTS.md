# Shared video page

- Ship index.html and player.js together. Update the player.js content hash in index.html whenever the script changes; unversioned files were cached for four hours by the development CDN. SDK assets must be same-origin under /owner/static/h5player/ for worker/wasm loading.
- Navigate before fetching. source/device/session remain explicit on every retry; never share Company and Office catalogs or place WSS in navigation/history/observation cards.
- Prepare SDK before requesting a short-lived stream. Only firstFrameDisplay means playing. Return waits for JS_Stop; a broken SDK has a bounded return fallback. Hide/unload aborts requests and releases the instance.
- Do not log credentials, stream URLs or SDK payloads. The existing WebView injects token/tenantCode; immediately remove secrets from H5 browser history. A changed miniapp identity clears the old WebView.
- Public development proxies must require caller authorization; never fall back to the real development identity for anonymous external traffic.
- Gate actual controls on SDK evidence. Live and playback differ; a successful WSS response alone is not decoded video. Latest actual acceptance: plan/2026-10-09-shared-video-live-handoff.md.

- Verified playback uses JS_Play(url, { playURL: url, mode: 1 }, 0, beginTime, endTime). Keep Shanghai timestamps and the same window on retry; never label a recording LIVE. Evidence: plan/2026-10-09-shared-video-playback-handoff.md.

- SDK JS_Play may reject a string code; pluginErrorHandler supplies server status and can fail during playback. Capture only safe codes/status, show the actual failure stage, and ignore retired instance callbacks. A server rejection is not a decoder error; unknown codes retain uncertainty. See plan/2026-10-09-video-error-details-handoff.md.
