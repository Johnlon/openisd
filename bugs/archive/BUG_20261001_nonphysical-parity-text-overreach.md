# BUG_20261001_nonphysical-parity-text-overreach

**Status:** FIXED 2026-10-01 — `nonPhysicalQuantity()` no longer appends PARITY; the non-physical
sentence now states the raw result is shown, not changed. Pinned in
`packages/design/test/engine/vented-plausibility.test.ts` (non-physical text must not contain
'WinISD'; out-of-range keeps the parity sentence).

## Symptom

Every plausibility sentence — including the **non-physical** one — ends with the constant
`PARITY` (issueText.ts):

> "WinISD gives the same answer, and OpenISD keeps it rather than quietly changing it."

For non-physical designs that claim is **not evidenced**. A case reachable today:
BB4/SBB4 with `Qts' == Ql` (e.g. both 0.5) gives
`alpha = ¼·(1/Qts' − 1/Ql)² = 0` → `Vb = Vas/0 = +Infinity` → the user sees
"Tuning/Box volume is ∞ L - not a physical value. **WinISD gives the same answer**…"
The WinISD parity evidence (60 wizard captures) covers Qts 0.15–1.0 at Ql 10 for the
five alignments' normal outputs; it says nothing about WinISD's behaviour at degenerate
inputs (Ql=Qts, Ql=0, negative Vas…).

## Steps to reproduce

1. Construct an engine with a wide band and call
   `engine.vented.plausibility({Vb: 0.05, Fb: 35})` — normal.
2. Design BB4 at `Qts' = 0.5, Ql = 0.5, Vas = 0.02`:
   `engine.vented.alignment('bb4', 40, 0.5, 0.02, 0.5)` → `{Vb: Infinity, Fb: 40}`.
3. `engine.vented.plausibility(...)` on that design returns the non-physical issue whose
   `text` asserts WinISD's answer is identical — an unverified claim about an external
   product, shown to users in the wizard readout and on box cells' DQ.

## Evidence

Re-verified 2026-10-01:

- `packages/design/engine/vented/VentedEngine.ts:120-127` — `ventedAlphaAndH` bb4 branch
  computes `0.25 * (1/Qts - 1/Ql) ** 2` with no degenerate-input guard; `alignment()`
  divides `Vas_m3 / alpha`.
- `packages/design/engine/issueText.ts:42-44` — `PARITY` appended to
  `nonPhysicalQuantity`'s sentence in `plausibility.ts:44-50`.
- `packages/design/test/engine/vented-alignment.test.ts` header: the 1e-12 validation budget
  is stated for the 60 Qts 0.15–1.0 captures; no degenerate-input capture exists in
  `winisd_research/runs/vented_alignments.jsonl`'s documented scope (Ql fixed at 10).
- Consistent with the repo's own rule (bug-reporting skill): claims about WinISD need
  primary-source evidence from the current conversation; this sentence has none for the
  non-physical branch.

## Cause

`PARITY` was written for the extrapolation case (polynomials run out of band), where the
parity evidence lives, and reused as a universal suffix. The non-physical branch reuses it
because both issue kinds funnel through the same sentence builders.

## Fix

Keep `PARITY` for the `out-of-range` kind only (that is where the 60-capture evidence
applies). For `non-physical`, either drop the sentence or replace it with a scoped,
honest one — e.g. "The alignment formula was evaluated outside the range it was validated
for; OpenISD shows the raw result rather than changing it." If WinISD's behaviour at
degenerate inputs is later proven (WinISD probe), the original sentence can return.

## Verification

- Update `vented-plausibility.test.ts`: assert the non-physical `text` no longer contains
  "WinISD gives the same answer", and the out-of-range `text` still does.
- Grep: `nonPhysicalQuantity` in `plausibility.ts` no longer references `PARITY`.
