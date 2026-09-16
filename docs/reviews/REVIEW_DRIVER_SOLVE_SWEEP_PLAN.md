# Unbiased review — `PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS`

Read-only review by a fresh reviewer agent. No file was modified. Every claim cited `file:line`. The reviewer verified document claims against the actual code; **where they disagree, the code wins**.
Doc reviewed: `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md` (1336 lines), plus `questions.yml` (QO142–145), the engine/domain/UI sources, and the pinning tests.

## 1. Goal of the research

1. Verify, claim by claim, whether the plan doc describes what the code actually does today.
2. Decide which sections are (a) implemented as specified, (b) implemented differently, (c) stale/dead, (d) open work.
3. Check the implemented work against the repo's own guardrails (`packages/design/AGENTS.md`, root `CLAUDE.md`): no module-global mutable state, no casts, concrete derived types, exhaustive matches, one facade, `domain/index.ts` surface rule.
4. Confirm the QO rulings (QO142–145) are faithfully encoded, and that the doc's suite/typecheck claims hold on the current working tree.

## 2. The document, layer by layer

The doc is an **accretion of dated layers**, not a single snapshot; it self-maintains via dated "Completed/Reversed/Superseded" notes (convention stated at T7, line 1314).

| Layer | Lines | Nature | Verdict |
|---|---|---|---|
| Header | 1–23 | status + provenance | **Stale**: line 3 `Status: PLAN — not implemented`, while item 2–10 and T1–T3 are done |
| Terms / Calculation Owners / Solver Nodes | 25–204 | architecture glossary + per-solver specs | Accurate (intended node shape, not code claims) |
| Data Flow | 205–245 | air resolved once, `{rho,c}` threaded | Accurate; `ventLength`/`tuningFromLength`/`prTuning`/`prMassForFp` all take `Air` (Engine.ts:243,249,235,296) |
| Public Contracts | 247–482 | `SolveRoute`/`CalculationIssue`/`*SolveResult`/prerequisite types | **Half-built**: issue shape universal; result-bundle shape only for Driver, Signal, sweep |
| Convergence | 484–597 | obsolescence map of old 3-vocabulary world | **Stale by design** (its own job); the prescribed work is largely done |
| Diagnostic Channels / Domain Boundary | 599–668 | channel-ownership table + `SweepCalculationResult` sketch | Sketch (:616–628) **superseded** — actual: `SweepSolveResult`/`MaxCurvesSolveResult` |
| Driver Air Constants | 670–822 | decision record, **IMPLEMENTED 2026-09-15** | Faithful; verified |
| Implementation Order | 824–916 | live ledger items 1–15 | Mostly accurate; item 8 overclaims (C5) |
| Tests section | 918–952 | acceptance bullets | **Drifted**: bullet at :940–943 lists the 8 prerequisite arrays T3 deleted |
| Appendix | 954–1336 | seven-channels proposal + QO145 ruling + T1–T9 tasks | The useful part; state per task in §4 |

## 3. Contradictions / staleness (doc vs verified code)

