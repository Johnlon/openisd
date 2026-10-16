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
| The 4th-order bandpass wizard step offers 8 ripple/gain options, but no formula for them is sourced, and bandpass4 keeps the hardcoded 0.05 / 35. (from the vented wizard remainder list, 12 Oct 2026) | `OriginalNewProject.vue`, `OriginalNewProject-hooks.ts` |
| For 6th-order bandpass and ABC the wizard should show WinISD's disabled "<None available>" state. (from the vented wizard remainder list, 12 Oct 2026) | `OriginalNewProject.vue` |
| End correction is a fixed preset (0.613); there is no free-entry field, and the default itself needs settling against WinISD's 0.732 (every WinISD-saved `.wpr` carries 0.732; 0.6 is our harness writer's own default, not WinISD's). | `packages/design/domain/openisdSchema.ts`, `packages/design/fields/options.ts` |
| The driver editor has mandatory-field marks but no step-by-step guided entry flow. | `DriverEditorModal.vue` |
| Decisions the app makes silently (alignment seeding, auto-calculated fields) have no on-screen explanation beyond the EBP badge and DQ marks. | `OriginalNewProject.vue`, `OriginalShell.vue` |

## Ideas — logged, not for execution

| Idea | Files |
|---|---|
| A "Was calculated" (W) field state (John, 16 Oct 2026). In a set of linked fields, clearing the one entered (E) value turns a calculated (C) value into W: half way to E, held as the input, but never typed by the user. W shows in its own indicator colour. States: Entered, Was calculated, Calculated, NotAvailable. John: "this is too much work, so just log it as an idea not for execution". | `packages/design/domain/cell.ts`, `pairedField` |

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

## Agent and CLI use

| Item | Files |
|---|---|
| An agent-friendly OpenISD that runs at the command line (John, 12 Oct 2026): a local tool, installed from npm packages of the app's own code, that takes inputs, gives help, gives results and generates charts. Probably exposed to agents through a skill or an MCP server. Needs design and thought first: which inputs and commands, one engine shared with the app (no second copy of the maths), chart output format, how an agent discovers what it can do. | new package, `packages/design` engine |

## Cross-repo

Items outside this repository, tracked here because openisd's docs depend on them:

- Physical-dimension extraction and driver-type classification/matching are `winisd_tools`
  design work; see its `DESIGN.md`.
