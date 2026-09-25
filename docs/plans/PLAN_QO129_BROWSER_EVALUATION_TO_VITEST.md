# Plan: QO129 Step 3 — Migrate Browser-Tab Arithmetic to Vitest & Tag Tier-3 Acceptance Specs

Companion to [TESTING_STRATEGY.md](http://localhost:8000/winisd/openisd/TESTING_STRATEGY.md?html) · [questions.yml QO129](http://localhost:8000/winisd/openisd/questions.yml#L8815)

## 1. Context & Architecture Grounding

1. **Resolution of Tasks 5–7 (Option A Locked per TESTING_STRATEGY.md:49)**:
   Per `TESTING_STRATEGY.md:49` ("All UI tests are retained; the Tier-3 acceptance set is a curated subset of them"), we do **not** create a duplicate `packages/ui/test/scenarios/` directory with new files. Option A is locked: existing browser specs are tagged (`@acceptance`) across the 5 primary user workflows and run in parallel (`--workers=4`):
   - `packages/ui/test/ui/wizard-defaults.browser.spec.ts` (Project creation & wizard flow)
   - `packages/ui/test/logic/driver-editor-solver.browser.spec.ts` (Driver parameter editing & solver wiring)
   - `packages/ui/test/ui/original-skin.browser.spec.ts` (Enclosure tuning, box types & plot rendering)
   - `packages/ui/test/persistence/driver-selection.browser.spec.ts` (File import/export & persistence)
   - `packages/ui/test/ui/original-layout.browser.spec.ts` (Multi-project session switching)
2. **Task 2 (Driver Editor Modal DQ Extraction — Low Risk)**:
   `useDriverEditorModal()` is dead code (unimported by `DriverEditorModal.vue`). Extract the 6 pure DQ functions (`isBadValue`, `dqNote`, `issues`, `chartBlockingReasons`, `mandatory`, `ebpVal`) from `DriverEditorModal.vue` into plain exported functions in `DriverEditorModal-hooks.ts`, parameterised on `cellOf` + draft; 100% Vitest coverage. `consistency-dq.browser.spec.ts` already asserts only DOM elements (`.de-dq`, tooltips) with zero read-and-assert `page.evaluate` — its one `@vite-ignore` is setup-only (sets fields null) — so this task is additive coverage, not a browser-spec deletion.
3. **Task 3 (Original Shell + Signal — merged with former Task 4)**:
   Box-volume derivation and drive/signal calculation (`driveV`/`reconcileDriveV`) live in the same file, `OriginalShell-hooks.ts`, tested by the same file, `OriginalShell-hooks.test.ts`. One task, not two, so they don't race on the same file. Extract the volume switch as `createBoxVolume(...)`, mirroring the existing `createSealedReadouts` pattern.
4. **Task 4 (New Project Dispatch — Low Risk)**:
   Extract `OgNewProject.vue`'s `pickDriver()` box-type-dispatch defaults into a pure `applyWizardDefaults(...)` in `OgNewProject-hooks.ts`; vitest it. Keep the JSON-diff browser check in `wizard-defaults.browser.spec.ts` as a whole-file parity check (it earns its keep); remove only the per-value `page.evaluate` reads. *(`OgNewProject-hooks.ts` already exists in the tree — this task is largely done; remaining work is trimming the per-value reads in the browser spec.)*
5. **Scope of @vite-ignore (33 sites in 10 files)**:
   Distributed as: Tune panel 2 sites, Driver Editor 1 site (setup-only, stays), Wizard 2 sites, Original Shell + Signal (merged Task 3) the remaining sites across `original-skin` (21), `signal-pane-blur-must-notify` (1), `signal-commits-as-blur-notification` (1), `sealed-readout-wire` (1), `original-tuning-target` (1), `original-layout` (setup-only, stays).
6. **Incremental Coverage Gate**:
   Coverage thresholds (currently statements 15.8, branches 78.5, functions 54.0, lines 15.8) are raised incrementally after each task lands using verified `vitest run --coverage` figures — never lowered, never batched.

---

## 2. Granular Task List

0. The baseline record MUST capture the current `@vite-ignore` count (33), `vitest run --coverage` figures, and `scripts/test-browser.sh` wall-clock + pass count before any migration task starts, so before/after is measured, not claimed.
1. The Tune panel hook test suite MUST verify field derivations, unit conversions, and calculation override clearing in Vitest when testing `tune-panel-fields` logic, except for DOM input rendering retained in Playwright.
2. The Driver Editor hook test suite MUST verify the 6 extracted DQ functions (`isBadValue`, `dqNote`, `issues`, `chartBlockingReasons`, `mandatory`, `ebpVal`) in Vitest when driver parameters are evaluated, except for modal DOM rendering and the setup-only `@vite-ignore` in `consistency-dq.browser.spec.ts`, both retained in Playwright.
3. The Original shell hook test suite MUST verify box volume derivations, filter count bookkeeping, and drive/signal calculations (`driveV`/`reconcileDriveV`) in Vitest across the `@vite-ignore` read-and-assert sites in `original-skin`, `signal-pane-blur-must-notify`, `signal-commits-as-blur-notification`, `sealed-readout-wire`, and `original-tuning-target`, except for canvas and tab rendering, and the setup-only sites in `original-layout`, retained in Playwright.
4. The New Project wizard hook test suite MUST verify box-type-dispatch defaults and presets in Vitest when initializing project options, except for dialog navigation and the whole-file JSON-diff parity check, both retained in Playwright.
5. The test runner MUST report all 5 tagged `@acceptance` Playwright specs passing when run in parallel with `bash scripts/test-browser.sh --grep @acceptance --workers=4`, except when running on single-core environments.
6. The test runner MUST verify incrementally raised coverage thresholds after each task when executing `npx vitest run --coverage`, except for excluded test fixtures.
7. The health check suite MUST report 100% green when running `bash scripts/health-check.sh`, except when external browser dependencies are offline.
