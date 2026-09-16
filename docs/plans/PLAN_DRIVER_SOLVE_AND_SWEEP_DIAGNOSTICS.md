# PLAN — DRIVER SOLVE AND SWEEP DIAGNOSTICS

**Status: LIVE — kept up to date as tasks close.** 2026-09-16 rewrite: dropped the accreted
design-history layers (original sketches, corrections, convergence essays — preserved in git
history) and replaced them with the current components, the APIs the plan references by name,
the built state, and the remaining steps. Review that prompted this:
`docs/reviews/REVIEW_DRIVER_SOLVE_SWEEP_PLAN.md`.

---

## 1. Goal

Make sweep diagnostics name the blocking field, not a blank chart.

The sweep can silently fail: an unsized vent port (no `tuning_hz`, no `length_m`) produced
`sweep().issues === []` while `Leff` went undefined and `zmag`/`exc`/`pv`/`gd` went `NaN`; only
the UI's generic postcondition caught it. Rules driving the shape:

- Every calculation's result is `CalculationIssue<Q>` — a discriminated union over the quantities
  the calculation owns. No hand-copied unions per node.
- A channel that **blocks the whole sweep** (`values` null) is embedded in `SweepIssue` — real
  issue objects, never a reference array pointing at them ("blocking/advisory split", appendix
  2026-09-15).
- A channel where the sweep **did produce a curve but one output is degraded/unbounded** is an
  advisory reference (`driverPrerequisites`) — never a duplicated DQ.
- One missing-field diagnostic per absent field, naming exactly what to state. No cross-field
  substitution suggestions (QO144).
- UI projections and cell DQ must be the same generic mechanism every channel uses — no per-node
  hand-rolled rule without a stated reason.

## 2. Decisions already made (rulings)

| Ruling | Date | What it decided |
|---|---|---|
| QO142 | 2026-09-15 | `sweep()`/`maxCurves()` return `CalculationIssue<Q>`- based results; no parallel old-style path (`SweepSolveResult`/`MaxCurvesSolveResult`). |
| QO143 | 2026-09-15 | `maxspl`/`maxpwr` `+Infinity` (no Pe/Xmax) is a correct answer, not a blocker → a separate advisory `driverPrerequisites`, labelled "state Pe or Xmax to bound this curve". |
| QO144 | 2026-09-15 | One `missing-dependencies` issue per absent circuit field; per-target routes; `singleFieldUnblockers` deleted. |
| QO145 | 2026-09-15 | Configuration: no new issue type; unsimulated `bandpass6`/`abc` → plain `DriverError` "Not yet implemented" at the store. `ConfigurationPrerequisite` deleted. |
| Appendix | 2026-09-15 | Blocking/advisory split (above). Vent/PR/sealed/box-params channels widen `SweepIssue`; Signal gets no channel (power/voltage cannot disagree by construction). Seven `*Prerequisite` types were dead and deleted (T3). |

## 3. Components

| Component | Job | Files |
|---|---|---|
| Issue/route/prereq types + driver solve | generic `CalculationIssue<Q>`/`SolveRoute<Q>`/prerequisite shapes; driver relation table, `checkConsistency`, `solveDriver` | `packages/design/engine/consistency.ts` |
| Group solvers + checks | vent/PR/sealed-alignment consistency groups and their `check*` | `packages/design/engine/solver.ts` |
| Box params | `requiredParamsFor` + `validateParams` (`DriverError[]`, legacy) + `checkBoxParams` (`BoxParamsIssue[]`) | `packages/design/engine/params.ts` |
| Signal | `solveSignal` (pending T5) | `packages/design/engine/signal.ts` |
| Air | air constants, reference env, `environmentIssues` | `packages/design/engine/air.ts` |
| Sweep | `SweepIssue` union; `engine.sweep`/`maxCurves`; `classifyFinite*` postconditions | `packages/design/engine/sweep.ts` |
| Engine facade | one composition root exposing every above function | `packages/design/engine/Engine.ts` |
| Domain | `OpenISDProject` windows, `sweep()`/`maxCurves()` with box guards, per-field DQ getters | `packages/design/domain/openisdDomain.ts` |
| Store | `doSweep`, `allIssues`/`paramIssues`/`sweepErrors`, `boxTypeIsSimulatable` | `packages/ui/src/logic/appState.ts` |
| Projection | `SweepIssue` → `DriverError`, `DriverPrerequisite` → warn | `packages/ui/src/logic/sweepIssueMessage.ts` |

## 4. API reference (what this plan references by name)

### Types — engine

