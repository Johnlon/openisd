# BUG_20261001_options-frequency-range-unvalidated-empty-inverted

**Status:** OPEN

## Symptom

The Options dialog → Plot Window → Limits → "Frequency range" Start/End inputs have no
effective validation at OK. Two corrupt states are savable today:

1. **Cleared field**: clearing Start (or End) and clicking OK writes the empty string
   `''` into `presentationState.sweepRange`. Every chart's frequency axis is driven by
   that pair; `''` coerces to `0` in arithmetic, and a log-scaled axis does `log10(0) = −Infinity`
   — broken axes across the app until the user repairs the setting.
2. **Inverted range**: Start `30000`, End `20` is saved as-is (OK is not disabled).

The band-validation `error` that gates `canApply` covers ONLY the vented limits
(OptionsModal-hooks.ts `error` computed); the Plot Window tab has no equivalent, so
`saveAndClose` happily writes a corrupt sweep range.

## Steps to reproduce

1. Open Options → Plot Window → Limits.
2. Clear the "Frequency range" **Start** field (select-all, Delete).
3. Click OK — it is enabled; the dialog closes with no error.
4. Open any chart: the frequency axis is broken (log of 0). Reload the page — the corrupt
   value persists (view state).

Variant: type Start `30000`, End `20`, OK — saved inverted.

## Evidence

Re-verified 2026-10-01 by reading the current source:

- `packages/ui/src/ui/components/OptionsModal.vue:113-115` — `v-model.number="draft.P.fmin"`;
  Vue's `.number` modifier keeps the RAW string when `parseFloat` fails, so a cleared field
  makes `draft.P.fmin === ''`.
- `packages/ui/src/ui/directives/limits.ts:48-49` — `clampNow` explicitly leaves `''` alone
  ("transient empty/partial entry is left alone"), and there is no blur/commit pass, so the
  empty string is never repaired before save.
- `packages/ui/src/ui/components/OptionsModal.vue:105-112` — `saveAndClose` writes
  `presentationState.sweepRange = { min: draft.P.fmin, max: draft.P.fmax }` with no
  finite/ordered check; the only gate is `canApply`, which is band-only.
- Aggravation: `packages/ui/src/logic/appState.ts:705-709` persists `sweepRange` into view
  state with no sanitising on the way in or out.

## Cause

`v-limits` clamps typed out-of-range numbers but was never given an emptiness or
cross-field-ordering contract, and the dialog's single `error` computed was scoped to the
vented band when the Settings tab was added — the Plot Window tab predates it and was never
brought under the gate.

## Fix

Extend the dialog's commit gate: in `saveAndClose` (or the hook's `error` computed), require
both `Number.isFinite` and `min < max` for the frequency pair, showing the same `.opt-error`
treatment the band gets; repair-or-reject the empty string on blur. Optionally sanitise at
the `presentationState.sweepRange` writer for defence in depth.

## Verification

- Unit test: `useOptionsModal`-level or component test — clear Start, `canApply` false /
  error shown; save blocked.
- Browser check: clear Start → OK → dialog stays open with the error; set 30000/20 → same.
