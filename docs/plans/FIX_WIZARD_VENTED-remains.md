# PLAN — FIX_WIZARD_VENTED-remains (what the vented wizard work left open)

**Status: OPEN 2026-09-22.** The vented alignment step itself is done — all 5 WinISD
alignments wired bit-exact, plan archived at
[archive/FIX_WIZARD_VENTED.md](http://localhost:8000/winisd/openisd/docs/plans/archive/FIX_WIZARD_VENTED.md?html).
This is the remainder: nothing here is started unless its row says so.

## 1. Outstanding

| # | Item | State | Where |
|---|------|-------|-------|
| 1 | Out-of-range `Qts` (0.15 / 0.20 / 0.70 / 0.80 / 1.0): does WinISD clamp or extrapolate? | DONE 2026-09-22: 25 captures, no clamp, polynomials extrapolate, all reproduce to 2.3e-14. Fixture and doc table hold 60 rows. | [VENTED_ALIGNMENT_FORMULAS.md §6](http://localhost:8000/winisd/openisd/docs/research/VENTED_ALIGNMENT_FORMULAS.md?html) |
| 2 | Product call: outside ~0.25–0.6 the engine now matches WinISD's extrapolated nonsense (C4 at Qts 1.0 → 1684 L, 5.4 Hz; QB3 at 1.0 → 0.99 L). Keep parity, or warn/refuse in the wizard? | RULED 2026-09-22 — "keep parity and use dq — this is the way". Numbers unchanged; implausible ones marked. DONE 2026-09-23: engine, persistence, domain and UI all landed (§2 below) | [plausibility.ts](http://localhost:8000/winisd/openisd/packages/design/engine/plausibility.ts), [appSettings.ts](http://localhost:8000/winisd/openisd/packages/design/engine/appSettings.ts) |
| 3 | `Ql` default for the wizard preview is a hook-local constant (`NEW_PROJECT_VENTED_QL = 10`), not shared with `NO_VENTED_LOSSES` in the schema | Not started. `Rs_ohm` got its single source (`DEFAULT_SOURCE_RESISTANCE_OHM` in `fields/defaults.ts`); `Ql` should follow the same route | [OgNewProject-hooks.ts](http://localhost:8000/winisd/openisd/packages/ui/src/hooks/OgNewProject-hooks.ts), [openisdSchema.ts](http://localhost:8000/winisd/openisd/packages/design/domain/openisdSchema.ts#L1090) |
| 4 | Playwright browser spec `wizard-defaults.browser.spec.ts` updated for C4 + source-loaded Qts but not run | Not run | [wizard-defaults.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/wizard-defaults.browser.spec.ts) |
| 5 | BP4th alignment step: 8 ripple/gain options, no formula sourced. `bandpass4` keeps hardcoded `0.05` / `35` | Out of scope, not ruled on | archived plan §2, §4 |
| 6 | 6th-order bandpass / ABC: wizard should show WinISD's disabled `<None available>` state | Not started | archived plan §2 |
| 7 | Passive-radiator wizard step (Vas/Qms/Fs/Sd/Xmax) — `defaultPassiveRadiator()` fills placeholders today | Not started | archived plan §3 |

## 2. Item 2 — the plausibility mark, as shipped

Ruling: **the designed value never changes.** WinISD extrapolates, OpenISD extrapolates, and
the answer is MARKED instead of clamped. Two judgements: `non-physical` (zero, negative,
non-finite) is absolute; `out-of-range` is judged against a band the user owns.

The band is an **application setting**, not a constant — John: *"we can make the limits
application level limit settings in a new settings tab"*. It reaches a calculation through the
collaborator the engine is constructed with (*"engine can be constructed with a Limit provider
maybe??"*), generalised to `AppSettings` so *"app level stuff can come that route always"*:
every future app-level setting is a new member on that interface, never a new threaded
parameter.

| Layer | Piece | State |
|-------|-------|-------|
| engine | `plausibility.ts` — `ventedVolumePlausibility` / `ventedTuningPlausibility` / `ventedPlausibility` / `plausibilityToText` | done |
| engine | `appSettings.ts` — `AppSettings`, `DEFAULT_VENTED_DESIGN_LIMITS` | done |
| engine | `new Engine(settings)`; `ventedVolumeIssue` / `ventedTuningIssue` / `ventedPlausibility` / `plausibilityToText` | done |
| persistence | `appSettingsRepo.ts` — stores the band, falls back to the factory one on anything unreadable | done |
| domain | `box.vented.volume_m3` DQ, computed at read time, only for the active box type | done |
| domain | `box.vented.tuning_goal_hz` DQ, written by the resolve cascade, appended to the vent solver's own mark | done |
| domain | `OpenISDProject.appSettingsChanged()` — resolve + notify, does not mark the project edited | done |
| ui | appState holds the band, builds the engine from it, calls `appSettingsChanged()` on every open project after a write | done |
| ui | wizard step-4 readout shows the marks | done |
| ui | new Settings tab: min/max volume, min/max tuning, Reset to `FACTORY_VENTED_LIMITS`; renders with no project open | done |
| ui | tests: `appSettings.test.ts`, `OptionsModal-hooks.test.ts`, `OriginalShell-hooks.test.ts` tab set, `settings-vented-band.browser.spec.ts` for the seam | done |

The repaint chain, end to end:

| # | Step | Mechanism |
|---|------|-----------|
| 1 | edit | the Settings tab writes the band through `AppSettingsRepo.setVentedLimits` |
| 2 | engine sees it | `settings.ventedLimits()` is a METHOD, read at call time — never snapshotted |
| 3 | recall | `project.appSettingsChanged()` re-resolves, rewriting the stored marks |
| 4 | notify | the same listener set every design edit fires |
| 5 | repaint | appState's subscriber triggers its refs |

## 3. Not open

- Sealed step — landed earlier.
- The 5 vented formulas — decompiled, validated 60/60 (Qts 0.15–1.0) to 2.3e-14, wired. Don't re-derive.
- `Rs_ohm` default — one constant, `DEFAULT_SOURCE_RESISTANCE_OHM`, used by the prototype
  project, the wizard preview, and the test fixtures.
