## 1. Generate golden values from the independent oracle

- [ ] 1.1 Using `../winisd_research/lib/winisd_resonance.py` (`winisd_sealed_fc`) plus the pole
      real-part formula documented in `../winisd_research/SEALED_FSC_MODEL.md` §3 (`Qtc =
      |pole|/(2·|Re(pole)|)`), compute `Fsc`/`Qtc` for the Dayton Audio E150HE-44
      (`Fs=40, Vas=0.007645536, Qts=0.39`, from `packages/ui/src/drivers-bundle.json`) in a
      6 L (`Vb=0.006`) sealed box at `Ql=10, Qa=100` (openisd's `P_DEFAULTS`,
      `packages/ui/src/logic/store.ts:26`). Record the exact digits and the command/script
      used to produce them (design.md - Decision 3 gives the approximate values `Fsc≈63.208,
      Qtc≈0.592`; record the precise ones here).
- [ ] 1.2 Compute the same driver/box's lossless case (`Ql=Qa=∞`,
      i.e. `Fsc = fs·√(1+Vas/Vb)`, `Qtc = Qts·√(1+Vas/Vb)`) for the exact-match secondary
      golden point (design.md - Decision 4).

## 2. Failing tests first (red)

- [ ] 2.1 Add the E150HE-44/6L case (both golden points from Section 1) to
      `packages/engine/test/loss-mode.test.ts`, asserting `sealedResonance(LossMode.WinisdLossy,
      ...)` against the lossy golden point within the tolerance from design.md - Decision 3,
      and `sealedResonance(LossMode.Lossless, ...)` against the lossless golden point exactly.
      This SHOULD already pass (lossMode.ts is unmodified) — run it and confirm it passes,
      establishing the oracle values are correctly wired before they're used to catch a
      regression elsewhere.
- [ ] 2.2 Write `packages/ui/test/ui/original-sealed-fsc.browser.spec.ts`: load the Original
      skin, select the E150HE-44 driver, set box type to Sealed with Volume 6 L, and assert
      the displayed `Fsc`/`Qtc` fields match the Section 1 golden values (same tolerance).
      Run it and watch it fail with the reported symptom (`Fsc≈20000`, `Qtc=0.000`) — this is
      the red step, reproducing the live bug from `proposal.md` as an automated test.

## 3. Fix: route Original skin and .wpr export through the shared engine call

- [ ] 3.1 In `packages/ui/src/ui/shells/original/OriginalShell.vue`, rewrite `rearResonance`
      and `rearQtc` (currently backed by `rearPeak`/`findImpedancePeak`,
      `OriginalShell.vue:117-136`) to call `sealedResonance(LossMode.parse(state.lossMode),
      { Fs: d.Fs, Vas: d.Vas, Qts: d.Qts, Vb: state.P.Vb, Ql: state.P.Ql, Qa: state.P.Qa })`,
      matching `StatBar.vue`'s existing call shape. Remove the now-unused `rearPeak` computed
      property and its `findImpedancePeak` import.
- [ ] 3.2 In `packages/ui/src/logic/wprMapping.ts`, replace the `findImpedancePeak`/`sealedFc`
      fallback chain (`wprMapping.ts:66-67`) feeding sealed/bandpass4 `Fr` with
      `sealedResonance(LossMode.WinisdLossy, { Fs: driver.Fs, Vas: driver.Vas, Qts: driver.Qts,
      Vb: P.Vb, Ql: P.Ql, Qa: P.Qa }).Fsc` (WinISD Lossy, matching what a real `.wpr` file's
      `[Box] Fr` represents). Remove the now-unused `findImpedancePeak`/`sealedFc` imports.
- [ ] 3.3 Re-run the two tests from Section 2 and watch both pass (green).

## 4. Delete the superseded estimator

- [ ] 4.1 Confirm (grep) `findImpedancePeak` and `sealedFc` have zero remaining production
      consumers after Section 3.
- [ ] 4.2 Delete `findImpedancePeak` and `sealedFc` from `packages/engine/src/alignments.ts`,
      and their exports from the package's index/barrel file if separately listed.
- [ ] 4.3 Delete the `'Lossy sealed box resonance and Q from sweep (findImpedancePeak)'`
      describe block from `packages/engine/test/alignments.test.ts` (and its now-unused
      `findImpedancePeak`/`sweep` import at line 386 if `sweep` is not used elsewhere in the
      file). Run the file's remaining tests and confirm they still pass unmodified.

## 5. Spec-traceability comments

- [ ] 5.1 Confirm `packages/engine/test/loss-mode.test.ts` already links
      `openspec/specs/core-engine/spec.md` (added by `9ffa0d2`); no change needed there beyond
      the new test case added in 2.1.
- [ ] 5.2 Add a spec-link comment to `packages/ui/test/ui/original-sealed-fsc.browser.spec.ts`
      referencing `openspec/specs/ui-presentation/spec.md` "Box Tab Loss-Mode Selector".
- [ ] 5.3 Confirm no remaining test file references the deleted `findImpedancePeak` describe
      block's old spec link (if it carried one distinct from the requirement's other tests).

## 6. Full gate

- [ ] 6.1 Run `python3 scripts/validate-openspec.py` and confirm the traceability check passes
      for both modified spec files and the new/changed test files.
- [ ] 6.2 Run `bash scripts/health-check.sh` (lint + typecheck + unit + browser) and confirm
      100% green.
- [ ] 6.3 Manually re-verify the exact scenario from `proposal.md` — Dayton Audio E150HE-44 in
      a 6 L sealed box, Original skin — via the dev server, confirming the displayed `Fsc`/`Qtc`
      now match the Section 1 golden values, and save the confirming screenshot to
      `openspec/changes/fix-sealed-fsc-original-skin/evidence/original-skin-fsc-fixed.png`
      alongside the existing bug-repro screenshot.
