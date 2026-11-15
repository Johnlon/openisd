# BUG_20261115_reload-question-says-unsaved-changes-are-discarded-but-they-are-kept

**Status:** RESOLVED (T829)

## Symptom
John, 15 Nov 2026, on the test site: "pulling a new version says you lose unsaved but that's not true".
When a newer build is offered and an open project has unsaved edits, Reload and About's Force refresh ask
"Discard changes? Reloading discards all unsaved changes." (Reload / Keep). After pressing Reload every edit
is back and the project still shows as unsaved. The question was false, and it made users hesitate to take
an update.

The opposite defect sat beside it: the things a reload really loses were never asked about. An open driver
editor with values typed and not applied, and a What-if with values tried, are lost on any reload, and with
no unsaved project edit the app reloaded itself with no question at all.

## Steps to reproduce
Both skins (desktop, and a 390 px window for the phone skin), build 20261115 and earlier.
1. Open `packages/ui/test/fixtures` sample project (`build/test-fixtures/sample-project.owpr`).
2. Box tab, set Volume to 55.5 L (the project is now unsaved).
3. A newer build waits (in the browser suite: `deliverWaitingBuild`). The strip "New version available"
   shows. Press Reload.
4. Observed: "Discard changes? Reloading discards all unsaved changes." Press Reload.
5. After the load: Volume is 55.5 L and the project shows Unsaved changes. Expected: no question, since
   nothing is discarded.
Second defect: open the driver editor (Driver tab, Edit), type Fs 33 in Parameters, do not press OK, deliver
a waiting build on a project with no unsaved edits. Observed: the page reloads by itself, no question, the
value is gone (on desktop the editor reopens showing the old Fs).

## Evidence
A browser probe (scratch spec, 15 Nov 2026) ran edits of every kind (box volume, chosen driver, a driver
parameter applied with OK, a filter added, series resistance, a project rename, and a second open project also
edited) and reloaded by the update prompt's Reload, About's Force refresh, a plain reload and a closed and
reopened tab, on both skins: all 8 combinations brought every edit of both projects back and both showed as
unsaved. A value typed and not yet committed with Tab also survived a plain reload (the box commits as you
type). Cases that lost something: storage refusing the session write (edit made after the refusal gone), a
driver editor draft, a What-if. Closing without saving and Revert were checked and do what they say.

## Cause
`createAppUpdateUi` asked whenever any open project was unsaved (`packages/ui/src/hooks/appUpdateUi.ts`), on
the belief that unsaved means lost. But `startSessionSync` (`packages/ui/src/logic/sessionSync.ts`) writes the
whole open-project session (saved and edited layers, `toStoredText`) on every change, so unsaved edits are
restored by `bootApplication`. What is not in the session: a driver editor draft (a detached driver until OK),
a What-if layer (`cloneSession` leaves it out), and any write the browser's storage refused (`createWebStorage.set`
swallows the error, so nothing tells the app). On a read-only backup (store opened in memory) nothing is stored.
A plain browser reload no longer reopens the driver editor or What-if panel (T829): their values are never stored.

## Fix
The question is asked only when something is lost, and says what: the store refused the session, the app runs
on a read-only backup, an open driver editor holds values not applied, a What-if holds values. Unsaved edits
the session holds are never asked about. A waiting build is offered, not switched to unasked, while an editor
draft or What-if holds values.

## Verification
`packages/ui/test/ui/app-update.browser.spec.ts` (both skins): Reload and Force refresh with an unsaved edit
reload at once and the edit is back, still unsaved; a refused store asks and names it; a driver editor draft
holds the offer; a What-if is named. Unit: `reloadLosses.test.ts`, `appUpdateText.test.ts`,
`appUpdateUi.test.ts`, `driverDraft.test.ts`, `projectRepo.test.ts`, `project-what-if.test.ts`.