| # | Doc claim | Where | Code reality | Disposition |
|---|---|---|---|---|
| C1 | `Status: PLAN — not implemented` | :3 | Items 2–10 + T1–T3 done; 1491 tests green | **Stale** |
| C2 | `OpenISDDriver.checkConsistency(): ConsistencyIssue[] { return []; }` is the convergence anchor | :14–15, :486–499 | Stub gone; `:1479` now `statedDriverQuantities`; adapter returns real entered-only issues (:1517–1523) | **Stale** |
| C3 | `consistency.ts` holds only `ConsistencyIssue` + `Q_GROUP_FIELDS`/`isQGroupField`/`qGroupIsIncomplete` | :495–498 | All deleted; `RELATIONS` table restored (:64–92), `checkConsistency(entered)` (:151), `solveDriver` (:223) | **Stale but done** (commit `8baba7a`) |
| C4 | `ConsistencyIssue` live type consumed by `calcMark` | :505–517, :567 | Gone; `calcMark` takes `InconsistentInputsIssue = Extract<DriverIssue,{kind:'inconsistent-inputs'}>` (`dqCalculated.ts:272,281`) | **Done, renamed** |
| C5 | Item 8: `SealedAlignmentSolveResult`/`VentSolveResult`/`PrSolveResult`/`BoxParamsSolveResult` exist | :858–866 | **None exist** (grep: zero). Code ships `solve*ConsistencyGroup` + `check*Consistency` as TWO functions (`solver.ts:573/622/641`); only Driver/Signal got the `{values,issues}` bundle | **Overclaim** |
| C6 | `SweepCalculationResult {curves, issues, …8 prerequisite arrays}` | :616–628 | Superseded by `SweepSolveResult`/`MaxCurvesSolveResult` (`sweep.ts:48,58`); 7 arrays deleted (T3) | **Stale** |
| C7 | "Tests" bullet lists all 8 prerequisite arrays | :940–943 | Only `driverPrerequisites` exists | **Stale** |
| C8 | Appendix ground-truth line numbers (`sweep.ts:37`, `openisdDomain.ts:2751`, `consistency.ts:268–279`) | :1165–1190 | `SweepIssue` now `sweep.ts:43`; sweep `openisdDomain.ts:2752`, `maxCurves` :2761, `#engineBoxType` :2743; `consistency.ts` ends at :270 | **Stale numbers** |
| C9 | "A sweep never copies upstream DQ messages into its issue list" | :244–245 | Reversed by the appendix itself (:969–974): when `values` is `null`, real upstream issues ARE embedded in `SweepIssue` (`sweep.ts:217`; domain guards `openisdDomain.ts:2767–2768`) | **Self-resolved contradiction** |
| C10 | Environment projected to "Advanced fields" only | :599–611 | `engine/sweep.ts` reports `environmentIssues(P)` as a blocking sweep issue (:219–220); no Advanced-tab cell reads it (T8 gap, verified) | **Half-true** |
| C11 | Cell-projection parity per channel | :884–889 | Vent/PR have per-field getters; **sealed-alignment has no domain call site**; signal `solveSignal()` has no production caller | Open (T8) |
| C12 | UI: `consistencyNote`/`fieldIsMandatoryAndUnsatisfied`/`chartBlockingReasons` collapse into one projection | :570–597, item 15 | `consistencyNote`/`fieldIsMandatoryAndUnsatisfied` read `DriverIssue[]` (`useDriverCells.ts:76,98`); **`useDriverCells.ts:65` hand-rolls `fieldsNamedBy`** — a local copy of engine's exported `issueFields` (`consistency.ts:231, Engine.ts:192`) | **Partial** (duplication worth folding) |

## 4. What was actually built — critical assessment

### Built (commit-anchored)
- `8baba7a` (2026-09-15) — driver T/S unification: `RELATIONS` restored, `checkConsistency(entered)→DriverIssue[]`, `solveDriver`, Engine wrappers, domain entered-only adapter, `environmentIssues()`, sealed-alignment group solver.
- `42fcf0b` — sweep unification: `SweepSolveResult`/`MaxCurvesSolveResult {values, issues}` (QO142); one `missing-dependencies` issue per absent circuit field (QO144); `singleFieldUnblockers` deleted.
- `88c5d28` — `driverPrerequisites` advisory only when value present (QO143); `classifyMaxFinite` exempts `+Infinity`.
- Working tree (uncommitted) — T1: `SweepIssue` widened `| VentIssue | PrIssue` (`sweep.ts:43–45`); domain guards `#boxSweepIssues`/`#sweepAir`/`#ventSweepIssues`/`#prSweepIssues` (`openisdDomain.ts:2775–2853`); vent has a both-missing gate (target `length_m`), PR deliberately none (un-tuned PR is simulable — exactly the asymmetry the T1 DONE note specifies); `maxCurves()` early returns gained `driverPrerequisites: []`. T2: sealed closed as unreachable (schema stores sealed as `{volume_m3,losses}` only — `openisdSchema.ts:525`; `#sealedQtc` derived `openisdDomain.ts:899–912`). T3: seven non-driver `*Prerequisite` types deleted.

