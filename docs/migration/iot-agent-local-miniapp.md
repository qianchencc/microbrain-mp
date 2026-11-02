# Local Java Agent profile and mini-program route matrix

This is a develop-only acceptance profile. It does not change login, SSO, customer gateway, video playback, trial, or release.

## Enable and restore

`config/settings.js` contains `USE_LOCAL_DEVELOP_AGENT = false`. For a local acceptance build, change that one line to `true`, compile the `develop` target, and restore it to `false` followed by another compile when finished. The switch is ignored for `trial` and `release`; they always select their existing customer profiles.

The selected local profile is:

| traffic | origin |
| --- | --- |
| Agent | `http://127.0.0.1:3205/api` |
| login / SSO / customer gateway | existing `https://ncim.577119.com` origins |
| video player / video API | existing develop `mp-video.qianc.ltd` origins |

The mini-program sends `Authorization: <customer token>` and `Tenantcode: <district.id>` on every Agent request. JSON requests add `content-type: application/json`; conversation streaming additionally requests `application/x-ndjson` behavior through the existing chunked `wx.request` path. Conversation `source` is a query parameter and is also sent in the create body. No page supplies credentials.

## Matrix

Status `verified` means the Java public controller route and the mini-program method/payload shape were checked against the source at the time of this document. It is not a claim that a real Developer Tools request has succeeded. A route requiring an unavailable adapter must still fail closed with the backend's error response. Cache rows describe client behavior, not a second backend route.

