# OpenISD — backlog

Open work, verified against the code on 6 Nov 2026. Shipped and obsolete items from the
previous backlog are gone; the full verification is
[docs/_archive/BACKLOG_2026-09-25.md](docs/_archive/BACKLOG_2026-09-25.md). Planned features
(new box types, charts, filters) are in [FEATURES.md](FEATURES.md#planned), not here — this
list is the smaller engineering and UI work items around what already ships.

## Design tools and wizard

| Item | Files |
|---|---|
| The wizard's default vent diameter for a vented and a 4th-order bandpass box is 0.05 m; WinISD's is 4 in (0.102 m), which the 6th-order bandpass and ABC defaults already use. | `packages/design/domain/box/openISDBox.ts` |
| For 6th-order bandpass and ABC the wizard's fourth step takes chamber volumes and tunings; WinISD's wizard shows a disabled "<None available>" state there. Not rechecked against WinISD. (from the vented wizard remainder list, 12 Oct 2026) | `OriginalNewProject.vue` |
| End correction is a choice of three presets (0.613, 0.732, 0.849); there is no free-entry field, though WinISD's box can be typed in. | `packages/design/fields/options.ts`, `packages/design/domain/boxDefaults.ts` |
| The driver editor has mandatory-field marks but no step-by-step guided entry flow. | `DriverEditorModal.vue` |
| Decisions the app makes silently (alignment seeding, auto-calculated fields) are explained only by the wizard's Placement and EBP popups, the equation inspector and the DQ marks. | `OriginalNewProject.vue`, `OriginalShell.vue` |

## Ideas — logged, not for execution

| Idea | Files |
|---|---|
| A "Was calculated" (W) field state (John, 16 Oct 2026). In a set of linked fields, clearing the one entered (E) value turns a calculated (C) value into W: half way to E, held as the input, but never typed by the user. W shows in its own indicator colour. States: Entered, Was calculated, Calculated, NotAvailable. John: "this is too much work, so just log it as an idea not for execution". | `packages/design/domain/cell.ts`, `pairedField` |

## Charts and UI

| Item | Files |
|---|---|
| **Feature request — PR selection summary (John, 28 Oct 2026):** The passive-radiator picker should show a selected-item information summary like the Driver picker, so the user can inspect its specifications, units and data-quality status before choosing it. Currently PR has no equivalent dedicated summary (phone rows show a short specs line; desktop names have specification tooltips). Logged for a separate feature; not part of the popup-size/stacking fix. | `PRBrowser.vue`, `PRBrowser-hooks.ts` |
| No frequency-range presets on the charts. | `OriginalShell.vue`, `presentationState.ts` |
| Chart panels cannot be dragged into a different layout. | `GraphPanel.vue`, `OriginalShell.vue` |
| No dB-per-division gridline setting (spacing is fixed). | `canvas.ts`, `OptionsModal.vue` |
| Vb/Fb cannot be dragged directly on the enclosure-tuning graph. | `GraphPanel.vue`, `canvas.ts`, `ventGroup.ts` |
| The vent solver has no feasible-region chart (diameter vs length, iso-Fb lines, a safe-velocity band). | `series.ts`, `canvas.ts`, `ventGroup.ts` |
| The box picture is one fixed drawing per box type; no schematic follows the entered volumes, vent and driver. | `BoxTypeDiagram.vue` |
| Whether the URL should update live (bookmarkable) or only through Share is undecided. | `applicationIO.ts`, `App.vue`, `packages/persistence/src/repos/projectRepo.ts` |

## Files and driver data

| Item | Files |
|---|---|
| No import path for Unibox project files. | `fileImportExport.ts`, `fileFormat.ts` |
| A saved driver never re-syncs with a later catalogue update to the same model. | `driverSelection.ts`, `OriginalShell.vue` |
| Cloud sync works through Google Drive only; no other backend (Dropbox). | `packages/design/cloud`, `CloudSync-hooks.ts` |
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
| No knowledge base: help is the per-screen help, the chart help pages and field tooltips. |
| No guided tutorial project. |

## Engineering

| Item | Files |
|---|---|
| `bundle-drivers.mjs` runs the `openisd.json` round-trip check on every record; the `.wdr` round-trip check (`checkWdrRoundTrip`) still runs only in a test. | `scripts/roundTripGate.mjs`, `scripts/bundle-drivers.mjs` |
| ESLint enforces the engine's one-door imports, no re-exports, no type assertions and no import cycles; the other architecture rules are hand-written tests, not lint rules. | `eslint.config.js`, `packages/design/test/architecture-*.test.ts` |
| The speakerbox-lite parity scenario (`sbl`) is declared but never filled in. | `packages/ui/test/scenarios.ts` |
| Evaluate Chrome DevTools MCP as an alternative to Playwright for UI testing. | research spike |

## Agent and CLI use

| Item | Files |
|---|---|
| An AI in a phone chat app drives OpenISD (John, 12 Oct 2026; changed 7 Nov 2026). The AI inside the Android ChatGPT or Gemini app (and Google AI Mode if it can) runs OpenISD commands itself: it takes the user's inputs, runs the trials and shows the results and charts in the chat. The user never copies results between apps. Users are worldwide. Not a local command-line install, and not MCP (Google's custom MCP apps are US only). The commands use the app's own engine (no second copy of the maths). Before any design, check what a chat app can really do with one small live test at a time, for example whether it can build a web address and read the answer. | new package, `packages/design` engine |
| An AI agent inside OpenISD (John, 8 Nov 2026). The user types a request in plain words in the app. A server that holds John's AI API keys sends it to the model. The model answers, and it can change the open project through tool calls (set inputs, add or change a design). Every change it makes shows on screen. | new server, `packages/design` engine |

## Cross-repo

Items outside this repository, tracked here because openisd's docs depend on them:

- Physical-dimension extraction and driver-type classification/matching are `winisd_tools`
  design work; see its `DESIGN.md`.