| Symbol | Definition / location |
|---|---|
| `SolveRoute<Q>` | `{formula, required: readonly Q[], missing: readonly Q[]}` — `consistency.ts:7-11` |
| `CalculationIssue<Q>` | `missing-dependencies` \| `inconsistent-inputs` — `consistency.ts:18-32` |
| `DriverQuantityName`/`DriverIssue`/`DriverSolveResult` | `keyof DriverSolverQuantities`; `{values, issues}` — `consistency.ts:34,35,40-43` |
| `VentQuantityName`/`VentIssue`, `PrQuantityName`/`PrIssue`, `SealedAlignmentQuantityName`/`SealedAlignmentIssue` | instantiated at `solver.ts:25-30` |
| `BoxParamsQuantityName`/`BoxParamsIssue` | `params.ts:27-28` |
| `EnvironmentQuantityName`/`EnvironmentIssue` | `air.ts:118-119` |
| `SignalQuantityName`/`SignalIssue`/`SignalSolveResult` | `signal.ts:29-35` |
| `SweepOutputName`/`CalculationPrerequisite<Q>`/`DriverPrerequisite` | `consistency.ts:250,265,270` — the only prerequisite types that remain |
| `SweepIssue` | `DriverIssue \| EnvironmentIssue \| BoxParamsIssue \| VentIssue \| PrIssue` — `sweep.ts:43` |
| `SweepSolveResult`/`MaxCurvesSolveResult` | `{values: SweepResult\|null, issues}` / `+ {driverPrerequisites}` — `sweep.ts:48,58` |
| `BoxType`/`SimulatableBoxType` | `types.ts:46,55` — `Simulatable = 'sealed'\|'vented'\|'bandpass4'\|'box-passive-radiator'` |

### Engine facade (`Engine.ts`) — one door, all functions

| Method | Line |
|---|---|
| `airFor(env): Air` / `environmentIssues(env): EnvironmentIssue[]` | 54 / 61 |
| `solveConsistencyGroup(p): DriverSolverQuantities` / `checkConsistency(p): DriverIssue[]` / `solveDriver(p): DriverSolveResult` | 82 / 91 / 99 |
| `solvePrConsistencyGroup(p, air)` / `checkPrConsistency(p): PrIssue[]` | 106 / 113 |
| `solveVentConsistencyGroup(p, air)` / `checkVentConsistency(p): VentIssue[]` | 119 / 125 |
| `solveSealedAlignmentGroup(p)` / `checkSealedAlignment(p)` | 131 / 137 |
| `solveSignal(p): SignalSolveResult` (no production caller yet) | 184 |
| `issueFields(issue)` / `issueFormula(issue)` | 192 / 198 |
| `sweep(drv, Le, box, P): SweepSolveResult` / `maxCurves(...)` | 331 / 336 |
| `validateParams(box, P): DriverError[]` (legacy) / `checkBoxParams(box, P): BoxParamsIssue[]` | 341 / 350 |
| `classifyFinite(s)` / `classifyFiniteIssues(s)` / `classifyFlatClamp` / `classifyMaxFinite` | 365 / 370 / 375 / 380 |

### Domain (`openisdDomain.ts`)

| Method | Line | Notes |
|---|---|---|
| `OpenISDDriver.checkConsistency(): DriverIssue[]` | 1517 | entered-values-only adapter |
| `OpenISDProject.sweep(P): SweepSolveResult` | 2752 | early-exit order: `!box` → `!params` → `#boxSweepIssues` → engine |
| `OpenISDProject.maxCurves(P): MaxCurvesSolveResult` | 2763 | mirrors `sweep`; includes `driverPrerequisites` |
| `#engineBoxType()` | 2743 | null for `bandpass6`/`abc` |
| `#boxSweepIssues(box)` | 2775 | dispatches vent/PR guard |
| `#ventSweepIssues('vented'\|'bandpass4')` | 2795 | **both-missing gate**: no tuning and no length → `VentIssue` target `length_m`, formula "(Helmholtz)" (2820-2823) |
| `#prSweepIssues()` | 2835 | **no both-missing gate** — an un-tuned radiator still sweeps |
| `#sweepAir()` | 2783 | `{rho, c}` from the embedded driver |

### Store (`appState.ts`) and projection

