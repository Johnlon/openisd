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
- **One solve per component (C5, decided 2026-09-16).** Every node answers ONE question —
  `solveX(inputs) → { values, issues }`. There is no public `check*`/resolver split: issues are a
  product of the solve, not a separate discipline (John: "it's all about solving not checking").
- **DQ lives in the Cell (2026-09-16).** The domain getter attaches the issue text to the Cell it
  returns (`createCell(..., dq)`), and cells, charts and the driver editor read **one** message
  template. Today the wording drifts three ways (formula-only in cells, two variants on charts and
  in the editor) — that is the drift to kill, not to keep.

## 2. Decisions already made (rulings)

| Ruling | Date | What it decided |
|---|---|---|
| QO142 | 2026-09-15 | `sweep()`/`maxCurves()` return `CalculationIssue<Q>`- based results; no parallel old-style path (`SweepSolveResult`/`MaxCurvesSolveResult`). |
| QO143 | 2026-09-15 | `maxspl`/`maxpwr` `+Infinity` (no Pe/Xmax) is a correct answer, not a blocker → a separate advisory `driverPrerequisites`, labelled "state Pe or Xmax to bound this curve". |
| QO144 | 2026-09-15 | One `missing-dependencies` issue per absent circuit field; per-target routes; `singleFieldUnblockers` deleted. |
| QO145 | 2026-09-15 | Configuration: no new issue type; unsimulated `bandpass6`/`abc` → plain `DriverError` "Not yet implemented" at the store. `ConfigurationPrerequisite` deleted. |
| Appendix | 2026-09-15 | Blocking/advisory split (above). Vent/PR/sealed/box-params channels widen `SweepIssue`; Signal gets no channel (power/voltage cannot disagree by construction). Seven `*Prerequisite` types were dead and deleted (T3). |
| C5 | 2026-09-16 | One approach everywhere — bundle every node into `solveX → {values, issues}` (solve-only). Driver/Signal keep existing bundles; vent/PR/sealed/box-params/environment get one. No `check*`/resolver on the public surface. ***This supersedes §4's "before" columns below.*** |
| T9 | 2026-09-16 | `validateParams()` is retired; `paramIssues` re-points through `solveBoxParams(...).issues` via the shared projection. `checkBoxParams` folds into `solveBoxParams`. |
| Text | 2026-09-16 | One `issueToText(issue)` full sentence everywhere: `"<target> cannot be calculated yet — state <formula> (needs <missing>)."` for `missing-dependencies`; `"<fields> disagree by <pct>%: <formula>. Every field in the group is marked — correct one of them, or clear one to let it be calculated."` for `inconsistent-inputs`. Cells, charts, editor read the same string. `.wdr` marks unaffected — `calcMark` renders typed issues via registry templates, not cell DQ text. |

## 3. Components

| Component | Job | Files |
|---|---|---|
| Issue/route/prereq types + driver solve | generic `CalculationIssue<Q>`/`SolveRoute<Q>`/prerequisite shapes; **target**: `solveDriver` only | `packages/design/engine/consistency.ts` |
| Group solvers + checks | vent/PR/sealed-alignment consistency groups and their `check*` — **target**: folded into one `solveVent`/`solvePr`/`solveSealedAlignment` each; group structures stay as private internals | `packages/design/engine/solver.ts` |
| Box params | `requiredParamsFor` + `validateParams` + `checkBoxParams` — **target**: `solveBoxParams` only | `packages/design/engine/params.ts` |
| Signal | `solveSignal` (pending T5) | `packages/design/engine/signal.ts` |
| Air | air constants, reference env — **target**: folded into `solveEnvironment` | `packages/design/engine/air.ts` |
| Sweep | `SweepIssue` union; `engine.sweep`/`maxCurves`; `classifyFinite*` postconditions | `packages/design/engine/sweep.ts` |
| Engine facade | **target**: 7 solves + sweep/maxCurves + classify* + issue fields/formula — nothing else | `packages/design/engine/Engine.ts` |
| Domain | `OpenISDProject` windows, `sweep()`/`maxCurves()` with box guards, per-field DQ getters reading the one solve per node | `packages/design/domain/openisdDomain.ts` |
| Store | `doSweep`, `allIssues`/`paramIssues`/`sweepErrors`, `boxTypeIsSimulatable` | `packages/ui/src/logic/appState.ts` |
| Projection | one `issueToText(issue)`, cells + `sweepErrors` + editor all call the same function (`driverPrerequisiteMessage` stays, warn) | `packages/ui/src/logic/` |

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

