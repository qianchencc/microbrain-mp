# Native preview package size

2026-09-08: WeChat preview rejected a 4269KB source package (80051, limit 4MB).

- Change: `apps/agent-miniapp/scripts/build.mjs` resizes only the compiled central AC and sliding door PNGs to a maximum dimension of 768px, after a successful compile. Full-resolution source assets remain unchanged. Existing 240px editor previews retain at least 3x resolution.
- The current macOS/HBuilderX build now also uses the macOS `sips` command. Image optimization failure fails the build rather than silently shipping oversized assets.
- Validation: build succeeded, 22 tests passed, both output images visually inspected. Compiled files total 1,271,835 bytes (about 1.21MiB); actual WeChat upload size may differ.
- Pending: user retries Preview in WeChat Developer Tools. No upload, phone connectivity, or device control was performed in this side conversation.
- Suggested skills: none needed for retry; use diagnosing-bugs if upload still fails.
