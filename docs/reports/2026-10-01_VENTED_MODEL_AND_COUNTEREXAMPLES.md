# Model, counter-examples, and repair report — vented wizard + plausibility + Options modal

**Date:** 2026-10-01 · **Scope:** the 10 changed files around `FIX_WIZARD_VENTED-remains`
(engine: `VentedEngine.ts`, `plausibility.ts`, `issueText.ts`; UI: `OptionsModal-hooks.ts`,
`OptionsModal.vue`, `OriginalNewProject-hooks.ts`; their tests).
**Method:** build the model → derive invariants → attack them with counter-examples →
verify or kill each candidate against source/tests → record confirmed bugs in `bugs/`.

---

## 1. The model

### 1.1 Data flow (vented design)

```
driver specs (Fs, Qes, Qms, Re, Vas, Qts)
        │
        ▼
DriverEngine.sourceLoadedQts(qms, qes, re, rg, fallbackQts)      lossMode path
  guard: !(qms>0)||!(qes>0)||!(re>0) → fallbackQts (bare Qts)
  else   Qes' = Qes·(Re+Rg)/Re ;  Qts' = 1/(1/Qms + 1/Qes')
        │
        ▼
VentedEngineImpl.alignment(kind, Fs, Qts', Vas, Ql)              VentedEngine.ts
  bb4 : alpha = ¼(1/Qts' − 1/Ql)² , h = 1
  qb3/c4/ebs3/ebs6 : alpha = exp(Pα(ln Qts')) , h = exp(Pℎ(ln Qts'))
  Vb = Vas/alpha ; Fb = h·Fs
        │
        ▼
judge(q): !finite||≤0 → non-physical ; outside [min,max] → out-of-band ; else null
  band read LIVE from settings.ventedLimits() each call (Settings-tab repaint contract)
        │
        ▼
text = subject + quantified(value) [+ band] + PARITY               issueText.ts
```

### 1.2 Consumers

| Consumer | Judgement surface |
|---|---|
| Wizard step 4 (`OriginalNewProject-hooks`) | `volumeIssue`/`tuningIssue` on the preview design; preview pinned to project constants `DEFAULT_SOURCE_RESISTANCE_OHM` + `NEW_PROJECT_VENTED_QL = 10` by test |
| Domain resolve (`projectResolve.ts`) | `ventTuningExtra` = `tuningIssue(Fb)` appended to the vent solver's own mark, vented box type only |
| Project builder (`openisdTransforms.ts` `afterWrap`) | designs once at create from the project's own Rs/Ql; explicit `volume_m3` wins |
| Options modal | owns the band as a draft; validates band only (positive, min<max), applies both band and env on OK |

### 1.3 Invariants claimed by the code/tests

- **INV-1 (parity):** designed Vb/Fb reproduce WinISD captures ≤ 1e-12 relative, Qts 0.15–1.0, Ql 10 — **held** (82/82 engine tests).
- **INV-2 (no clamp):** the design value is never altered by the judgement — **held** (tests pin it).
- **INV-3 (band is live):** the engine asks settings on every call; no snapshot — **held** (tested).
- **INV-4 (judgement):** non-physical = !finite or ≤0, absolute; out-of-band = user's band, inclusive limits — **held**.
- **INV-5 (preview = project):** wizard preview constants equal the created project's Rs/Ql — **held** for Rs (test) and Ql (test), but both are *pinned copies*, not one source (plan item 3 — live drift risk, already recorded in the plan).
- **INV-6 (text truthfulness):** every sentence in a `DqIssue.text` is evidenced — **BROKEN** (BUG 3).
- **INV-7 (Options modal saves only sane settings):** OK writes nothing corrupt — **BROKEN** (BUGS 1–2).

---

## 2. Counter-examples — candidates attacked, outcomes

