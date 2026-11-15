# BUG_20261115_visual-baselines-cover-no-dialogs

**Status:** FIXED by T793 (reworked after the T817 revert: see the last section) (the left-out views below are listed with their reasons)

## Symptom

The visual baselines (`packages/ui/test/visual/screens.ts`) pictured only the empty screen, the wizard steps,
the main tabs, the phone menu and the box types. No dialog, popup, sheet, menu or help panel had a baseline,
so a change that broke one (clipped, moved, restyled) turned nothing red. T230 had said "every screen in both
skins". John: "every screen in the app is meant to have regression testing".

## Steps to reproduce (before T793)

1. `grep -c "screen(" packages/ui/test/visual/screens.ts`: 60 screens, none of them a dialog.
2. Change the Options dialog's padding and run `bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts`.
3. Observed: every visual test passes. Expected: `desktop-dialog-settings-options-general` and the phone
   Options screens fail.

## Evidence

- `packages/ui/test/fixtures/viewIndex.ts` lists every view and popup in both skins, and `fixtures/viewOpen.ts`
  `openTargets()` gives each (view, skin) a real-UI open step (the layout walk uses them). None of them reached
  `screens.ts`.

## Fix (T793)

`screens.ts` now adds one screen per popup in `openTargets()`: kinds dialog, sheet, menu, help, field note,
warning popup, error popup, inline expansion and driver browser. Each tab of a tabbed dialog is its own view.
Each opens from the complete-driver project, through the same open steps the layout walk uses. That makes 185
new baselines (82 desktop, 103 phone); with the 60 before, 245 screens. Pages, tabs and wizard steps were
already pictured.

### Found on the way: a frozen clock broke clicks

`VisualSkin.start` used `page.clock.setFixedTime`. Vue skips an event handler attached at or after the event's
`Date.now()` stamp (`runtime-dom` invoker, `e._vts <= invoker.attached`). With a frozen clock every stamp is
equal, so a parent's `@click.stop` never ran. Example: the phone menu's Save As / Export opened and the click
then reached the document listener, which closed it again. The clock now starts at `FIXTURE_DATE` and runs
(`clock.install` + `clock.resume`). All 60 earlier baselines came out unchanged.

### Screens that drew two ways, fixed at the open step (CI run 43678501129 and a local two-pass sweep)

- `desktop/cloud/conflict-notice`: the notice shows while the first sync run is still ending. The toolbar badge then
  reads "2 changes will sync in a moment" (busy glyph) and the project rows are "not on Drive yet"; the app's 3 s
  sync debounce then runs a second run that uploads the conflict copy, and the badge settles on "kept both ... Tap
  to see them" (alert glyph, red badge) with every row on Drive. The app always ends in that one state (probe: same
  sequence in every run, nothing after 7.5 s), so it is not an app bug: the open step now waits for the badge's
  tooltip to say so.
- `desktop/cloud/reconnect-strip`: the strip reads "1 change not synced" at once and "2 changes not synced" when
  the same debounce fires; the step waits for the second.
- `refresh` (phone): `/about/refresh/` replaces itself with the app; the picture was the "Updating" page, the app
  starting, or the app, by chance. The step waits for the address to move to `/?_openisd_refresh=` and the project's
  Box page to show.
- The three phone cloud screens left out for the box-type width flake are pictured again: that flake was fixed (T795, T798).

### Masked parts (only one on the popup screens; a selector that matches nothing masks nothing)

| Part                                                         | How                                                             | Why                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------- |
| "This site uses … of the … this browser allows"              | not masked: `VisualSkin.start` fixes `navigator.storage.estimate` | The browser works the quota out from the disk; the screen gets a fixed answer. |
| "Projects saved in this browser at http://localhost:<port>/" | not masked                                                      | The suite and the re-take serve on port 4300 (`OPENISD_TEST_PORT`); only a local pooled port differs, and a local run cannot match CI's pictures anyway. |
| Phone About "Build · <date>" (`[data-testid="about-version-line"]`) | masked                                                   | The build's own date; it belongs to the build. |

The build stamp in the toolbar was masked before T793 and still is.

### Not pictured, and why