| mini-program export | method and path under local base | payload / propagation | status |
| --- | --- | --- | --- |
| `createConversation` | `POST /agent/conversations` | `{source}` body; auth headers | verified |
| `restoreConversation` | `GET /agent/conversations/current?source=` | source query; auth | verified |
| `clearConversation` | `DELETE /agent/conversations/{id}?source=` | source query; auth; clears client read cache on relevant writes | verified |
| `discardTurn` | `DELETE /agent/conversations/{id}/turns/{turnId}?source=` | source query; auth | verified |
| `streamMessage` | `POST /agent/conversations/{id}/messages?source=` | `{content, focusRegionId?, reference?}`; NDJSON chunks; auth + JSON content type; terminal event required | verified; real stream acceptance pending |
| `cancelRun` | `POST /agent/conversations/{id}/runs/cancel?source=` | source query; auth | verified |
| `getCompanyDashboard` | `GET /agent/dashboard?source=company&section=` | company source; read snapshot cache | verified |
| `getCompanyDevices` | `GET /agent/company-devices?source=company` | company source; read snapshot cache | verified |
| `getEnvironmentHistory` | `GET /agent/environment-history?source=company&...` | company source; query object | verified |
| `getEnergyHistory` | `GET /agent/energy-history?source=company&...` | company source; query object | verified |
| `getCompanyEnergyDaily` | `GET /agent/company-energy-daily?source=company&...` | company source; query object; 90s timeout; read cache | verified |
| `getCompanyMeterReport` | `GET /agent/company-meter-report?source=company&...` | company source; scope/time query; read cache | verified |
| `listSafetyHistory` | `GET /agent/safety-events?source=company&...` | company source; read cache | verified |
| `getSafetyEvent` | `GET /agent/safety-events/{eventId}?source=company&ledger=&deviceId=` | reference query fields; auth | verified |
| `getSafetyEventCameras` | `GET /agent/safety-events/{eventId}/cameras?source=company&ledger=&deviceId=` | reference query fields; auth | verified; unavailable camera data must remain fail-closed |
| `listRegions` | `GET /agent/regions?section=` | section query; auth | verified |
| `markRegionSeen` | `POST /agent/regions/{regionId}/seen` | region path; auth | verified |
| `listRegionDevices` | `GET /agent/regions/{regionId}/devices` | region path; auth | verified |
| `listRegionDeviceStates` | `GET /agent/regions/{regionId}/device-states` | region path; auth | verified |
| `listRegionTimeline` | `GET /agent/regions/{regionId}/timeline?date=` | date query; auth | verified |
| `listRegionCalendar` | `GET /agent/regions/{regionId}/calendar?from=&to=` | date window query; auth | verified |
| `listAgentTasks` / `readAgentTasks` | `GET /agent/tasks?source=&from=&to=` | source/date query; read snapshot variants | verified |
| `readAgentCalendar` / `readAgentCalendarDay` | same `GET /agent/tasks` | client calendar cache keys/TTL only; no extra route | verified |
| `getTaskDetail` | `GET /agent/tasks/{id}?source=` | source query; auth | verified |
| `getTaskLightingStates` | `GET /agent/tasks/{id}/lighting-states?source=` | source; auth; adapter absence is fail-closed | verified; adapter absence is fail-closed |
| `cancelTask` | `POST /agent/tasks/{id}/cancel?source=` | `{version}` body; source; retry/cache invalidation rules | verified |
| `confirmTask` / `discardTask` | `POST /agent/tasks/{id}/confirm|discard?source=` | `{version}` for confirm; source | verified |
| `readAgentPlans` / `peekAgentPlans` | `GET /agent/task-plans?source=` | source; read snapshot variants | verified |
| `getTaskPlan` | `GET /agent/task-plans/{id}?source=` | source; auth | verified |
| `setTaskPlanStatus` | `POST /agent/task-plans/{id}/status?source=` | `{version, operation, confirmed?}`; invalidates plan list | verified |
| `cancelTaskPlan` | `POST /agent/task-plans/{id}/cancel?source=` | `{version, scope, date?}`; auth | verified |
| `readAgentNotifications` / `peekAgentNotifications` | `GET /agent/notifications?source=&limit=&before=` | source/page cursor; read snapshot variants | verified |
| `markNotificationSeen` | `POST /agent/notifications/{id}/seen?source=` | source; invalidates notification cache | verified |
| `markAllNotificationsSeen` | `POST /agent/notifications/seen-all?source=` | source; invalidates notification cache | verified |
| task-change confirm/discard | `POST /agent/task-changes/{id}/confirm|discard?source=` | source; client invalidates relevant reads | verified |
| task-cancellation confirm/discard | `POST /agent/task-cancellations/{id}/confirm|discard?source=` | source; client invalidates relevant reads | verified |
| `listDeviceTimeline` | `GET /agent/devices/{deviceId}/timeline?date=` | date query; backend office default | verified |
| `listDeviceCalendar` | `GET /agent/devices/{deviceId}/calendar?from=&to=` | date window; backend office default | verified |
| `getVideoStream` | `GET /agent/devices/{deviceId}/video-stream?source=` | source; short-lived stream URL; no client cache | verified; local video adapter may fail closed |
| `getReportArtifact` | `GET /agent/reports/{reportId}?source=company` | source; auth | verified |
| `downloadReportArtifact` | `GET /agent/reports/{reportId}/download?source=&format=` | download URL uses same auth headers; client download/open-document lifecycle | verified; file acceptance pending |
| `readDeviceStates` | `GET /agent/action-drafts/{id}/device-states?source=` | source query; auth | verified |
| `retrySummary` | `POST /agent/action-drafts/{id}/summary?source=` | source; auth | verified |
| `updateSelection` | `PATCH /agent/action-drafts/{id}/selection?source=` | `{revision, selectedActionIds}`; source | verified |
| `updateParameters` | `PATCH /agent/action-drafts/{id}/parameters?source=` | `{revision, changes}`; source | verified |
| `revalidateAction` | `POST /agent/action-drafts/{id}/revalidate?source=` | `{revision}`; source | verified |
| `restoreAction` | `POST /agent/action-drafts/{id}/restore?source=` | `{revision}`; source | verified |
| `confirmAction` | `POST /agent/action-drafts/{id}/confirm?source=` | `{revision}`; 180s timeout; source | verified |
| `cancelAction` | `POST /agent/action-drafts/{id}/cancel?source=` | source; auth | verified |

There are no page-used Agent exports mapped to a missing local Java public route in this source comparison. The matrix must not be treated as full page compatibility until the remaining Developer Tools acceptance proves real identity propagation, response/error bodies, NDJSON terminal behavior, report download, and adapter-backed video/safety flows. Any route whose local adapter is unavailable is expected to return an explicit failure, never a synthetic success.

## Manual Developer Tools prerequisites

1. Start the Java backend on loopback port `3205` with its normal local configuration and identity verifier; do not expose it publicly.
2. In WeChat Developer Tools, enable **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书** for this local acceptance project.
3. Use a desktop Developer Tools run (the `127.0.0.1` endpoint is not a real-device endpoint), complete the existing customer login/session initialization, and ensure a district is loaded before opening Agent.
4. Set `USE_LOCAL_DEVELOP_AGENT` to `true`, rebuild the develop target, then inspect the Java request logs for the real `Authorization` and `Tenantcode` headers. Do not paste token values into docs or screenshots.
5. Exercise only rows marked verified and record HTTP status, error JSON, and stream terminal events. Restore the flag to `false` and rebuild after acceptance.