### Not built (open)
| Task | Status |
|---|---|
| T4 — `bandpass6`/`abc` "Not yet implemented" chart message | **Open, ruled (QO145)**: `!box` still returns `{values:null, issues:[]}` silently (`openisdDomain.ts:2753–2766`). Smallest high-value next step |
| T5 — Signal `voltage_V` not persisted | **Open**; schema still pairs it (`openisdSchema.ts:579–582`) |
| T6 — `classifyFinite` regression hardening | **Not done** |
| T7 — doc sync (C1,C6,C7,C8) | **Open** |
| T8 — projection audit | **Open** (self-answered: sealed none, signal none, environment no Advanced cell) |
| T9 — `validateParams()` fate | **Open**, deliberately (parallel `DriverError[]` path still read by `paramIssues`, `appState.ts:396`) |

### Strengths
- Type discipline genuinely respected: `CalculationIssue<Q>` unions over `keyof`-derived names; no `any`/`unknown`/casts (arch guards enforce; typecheck clean). `SolveRoute.missing=[] ⇔ route usable` is in the contract (`consistency.ts:5–11`).
- `RELATIONS` frozen (no module-global mutable state); engine is a single facade; domain is composition root; new sweep guards live at the domain layer (engine only sees resolved params) — exactly the appendix's recommended option (:1023–1033).
- Rulings faithfully encoded: QO144 → `hardening.test.ts:65–81`; QO143 → `hardening.test.ts:250–268` + `sweep.test.ts:170–189`; QO145 → appendix annotation + `ConfigurationPrerequisite` deleted.
- The silent-NaN path is closed for vent/PR: `Leff` undefined → NaN `zmag` is now caught by domain guards with a real named target (`openisdDomain.ts:2814–2824`), proven by RED-then-GREEN tests (`domain.test.ts` + `store-issue-channel.test.ts`).

### Weaknesses / risks
1. Uncommitted work vs the doc's own process rule: T1/T2/T3 DONE lives only in the working tree; appendix says "commit each task on its own with `(auto)` prefix, never `git add -A`" (:1155–1163).
2. Item 8 overstates the build (C5): four `*SolveResult` bundles asserted built and don't exist. The `solve*ConsistencyGroup`/`check*Consistency` split has exactly the "two calls could describe two different inputs" hazard `solveDriver`'s docstring warns against (`consistency.ts:220–225`).
3. `#sweepAir()` uses `!` assertions (`openisdDomain.ts:2785`) — justified on the embedded-driver path, a small bend of the no-escape-hatch spirit.
4. Doc/body drift remains even after T3 (header, Convergence, Tests bullet, ground-truth lines) — misleading to a fresh reader.

## 5. API reference (current ground truth — what the plan should reference by name)

### Types — engine (`packages/design/engine/`)
| Symbol | Definition / location |
|---|---|
| `SolveRoute<Q>` | `{formula, required: readonly Q[], missing: readonly Q[]}` — `consistency.ts:7–11` |
| `CalculationIssue<Q>` | `missing-dependencies` \| `inconsistent-inputs` — `consistency.ts:18–32` |
| `DriverQuantityName` / `DriverIssue` / `DriverSolveResult` | `keyof DriverSolverQuantities`; `CalculationIssue<DriverQuantityName>`; `{values, issues}` — `consistency.ts:34,35,40–43` |
| `VentQuantityName`/`VentIssue`, `PrQuantityName`/`PrIssue`, `SealedAlignmentQuantityName`/`SealedAlignmentIssue` | generic `CalculationIssue<Q>`, instantiated at `solver.ts:25–30` |
| `BoxParamsQuantityName`/`BoxParamsIssue` | `keyof EnclosureParams` — `params.ts:27–28` |
| `EnvironmentQuantityName`/`EnvironmentIssue` | `keyof AirEnvironment` — `air.ts:118–119` |
| `SignalQuantityName`/`SignalIssue`/`SignalSolveResult` | `{values, issues}` — `signal.ts:29–35` |
| `SweepOutputName` / `CalculationPrerequisite<Q>` / `DriverPrerequisite` | `consistency.ts:250,265,270` (all other `*Prerequisite` deleted) |
| `SweepIssue` | `DriverIssue \| EnvironmentIssue \| BoxParamsIssue \| VentIssue \| PrIssue` — `sweep.ts:43–45` |
| `SweepSolveResult` / `MaxCurvesSolveResult` | `{values: SweepResult\|null, issues}` / `+ {driverPrerequisites}` — `sweep.ts:48,58` |