| View                                                                  | Skin    | Why                                                                                                     |
| --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `shared/flash-message`, `phone/flash-strip`                           | both    | Fade out by design a few seconds after they show; no stable picture.                                    |
| `diagnostic-repairs`, `desktop/diagnostic-repairs`                    | both    | The fault report prints a stack trace naming the hashed bundle (`main-<hash>.js`) and the test port.    |
| `startup-failure`, `desktop/startup-failure`                          | both    | Same: a stack trace with the bundle hash and the port.                                                  |
| `cloud`, `cloud-confirm`, `desktop/settings/cloud/account-and-activity`, `desktop/cloud-confirm` | both | The signed-in step's Google stand-in (`stubGoogleApis`) answers Drive's create with a file list, so the dialog shows "Sync failed ... Retrying at <time>" (now plus the retry delay). Needs the Drive emulator the conflict notice uses, and a wait for "Synced". |
| `native-select`, `native-colour`, `native-title`, `desktop/projects/trace-colour-picker` | as listed | Drawn by the browser or the OS (`NoOpenReason.BrowserOwned`).                         |
| `cross-tab`, `desktop/cross-tab-notice`, `shared/driver-library-storage-note`, `phone/response-model-pending-notice`, `desktop/enclosure/response-model-pending-notice`, `desktop/results/chart-unavailable-notice`, `desktop/wizard-help` | as listed | The index lists a view the app cannot show (`NoOpenReason.IndexDisagrees`). |

Pages and tabs not yet pictured (charts, filter cards and editors, the desktop enclosure tabs and What-if panel,
the phone Box page per box type): about 100 more. Those are screens, not popups, and are outside T793.

### Seen while reviewing the pictures (not changed here)

- The existing baselines `mobile-wizard-bandpass6-step3` and `mobile-wizard-bandpass4-step3` each failed once on a re-run: the same box-type width flake
  as BUG_20261115_mobile-wizard-box-type-select-width-varies. T793 left main's picture in place.

## Review of the pictures (T816)

A look at the CI-drawn pictures found baselines that did not show the view they were named for. `packages/ui/test/visual/pictureSet.ts` now names each case and
`packages/ui/test/architecture/visual-baselines-distinct.test.ts` fails when a committed picture breaks it: no two pictures are equal unless declared
(`SAME_PICTURE`), no `<skin>-dialog-*` picture equals the new base screen `<skin>-complete-project` (the project the popups open from), and a left-out view has no picture.

| Picture | Verdict |
| --- | --- |
| `desktop-dialog-projects-import-file`, `desktop-dialog-driver-import-file` | Cannot be shown: Import raises the browser's file chooser; the page was left as the Box tab / the driver editor's Parameters tab. Removed. |
| `mobile-dialog-refresh` | Cannot be shown: the page replaces itself with the app, so its picture is the base screen. Removed. |
| `mobile-dialog-driver-import` | Same view as `mobile-dialog-driver-more` (Import is a row of the More menu). Kept the latter. |
| `mobile-dialog-native-files` | Same view as `mobile-dialog-project-import`. Kept the latter. |
| `desktop-dialog-shared-winisd-difference-entry` | Same view as `desktop-dialog-difference-cue`: the desktop dialog has every entry unfolded. The phone one (an entry unfolds) stays. |
| `desktop-dialog-driver-search-filters` | Same dialog as `desktop-dialog-driver-library-overview`. Kept the latter. |
| `*-vented-tuning-warning` (both skins) | Same screen as `*-vented-volume-warning`: both warnings show in the one wizard step. Kept the volume name. |
| `mobile-dialog-menu-advanced` | The menu item opens the Advanced page, the tab `mobile-tab-advanced`. Removed. |
| `mobile-dialog-menu-splashmodal` | Same About dialog as `mobile-dialog-about-version`. Kept the latter. |
| `desktop-dialog-shared-chart-readout` | Own view: 0.3% of its pixels differ from the base screen, the read-out box. Kept. |
| `*-losses-front` / `*-losses-rear`, `cloud-hint` / `cloud-reconnect-strip` | Own views (heading, chamber, strip text differ). Kept. |
| `mobile-wizard-sealed-step1` = `step2` (and desktop) | A screens.ts fault: "step 1" pressed Next once and so showed step 2. Step 1 is now the driver list. |
| Wizard step 4 (abc, bandpass6) and step 5 (five box types) | Same screen for those box types: declared in `SAME_PICTURE`. |

