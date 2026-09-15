# Native touch interaction fixes

2026-09-08. Scope: avatar motion, consistent card height, accidental hold feedback, missing door count, live AC temperature feedback. No backend, device execution, or confirmation behavior changes.

## Changes

- `AgentAvatar.vue`: view-layer gaze/blink animation replaces tiny random JS gaze updates. The entire figure breathes while running. Reduced-motion preferences remain respected.
- `DeviceActionCard.vue`: all device cards use 182px height, matching the existing overflow card. Product art and typography are unchanged.
- `card-press.mjs`: total long press remains 500ms. Visual feedback begins after 180ms; normal short taps show no ring. Movement over 8px, multitouch and cancellation suppress configuration and selection. Normalize clientX/clientY, pageX/pageY and x/y coordinates; missing coordinates cancel safely. Scrolling is tracked even for non-configurable cards.
- `ac-draft.js`: access commands with omitted count resolve to 1, matching operationLabel and backend semantics. Explicit counts and mixed batch counts remain distinct. Door settings do not inherit physical state fields.
- `ParameterEditor.vue`: native slider changing and change events both update local draft fields, so the temperature and summary follow dragging. Saving remains explicit.

## Verification

The new default-count and press-feedback tests failed before implementation. Now 27 source tests and 1 compiled-runtime test pass. Build succeeded; native WXML contains the changing handler and WXSS contains the scoped avatar animations and consistent dimensions.

Actual phone motion/gesture acceptance remains pending: the developer tool is currently in a live physical-device debug session, while miniprogram-automator response timed out. The user's session was not stopped or reset, and no draft was saved/executed during testing. Regenerate the QR code before retesting on the phone.

Phone checks: avatar blink/gaze (unless reduced motion is enabled); equal-height mixed cards; short taps and horizontal swipes without a hold ring/menu; deliberate 500ms hold opens once without toggling; a new door command shows 1; mixed batch counts still show multiple; temperature and target summary update before release.

Suggested skills for follow-up: diagnosing-bugs for any concrete failure; emil-design-eng for motion refinement. Previous startup/network work is recorded in `plan/native-text-encoder-startup.md`.