### Engine façade (`Engine.ts`) — method : line
`airFor` :54, `environmentIssues` :61, `solveConsistencyGroup` :82, `checkConsistency` :91, `solveDriver` :99, `solvePrConsistencyGroup` :106 / `checkPrConsistency` :113, `solveVentConsistencyGroup` :119 / `checkVentConsistency` :125, `solveSealedAlignmentGroup` :131 / `checkSealedAlignment` :137, `solveSignal` (no production caller) :184, `issueFields` :192, `issueFormula` :198, `sweep` :331, `maxCurves` :336, `validateParams` :341, `checkBoxParams` :350, `classifyFinite` :365 / `classifyFiniteIssues` :370 / `classifyFlatClamp` :375 / `classifyMaxFinite` :380.

### Domain (`openisdDomain.ts`)
`OpenISDDriver.checkConsistency(): DriverIssue[]` (entered-only) :1517, `statedDriverQuantities` :1472, `solveConsistencyGroup` :1500; `OpenISDProject.sweep()` :2752 (early-exit order: `!box`→`!params`→`#boxSweepIssues`→engine), `maxCurves()` :2761, `#engineBoxType()` :2743, `#boxSweepIssues()` :2775, `#ventSweepIssues()` :2795 (both-missing gate target `length_m`, formula "…(Helmholtz)" :2820–2823), `#prSweepIssues()` :2835 (no both-missing gate).

### UI (`packages/ui/src/`)
`sweepIssueMessage(issue): DriverError` (`sweepIssueMessage.ts:16`), `driverPrerequisiteMessage` warn-level (:39+); `doSweep` — unified `sw.issues`+`mx.issues` → deduped → `sweepErrors` (`appState.ts:317–339`); `paramIssues` still via `validateParams` (:396); `allIssues` (:403); `boxTypeIsSimulatable` (:473).

### WinISD data-quality bridge
`calcMark(issue: InconsistentInputsIssue): CalcFinding` (`dqCalculated.ts:281`); `dqCalculated()` filters `missing-dependencies` (:344).

## 6. Recommendations (priority order)

1. **Commit T1/T2/T3** as per the appendix rule (one commit each, `(auto)` prefix) — the DONE notes currently describe an uncommitted state.
2. **Settle C5** — bundle vent/PR/sealed/boxparams into `{values, issues}` result objects to match Driver/Signal, or strike "same shape everywhere" from §3 and document the two-pattern split per node in item 8. Stop claiming the four bundles exist.
3. **Do T4** (ruled, small, closes a live silent-blank-chart gap): push QO145's "Not yet implemented" `DriverError` into the sweep channel at the store when `!boxTypeIsSimulatable` (`appState.ts:473`).
4. **Do T6 properly** — a real `hardening.test.ts` regression asserting the vent/PR case no longer reaches `classifyFinite`.
5. **Do T7** — fix Status line, Convergence description, Tests bullet, `SweepCalculationResult` sketch, ground-truth line numbers (C1/C2/C3/C6/C7/C8), add the C5 correction.
6. **Post-T9 folding:** retire `validateParams()`/`DriverError` in `paramIssues` once QO142-style convergence is ruled for it; have `useDriverCells.ts` use `issueFields` instead of its private `fieldsNamedBy`.
7. **T5** is a data-model change with migration risk (`.owpr` schema drop of `voltage_V`) — plan it as its own session.