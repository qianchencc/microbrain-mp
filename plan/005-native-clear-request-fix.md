# Native Clear Request Fix

The native UI displayed `Body cannot be empty when content-type is set to 'application/json'` after clearing. WeChat supplies a JSON content type by default, even when a DELETE request has no data. The server rejects the empty JSON body before reaching its clear handler.

`apps/agent-miniapp/apis/agent/request.mjs` now supplies an empty object for bodyless mutation requests. Existing payloads, GET requests, error messages and error data are preserved. The agent API uses this shared request boundary; no server parser exception or security change was needed.

Verification:
- 22 Node tests pass, including bodyless POST/DELETE, unchanged PATCH payload, GET, and conflict response handling.
- Actual native `wx.request` reproduced old DELETE=400 using a newly-created isolated test identity/conversation.
- The same native request API through the fixed request boundary created and cleared that test conversation successfully; restore returned null.
- User's current conversation was not cleared. No device commands were issued.
- WeChat build succeeded and native page was reloaded.

Reproduction harness is temporary: `/tmp/native-automator.At2foQ/clear-request.mjs`. It creates its own unique test identity and does not target the user's conversation.
