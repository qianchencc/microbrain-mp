# Native Segment Tap Fix

Actual CUA clicks on visible mode choices did not update the setting, while an official SDK direct tap did. The undo button in the same sheet worked through CUA. This isolated the failure to the segmented control's touch interception rather than a sheet-wide overlay.

SlidingSegments.vue no longer catches touchstart/touchend at the parent. It retains touchmove isolation and catches the option tap, preserving swipe behavior and avoiding propagation into the popup. Missing changedTouches is handled without throwing.

After rebuilding, actual CUA clicks changed auto -> heat and middle -> high, with the target summary updating. Undo restored the original draft parameters and disabled save; close removed the sheet. No parameter save or device control was performed. Revalidation was used once because the inspected draft expired during testing.

Scope: the independent app has one page. The shared component is used by AC mode, fan speed, and device-browser selection filters; all receive the fix. Door steppers, scope switch, dropdown, save and close use different event handling and do not share this interception. Save-button execution was not independently retested on the user's draft, to avoid persisting test changes. Existing 22 tests and WeChat compilation pass. Native browser-filter swipe-in-swiper remains a follow-up verification; direct synthetic tap alone is not evidence that physical click works.