### Engine facade (`Engine.ts`) — BEFORE the C5 collapse (what the code ships today)

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

### Engine facade — AFTER the C5 collapse (the target this plan builds, step S2)

| Method | `values` | `issues` | absorbs |
|---|---|---|---|
| `solveDriver(p): DriverSolveResult` | resolved relations, live air | missing routes, contradictions | ✓ exists |
| `solveVent(p, air): VentSolveResult` | `VentSolverQuantities` | `VentIssue[]` | `solveVentConsistencyGroup` + `checkVentConsistency` |
| `solvePr(p, air): PrSolveResult` | `PrSolverQuantities` | `PrIssue[]` | `solvePrConsistencyGroup` + `checkPrConsistency` |
| `solveSealedAlignment(p): SealedAlignmentSolveResult` | `SealedAlignmentSolverQuantities` | `SealedAlignmentIssue[]` | `solveSealedAlignmentGroup` + `checkSealedAlignment` |
| `solveBoxParams(box, P): BoxParamsSolveResult` | the validated `EnclosureParams`, or null | `BoxParamsIssue[]` | `checkBoxParams` + `validateParams` (T9) |
| `solveSignal(p): SignalSolveResult` | drive V/W | `SignalIssue[]` | ✓ exists |
| `solveEnvironment(env): EnvironmentSolveResult` | `{rho, c}` (`Air`) | `EnvironmentIssue[]` | `airFor` + `environmentIssues` |

Kept unchanged: `sweep`, `maxCurves`, `classifyFinite`/`classifyFiniteIssues`/`classifyFlatClamp`/
`classifyMaxFinite`, `issueFields`, `issueFormula`. The raw `*ConsistencyGroup`/`check*` pairs
become module-private internals; the public `check*`/resolver names are deleted (T3-style).

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
| **T1** — `SweepIssue = ... \| VentIssue \| PrIssue`; domain vent/PR guards in `sweep()`/`maxCurves()`; `maxCurves` early returns carry `driverPrerequisites: []` | commit `4ef4327` (2026-09-16) | `domain.test.ts` (RED→GREEN), `store-issue-channel.test.ts` (vent surfaces `field: length_m`, no generic `sweep` postcondition) |
| **T2** — sealed alignment closed as unreachable at sweep time: persisted sealed box is `{volume_m3, losses}` only (`openisdSchema.ts:525`); `#sealedQtc` is a derived readout (`openisdDomain.ts:899`) | verified on the working tree at commit `4ef4327` | none needed — reading-only verification |
| **T3** — the seven dead `*Prerequisite` types deleted (`consistency.ts`, `engine/index.ts`); unused quantity-name imports dropped | commit `9dbc54c` (2026-09-16) | typecheck + architecture tests; `prerequisite.test.ts` unchanged (only `DriverPrerequisite`) |
| Plan rewrite (8 sections, API refs, steps) + the review that prompted it | commit `f424776` (2026-09-16) | — |

Overall: **126 test files / 1875 tests green; three-package typecheck clean** (2026-09-16), after
the three commits above and the C5/T9/Text rulings.

### Open work from the old doc maps onto the steps below

