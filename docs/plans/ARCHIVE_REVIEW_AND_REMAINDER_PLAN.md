# Archived plans review + remaining-work plan

Date: 2026-09-20. Branch: `refactor`. Scope: every file in
[`docs/plans/archive/`](http://localhost:8000/winisd/openisd/docs/plans/archive) (29 files, ~9,500
lines) — are the plans actually done? Below: verdict per file, then a plan for what genuinely
remains. Every verdict was checked against the live tree (grep/read of the shipped packages,
`git log`, the ledger), not doc self-claims.

## 1. Headline

- **Most of the archive is genuinely DONE.** Of the ~20 plans, 14 are DONE
  (or SUPERSEDED with the work shipped in evolved form). Two handovers are PARTIAL (ledger
  follow-up), four files are reference/history.
- **The fast gates are green today**: `npm run typecheck` clean (design/persistence/ui);
  `npx vitest run packages/design packages/persistence` = **75 files / 1570 tests pass**;
  the no-casts gate reports **0 casts** (was 21).
- **Genuinely-not-done work clusters into five bundles**, covered in §3. The two big ones:
  (A) the JS-calc/units migration of the Python scraper maths, and (B) the sweep-state
  save + sealed-cascade follow-ups of the active solve/sweep plan.

## 2. Verdict per archived file

Legend: **DONE** = deliverables shipped (named in-doc, verified in code). **SUPERSEDED** =
outcome shipped via a different (often better) mechanism the plan did not name. **PARTIAL** =
some deliverables still open. **REFERENCE** = history/handover, no executable deliverables.

