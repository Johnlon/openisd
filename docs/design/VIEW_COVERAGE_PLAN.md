# View coverage plan (T768)

Goal (John, 10 Nov 2026: "I need full coverage, add it, then maintain it"): every (view, skin) pair in
`packages/ui/test/fixtures/viewIndex.ts` is opened and measured by `view-layout-walk.browser.spec.ts`.
Start: 371 pairs, 240 opened, 131 with a reason (ceiling 131, held by
`packages/ui/test/logic/view-walk-coverage.test.ts`). Target: 0 reasons, except views that no user action in
Chromium can put on a page (below), and those stay as a named reason with the proof.

Rules for every step: the spec acts as a user does (screen, controls, a file a user would import). A scripted
stand-in for an outside system (cloud endpoint, announcement endpoint, service worker, browser storage quota)
is allowed. No reading or writing app state objects. Each batch: write the steps, lower `REASON_CEILING`,
`bash scripts/ship.sh`. A real fault the walk finds gets a `bugs/` file and a `KNOWN` entry in the walk spec.

## Maintenance (how a new view cannot slip in)

- A new template branch that is not mapped to an index view fails `branch-map.test.ts`.
- A new index view with no open step gets the default reason `step-not-written`, which raises the count above
  the ceiling and fails `view-walk-coverage.test.ts`.
- The ceiling must equal the count exactly (added in T768): a step written without lowering the ceiling also
  fails, so the ratchet cannot drift.

## Challenge to each "cannot be opened" claim

| Reason | Verdict | Why |
|---|---|---|
| outside-app (5: about, install, refresh, both skins) | Openable | A user types the URL. `page.goto('/about/')` and measure `body`. Batch 1. |
| browser-owned: native-keyboard | Partly | The keyboard itself is the OS. What the app does when it is up is the layout the user sees: shrink the viewport height as Android does, focus a field, measure. The OS keyboard stays out of scope. |
| browser-owned: native-files | Partly | Assert Playwright's `filechooser` event fires from the button (that is "opened"). The OS dialog cannot be drawn in the page. |
| browser-owned: native-select, native-colour, trace-colour-picker | Not openable | The popup is drawn by the browser outside the page; headless Chromium does not render it and no DOM or screenshot of it exists. Keep the reason; the closed control is already walked. |
| browser-owned: native-title (hover tooltip) | Not openable | Browser-drawn tooltip, not in the DOM. Keep the reason. The `title` text itself is checked by the field-title tests. |
| index-disagrees (wizard step 5 of passive radiator) | Needs John | The index lists a step the phone wizard does not have. Remove the row or add the step is his decision. Board item, not a test. |

## Batches (smallest first)

| # | Pairs | Reason cleared | How each is opened |
|---|---|---|---|
| 1 | 5 | outside-app (DONE T769, ceiling 126) | `goto` the static URL, measure `body`. Phone `refresh`: `/about/refresh/`. |
| 2 | 8 | saved-state-needed | See "Saved state" below. |
| 3 | 10 | cloud-account-needed | See "Cloud". |
| 4 | 17 | rejected-input-needed | See "Rejected input". |
| 5 | 18 | fault-needed | See "Faults". |
| 6 | 66 | step-not-written | Click paths, 6a phone dialogs and sheets, 6b desktop, 6c shared (one step per pair, both skins), See "Click paths". |
| 7 | 2 of the 6 | browser-owned | keyboard-up and file-chooser as above. |

### Saved state (8)

| View | Opened by |
|---|---|
| announcements-current (phone, desktop) | Stand-in announcement endpoint (`page.route`, `no-store`) returning a version newer than seen; launch; the modal opens as a user would see it. |
| diagnostic-repairs (both) | Import a project file a user could have (one with a repairable fault), Options > Diagnostics > run repair. |
| shared/driver-library-broken-entry (both) | Import a driver file of a record version this build cannot read through Manage Drivers; the flagged row shows. |
| shared/storage-restore-picker (both) | Save twice so a backup row exists, Options > Your data > Restore on the row. |

### Cloud (10)

Stand-in: `page.route` for the cloud endpoint and sign-in redirect; the app is configured as a user configures it
(Menu > Cloud sync > sign in). Views: cloud, cloud-confirm, reconnect-strip, conflict-notice, hint (phone, 5) and
account-and-activity, reconnect-strip, conflict-notice, hint, cloud-confirm (desktop, 5). Conflict: stand-in returns a
newer copy of an open project. Reconnect: stand-in answers 401 after sign-in. Hint: stand-in offers a project not on the device.
First task of the batch: find how the test build turns cloud on (`architecture-every-build-has-cloud-sync`).

### Rejected input (17)

Type the value in the real field, then measure the message. Vented tuning/volume warnings (wizard, both skins, 4):
enter a tuning below the reachable one in New project > details. Tuning-unreachable (Box tab, 2) same on the tab.
Response-model-pending (2): pick the box type the engine does not model. Passive-radiator pick error (2): pick an unusable radiator.
Options error (shared, 2): type a refused limit. Driver delete challenge (shared, 2): press delete on a saved driver before export.
Driver identity (2): save a driver with no brand. field-dq (phone): tap a field warning.

### Faults (18)

| View | Opened by (no state objects touched) |
|---|---|
| update strip / update (3) | Service-worker stand-in: serve a new build id to the update check. |
| cross-tab notice (2) | A second page in the same context edits the open project, as a user with two tabs. |
| startup-failure (2) | `page.route` aborts the app's lazy chunk: network failure is the outside system. |
| crash (2) | `page.route` serves a lazy chunk that throws when used; the app captures a real runtime error. |
| storage-usage (2) | Stand-in for the browser quota (`navigator.storage.estimate` answers near full) before load. |
| store-gate, storage-warning, driver-library-storage-note (shared, 6), driver-storage-error | Storage blocked at context level (IndexedDB denied) before load: the browser, not the app, is stubbed. |

If a fault cannot be produced without touching app state, it stays `fault-needed` and the plan says which and why.

### Click paths (66)

The index `reach` text is the script. Groups:

- Phone dialogs from menus (27): empty, bin, project-actions, sealed-alignment, vented-alignment, pr-picker, pr-save, chart-data, sheet-port,
  driver-summary-manage, driver-summary-pick, driver-search-filters, driver-export, driver-rename, driver-save, equations, driver-dq,
  options-limits-help, exports, wizard-placement, wizard-ebp, wizard-help, section-help, confirmation, about-version, project-import, driver-import.
  Import menus are opened up to the file chooser (the OS picker is out of scope).
- Phone notes and strips (5): difference-cue, filter-card-body, wizard-isobarik-note, save-note, flash-strip.
- Desktop (16): difference-cue, close-unsaved, sealed-alignment, vented-alignment, chart-unavailable-notice, tab-help-panel, signal/generator,
  equation-inspector, confirmation, driver-rename, driver-disagreement-list, driver-search-filters, options-limits-help, wizard-help,
  wizard-placement-info, wizard-ebp-info.
- Shared, both skins (9 views, 18 pairs): field-catalogue (`?field-catalogue`), flash-message, chart-readout (hover/drag a chart),
  graph-warning-pill, graph-blocked-message, graph-context-menu (right-click), winisd-difference-entry, driver-editor-incomplete-warning, driver-type-help.