The original "Tests" bullet that names 8 prerequisite arrays (`driverPrerequisites`/…/
`configurationPrerequisites`) is **stale** — only `driverPrerequisites` exists. It is retired by
this rewrite; see §1 rule "never a duplicated DQ" for the surviving intent.

## 6. Remaining steps

| # | Step | Component / APIs | RED test | Acceptance |
|---|---|---|---|---|
| S1 | **Commit T1/T2/T3 + plan rewrite** | — | — | **DONE (2026-09-16)** — commits `4ef4327`, `9dbc54c`, `f424776`; one commit per task, `[auto]` prefix, never `git add -A` (appendix rule). |
| S2 | **C5+T9 — solve-only unification (builds the "AFTER" table above)** | `solver.ts`, `consistency.ts`, `params.ts`, `air.ts`, `Engine.ts`, `openisdDomain.ts` | per node, RED first | one `solveX → {values, issues}` per node; text via one `issueToText`. Detail below. |
| S3 | **T4 — unsimulated topology message** | `appState.ts` `doSweep` (317): when `!boxTypeIsSimulatable(box)` (473) push `{level:'error', field:'boxType', message:'Not yet implemented — <boxType>'}` into `sweepErrors`. Engine/domain untouched. | `store-issue-channel.test.ts`: a `bandpass6` project's `allIssues` has an `/not yet implemented/i` error (today silently empty); one browser spec asserting chart-area text. | QO145 wording shown; `allIssues` non-empty for `bandpass6`/`abc`. |
| S4 | **T6 — hardening regression** | tests only (`hardening.test.ts`) | Assert an unsized vent no longer reaches `classifyFinite`'s generic message (T1 catches it first); keep an engine-level net test: `Leff: undefined` still classified. | Both regressions green. |
| S5 | **T5 — signal data model** | `openisdSchema.ts:~580`; `openisdDomain.ts` `powerDrive_W` (~2432), `driveVoltage_V`/`statedVoltage_V` (~2471/~2507); `signal.ts#solveSignal` | One RED per (a)–(e), below | Signal-tab browser spec + store signal tests pass unchanged; V field shows the DQ when the driver has no Re. |
| S7 | **T8 — projection parity audit** | read-only | none | A parity table appended to this doc: per channel the ONE domain getter that projects its issues onto cell DQ via `issueToText`, or "none". Expected gaps: sealed (none), signal (V-field DQ only, after T5), environment (no Advanced cell reads it). |
| S9 | **Keep this doc current** | `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md` | — | annotate each step `Done (date)` with a one-line "why/what", as S1–S5 land. |