| File | Verdict | One-line reason | Remaining (if any) |
|---|---|---|---|
| PLAN_DELETE_PACKAGES_MODEL.md | SUPERSEDED | Model package gone; all §4 consumer moves verified live | — |
| PLAN_DECOMMISSION_PACKAGES_MODEL.md | DONE | §6 driverDisplay live; managedProject deleted | orphan `iniRows.ts` (§3-E3) |
| PLAN_OPENISD_DRIVER_MODEL.md | DONE | OpenISDDriver/WinISDDriver live; condemned `Driver` deleted | — |
| OPENISD_TARGET_MIGRATION_PLAN.md | DONE | All 10 steps verified; steps 2/3 reshaped by later rulings, not skipped | ARCHITECTURE.md drift (§3-E1) |
| PLAN_PROJECTION_PACKAGE.md | SUPERSEDED | Shipped as design winisd bridge, wired into Python emit path | — |
| OPENISD_MODEL_MIGRATION_READINESS.md | REFERENCE | Readiness gates a migration that has since shipped | — |
| PERSIST_ISSUES.md | DONE | Six dead methods re-wired via fileImportExport glue; typecheck green | QO119/QO120 self-review (§3-E4) |
| PLAN_JS_CALC_CONSOLIDATION.md | PARTIAL | One JS engine built; WDR-via-JS built; **§2 SPL constants + §6 precision port open** | §3-A4 |
| MATH_MIGRATION.md | PARTIAL | mini-racer bridge + model_wdr deletion landed; **Phases 1–4 not built** | §3-A1..A3 |
| PLAN_QO60_LAYERING_REMEDIATION.md | DONE (as outcome) | state.P dead; all 4 architecture gates green; superseded by QO78/QO80 mechanisms | SERVICE wrapper + catalogue index (§3-D2/D3) |
| PLAN_USEDESIGNIO_REMEDIATION.md | PARTIAL | Physics out of the file; facade promoted; `.wpr` parse in domain | rename + use*-prefix naming (§3-D1) |
| PLAN_DYNAMIC_FIELD_SET_VS_CONCRETE_API.md | SUPERSEDED | SolverField/DQ-collation/setNotAvailable shipped; clear() kept by design | — |
| PLAN_COMPONENT_FIELDS_AND_UI_HOOKS.md | DONE | Direct Field handles on all domain classes; 11/12 hooks shipped (obsolete row) | — |
| PLAN_DOMAIN_ENGINE_SOLVER_SEAM.md | DONE | solverTypes.ts matches plan's contract; engine owns C/N/E | — |
| PLAN_UNIFIED_PR_VENT_ENGINE_SOLVERS.md | SUPERSEDED | Unified solvePr/solveVent/solveDriver shipped; old API names ruled out | — |
| PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md.1 | PARTIAL | Superseded by the [active plan](http://localhost:8000/winisd/openisd/docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md?html) (S1–S7 landed 2026-09-17) | **S8, S10, browser re-run** (§3-B) |
| PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.txt | DUPLICATE | Pasted session transcript; no content beyond the `.md.1` | delete or keep-as-history (§3-E5) |
| PLAN_SWEEP_PARAMS_INTRINSIC.md | DONE | sweep/maxCurves take only the grid; 3-field class holds (4th `#whatif` is a documented exception) | — |
| PLAN_REWORK_AIR_CONSTANT_DELEGATION.md | DONE | VCCon/numVC live defaults; converter reads getters | — |
| PLAN_PROJECT_PERSISTENCE.md | SUPERSEDED | No-Vue write path **did not** ship; simpler Vue-watch design shipped instead | per-project autosave is new work, not this plan |
| PLAN_FIELD_REGISTRY_DESCRIPTIONS_AND_SSOT.md | DONE | 110-row registry matches; every `<select>` typed; archived "complete 2026-09-20" | — |
| PLAN_CAST_DISPOSITIONS.md | DONE | Gate at **0 casts** (was 21); driverName.ts deleted | — |
| HANDOVER_20260828_overnight.md | REFERENCE | History; both sessions' work long committed | — |
| HANDOVER_20260904_fixcast.md | SUPERSEDED | All "true now" claims resolved (ui typechecks, model gone) | — |
| HANDOVER_20260909_AGY_model_migration_and_qo129_logic_split.md | PARTIAL | Migration DONE; health-check fast gates green; **QO129 step-3 partial** | §3-C |
| HANDOVER_20260909_browser_suite_stale_fixtures.md | PARTIAL | Stale-fixture work landed | load-testing doc (§3-E5) |
| PROMPT_RELEASE_HARDENING.md | REFERENCE | Aug-2026 dev-era checklist; unticked rows moot on refactor | — |

## 3. What genuinely remains — the plan

### Bundle A — JS calc & units migration *(biggest remaining chunk, spans two repos)*
Source of truth: [MATH_MIGRATION.md](http://localhost:8000/winisd/openisd/docs/plans/archive/MATH_MIGRATION.md?html)
Phases 1–4. The bridge is built and in production
([openisd_js.py](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/openisd_js.py#L74) →
[min-i-racer](http://localhost:8000/winisd/openisd/packages/design/winisd/bridge.ts#L47),
[project_ui.py](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/project_ui.py)) but only
for `.wdr`/`openisd.yml` projection. **Python still owns the maths too**, in
[semantic_dq.py](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/semantic_dq.py#L41)
(DQ tolerances), [precision.py](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/precision.py#L62)
and [units.py](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/units.py)
(`exact`, `_printed_half_width`), [model_driver.py](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_driver.py?html#L941)
(`readings_agree`).

- **A1 Phase 1 — `dqFormulas` to JS.** Port the 9 DQ-tolerance formulas
  (`rme`/`mpow`/`gamma`/`noEfficiency`/`vasFromCms` + `_CALCULATABLE` Qts/Dd/EBP/Vas and
  `computable_interval`) into `packages/design/engine`, with golden tests derived from the Python.
- **A2 Phase 2 — `packages/uncertainties`.** Port precision propagation (`uncertainties` pkg
  semantics, half-width printing, signed rounding) into a TS package; parity-test against Python.
- **A3 Phase 3 — maths API on the bridge.** Expose `exact`/`agree`/`propagate`/`derive_driver`/
  `dq_check` through the existing mini-racer bridge so the scraper becomes a blind client.
- **A4 Phase 4 + leftovers.** Corpus parity test, delete `_CALCULATABLE`, `precision.py`,
  `exact`, `_printed_half_width`, `readings_agree`; add the arch guard that no calc lives in
  Python; resolve the three-way SPL/`no` constant from PLAN_JS_CALC_CONSOLIDATION §2 row 18.
- *Owner:* winisd_tools repo + openisd `packages/design/engine`. Not yet allocated; no active
  plan tracks it. Highest value-open item in the archive.

### Bundle B — sweep-state save + sealed cascade *(openisd, tracked in the active plan)*
Tracked in [PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md?html)
(S1–S7 landed; J1–J6 ruled). Ledger: [questions.yml:9302-9357](http://localhost:8000/winisd/openisd/questions.yml?html#L9302).

- **B1 S8 — strip `'C'` on save** (QO147 decided, **unimplemented**): computed state written into
  the record on the sweep is currently emitted on save; `roundTripGate.mjs` still carries the
  S2-7 patches that paper over it.
- **B2 S10 — sealed joins the cascade** (QO150 decided, **unimplemented**): sealed alignment is
  still lossless engine-only ([Engine.ts:128](http://localhost:8000/winisd/openisd/packages/design/engine/Engine.ts#L128)),
  absent from `#resolve()`; `#sealedQtc` is a lossy get()-time readout
  ([openisdDomain.ts:604-617](http://localhost:8000/winisd/openisd/packages/design/domain/openisdDomain.ts#L604)).
- **B3 Re-run the browser suite** over the solve/sweep work (self-declared pending; multi-hour).

### Bundle C — QO129 logic-split close-out *(openisd)*
Ledger step still OPEN. Migration itself done; [health-check.sh](http://localhost:8000/winisd/openisd/scripts/health-check.sh#L29-L52)
fast gates green (lint/typecheck/unit/verify-preview + zero skips).

- **C1** Move the arithmetic of the ~10 remaining `@vite-ignore` browser specs into vitest so
  the UI suite holds only genuinely-UI assertions (QO129 step 3).
- **C2** Run the full health-check browser gate once (the only un-verified step) and mark QO129
  closed.

### Bundle D — naming / structure leftovers *(openisd, decided-but-not-literal)*
- **D1 Rename `useApplicationIO.ts` → `createFileIO.ts`** (QO61 Proposal B ruled; substance
  shipped, [file now orchestration-only](http://localhost:8000/winisd/openisd/packages/ui/src/logic/useApplicationIO.ts#L90)).
  Also settle the `use*`-prefix naming (obj 9: `useVentGroup`/`usePrGroup`/`useDriverCells`).
- **D2 SERVICE wrapper around `appState`** — still declared **NOT BUILT** in
  [ARCHITECTURE.md:170](http://localhost:8000/winisd/openisd/ARCHITECTURE.md?html#L170); 7+
  `.vue` files import `appState` directly. QO80's layer matrix now blesses components→logic, so
  this needs a ruling: build the wrapper or strike the sentence.
- **D3 Env-keyed on-demand catalogue index** — shipped as build-time static files
  (`drivers-index.json`) instead of the boot-lazy design. Needs either ruling-as-done or the
  env-keyed rebuild.

### Bundle E — docs & hygiene *(cheap)*
- **E1 Fix ARCHITECTURE.md drift**: module table + diagrams still name deleted
  `packages/model`/`packages/engine`/`packages/winisd`/`packages/projection`
  ([L45](http://localhost:8000/winisd/openisd/ARCHITECTURE.md?html#L45),
  [L180-185](http://localhost:8000/winisd/openisd/ARCHITECTURE.md?html#L180),
  [L526-529](http://localhost:8000/winisd/openisd/ARCHITECTURE.md?html#L526),
  [L924](http://localhost:8000/winisd/openisd/ARCHITECTURE.md?html#L924) still cites deleted
  `engine/src/consistency.ts`). Bring it to the shipped design (new layer-gate sections at
  L561-563 already describe it).
- **E2 Ruling on orphan [`iniRows.ts`](http://localhost:8000/winisd/openisd/packages/design/winisd/iniRows.ts)** —
  unimported; delete or wire (deferred since the model-decommission plan).
- **E3 Close QO119/QO120** self-review audits (implementation done; review outstanding).
- **E4 Load-testing design doc** — referenced by the browser-suite handover, never written.
  Write or strike.
- **E5 De-duplicate the archive**: delete
  [PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.txt](http://localhost:8000/winisd/openisd/docs/plans/archive/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.txt)
  (pure transcript of the `.md.1`); drop the stale `__pycache__/model_wdr.cpython-*.pyc` in
  winisd_tools.

## 4. Suggested order

1. **Bundle E** (hours) then **Bundle C** (days) are pure debt — do first weather the tree is
   ever green again.
2. **Bundle D** needs 2-3 human rulings before any code (D1 is safe to just do).
3. **Bundle B** is decided and ready — needs a session willing to take the browser re-run.
4. **Bundle A** is the largest and riskiest (precision-parity across two repos) — deserialize
   MATH_MIGRATION Phases 1–4 into a fresh active plan with per-phase gates before starting.