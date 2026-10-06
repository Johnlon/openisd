# OpenISD — backlog

Open work, verified against the code on 2026-09-26. Shipped and obsolete items from the
previous backlog are gone; the full verification is
[docs/_archive/BACKLOG_2026-09-25.md](docs/_archive/BACKLOG_2026-09-25.md). Planned features
(new box types, charts, filters) are in [FEATURES.md](FEATURES.md#planned), not here — this
list is the smaller engineering and UI work items around what already ships.

## Design tools and wizard

| Item | Files |
|---|---|
| The wizard's default vent diameter is 0.05 m; WinISD's is 4 in (0.102 m). | `packages/ui/src/hooks/OriginalNewProject-hooks.ts` |
| The vented alignment picker works only from the wizard. Re-applying a different alignment to an existing vented project has no UI path. | `OriginalShell.vue`, `SealedAlignment-hooks.ts` |
| The wizard has no passive-radiator step. | `OriginalNewProject.vue` |
| End correction is a fixed preset (0.613); there is no free-entry field, and the default itself needs settling against WinISD's 0.732 (every WinISD-saved `.wpr` carries 0.732; 0.6 is our harness writer's own default, not WinISD's). | `packages/design/domain/openisdSchema.ts`, `packages/design/fields/options.ts` |
| The driver editor has mandatory-field marks but no step-by-step guided entry flow. | `DriverEditorModal.vue` |
| Decisions the app makes silently (alignment seeding, auto-calculated fields) have no on-screen explanation beyond the EBP badge and DQ marks. | `OriginalNewProject.vue`, `OriginalShell.vue` |

## Box types not yet implemented

6th-order bandpass and ABC. The engine models both and matches WinISD's charts; the screens
around them are unfinished. Their rows in the box-type pickers are dimmed until these are done
(`BoxEngine.implemented`).

| Item | Files |
|---|---|
| Box page, Vents pane: the 6th-order bandpass and ABC vent fields are fixed placeholder values, not wired to the project's rear, front and intra-chamber vents. The "Response model pending" note there is out of date. | `OriginalShell.vue`, `boxFields.ts` |
| Box losses popup is blank for both types: their losses are per chamber and the popup shows one set. Check WinISD's own dialog under wine first ([bug](bugs/BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md)). | `OriginalShell.vue`, `box.ts` |
| New Project wizard: choosing either type creates the box from starting values; there is no step for the chamber volumes and tunings. | `OriginalNewProject.vue`, `OriginalNewProject-hooks.ts` |
| Mobile skin: the Box and Enclosure tabs show only the placeholder note for both types. | `MobileBoxTab.vue`, `MobileEnclosureTab.vue` |
| Set `BoxEngine.implemented` to true for each type once the items above are done. | `packages/design/engine/box/BoxEngine.ts` |

## Charts and UI

| Item | Files |
|---|---|
| No frequency-range presets on the charts. | `OriginalShell.vue`, `presentationState.ts` |
| Chart panels cannot be dragged into a different layout. | `GraphPanel.vue`, `OriginalShell.vue` |
| No dB-per-division gridline setting (spacing is fixed). | `canvas.ts`, `OptionsModal.vue` |
| Vb/Fb cannot be dragged directly on the enclosure-tuning graph. | `GraphPanel.vue`, `canvas.ts`, `ventGroup.ts` |
| The vent solver has no feasible-region chart (diameter vs length, iso-Fb lines, a safe-velocity band). | `series.ts`, `canvas.ts`, `ventGroup.ts` |
| No schematic view of the box/vent/driver layout. | new component |
| Layout does not adapt to a phone-width screen. | `OriginalShell.vue`, `style.css` |
| Whether the URL should update live (bookmarkable) or only through Share is undecided. | `applicationIO.ts`, `App.vue`, `persistence/projectRepo.ts` |

## Files and driver data

| Item | Files |
|---|---|
| No import path for Unibox project files. | `fileImportExport.ts`, `fileFormat.ts` |
| A saved driver never re-syncs with a later catalogue update to the same model. | `driverSelection.ts`, `OriginalShell.vue` |
| No cloud storage backend (Drive, Dropbox). | new `FileStorage` implementation |
| No script flags near-duplicate driver records. | new `scripts/` check, wired into CI |
| Confirm the `winisd_drivers` corpus was regenerated through the openisd bridge after the Python `.wdr` writer was deleted (2026-09-24); some `.wdr` files may still carry a stale `Gloss=0`. | cross-repo: `winisd_tools`, `winisd_drivers` |

## Construction

| Item |
|---|
| 3D box preview. |
| Cut-list optimiser. |
| STL export. |

## Docs and onboarding

| Item |
|---|
| No in-app onboarding walkthrough. |
| No knowledge-base / help content beyond field tooltips. |
| No guided tutorial project. |

## Engineering

| Item | Files |
|---|---|
| The `.wdr` round-trip gate (`checkWdrRoundTrip`) runs only in a test, not in the build check `bundle-drivers.mjs` calls. | `scripts/roundTripGate.mjs`, `scripts/bundle-drivers.mjs` |
| The architecture lint rules (one-door imports, no casts) are gated by hand-written tests; the equivalent ESLint plugins are not installed. | `eslint.config.js` |
| The speakerbox-lite parity scenario (`sbl`) is declared but never filled in. | `packages/ui/test/logic/scenarios.ts` |
| Evaluate Chrome DevTools MCP as an alternative to Playwright for UI testing. | research spike |
| WinISD parity: field calculations are covered; curve-level parity is blocked because WinISD cannot export curve data. Chart parity relies on manual probes (see [RESEARCH.md](RESEARCH.md#golden-files-from-winisd)). | `packages/design/test/winisd/` |

## Cross-repo

Items outside this repository, tracked here because openisd's docs depend on them:

- Physical-dimension extraction and driver-type classification/matching are `winisd_tools`
  design work; see its `DESIGN.md`.