(S6 — `validateParams()` fate — is **absorbed into S2**: T9 ruling made it part of `solveBoxParams`,
so there is no separate step. S8 — folding `fieldsNamedBy` into `issueFields` and the editor's
live-`checkConsistency` call — is **absorbed into S2's text work**.)

### Step S2 detail (C5+T9 — the solve-only unification)

Per node, TDD: pin the bundled solve, watch it go RED, build, rewiring consumers in the same
commit, watch GREEN. Node order: `solveVent` → `solvePr` → `solveEnvironment` → `solveBoxParams`
(`validateParams`/`checkBoxParams` die) → `solveSealedAlignment` → wholesale delete of the public
`check*`/`solve*ConsistencyGroup`/`airFor`/`environmentIssues` names (T3-style trim).

- **Engine**: add seven-row "AFTER" facade (§4). Existing `solveDriver`/`solveSignal` untouched.
  `solver.ts` group solvers + paired checks become private internals of each `solveX`; sweep's
  `environmentIssues`/`airFor` reads (`sweep.ts:219-221`) re-point at `solveEnvironment`.
- **Domain getters**: vent/PR/box/sealed getters read `issues` from the one solve of their node
  (no `check*` call). Driver unchanged.
- **`issueToText`**: one function in the projection layer; deletes the bodies of both
  `sweepIssueMessage` (`sweepIssueMessage.ts:16`) and `consistencyNote` (`useDriverCells.ts:76`),
  which re-implement the same template today. Cell DQ, chart blocks and editor tooltips all run it.
  Vent/PR/box cells switch from formula-only DQ to the full sentence (pinning tests update).
  `inconsistent-inputs` unifies on the editor's longer, actionable form (Text ruling, §2).
- **Driver editor (the one flagged wrinkle)**: `DriverEditorModal.vue:325` and
  `OgTune-hooks.ts:54` stop calling `OpenISDDriver.checkConsistency()`; the spec-cell builder
  (`openisdDomain.ts:1108-1142`) starts attaching DQ so the editor reads `cell.dq()`. Kept-in:
  the `missing-dependencies` *kind* still answers "mandatory-but-unsatisfied" internally — that is
  a private detail of the edited-vs-calculated state, not a public `check`.
- **`.wdr` marks**: untouched. `calcMark` renders *typed* `inconsistent-inputs` issues via the
  Python registry templates (`dqCalculated.ts:266-281`); it never reads `cell.dq()` text, so the
  Text ruling cannot break export parity (verified 2026-09-16).

**Task checklist (mirrors the opencode tracker; each `(auto)` commit on completion):**

| Task | Work | Green check |
|---|---|---|
| S2a | RED `solveVent` bundle; rewire Engine + domain getters + pinning tests | `vent-pr-consistency.test.ts`, domain suite |
| S2b | RED `solvePr` bundle; rewire | same |
| S2c | `solveEnvironment` bundle; re-point `sweep.ts:219-221` | sweep tests |
| S2d | `solveBoxParams` bundle absorbs `checkBoxParams`+`validateParams` (T9); re-point `paramIssues` (`appState.ts:394`) | `params.test.ts`, store tests |
| S2e | `solveSealedAlignment` bundle | sealed-alignment tests |
| S2f | Delete public `check*`/`solve*ConsistencyGroup`/`airFor`/`environmentIssues` (T3-style trim); typecheck + full suite | 1875+ tests, 3-package typecheck |
| S2g | `issueToText` single source; cells/charts/editor read one sentence; formula-only cell DQ updated | cell-DQ + store-issue-channel tests |
| S2h | Driver spec cells attach DQ; editor reads `cell.dq()`; `checkConsistency()` public call gone | driver-editor tests, e2e spec |
| S2i | Fold `fieldsNamedBy` → `issueFields` | existing cell-DQ tests |
| S2j | Update this doc (S2 Done, §4 AFTER verified) + commit | — |

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
| T5 (S5) | Sign-off the `.owpr` schema migration (drop `voltage_V`) and the DQ on the V field. | Needs ruling; own session. |
| T4 (S3) | Deprioritised per QO145 — slot after S2 or now? | Needs priority call. |

(C5, T9 and the Text ruling were decided 2026-09-16 — §2 — and fold into S2.)

## 8. Was "remove junk" and what died with it

- `Status: PLAN — not implemented` header → replaced (items are done).
- Original `SweepCalculationResult` sketch with 8 prerequisite arrays → superseded by
  `SweepSolveResult`/`MaxCurvesSolveResult` (verified `sweep.ts:48,58`).
- "Tests" bullet listing all 8 prerequisite arrays → retired (§1 wording kept).
- Convergence essay, old `ConsistencyIssue`/`Q_GROUP_FIELDS` references, ground-truth line
  numbers from before T1 → deleted (git history holds them).
- Item 8's claim that `SealedAlignmentSolveResult`/`VentSolveResult`/`PrSolveResult`/
  `BoxParamsSolveResult` exist → corrected: they do not; the split
  `solve*ConsistencyGroup`/`check*Consistency` pair is what ships (C5). The 2026-09-16 ruling now
  BUILDS those result types and collapses the split (§4 AFTER, step S2).
- The seven dead `*Prerequisite` types → deleted (T3).