| Symbol | Line |
|---|---|
| `sweepErrors` / `doSweep` (dedupes `sw.issues` + `mx.issues` → `sweepErrors`) | 316 / 317 |
| `paramIssues` (via legacy `validateParams`) | 394 |
| `allIssues = [...sweepErrors, ...paramIssues, ...curveIssues]` | 403 |
| `newProject()` / `boxTypeIsSimulatable(box)` | 463 / 473 |
| `sweepIssueMessage(issue): DriverError` / `driverPrerequisiteMessage(p): DriverError` (warn) | `sweepIssueMessage.ts:16` / `:39` |

### How a sweep fails now (the shape T1 built)

- **Driver too incomplete** — engine `circuitQuantities` yields `DriverIssue[]` per absent field (embedded in `SweepIssue`).
- **Box params unstated/zero** — `checkBoxParams` → `BoxParamsIssue` (embedded).
- **Environment out of range** — `environmentIssues` → `EnvironmentIssue` (embedded).
- **Vented/BP4 port has neither tuning nor length** — domain `#ventSweepIssues` → `VentIssue` (blocking, `values: null`).
- **PR target stated but radiator geometry incomplete** — domain `#prSweepIssues` → `PrIssue` (blocking, `values: null`). Radiator with no target at all sweeps un-tuned.
- **Curves present but non-finite** — `classifyFinite*` postconditions → `DriverError` (sweep/maxCurves).
- **Unbounded max-SPL** — `driverPrerequisites` advisory, warn, not an error.
- **Unsimulated topology** — still `{values: null, issues: []}`; this is T4.

## 5. Current state

### Built (verified on the working tree)

| Work | Where | Tests |
|---|---|---|
| Driver T/S unification — `RELATIONS`, `checkConsistency`, `solveDriver`, Engine wrappers, domain entered-only adapter, `environmentIssues`, sealed-alignment group solver | commit `8baba7a` (2026-09-15) | pinning tests in engine + domain suite |
| Sweep unification — `SweepSolveResult`/`MaxCurvesSolveResult`, one issue per missing circuit field, `singleFieldUnblockers` deleted, `sweepIssueMessage` seam | commit `42fcf0b` (2026-09-15) | `hardening.test.ts`, `sweep.test.ts` |
| `driverPrerequisites` advisory + `classifyMaxFinite` exempts `+Infinity` | commit `88c5d28` (2026-09-15) | `hardening.test.ts:250`, `sweep.test.ts:170` |
| **T1** — `SweepIssue = ... \| VentIssue \| PrIssue`; domain vent/PR guards in `sweep()`/`maxCurves()`; `maxCurves` early returns carry `driverPrerequisites: []` | **worktree (uncommitted)** | `domain.test.ts` (RED→GREEN), `store-issue-channel.test.ts` (vent surfaces `field: length_m`, no generic `sweep` postcondition) |
| **T2** — sealed alignment closed as unreachable at sweep time: persisted sealed box is `{volume_m3, losses}` only (`openisdSchema.ts:525`); `#sealedQtc` is a derived readout (`openisdDomain.ts:899`) | **worktree (uncommitted)** | none needed — reading-only verification |
| **T3** — the seven dead `*Prerequisite` types deleted (`consistency.ts`, `engine/index.ts`); unused quantity-name imports dropped | **worktree (uncommitted)** | typecheck + architecture tests; `prerequisite.test.ts` unchanged (only `DriverPrerequisite`) |

Overall: **126 test files / 1875 tests green; three-package typecheck clean** (2026-09-16).

### Open work from the old doc maps onto the steps below

The original "Tests" bullet that names 8 prerequisite arrays (`driverPrerequisites`/…/
`configurationPrerequisites`) is **stale** — only `driverPrerequisites` exists. It is retired by
this rewrite; see §1 rule "never a duplicated DQ" for the surviving intent.

## 6. Remaining steps

