# BUG_20260918_hand-entered-passive-radiators-never-derive-mms-cms

**Status:** OPEN

## Symptom
A passive radiator entered through the UI can never reach a solvable `Fp` → `addedMass` state.
The Fp field gets the app's own data-quality flag (missing `prMmd_kg, prSd_m2, prCms_m_per_N`),
and the Box-tab resonance stays `—`, no matter what the user types. Hand-entered radiators are
D.Q.'d forever; only a bundled PR record that already carries Mms/Cms (e.g. Dayton ND140-PR) can
be tuned.

Detected while strengthening `packages/ui/test/ui/app.browser.spec.ts`. The test entered a
complete-looking PR through the real controls (pane `Fpr` 40 Hz + `Sd` 133 cm² + `Xmax`, editor
`Qms` + `Vas`) and set Fp 37.9; diagnostics:

```json
{"fh":"—","fpr":"40.00","paneSd":"133.00","madd":"","fp":"37.90","fpField":"field entered dq-flag"}
```

## Cause — nothing derives Mms/Cms for spec entries typed via the UI
The PR solve routes on the radiator's **stored spec entries**, read raw
(packages/design/domain/openisdDomain.ts — route `2360–2376`, `prSpec` `424–455`):
`prMmd_kg = r.spec.Mms_kg`, `prSd_m2 = r.spec.Sd_m2`, `prCms_m_per_N = r.spec.Cms_m_per_N`.

`Engine.prCmsFromVas` and `Engine.prMmdFromFs` exist (packages/design/engine:
Engine.ts:13,276,284 and formulas.ts:65,75) but **nothing in the app calls them** — they are
exercised only by unit tests. So entering Fs/Qms/Vas/Sd through `PREditModal.vue` writes those
five numbers and leaves `Mms_kg` / `Cms_m_per_N` at null, and `solvePr` can never produce
`addedMass` / `systemTuning` (PR_GEOMETRY is incomplete → missing-dependencies DQ).

`PREditModal.vue`'s own comment claims "the consistency solver works out what the rest of the
radiator's parameters must be" — false today: the solver only routes on what is stored.

## Should fix (two ways, design decision)
1. Derive `Cms` from `Vas`+`Sd` (and `Mms` from `Fs`+`Cms`) for the PR board's spec on write,
   wiring in the existing `Engine.prCmsFromVas` / `prMmdFromFs`.
2. Or accept the current model (bundled PRs only) and make the no-derive intent explicit in the
   editor's UI text/help.

Re-add the original Fp-37.9-style assertion in `app.browser.spec.ts` once a hand-entered PR can
solve; until then the test loads a bundled PR and asserts its solved added mass / system tuning.