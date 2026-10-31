# BUG_20261016_live-crash-no-project-is-focused

**Status:** RESOLVED (crash fixed by T226, no-project menu by T228, error context by T229 and T563)

## Symptom
Live release v20261015T1542Z (7.0.951) shows the crash screen with "no project is focused". Stats dashboard, 16 Oct 2026: 7 crashes in two browsers (a Chrome-style stack, 2 at 13:42; a Firefox-style stack, 5 at 11:28, hash 44211fa4efe9c4e7af10ffc6). One user sent a crash report for it at 11:07 with no note and no contact.

## Evidence
Thrown by `NoFocusedProject` in `packages/ui/src/logic/appState.ts:118`, from a computed inside a component `setup` (frames `k` ← `setup` computed ← Vue effect `Ve`). Not changed on main since the release.

## Cause
App.vue provided the focused project to the gated panels as a computed that threw when none was
focused. When the last project closes, Vue runs the gated panels' watchers and scope cleanups before it
removes them, and any of those that reads the project threw. The release bundle's frames (178:6506 is
the throw, 190:8346 the App.vue computed) do not name the reader, and no source map is published.
On main one such reader was seen in a test run: the Tune sheet session's close (T209), run from a scope
stop. It did not reproduce on demand. ⚠ unverified which reader the live crashes hit.

## Fix (T226)
- The gated panels get `heldFocusedProject`: the focused project, or the last one that was focused,
  so a panel being removed keeps the project it showed. It asks `requireFocusedProject` only when no
  project was ever focused, which the gate rules out.
- `app.config.errorHandler`: a `NoFocusedProjectError` is logged and goes no further; it never shows
  the crash screen or the flash.
- Both skins' empty state says "No project open. Create or open a project." (`NO_PROJECT_OPEN` in
  packages/design), with New project and Open project buttons.
- Tests: packages/ui/test/logic/focusedProjectContext.test.ts; packages/ui/test/ui/
  no-focused-project-crash.browser.spec.ts (closing the only project from each tab, and a mobile cold
  start, end on the empty screen with no crash).

## John's ruling, 16 Oct 2026
- Never a crash here. With no project open the app says, in plain words: "No project open. Create or open a project." with New project and Open project buttons, on both skins.
- Every error is logged with enough context to diagnose it: which screen and dialog were open, how many projects were open, the focused project's box type (or none), the last few user actions by name, app version and device type. No project data and no values. The privacy text gets the matching sentence.
- Mobile, John 16 Oct: with no project open, every app-level feature stays reachable from the menu: New project, Open project, Import, Options (Your data, Backups, Export/Import, cloud sync), My Drivers / driver manager, About, Diagnostics. Only project-level items (Save, the project tabs, charts, Tune/Learn) are hidden or disabled. Desktop the same.

## No-project menu (T228)
- Mobile: the top bar with the hamburger shows with no project open. The menu, the Manage drivers pane
  and the Cloud sync pane sit outside the project-only branch. In the menu, Save, Save all, Save As /
  Export, Revert, Project details, Advanced and the open-projects list show only with a project open.
- Desktop already reached every app-level item with no project; Save and Export are disabled.
- Test: packages/ui/test/ui/no-project-app-menu.browser.spec.ts, one test per skin, opens each
  app-level item with no project open.

## Error context (T229)
- Every `error` and `report` wire event carries anonymous runtime context:
  - `screen`: skin and current tab or destination (`original/Vented`, `mobile/graph`).
  - `dialog`: open dialog, modal or mobile pane (`options`, `driver-editor`, `whatif`, `new-project`, `none`).
  - `projects`: open project count (`number`).
  - `box`: focused project's box type, or `none`.
  - `actions`: comma-joined list of the last 10 user action names from a closed `ActionName` union (oldest first).
  - `device`: platform/device category (`android`, `ios`, `windows`, etc.).
- Every `report` wire event also carries the crash `message` so reports can be grouped and identified in the collector.
- No project data, no user values, no names, and no filenames are included.
- `RecentActions` implements a 10-item ring buffer injected through `ErrorContext` in `main.ts` and provided to `CrashReports`.
- Privacy text updated on `AboutPage.vue` to describe the anonymous diagnostic fields.
- Verified by `packages/ui/test/logic/telemetry/errorContext.test.ts` and `packages/ui/test/logic/telemetry.test.ts`.


## Resolution (T563)
- Cause of the gap: a `NoFocusedProjectError` was only written to the console, so the collector never saw
  which screen, dialog, project count or last actions went with it. Only other errors were sent.
- Now `CrashReports.logOnly` sends it as an `error` event with the full anonymous context (and the
  version on the wire event), with no crash screen and no report box. The reader that asks shows in the
  `frames` and `actions` fields of the next live occurrence.
- Verified by `packages/ui/test/logic/telemetry.test.ts` ("CrashReports.logOnly"), red before, green after.