Other findings: the Options dialogs showed "johnl" as the Username input's placeholder text, written in `OptionsModal.vue`; it is now "Your name". The storage line
"1.2 MB of the 2.3 GB" on `options-your-data` is the stubbed quota of `VisualSkin.start`, not the runner's; the storage-warning screens set their own stub ("99 B of the 100 B"),
so no storage screen reads the machine's quota. The phone Tune sheets' rows sit in `.mob-sheet-rows`, `overflow: auto`, 171 px high, and scroll: the cut row is at a scroll edge, reachable.
The crash report card covering the diagnostics buttons is `BUG_20261115_crash-report-card-covers-diagnostics-buttons`. Masks now: the build version in the phone menu header
(`[data-testid="app-version"]`, on every screen showing the phone menu: menus, confirmations, exports) and the phone About "Build · <date>" line (`[data-testid="about-version-line"]`).

### After the T817 revert (rework)

- The screen list is split by `Screen.kind`: `page` (empty, wizard steps, tabs, box types), `base` (`complete-project`, the project popups open from) and `popup`.
  `unit-label-underline`, `field-visual-contract` and `scripts/capture-approved-field-paint.ts` walk `PAGE_SCREENS`: they measure the page's own field surface and
  compare units with a frozen per-screen reference (`approvedJoinedPaint.json`, never refreshed from the app under test). A popup's page is only its backdrop, and a popup's
  fields are measured by `view-layout-walk` and `field-layout-rules`, which open every popup. `driver-summary-contract` measures `body` and walks all screens.
  `scripts/visual/screen-names.mjs` gives every popup and the base screen a plain name.
- The outside review (REVIEW.md) is resolved: `native-keyboard` joins the cannot-be-shown list; the phone pick-error, tuning-unreachable and incomplete-warning steps scroll to their message
  (it sat below the first screen); the crash step writes its own stack so no test-harness frame is in the picture; the vented warnings are one screen made with a deliberately narrowed band
  (1-2 L, 1-2 Hz, set in Options by the step, so the text is true); the storage figures are the app's mixing of two measures (own bug file). `mobile-empty` is right (No project open).
  The app defects it found each have a bug file dated 20261115.

### Second review round (PR 114)

- Left out of the set, each with its reason in `pictureSet.ts`: `mobile-dialog-project-import` (Open a file raises the browser's file chooser; the picture was the phone menu), and the four
  storage screens (`WAITING_FOR_FIX`): a real user can see "99% full (1 project, 20.7 KB of 5 MB used)" when the site's allowance is full and the local store is not, so the sentence is an app defect
  (`BUG_20261115_storage-warning-mixes-site-and-local-numbers`) and a baseline must not freeze it. The architecture test checks the named bug file exists.
- Nothing is left in a "no stable picture" list any more; each was a cause, not a difficulty:
  - `flash-message`, `phone/flash-strip`: the strip is a 2 s JS timer (`logging/flash.ts`); the picture pauses the page clock (`page.clock.pauseAt`) the moment the strip shows.
  - `diagnostic-repairs`, `startup-failure`: the fault text names the build's hashed bundle and address; those parts (the stack lines, the "did not load" line) are masked on those views only. The value belongs to the build.
  - the four signed-in cloud dialogs: their Google stand-in answered Drive's create with a file list, so sync failed ("Retrying at <time>"). They now use the Drive emulator answering in the order asked
    (the app sends several creates at once and the Activity list shows the order they finish in), and wait for "Synced".
- `about-version` scrolls to the Version section and masks its heading and stamp (the running build's own date).
- Wizard step 1 is now the driver list as the wizard opens it. Before, "step 1" clicked a driver and pressed Next, so it was step 2 (desktop) or the driver summary (phone), and
  `wizard-sealed-step1` equalled `wizard-sealed-step2`. This corrects a mislabelled baseline on main.
- `<skin>-complete-project` stays: popups open from the complete-driver project, `tab-box` is the sample project, so only it is the exact "nothing opened" picture the gate compares with.
- The four driver-editor fields with a heavy border (Fs, Vas, Re, Sd on `desktop-dialog-driver-editor-parameters`) are the driver's mandatory inputs: the app sets
  `de-input-mandatory` (2 px border) on them by design (`style.css`, `NumInput.vue`). Not a defect.
- New defect files from the review: `lr2-size-line-states-one-section-not-two`, `qes-qms-qts-help-sentence-ambiguous`.
