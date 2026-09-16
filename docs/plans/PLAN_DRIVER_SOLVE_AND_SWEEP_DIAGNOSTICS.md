# PLAN — DRIVER SOLVE AND SWEEP DIAGNOSTICS

**Status: COMPLETE 2026-09-17 — every step S1–S7 landed (`6161b6c`..`713dbf3`); open items are John's rulings J1–J6 (§6) and the browser-suite re-run.** 2026-09-16 rewrite: dropped the accreted
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
- **DQ lives in the Cell (2026-09-16).** The domain writes a derived value and its issues back
  through the field's OWN write-back primitive — `Field.setCalculated(value, dq[])`
  (`cell.ts:105`, the `SolverField` contract) — never a fourth channel. Cells, charts and the
  driver editor read **one** message template. Today the wording drifts three ways (formula-only
  in cells, two variants on charts and in the editor) and `setCalculated` is never called in
  production — the orphan this step retires, not keeps.

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
| T5 | 2026-09-16 | `voltage_V` is **not part of the OpenISD data model** — a calculated value where needed, like anything else (John). `.owpr` signal record stays `{power_W}`; the V field derives `√(power_W·Re_ohm)` → `'calculated'`, `'not-available'`+DQ when `Re_ohm` is unstated; `.set(v)` keeps the Re guard and stores `power_W = v²/Re`. **No one shares a voltage**: whoever needs it either computes `√(power_W·Re_ohm)` themselves or is passed it (e.g. `solveSignal`'s bundle) — it is never a stored/globally-reachable value. Details = step S5; the write-back contract (§4 apply step) governs the V field's `setCalculated(value, dq)`. |
| T10 | 2026-09-16 | **ALL `*SolverQuantities` numeric bags are DEAD** (John: "I want it dead"): `DriverSolverQuantities`, `VentSolverQuantities`, `PrSolverQuantities`, `SealedAlignmentSolverQuantities` — `solverQuantities.ts` is deleted; a numeric bag never appears at a public engine boundary. Each node's solve consumes its `*SolverParams` handle map (the `SolverField`s the solver defines, implemented by things like the driver — `Field<T>`, `cell.ts:47`) and writes derived values onto them via `setCalculated(value)` / clears with `setNotAvailable()`. Raw numbers survive only as a **private working set inside the engine** (the tolerance/perturbation machinery operates on copies, never on live handles). `*QuantityName = keyof <Node>SolverParams`. The C5 `.values` result types retract — node solves return their `issues` only. Box/signal/environment never had a `*SolverQuantities` bag — unaffected. |
| T11 | 2026-09-16 | **One value, one flag — flat in the OpenIsdJson** (John: "it gets written into the Json simple as that… do not muddle semantics"). A spec field stores THE value plus a state flag `'C'` (calculated) or `'E'` (entered); **absence = `'N'`** (not-available). `setCalculated(value)` writes value + `'C'`; an edit writes value + `'E'`; there is **no separate value channel** for calculated values. Dead with it: the `Field`'s private `isCalculated`/`derivedValue` store (`cell.ts:48-50`) and the "record holds only what was stated" framing (QO127 comment, `openisdDomain.ts:1060-1069`). |
| S7-a | 2026-09-16 | **`Field` is the ubiquitous model type** (John). Every solvable quantity — driver spec AND box fields (`vented.tuning_hz`/`length_m`, `passiveRadiator.tuning_hz`/`addedMass_kg`, sealed `Qtc`/`volume_m3`, …) — is stored as the same `{state:'C'\|'E', value}` entry and read through the same `Field` lens. Plain `number \| null` box fields die. |
| S7-b | 2026-09-16 | **Provenance rides beside the value.** A scraped spec entry keeps its readings/origin next to `{state:'E', value}` as information, never as the place the value is read from. A manual edit replaces the provenance (it becomes user-entered). |
| S7-c | 2026-09-16 | **Project-wide cascade on any write.** `Field.set()`/`clear()` triggers one project-level re-solve in dependency order: environment → driver → vent → PR → sealed. No per-node dependency graph, no store-side `solve()` call. |
| S7-d | 2026-09-16 | **`'C'` entries are a cache — always recomputed on load**, from the browser store and from disk alike. No old-format files exist, so no migration path and no format version bump. |

## 3. Components

| Component | Job | Files |
|---|---|---|
| Issue/route/prereq types + driver solve | generic `CalculationIssue<Q>`/`SolveRoute<Q>`/prerequisite shapes; **target**: `solveDriver` only | `packages/design/engine/consistency.ts` |
| Group solvers + checks | vent/PR/sealed-alignment consistency groups and their `check*` — **target**: folded into one `solveVent`/`solvePr`/`solveSealedAlignment` each; group structures stay as private internals | `packages/design/engine/solver.ts` |
| Box params | `requiredParamsFor` + `validateParams` + `checkBoxParams` — **target**: `solveBoxParams` only | `packages/design/engine/params.ts` |
| Signal | `solveSignal` (T5 ruled 2026-09-16; step S5) | `packages/design/engine/signal.ts` |
| Air | air constants, reference env — **target**: folded into `solveEnvironment` | `packages/design/engine/air.ts` |
| Sweep | `SweepIssue` union; `engine.sweep`/`maxCurves`; `classifyFinite*` postconditions | `packages/design/engine/sweep.ts` |
| Engine facade | **target**: 7 solves + sweep/maxCurves + classify* + issue fields/formula — nothing else | `packages/design/engine/Engine.ts` |
| Domain | `OpenISDProject` windows, `sweep()`/`maxCurves()` with box guards, per-field DQ getters reading the one solve per node | `packages/design/domain/openisdDomain.ts` |
| Store | `doSweep`, `allIssues`/`paramIssues`/`sweepErrors`, `boxTypeIsSimulatable` | `packages/ui/src/logic/appState.ts` |
| Projection | one `issueToText(issue)`, cells + `sweepErrors` + editor all call the same function (`driverPrerequisiteMessage` stays, warn) | `packages/ui/src/logic/` |

## 4. API reference (what this plan references by name)

### Types — engine

| Symbol | Definition / location |
|---|---|---|
| `SolveRoute<Q>` | `{formula, required: readonly Q[], missing: readonly Q[]}` — `consistency.ts:7-11` |
| `CalculationIssue<Q>` | `missing-dependencies` \| `inconsistent-inputs` — `consistency.ts:18-32` |
| `DriverQuantityName`/`DriverIssue`/`DriverSolveResult` | `keyof DriverSolverQuantities`; `{values, issues}` — `consistency.ts:34,35,40-43` |

**The driver's solve surface — `DriverSolverParams`, verbatim** (`solverTypes.ts:30-75`). The
numeric `DriverSolverQuantities` bag is **DEAD** (T10, §2) — no public boundary ever touches it.

```ts
export interface DriverSolverParams {
  Fs_hz: SolverField; Re_ohm: SolverField; Znom_ohm: SolverField; Le_H: SolverField;
  fLe_hz: SolverField; KLe_H_sqrtHz: SolverField; Qes: SolverField; Qms: SolverField;
  Qts: SolverField; Vas_m3: SolverField; Sd_m2: SolverField; Dd_m: SolverField;
  BL_Tm: SolverField; Mms_kg: SolverField; Cms_m_per_N: SolverField; Rms_kg_per_s: SolverField;
  EBP_hz: SolverField; Xmax_m: SolverField; Vd_m3: SolverField; Hc_m: SolverField;
  Hg_m: SolverField; Pe_W: SolverField; no: SolverField; SPLref_dB: SolverField;
  SPL_dB: SolverField; USPL_dB: SolverField; SPLmax_dB: SolverField; SPLmaxLF_dB: SolverField;
  Rme_kg_per_s: SolverField; Mpow_N_per_sqrtW: SolverField; Mcost_kg_per_s: SolverField;
  gamma_m_per_s2_A: SolverField; Gloss: SolverField; Vcd_m: SolverField; Depth_m: SolverField;
  MagDepth_m: SolverField; Magnet_m: SolverField; DVol_m3: SolverField; c_m_per_s: SolverField;
  roo_kg_per_m3: SolverField; Re_terminal_ohm: SolverField; BL_terminal_Tm: SolverField;
  numVC: SolverField; wiring: SolverField<'series' | 'parallel'>;
};
```

Reading this definition:

- **Every member is a `SolverField` handle** — the engine touches nothing else. The solve reads
  `.value`/`.entered`, writes back `setCalculated(value, dq)`, and returns only `issues`.
- The domain supplies these handles: `Field<T>` implements `SolverField` (`cell.ts:47`), and the
  driver exposes one per T/S quantity (`openisdDomain.ts:1101-1135`).
- **Raw numbers still exist, privately**: the engine's working set and the tolerance/perturbation
  analysis (`checkConsistency`'s `halfUlp` re-solves, `consistency.ts:157-176`) can only operate
  on copies of numbers, never on live handles — that numeric map is an internal detail, not the
  API.
- **`DriverQuantityName = keyof DriverSolverParams`** — the same closed 44-quantity universe the
  `wiring`: type inclusion … judges the dead bag used to name, so issues/`issueFields`/
  `issueToText` keep addressing fields unchanged.
- The dead bag held members no relation names (`Hc_m`, `Gloss`, `Magnet_m`, `numVC`, …) so the
  closed quantity vocabulary stays complete — those keys live on in `DriverSolverParams`.
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

### Engine facade — AFTER the T10/T11 collapse (the target this plan builds, step S2)

| Method | writes onto | `issues` | absorbs |
|---|---|---|---|
| `solveDriver(params: DriverSolverParams): DriverIssue[]` | its 44 `SolverField`s via `setCalculated`/`setNotAvailable`; `'E'` never touched | missing routes, contradictions | `solveConsistencyGroup` + `checkConsistency` (`DriverSolverQuantities`/`DriverSolveResult` deleted) |
| `solveVent(params: VentSolverParams, air): VentIssue[]` | its 5 `SolverField`s | `VentIssue[]` | `solveVentConsistencyGroup` + `checkVentConsistency` (bag deleted) |
| `solvePr(params: PrSolverParams, air): PrIssue[]` | its 9 `SolverField`s | `PrIssue[]` | `solvePrConsistencyGroup` + `checkPrConsistency` (bag deleted) |
| `solveSealedAlignment(params: SealedAlignmentSolverParams): SealedAlignmentIssue[]` | its 4 `SolverField`s | `SealedAlignmentIssue[]` | `solveSealedAlignmentGroup` + `checkSealedAlignment` (bag deleted) |
| `solveBoxParams(box, P): BoxParamsSolveResult` | the validated `EnclosureParams`, or null | `BoxParamsIssue[]` | `checkBoxParams` + `validateParams` (T9) |
| `solveSignal(p): SignalSolveResult` | drive V/W | `SignalIssue[]` | ✓ exists |
| `solveEnvironment(env): EnvironmentSolveResult` | `{rho, c}` (`Air`) | `EnvironmentIssue[]` | `airFor` + `environmentIssues` |

Kept unchanged: `sweep`, `maxCurves`, `classifyFinite`/`classifyFiniteIssues`/`classifyFlatClamp`/
`classifyMaxFinite`, `issueFields`, `issueFormula`. The raw `*ConsistencyGroup`/`check*` pairs
become module-private internals; the public `check*`/resolver names are deleted (T3-style). The
numeric `*SolverQuantities` bags and the `.values` result types die with them (T10); box/signal/
environment keep their value results because no bag ever existed there.

### Write-back contract — how cells receive solve results (the fundamental)

The engine defines **`SolverField`** (the solver's only notion of a domain quantity;
`solverTypes.ts:3-26`, verbatim below). Domain quantity surfaces — the driver, and so on —
**implement** it: in this codebase `Field<T>` is that implementation (`cell.ts:47`), and the
driver exposes one `Field<T>` handle per T/S quantity (`openisdDomain.ts:1101-1135`). The
engine never sees anything else — no cells, no records, no `createCell`.

```ts
export type FieldState = 'entered' | 'calculated' | 'not-available';

export interface SolverField<T = number> {
  readonly value: T | null;
  /** True if the user explicitly entered this value ('E'). The solver must NEVER overwrite an entered value. */
  readonly entered: boolean;
  /** True if the value was derived by the physics engine ('C'). */
  readonly calculated: boolean;
  /** True if the value cannot be derived from current inputs ('N'). */
  readonly notAvailable: boolean;
  /** The current DQ messages on this field. */
  readonly dq: readonly string[];
  /** Write a derived value, marking the field as 'calculated' ('C'), and optionally attach DQ. */
  setCalculated(value: T, dq?: string[]): void;
  /** Attach a Data Quality (DQ) issue to an *entered* field. */
  setDq(dq?: string[]): void;
  /** Mark a field as un-derivable ('N' / not-available). */
  setNotAvailable(): void;
}
```

The `Field` is a lens onto the `OpenIsdJson` object: every write puts **one value** into the
record, and the record is the only storage. Write semantics (T11 — no separate calculated
channel, no muddled value):

| Write | Storage in the OpenIsdJson | `get()` outcome |
|---|---|---|
| `field.setCalculated(value, dq?)` | writes **value + flag `'C'`** | cell `'calculated'` |
| `field.set(v)` (user edit) | writes **value + flag `'E'`** | cell `'entered'` |
| `field.setDq(dq?)` | attaches the DQ text to the entry | `'C'`/`'E'` as stored, plus the text |
| `field.setNotAvailable()` / `clear()` | removes the entry | `'not-available'` — **absence = N** |

`get()` precedence — ONE implementation, never re-implemented per node. With T11 it collapses to
a **plain record read**: the entry's flag (`'C'`/`'E'`) or its absence (`'N'`) IS the cell state.
The three-branch `Field.getEffectiveCell` (`cell.ts:58-73`) and the private
`isCalculated`/`derivedValue`/`dqList` store die — everything is written to the JSON and
everything is read from it the same way:

1. entry says `'E'` → cell `'entered'`.
2. entry says `'C'` → cell `'calculated'`.
3. entry absent → cell `'not-available'` (N).

**Apply step** — one shape per node; `solveX(handles…)` is the writer, the record is the store:

```
solveX(params: <Node>SolverParams, …) : <Node>Issue[]        // engine
  reads  params.K.value + params.K.entered                   // the record
  derives → params.K.setCalculated(value);                   // writes value + flag 'C'
  stale/unresolved → params.K.setNotAvailable();             // removes the entry → N
  returns its issues
projection (domain/UI, S2g):
  for issue of issues, for K of issueFields(issue): params.K.setDq([issueToText(issue)])
```

- One value per field in the record; calculated values are stored, flagged `'C'` — never as a
  second value (T11). "do not muddle semantics": at no point can the record hold two values for
  one field.
- **Entered cannot be overwritten**: the engine reads `params.K.entered` and leaves an `'E'`
  value alone; only the DQ projection may touch it.
- Engine stays projection-free: it writes numbers + the flag, never message text; DQ strings are
  the projection's `setDq` and land on `'C'` and `'E'` entries alike.
- **QO127 revised**: the record now stores derived values (as `'C'`); the "nothing writes to the
  domain / stated-only" comment at `openisdDomain.ts:1060-1069` is re-written, and the
  `SpecEntryJson` "states no value of its own" reading-path comment (`openisdSchema.ts:62-69`)
  is superseded for the runtime channel — the schema shape that carries value+flag is settled
  inside step S2 (the scraper's `readings`/`origin` import channel is untouched).
- `issueFields` exists (`consistency.ts:231`); `issueToText` is S2g. The **driver** is the first
  full application (S2h): `solveDriver(p: DriverSolverParams)` replaces the
  `solveConsistencyGroup`+`checkConsistency` split.

**Three obligations (T11 — the make-or-break for "read everything the same"):**

1. **Every write re-triggers the node solve.** `set(v)` → re-solve → rewrite all of the node's
   `'C'` entries. Freshness is the trigger's job: with flags-only reads there is no way to tell a
   stale `'C'` from a fresh one, and the old pull model (compute-at-`get()`) is gone.
2. **Import collapses to the same channel.** Scraped `readings[origin].read_value` becomes
   `value + 'E'` at the runtime boundary; `origin`/`readings` survive only in the import layer.
   One value notion ever in the live record — no muddled semantics.
3. **DQ text lives where `dq_calculated` lives.** Projection `setDq([text])` writes into the
   existing `dq_calculated` channel (a `DqMark`, `detail` rendered by `issueToText`), so `.wdr`
   `calcMark` keeps its source of truth.

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

**Superseded by T10 (2026-09-16):** the bag-style `solveVent` (`890b981`) and `solvePr`
(`d5e3750`) shipped before the handle-model ruling. They are reworked handle-style as S2-1/S2-2 —
the numeric `*SolverQuantities` bags never appear at a public engine boundary.

### Open work from the old doc maps onto the steps below

The original "Tests" bullet that names 8 prerequisite arrays (`driverPrerequisites`/…/
`configurationPrerequisites`) is **stale** — only `driverPrerequisites` exists. It is retired by
this rewrite; see §1 rule "never a duplicated DQ" for the surviving intent.

## 6. Remaining steps

| # | Step | Component / APIs | RED test | Acceptance |
|---|---|---|---|---|
| S1 | **Commit T1/T2/T3 + plan rewrite** | — | — | **DONE (2026-09-16)** — commits `4ef4327`, `9dbc54c`, `f424776`; one commit per task, `[auto]` prefix, never `git add -A` (appendix rule). |
| S2 | **DONE 2026-09-17** (S2-1..S2-13 in commits `6161b6c`..`4ad463b`; S2-12b pending; sealed cascade deferred — J4). **solve-only unification, handle-style (C5+T9+T10+T11 — the "AFTER" table above)** | `solver.ts`, `consistency.ts`, `params.ts`, `air.ts`, `Engine.ts`, `openisdDomain.ts`, `cell.ts`, `openisdSchema.ts` | per node, RED first | one `solveX(params: <Node>SolverParams, …) → <Node>Issue[]` per node — values written onto the handles into the record (`'C'`), `*SolverQuantities` bags + `.values` result types deleted; one value + C/E flag storage (T11). Detail below. |
| S3 | **Done (2026-09-17, `b56c3e6`)** — `doSweep` reports `Not yet implemented — <boxType>` for bandpass6/abc; store test only (no browser spec — John to decide). **T4 — unsimulated topology message** | `appState.ts` `doSweep` (317): when `!boxTypeIsSimulatable(box)` (473) push `{level:'error', field:'boxType', message:'Not yet implemented — <boxType>'}` into `sweepErrors`. Engine/domain untouched. | `store-issue-channel.test.ts`: a `bandpass6` project's `allIssues` has an `/not yet implemented/i` error (today silently empty); one browser spec asserting chart-area text. | QO145 wording shown; `allIssues` non-empty for `bandpass6`/`abc`. |
| S4 | **Done (2026-09-17, `e269197`)** — domain guard sentence pinned (not classifyFinite's), engine net pinned with `Leff` absent. **T6 — hardening regression** | tests only (`hardening.test.ts`) | Assert an unsized vent no longer reaches `classifyFinite`'s generic message (T1 catches it first); keep an engine-level net test: `Leff: undefined` still classified. | Both regressions green. |
| S5 | **Done (2026-09-17, `713dbf3`)** — signal record `{power_W?: entry}`, `driveVoltage_V` derives `√(P·Re)` (DQ when Re unknown), `statedVoltage_V` collapsed, legacy `voltage_V` dropped at load, `#resynchronizeSignalVoltage`/`setPowerDrive_W` deleted; `architecture-notify` gate taught `#root()`. Whole repo 1933 green. **T5 — signal data model** (ruled 2026-09-16: `voltage_V` is not part of the data model — see §2) | `openisdSchema.ts:~580`; `openisdDomain.ts` `powerDrive_W` (~2432), `driveVoltage_V`/`statedVoltage_V` (~2471/~2507); `signal.ts#solveSignal` — the V field applies the §4 write-back contract (`setCalculated(value)`
  writes `'C'`; DQ attaches via `setDq`) | One RED per (a)–(e), below | Signal-tab browser spec + store signal tests pass unchanged; V field shows the DQ when the driver has no Re. |
| S7 | **Done (2026-09-17)** — table below. **T8 — projection parity audit** | read-only | none | A parity table appended to this doc: per channel the ONE domain getter that projects its issues onto cell DQ via `issueToText`, or "none". Expected gaps: sealed (none), signal (V-field DQ only, after T5), environment (no Advanced cell reads it). |
| S9 | **Keep this doc current** | `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md` | — | annotate each step `Done (date)` with a one-line "why/what", as S1–S5 land. |

(S6 — `validateParams()` fate — is **absorbed into S2**: T9 ruling made it part of `solveBoxParams`,
so there is no separate step. S8 — folding `fieldsNamedBy` into `issueFields` and the editor's
live-`checkConsistency` call — is **absorbed into S2's text work**.)

### S7 — projection parity table (audited on `a397468`, 2026-09-17)

Per channel: the ONE place its issues become cell DQ text, always through `Engine.issueToText`.

| Channel | Solve | Projection onto cell DQ | Where |
|---|---|---|---|
| Driver | `OpenIsdDriverSpec.resolve()` → `solveDriver` | `projectFormulaDq` over the 44 handles (`issueFields` → `setDq([issueToText])`) | `openisdDomain.ts:1072-1073`, helper `:1901-1908` |
| Vent (vented / bandpass4 front) | project `#resolve` → `solveVent` | `projectGroupDq` — the group's handles share the first issue's sentence | `openisdDomain.ts:~2387`, helper `:1920-1925` |
| PR | project `#resolve` → `solvePr` | `projectGroupDq` (same) | same |
| Box params | `solveBoxParams` at sweep time | **none on cells** — store `paramIssues` → `sweepIssueMessage` → `issueToText` (chart area) | `appState.ts` |
| Environment | `solveEnvironment` at sweep time | **none** — no Advanced cell reads it; issues reach the chart via `SweepIssue` → `sweepIssueMessage` | `sweep.ts` |
| Sealed alignment | `solveSealedAlignment` (engine only, not in the cascade — J4) | **none** — `q_tc`/`resonance_hz` are lossy readouts | `openisdDomain.ts:~580` |
| Signal | `solveSignal` at `driveVoltage_V.get()` | V cell only: not-available + `issueToText` when `Re` unknown | S5 (in flight) |
| Sweep-level (unsized port, PR geometry) | domain guards read `#issues.vent/.pr` | chart area via `sweepErrors` → `sweepIssueMessage` → `issueToText` | `appState.ts:~335` |

Gaps, all expected: sealed (J4), environment (no cell), box params (no cell — the chart message names the field).
One mechanism everywhere: `issueFields` decides which cells, `issueToText` decides the sentence.

### Step S2 detail (C5+T9 — the solve-only unification)

Per node, TDD: pin the handle-form solve, watch it go RED, build, rewiring consumers in the same
commit, watch GREEN. **T10 ruling** — the S2a/S2b solveVent/solvePr already shipped bag-style
(`890b981`, `d5e3750`) are **reworked handle-style here, not extended**. Node order:
`solveVent` → `solvePr` → `solveDriver` → `solveSealedAlignment` → `solveBoxParams`
(`validateParams`/`checkBoxParams` die) → `solveEnvironment` (kept — `Air` is not a bag) →
wholesale delete of the public `check*`/`solve*ConsistencyGroup`/`airFor`/`environmentIssues`
names + `solverQuantities.ts` + the `.values` result types (T3/T10 style trim).

- **Engine**: build the §4 AFTER facade — `solveDriver`/`solveVent`/`solvePr`/
  `solveSealedAlignment` become `(params: <Node>SolverParams, …) → <Node>Issue[]`, writing
  derived values onto the handles (`setCalculated`/`setNotAvailable`); `solverQuantities.ts`
  deleted, the numeric working set made private in `solver.ts`/`consistency.ts` (tolerance/
  perturbation still works on copies). Box/signal/environment keep their shapes (no bag ever
  existed there). Sweep's `environmentIssues`/`airFor` reads (`sweep.ts:219-221`) re-point at
  `solveEnvironment`.
- **Domain getters**: each node's getter hands its own `Field` handles to the one
  `solveX(params)`; values are written into the record; getters are plain record reads.
  The vent/PR `createCell(..., dq)` inline pattern and every "compute at get()" callback
  (`solvedNow`, the air-constant special case) die — one write path, one read path (T11).
- **`issueToText`**: one function in the projection layer; deletes the bodies of both
  `sweepIssueMessage` (`sweepIssueMessage.ts:16`) and `consistencyNote` (`useDriverCells.ts:76`),
  which re-implement the same template today. Cell DQ, chart blocks and editor tooltips all run it.
  Vent/PR/box cells switch from formula-only DQ to the full sentence (pinning tests update).
  `inconsistent-inputs` unifies on the editor's longer, actionable form (Text ruling, §2).
- **Driver editor (the one flagged wrinkle)**: `DriverEditorModal.vue:325` and
  `OgTune-hooks.ts:54` stop calling `OpenISDDriver.checkConsistency()`; the driver is the first
  full application of the §4 contract — `solveDriver(model.entered…)` writes each spec field
  (value + `'C'`), the projection attaches `dq_calculated` text, and the editor reads
  `cell.dq()`. The QO127 "stated-only" framing is re-written (T11). Kept-in: the
  `missing-dependencies` *kind* still answers "mandatory-but-unsatisfied" internally — that is a
  private detail of the edited-vs-calculated state, not a public `check`.
- **`.wdr` marks**: untouched. `calcMark` renders *typed* `inconsistent-inputs` issues via the
  Python registry templates (`dqCalculated.ts:266-281`); obligation 3 keeps that source intact, so
  the Text ruling and T11 cannot break export parity (verified 2026-09-16).
- **Storage (T11)**: `Field`-private `isCalculated`/`derivedValue`/`dqList` and
  `getEffectiveCell`'s three-branch precedence die — `get()` is one record read; `setCalculated`
  writes value+`'C'`, edits write `'E'`, absence is N. SpecEntryJson's "states no value of its
  own" comment is superseded for the runtime channel.

**Task checklist (mirrors the opencode tracker; each `(auto)` commit on completion).**
**T10 note** — tasks 1-2 REWORK the already-shipped bag-style `solveVent`/`solvePr`
(`890b981`, `d5e3750`), not extend them.

| Task | Work | Green check |
|---|---|---|
| S2-1 | RED `solveVent(p: VentSolverParams, air): VentIssue[]` — handle solve, writes `'C'` onto the params; rewire Engine + domain vent getters + pinning tests | `vent-pr-consistency.test.ts`, domain suite |
| S2-1 note | **Done (2026-09-16)** — engine seam landed handle-style (engine tests pin the writes). Domain rewire deferred to S2-7: the getters keep calling the bag `solveVentConsistencyGroup` + `checkVentConsistency` because record-backed `Field` handles (the only legal `SolverField` impls) and the re-solve trigger do not exist until the T11 storage step; S2-10 deletes those bag internals. | — |
| S2-2 | RED `solvePr(p: PrSolverParams, air): PrIssue[]` — handle solve; rewire | same |
| S2-2 note | **Done (2026-09-16, `5236d18`)** — engine seam handle-style; domain PR getters + `#prSweepIssues` re-pointed to the bag `solvePrConsistencyGroup`+`checkPrConsistency` until S2-7 (same deferral as S2-1). `solveEnvironment {values, issues}` landed in the same commit (S2-6 seam; `sweep.ts` re-point still open). | — |
| S2-3 | RED `solveDriver(p: DriverSolverParams): DriverIssue[]` — `DriverSolverQuantities` + `DriverSolveResult` deleted; `checkConsistency` runs on a private numeric working set | driver tests |
| S2-3 note | **Done (2026-09-16, `7dcd6f1`)** — handle seam; `DriverSolveResult` deleted; `DriverSolverQuantities` stays private until S2-10. Domain deferred to S2-7. | — |
| S2-4 | RED `solveSealedAlignment(p: SealedAlignmentSolverParams): SealedAlignmentIssue[]` | sealed-alignment tests |
| S2-4 note | **Done (2026-09-16, `d9a95ae`)** — engine seam handle-style, 5 pinning tests; domain deferred to S2-7. | — |
| S2-5 | `solveBoxParams(box, P)` absorbs `checkBoxParams`+`validateParams` (T9); re-point `paramIssues` (`appState.ts:394`) | `params.test.ts`, store tests |
| S2-5 note | **Done (2026-09-16, `bc3785a`)** — `validateParams`/`checkBoxParams` deleted; domain `validateParams(P)` → `boxParamsIssues()`; `paramIssues` maps through `sweepIssueMessage`. | — |
| S2-6 | `solveEnvironment(env): EnvironmentSolveResult` — kept (Air is not a bag); re-point `sweep.ts:219-221` | sweep tests |
| S2-6 note | **Done (2026-09-16, `d3232a4`)** — `sweep.ts` reads one `solveEnvironment`. | — |
| S2-7 | **T11 storage**: `setCalculated` writes value+`'C'` into the record; `get()` = one record read (`getEffectiveCell` + private store die); **every write re-triggers the node solve** (RED: edit Fs → Qts/Rms `'C'` entries refreshed) | cell/domain tests |
| S2-8 | **T11 import**: scraped `readings`/`origin` collapse to `value + 'E'` at the runtime boundary; origin machinery stays import-layer | schema/migration tests |
| S2-9 | **T11 DQ**: projection `setDq([text])` writes into `dq_calculated` (a `DqMark`, `detail` = `issueToText`); `.wdr` `calcMark` parity holds | cell-DQ + `.wdr` tests |
| S2-10 | Delete public `check*`/`solve*ConsistencyGroup`/`airFor`/`environmentIssues` + `solverQuantities.ts` + the `.values` result types (T3/T10 trim); typecheck + full suite | 1875+ tests, 3-package typecheck |
| S2-10 note | **Done (2026-09-17, `eb44f70`)** — `solverQuantities.ts` deleted, `*WorkingSet` private in `solver.ts`; `sweep`/`maxCurves` take `DriverSolverParams`; domain reads `driver.ts.X.value`; `checkConsistency()` → `issues()`; `driver.solverParams` adapter covers the 3 slot-less members (J3) + `VCCon`→`wiring`. | — |
| S2-11 | `issueToText` single source; cells/charts/editor read one sentence; formula-only cell DQ updated | cell-DQ + store-issue-channel tests |
| S2-11 note | Placement ruling (leader 2026-09-17): `issueToText` lives in the ENGINE beside `issueFields`/`issueFormula` (pure function of the issue); the domain cascade and the UI both call it. Supersedes §3's "Projection: `packages/ui/src/logic/`" row. | — |
| S2-12 | Driver editor: reads `cell.dq()`; `OpenISDDriver.checkConsistency()` (`openisdDomain.ts:1517`) + the live call (`DriverEditorModal.vue:325`) die | driver-editor tests / e2e spec |
| S2-13 | Fold `fieldsNamedBy` (`useDriverCells.ts:65-67`) → `issueFields` | existing cell-DQ tests |
| S2-11/12/13 note | **Done (2026-09-17, `4ad463b`)** — `Engine.issueToText` (engine, beside `issueFields`); cascade DQ + `sweepIssueMessage` + editor tooltips read one sentence; `consistencyNote`/`fieldsNamedBy` deleted; editor reads `fieldCell(key).dq()`. Whole repo 1926 green. **Found:** `fieldIsMandatoryAndUnsatisfied` compared short keys (`Fs`) to SI issue names (`Fs_hz`) — never matched outside the Q trio → S2-12b. | — |
| S2-12b | Map short spec keys → schema keys in `fieldIsMandatoryAndUnsatisfied` (via `WDR_TO_SCHEMA_KEY`). Likely fixes the pre-existing red in `consistency-dq` / `driver-editor-mandatory` browser specs. | `useDriverCells.test.ts` |
| S2-14 | **Done (2026-09-17)** — this update. §4 AFTER facade verified on `eb44f70`: `solveDriver(params, air)`, `solveVent`, `solvePr`, `solveSealedAlignment` (engine only), `solveBoxParams`, `solveSignal`, `solveEnvironment`; bags private; `Field` is a pure lens; `'C'` entries in the record; project-wide cascade. | — |

### Step S2-7 design (leader, 2026-09-16 — implements rulings S7-a..d)

**Storage shape** (`openisdSchema.ts`) — one entry type for every solvable quantity:

```ts
export type SpecEntryJson =
  | { state: 'E'; value: number; origin?: string; readings?: Record<string, Reading>;
      corroboration?: string; dq_scraper?: DqMark[]; dq_calculated?: DqMark[] }   // entered; provenance rides beside
  | { state: 'C'; value: number; dq_calculated?: DqMark[] };                      // calculated
// absent key = 'N'
```

- `winningValue(entry)` → `entry.value` (one read path). `enteredEntry(v)` → `{state:'E', value:v}`
  (hand entry = no provenance). New `calculatedEntry(v)`.
- Zod: legacy `{origin, readings}` (the catalogue `.owdr` shape) is **transformed at load** to
  `{state:'E', value: readings[origin].read_value, …provenance}` — this is the import channel
  (obligation 2). Serialisers to `.wdr`/`.wpr` read `entry.value`.
- Box fields join: `vent.tuning_hz`/`vent.length_m`/`passiveRadiator.tuning_hz`/`addedMass_kg`
  → `SpecEntryJson | absent` (was `number | null`); sealed gains `Qtc?: SpecEntryJson` so the
  alignment solve has a slot to write. `volume_m3` stays a required input for now.

**`Field` (`cell.ts`)** — a pure lens, no private store. Constructor gains two write callbacks;
`getEffectiveCell` + `isCalculated`/`derivedValue`/`dqList` die:

```ts
new Field<T>(readCell, writeEntered, clear, writeCalculated, writeDq)
  get()             → readCell()                   // entry flag IS the cell state
  set(v)            → writeEntered(v)              // record + 'E'; cascade fires via root lens
  clear()           → clear()
  setCalculated(v)  → writeCalculated(v)           // record + 'C'
  setNotAvailable() → if !entered: clear()         // never touches 'E'
  setDq(dq)         → writeDq(dq)                  // → dq_calculated DqMark[] (detail = text)
```

`entryField(lens: Lens<SpecEntryJson|undefined>, name)` builds the five callbacks once for every
entry-shaped slot (driver spec, vent, PR, sealed Qtc) — one factory, no per-node lens code.

**Cascade (S7-c)** — the aggregate root wraps its root record lens: every `set` outside a
resolve schedules `#resolve()`; a reentrancy flag makes the solves' own `setCalculated` writes
not re-trigger. `OpenISDProject.#resolve()` = `solveEnvironment → solveDriver → solveVent →
solvePr → solveSealedAlignment` over the live `Field` handles; a standalone `OpenISDDriver`
(editor) resolves `solveDriver` only. Constructor runs one resolve (S7-d: `'C'` is a cache).
`solvedNow`/memoised bag solves and every `createCell(..., dq)` compute-at-get body die.

**Chunks (worker-sized, serial):**

| Chunk | Files | RED |
|---|---|---|
| S2-7a `Field` lens rewrite + `entryField` | `cell.ts`, cell tests | setCalculated/set/clear/setDq each land in the lens; setNotAvailable leaves 'E' alone |
| S2-7b schema + loader transform + serialisers | `openisdSchema.ts`, `driverYmlToOpenisdAndWdr.ts`, `projectRepo.ts`, schema tests | legacy readings JSON string loads as `{state:'E', value}`; `winningValue` reads `.value`; box entries |
| S2-7c driver resolve | `openisdDomain.ts` driver section | edit `Fs` → `Qts`/`Rms` `'C'` entries in the record refreshed; `solvedNow` gone |
| S2-7d1 project cascade root (driver) | `openisdDomain.ts` OpenISDProject | `#resolve` over the current layer, no notify; wrap → `isModified()` false; `#issues` cache |
| S2-7d2 vent/PR/sealed rewire | `solverTypes.ts` (`SolverInput` split), `openisdSchema.ts` (sealed `volume_m3` entry), `openisdDomain.ts` box sections | edit vent tuning → `length_m` `'C'` in record; PR mass ↔ tuning; sealed Qtc/Vb; getters are plain reads |

**Progress:** S2-7a `f229856` · S2-7b `8dfaba0` · S2-7c `c9b08de` · S2-7d1 `a113c1b` · S2-7d2 `97fb4c2` — **S2-7 DONE (2026-09-17)** except sealed (J4). S2-8 (import transform) and S2-9 (DQ → `dq_calculated`, formula text) landed inside S2-7b/S2-7d2.

**Open for John (raised by S2-7 implementation, 2026-09-17):**

| # | Question | Leader's interim call |
|---|---|---|
| J1 | (now THREE gate patches: S2-7b, S2-7c, S2-7d2 `isExpectedDqGain`) Should persistence (disk / catalogue bundle / browser store) **strip `'C'` entries on save**? They are recomputed on load (S7-d), so storing them only bloats every catalogue file (13+ new keys per driver section) and forced two patches to the release gate `scripts/roundTripGate.mjs` (S2-7b, S2-7c). | Strip on save = cleanest; would let both gate patches be reverted. Not done yet. |
| J2 | `#issues` cache on `OpenISDProject` — a 4th private field beside `#saved/#edited/#engine` (rule of 2026-09-06). Derived, never persisted; needed because sweep guards must not re-solve on read (write-on-read = infinite reactive loop, found in S2-7c). | Allowed as the one documented exception. |
| J4 | **Sealed not in the cascade.** `#sealedQtc(volume, losses)` (lossy, Ql/Qa) and engine `sealedQtcFromVolume(Qts, Vas, Vb)` (lossless closed form) DISAGREE: 0.5965 vs 0.5933 for Qts=0.4, Vas=0.03, Vb=0.025, Ql=10, Qa=100. Rewiring sealed to the alignment solve changes a displayed number. | Leave sealed as the lossy readout; either make `solveSealedAlignment` lossy or keep it as a design-tool-only solve. John's call. |
| J5 | **`systemTuning_hz` semantics changed** in S2-7d2: old code solved it with unstated mass = 0 ("an unreachable request never drags the value"); now it is `solvePr`'s unified output, so an unreachable `tuning_hz` target yields a negative-mass-derived value + DQ, same as `resonanceWithAddedMass_hz`. Also: the cascade solves ONLY the active box type's vent/PR pair. | Consistent with "redline all the fields"; accepted unless John objects. |
| J6 | `packages/ui/src/logic/useVentGroup.ts` QO126 manual-Helmholtz workaround retired (was fighting the cascade); `vent-group.test.ts` "BLOCKED: QO126" block rewritten. | Correct consequence of the cascade. |
| J3 | Three `DriverSolverParams` members have no record slot (`SPLref_dB`, `Re_terminal_ohm`, `BL_terminal_Tm`) — S2-7c stubs them with a frozen not-available handle. | Either add the three spec keys to the schema or drop them from `DriverSolverParams` at S2-10. |

### Step S5 detail (T5 — signal)

(a) `openisdSchema.ts` signal record → `{power_W: number | null}` only (`.owpr` schema; `.wpr`
carries only `P` already; `.wdr` unrelated).
(b) `powerDrive_W.set(w)` stops requiring `Re_ohm` — stores `power_W: w`; `.get()` reads it;
`.clear()` stores `null`.
(c) `driveVoltage_V`/`statedVoltage_V`: `.get()` is a pure derivation `√(power_W · Re_ohm)`,
`'calculated'` when both known; when `Re_ohm` is unknown it carries a DQ
("Re is not known yet — voltage cannot be derived") via the same write-back channel every other
derived field uses. `.set(v)` KEEPS the Re guard — converts and stores
`power_W = v²/Re`, never a voltage. Collapse `statedVoltage_V` into `driveVoltage_V` if identical.
**Voltage is never shared**: every consumer derives `√(power_W·Re_ohm)` itself or is passed it
(signal bundle) — no stored/global voltage value to reach for (T5 ruling, §2).
(d) `signal.ts#solveSignal()`: delete the `inconsistent-inputs` branch and `voltage_V` as an
entered input; update `signal.test.ts`.
(e) Migration: an old `.owpr` with `voltage_V` in its signal record still loads — accept-and-drop
the legacy key in the zod schema, with a test against a literal old-shape JSON string.

## 7. Open decisions needing John

| # | Question | Status |
|---|---|---|
| T5 (S5) | ~~Sign-off the `.owpr` schema migration (drop `voltage_V`) and the DQ on the V field.~~ **RULED 2026-09-16** (§2): `voltage_V` is not part of the OpenISD data model — a calculated value where needed. S5 is a scheduled step (post-S2, own session). | Ruled. |
| T4 (S3) | Deprioritised per QO145 — slot after S2 or now? | Needs priority call. |
| S2-7 | ~~Storage shape for T11.~~ **RULED 2026-09-16** (§2 S7-a..d). | Ruled. |

(C5, T9, the Text ruling, T5, T10 and T11 were decided 2026-09-16 — §2. T5 folds into the S5
step (post-S2); C5/T9/Text/T10/T11 fold into S2.)

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
  BUILDS handle-based solves and collapses the split (§4 AFTER, step S2); the T10 ruling retracts
  the `.values` numeric bags from that build.
- The seven dead `*Prerequisite` types → deleted (T3).