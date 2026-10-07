# Business Completion Acceptance

## Environment

- Build under test: `2bbdf65` (`fix(agent): explicitly hide the retained arrangements pane in WeChat`). The DevTools project was rebuilt from the main checkout, then the Company Agent page was re-launched so it loaded the matching `data-v-1db54032` bundle.
- WeChat DevTools simulator: iPhone 12/13 Pro profile, WeChat 8.0.5, SDK 3.17.2, `windowWidth=390`, `windowHeight=753`.
- The Runtime task was read-only: task `9caf6fb6-103d-4980-b7db-2d8c612f4d56`, label `验收只读环境简报`, `actions=[]`.

## Verified Flow

- Tapped the Company Agent header menu trigger. Its actual options were `清除当前会话`, `我的安排与周期计划`, and `任务收件箱` (the inbox option later included its unread count). A callback wrapper selected the option after capturing these labels; the native system ActionSheet row itself was not touch-automated.
- Opened **我的安排 → 执行结果**. The real task appeared once as completed at `2026-10-07 19:42`. Tapping it opened the same task report. The results list was `display:none` while the report was open; Back returned to the retained result row.
- The saved report shows one completed checkpoint at `19:34`, one environment device, and a generated report at `19:42`. The observations are `27°C`, `48%` humidity, `PM2.5 11`, `PM10 10`, and `PM1.0 17`; the source was a device observation.
- Opened the real Company notification `3c49a795-89d7-49a0-adea-f6a4900b651c`. The detail matched the same task and report. Loading the report marked it seen: returning to the inbox changed the count from `1` to `0`, retained the row, and removed its unread marker.
- In fresh Company conversation `7cad31c7-36cd-45a3-a7c6-968a7b53130a`, entered a safe unsent draft, opened the inbox report, and tapped **引用任务并询问**. The sheet closed; the exact draft and `{type: "task", taskId: "9caf6fb6-103d-4980-b7db-2d8c612f4d56", label: "验收只读环境简报"}` reference remained in the composer. No message was sent until this preservation check passed.
- Sent that read-only explanation once. The captured Company `POST /agent/conversations/<id>/messages?source=company` contained the exact task reference. The completed response summarized the saved observation time and values. No task proposal, change card, or device-control card appeared.

## Screenshots

- [Result row](screenshots/company-results-redacted-390.png): the creator display string is replaced with `成员` in the rendered component data only; task ID and completed status were verified before capture.
- [Arrangements report](screenshots/company-task-report-redacted-390.png): same task and saved observations; the creator display string is replaced with `成员` in the rendered component data only. The arrangements list is hidden while the report is open.
- [Unread inbox](screenshots/company-inbox-unread-390.png) and [read inbox](screenshots/company-inbox-read-390.png): the same row before and after opening the report, with unread count `1 → 0`.
- [Inbox report](screenshots/company-inbox-report-redacted-390.png): same task and report. Only the creator display string was replaced with `成员` in the rendered component data for capture.
- [Preserved draft and reference](screenshots/company-reference-draft-390.png) and [completed explanation](screenshots/company-reference-explanation-390.png).

The display-name changes above were transient DevTools component `setData` overrides for screenshots only. They did not change the Runtime response, task, notification, or persisted conversation reference.

## Limits

- The automator reports a 390 px viewport; its installed API and official DevTools CLI expose no viewport-resize operation. A 320 px render was not verified, and no simulator or system settings were changed.
- Native ActionSheet item selection used the captured `success({tapIndex})` callback because the OS menu rows were not exposed by the automator page tree. Trigger tap and exact option labels were verified; native row tapping remains unverified.
- No live periodic plan or pending task-change item was available in this real-data pass. No fixture was injected for those states.
- A separate read-only API check by `inbox_frontend` found the Company task inaccessible through `source=office` (`404 CONVERSATION_SOURCE_MISMATCH`) and confirmed the Office inbox was empty. The Office empty state was not opened in the mini-program UI.
- Temporary DevTools request and ActionSheet wrappers were restored. No authentication storage, Runtime task, or device state was changed by this QA pass.