| # | Step | Component / APIs | RED test | Acceptance |
|---|---|---|---|---|
| S1 | **Commit T1/T2/T3** | — | — | One commit per task, `[auto]` prefix, never `git add -A` (appendix rule). |
| S2 | **C5 decision — NEEDS JOHN RULING** | `solver.ts`, `consistency.ts` | — | Either bundle vent/PR/sealed/box params into `{values, issues}` result objects to match Driver/Signal, or strike "one shape everywhere" and document the two-pattern split in the doc. See §7. |
| S3 | **T4 — unsimulated topology message** | `appState.ts` `doSweep` (317): when `!boxTypeIsSimulatable(box)` (473) push `{level:'error', field:'boxType', message:'Not yet implemented — <boxType>'}` into `sweepErrors`. Engine/domain untouched. | `store-issue-channel.test.ts`: a `bandpass6` project's `allIssues` has an `/not yet implemented/i` error (today silently empty); one browser spec asserting chart-area text. | QO145 wording shown; `allIssues` non-empty for `bandpass6`/`abc`. |
| S4 | **T6 — hardening regression** | tests only (`hardening.test.ts`) | Assert an unsized vent no longer reaches `classifyFinite`'s generic message (T1 catches it first); keep an engine-level net test: `Leff: undefined` still classified. | Both regressions green. |
| S5 | **T5 — signal data model** | `openisdSchema.ts:~580`; `openisdDomain.ts` `powerDrive_W` (~2432), `driveVoltage_V`/`statedVoltage_V` (~2471/~2507); `signal.ts#solveSignal` | One RED per (a)–(e), below | Signal-tab browser spec + store signal tests pass unchanged; V field shows the DQ when the driver has no Re. |
| S6 | **T9 — `validateParams()` fate — NEEDS QO** | `params.ts`, `appState.ts:394` | raise a QO; only re-point `paramIssues` through `checkBoxParams`/`sweepIssueMessage` and delete `validateParams` if ruled "converge" | Never done unasked. |
| S7 | **T8 — projection parity audit** | read-only | none | A parity table appended to this doc: per channel the ONE domain getter that projects its issues onto cell DQ, or "none". Expected gaps: sealed (none), signal (V-field DQ only, after T5), environment (no Advanced cell reads `environmentIssues()`). |
| S8 | **Folding (post-T9)** | `useDriverCells.ts:65` hand-rolled `fieldsNamedBy` → engine `issueFields` (`consistency.ts:231`, `Engine.ts:192`) | existing cell-DQ tests | refactor, no behavior change |
| S9 | **Keep this doc current** | `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md` | — | annotate each step `Done (date)` with a one-line "why/what", as S1–S4 land. |

### Step S5 detail (T5 — signal)

(a) `openisdSchema.ts` signal record → `{power_W: number | null}` only (`.owpr` schema; `.wpr`
carries only `P` already; `.wdr` unrelated).
(b) `powerDrive_W.set(w)` stops requiring `Re_ohm` — stores `power_W: w`; `.get()` reads it;
`.clear()` stores `null`.
(c) `driveVoltage_V`/`statedVoltage_V`: `.get()` is a pure derivation `√(power_W · Re_ohm)`,
`'calculated'` when both known; when `Re_ohm` is unknown return a `'not-available'` cell carrying
a DQ ("Re is not known yet — voltage cannot be derived") via the same `createCell(..., dq)`
mechanism other derived fields use. `.set(v)` KEEPS the Re guard — converts and stores
`power_W = v²/Re`, never a voltage. Collapse `statedVoltage_V` into `driveVoltage_V` if identical.
(d) `signal.ts#solveSignal()`: delete the `inconsistent-inputs` branch and `voltage_V` as an
entered input; update `signal.test.ts`.
(e) Migration: an old `.owpr` with `voltage_V` in its signal record still loads — accept-and-drop
the legacy key in the zod schema, with a test against a literal old-shape JSON string.

## 7. Open decisions needing John

| # | Question | Status |
|---|---|---|
| T9 (S6) | Retire `validateParams()` and re-point `paramIssues` at `checkBoxParams()` (QO142-style convergence), or keep both channels? | QO to raise. |
| C5 (S2) | Build `{values, issues}` result bundles for vent/PR/sealed/box params, or strike the "one shape everywhere" claim? | Needs ruling. |
| T5 (S5) | Sign-off the `.owpr` schema migration (drop `voltage_V`) and the DQ on the V field. | Needs ruling; own session. |
| T4 (S3) | Deprioritised per QO145 — slot now or after S1? | Needs priority call. |

## 8. Was "remove junk" and what died with it

- `Status: PLAN — not implemented` header → replaced (items are done).
- Original `SweepCalculationResult` sketch with 8 prerequisite arrays → superseded by
  `SweepSolveResult`/`MaxCurvesSolveResult` (verified `sweep.ts:48,58`).
- "Tests" bullet listing all 8 prerequisite arrays → retired (§1 wording kept).
- Convergence essay, old `ConsistencyIssue`/`Q_GROUP_FIELDS` references, ground-truth line
  numbers from before T1 → deleted (git history holds them).
- Item 8's claim that `SealedAlignmentSolveResult`/`VentSolveResult`/`PrSolveResult`/
  `BoxParamsSolveResult` exist → corrected: they do not; the split
  `solve*ConsistencyGroup`/`check*Consistency` pair is what ships (C5).
- The seven dead `*Prerequisite` types → deleted (T3).