| # | Counter-example | Invariant attacked | Outcome |
|---|---|---|---|
| C1 | Re=0 driver → `Qes' = Qes·(Rg)/0 = ∞` → Qts'=Qms → plausible-looking garbage | 1.1 guard | **KILLED** — `sourceLoadedQts` guards `!(re>0)` → falls back to bare Qts (`DriverEngine.ts:789`). Silent fallback is deliberate (driver carrying only Qts). |
| C2 | BB4 with `Qts' == Ql` → alpha=0 → Vb=+∞ | INV-6 | **CONFIRMED** — design is correctly marked non-physical, but the appended `PARITY` sentence asserts an unevidenced WinISD behaviour → `bugs/BUG_20261001_nonphysical-parity-text-overreach.md` |
| C3 | Options → Limits: edit only End → `{min:NaN,max}` stored → GraphPanel drops whole override silently | INV-7 | **CONFIRMED** → `bugs/BUG_20261001_options-chart-y-limit-partial-edit-silently-drops.md` |
| C4 | Options → Frequency range: cleared field saves `''` into `sweepRange`; inverted pair saves as-is; persists across reload | INV-7 | **CONFIRMED** → `bugs/BUG_20261001_options-frequency-range-unvalidated-empty-inverted.md` |
| C5 | Env defaults savable as 0/negative temperature → NaN air | INV-7 | **KILLED** — `NumberField.ADV_TEMP_K.limits` 173.15–373.15 K, humidity 0–100, pressure 1000–200000 Pa; `NumInput`/`v-limits` clamp typed values (empty kept only mid-edit, repaired by the field's own bounds on next valid entry; no path found that writes them out of range) |
| C6 | Band limits themselves corrupted via repo fallback (`appSettingsRepo` falls back to factory on unreadable) | 1.1 | **KILLED** — fallback covers it; band validated positive + ordered at the dialog |
| C7 | Preview/project drift if new-project Ql or Rs ever diverge from schema constants | INV-5 | **OPEN (known)** — exactly plan item 3; `NEW_PROJECT_VENTED_QL = 10` is a hook-local copy of the schema's starting value, test-pinned. Not a new bug; route through `fields/defaults.ts` like `DEFAULT_SOURCE_RESISTANCE_OHM` |
| C8 | `decimal()` renders tiny volumes in exponent form ("2.7e-6 L") in warning text | cosmetic | **NOTE** — defensible for 2-sig-fig readability; flag for the panel report, not a bug file |
| C9 | `saveAndClose` drops ALL unsaved dialog edits when one band field is invalid (OK disabled) | UX | **NOTE** — design choice; panel report, priority P3 |

## 3. Verification state at time of report

| Suite | Result |
|---|---|
| `packages/design` vented-alignment + vented-plausibility | 82/82 pass |
| `packages/ui` OptionsModal-hooks + OriginalNewProject-hooks | 40/40 pass |
| `wizard-defaults.browser.spec.ts` (plan item 4, "not run") | **4/4 pass — plan row now stale, may be ticked** |

## 4. Reproducing everything

```bash
# engine + hook suites
cd packages/design && npx vitest run test/engine/vented-alignment.test.ts test/engine/vented-plausibility.test.ts
cd packages/ui    && npx vitest run test/hooks/OptionsModal-hooks.test.ts test/hooks/OriginalNewProject-hooks.test.ts

# browser (plan item 4)
OPENISD_EXTERNAL=1 bash scripts/test-browser.sh packages/ui/test/ui/wizard-defaults.browser.spec.ts --timeout=60000

# UI repro of BUG 1 (manual): Options → Plot Window → SPL row End=100, Start untouched → OK → SPL chart unchanged
# UI repro of BUG 2 (manual): Options → Plot Window → clear Frequency-range Start → OK → charts' f-axis broken; reload persists
# Engine repro of BUG 3: createEngine() ; engine.vented.alignment('bb4', 40, 0.5, 0.02, 0.5).Vb === Infinity ;
#                        .plausibility(...)[0].text ends with the PARITY sentence
```

## 5. Repair plan (priority order)

| P | Item | Fix locus |
|---|---|---|
| P1 | BUG 1 — silent drop of one-sided / inverted chart Y-limits | `OptionsModal.vue setLimit` (+1 test in OptionsModal-hooks.test.ts) |
| P1 | BUG 2 — frequency range savable empty/inverted, persists | `OptionsModal.vue saveAndClose` / hook `error` (+ tests) |
| P2 | BUG 3 — `PARITY` sentence on non-physical issues is an unevidenced external claim | `plausibility.ts` + `issueText.ts` (+ test text assertions) |
| P2 | Plan item 3 — single-source the wizard's new-project Ql | `fields/defaults.ts` (mirror `DEFAULT_SOURCE_RESISTANCE_OHM`), delete `NEW_PROJECT_VENTED_QL` |
| P3 | Plan item 4 housekeeping — tick the browser-spec row | plan doc |
| P3 | C8/C9 polish — exponent-form litres in warnings; OK-disabled-scope | judgement text / dialog UX |
