# Scrollbars and Result Copy

- All four native scroll-view surfaces now use enhanced + show-scrollbar=false: conversation, draft rail, device browser, shared AC/door editor. Scrolling remains enabled.
- Global scrollbar styling and Markdown inline scrollbar-width:none hide ordinary overflow scrollbars without hiding content.
- Native build and 22 tests pass. Native conversation reports show-scrollbar=false; scrolling and screenshot verified in hidden-scrollbars.png. Physical-phone behavior is not claimed.
- Runtime normal-answer and execution-summary prompts now share concise result communication guidance: report accepted requests directly; do not append routine physical-state disclaimers. Still prohibit falsely claiming physical completion, retain failure/partial/unselected outcomes, and explain uncertainty when the user asks about actual state or it affects the decision.
- Runtime typecheck and 42 tests pass. These deterministic tests do not guarantee model wording; no new device operation was issued for wording verification. Existing persisted summaries are not rewritten; guidance applies to future generated answers.
