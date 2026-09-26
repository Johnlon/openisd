## Why

The sealed-box `Fsc`/`Qtc` readout on the "Original (WinISD)" skin — the app's **default**
skin — is broken: for the demo driver in the default 30 L sealed box it reads `Fsc = 20000.00
Hz`, `Qtc = 0.000` (live-reproduced via Playwright against the running dev server; screenshot
`evidence/original-skin-fsc-20000-repro.png` in this change directory). It is not driver- or
volume-specific — the
same collapse reproduces for the Dayton Audio E150HE-44 in a 6 L box, the case the user
reported ("it should be 60.32 Hz Fsc and Qtc 0.599").

**Root cause, traced to source (not "the last change" as first suspected).** The Original
skin's Box tab does not use the engine's `sealedResonance()`/`LossMode` cubic (added in
commit `9ffa0d2`, correct, and already validated bit-exact — see
`openspec/specs/core-engine/spec.md` "Sealed-Box Resonance Loss Models"). It uses a separate,
older estimator, `findImpedancePeak` (`packages/engine/src/alignments.ts:131`, introduced
two and a half hours earlier by commit `052f00c`), wired through `OriginalShell.vue`'s
`rearPeak`/`rearResonance`/`rearQtc` (`packages/ui/src/ui/shells/original/OriginalShell.vue:117-136`).
`findImpedancePeak` takes the **global** argmax of the swept impedance-magnitude curve
`zmag[]` across the *entire* `fmin`–`fmax` range (default 1–20000 Hz) as "the" resonance peak.
For a real driver, voice-coil inductance (`Le`) makes impedance rise again at high frequency;
when that inductive rise exceeds the true low-frequency Thiele/Small resonance bump — common,
and true of both the demo driver and the E150HE-44 — the argmax lands on the **last sample of
the sweep**, i.e. `fmax` (20000 Hz). Because that "peak" sits at the array boundary, the
function's own bandwidth search for the upper -3 dB-equivalent point (`f2`,
`alignments.ts:167-181`) never finds a lower crossing, so it falls into its own degenerate
branch (`alignments.ts:184-186`) and returns `{ Fsc: peakFreq, Qtc: 0 }` — exactly the observed
`20000.00 Hz` / `0.000`. `9ffa0d2` never touched `alignments.ts` or `OriginalShell.vue`'s
sealed-box readout, so this defect predates it and was simply left exposed on the one skin
that never adopted the new, correct engine call.

The same `findImpedancePeak` result also feeds the sealed/bandpass4 `Fr` field written into
`.wpr` exports (`packages/ui/src/logic/wprMapping.ts:66-67`), so the same pathological value
can be silently exported to a WinISD project file, not just displayed.

The user has explicitly authorised this calculation-logic fix in-conversation: "I need the
l[o]gic fixed and the test written as demanded" (original request) and "go" / "I need
enforcement" (follow-up), after being shown the root cause. This is the required permission
per `openisd/AGENTS.md` §"Calculation logic — permission gate".

## What Changes

- `OriginalShell.vue`'s sealed-box `Fsc`/`Qtc` readout (`rearResonance`/`rearQtc`, feeding the
  Box-tab "Fsc"/"Qtc" fields and the bandpass4 rear-chamber "Frc" field that reuses the same
  formula) SHALL be computed via the engine's `sealedResonance(LossMode, {...})` — the same
  bit-exact WinISD-cubic call `StatBar.vue`/`ModernShell` already use — instead of
  `findImpedancePeak`'s impedance-curve peak search. This also gives the Original skin the
  same three loss models (Lossless / Conventional Lossy / WinISD Lossy) the Modern skin
  already exposes, keeping the two skins' sealed-box physics identical rather than two
  independently-behaving estimates of the same quantity.
- `wprMapping.ts`'s sealed/bandpass4 `.wpr` `Fr` export SHALL use the same `sealedResonance()`
  call (WinISD Lossy, matching what `.wpr`'s own `[Box] Fr` field represents in a real WinISD
  project file) instead of `findImpedancePeak`.
- `findImpedancePeak` and `sealedFc` (`packages/engine/src/alignments.ts`) become unused in
  production once both call sites above are migrated (verified: their only production
  consumers are the two call sites named here) and SHALL be deleted, along with their now
  test-only-orphaned coverage in `packages/engine/test/alignments.test.ts`, rather than left
  as dead, misleadingly-named code implementing a broken duplicate of the canonical model.
- Add a golden functional test for `sealedResonance(WinisdLossy, ...)` using the Dayton Audio
  E150HE-44 (`packages/ui/src/drivers-bundle.json`: `Fs=40, Vas=0.007645536 m³, Qts=0.39`) in a
  6 L sealed box at openisd's own default box losses (`Ql=10, Qa=100` — `P_DEFAULTS` in
  `packages/ui/src/logic/store.ts:26`), with golden values generated from the research repo's
  independently-implemented, WinISD-bit-exact oracle (`../winisd_research/lib/winisd_resonance.py`,
  documented in `../winisd_research/SEALED_FSC_MODEL.md`) — **not** hand-typed — per
  `openisd-engine-tests` rule.

**BREAKING**: none for saved projects/data — this only changes a computed, non-persisted
readout and the `.wpr` export's `Fr` value for sealed/bandpass4 boxes (which was already wrong
in the same pathological cases this fixes).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `ui-presentation`: "Box Tab Loss-Mode Selector" is broadened — it currently reads as a
  single, skin-unqualified requirement but was in practice only honored by the Modern skin.
  The delta makes explicit that every skin's sealed-box `Fsc`/`Qtc` (Original included) SHALL
  be computed by the shared engine `sealedResonance()` call, never a skin-local estimator.
- `core-engine`: "Acoustical Mobility Circuit Solver" currently specs, as its Fsc/Qtc scenario,
  the exact broken behavior being removed ("track the resonance peak Fsc and system Q factor
  Qtc by scanning the impedance magnitude peak of the lossy circuit" —
  `openspec/specs/core-engine/spec.md:29-33`, verified by `packages/engine/test/alignments.test.ts`,
  the test file whose `findImpedancePeak` block this change deletes). This scenario was left
  stale when `9ffa0d2` added the correct, now-canonical "Sealed-Box Resonance Loss Models"
  requirement immediately below it in the same file without retiring this one — the two
  currently contradict each other. The delta rewrites that scenario to state Fsc/Qtc are NOT
  derived from the circuit's impedance-peak scan and delegate to `sealedResonance()` instead;
  the requirement's circuit-building responsibility (Cab/QL/QA) is unchanged and still
  verified by the requirement's other listed tests.

## Impact

- `packages/ui/src/ui/shells/original/OriginalShell.vue` — `rearPeak`/`rearResonance`/`rearQtc`
  rewritten to call `sealedResonance()`.
- `packages/ui/src/logic/wprMapping.ts` — sealed/bandpass4 `Fr` export rewritten to call
  `sealedResonance()`.
- `packages/engine/src/alignments.ts` — `findImpedancePeak`, `sealedFc` deleted (dead after the
  above).
- `packages/engine/test/alignments.test.ts` — the `findImpedancePeak` describe block deleted
  (was testing the deleted function; other alignment tests in this file are unaffected).
- New golden test: `packages/engine/test/loss-mode.test.ts` (existing file from `9ffa0d2`) gains
  an E150HE-44/6L case, and a new browser test drives the Original skin to the same scenario
  and asserts the displayed Fsc/Qtc against the same golden values.
- No change to `packages/engine/src/lossMode.ts` itself — it is already correct (verified by
  direct probing with `vite-node` against multiple degenerate inputs during investigation; no
  reproduction of the reported symptom came from that module).
- `openspec/specs/core-engine/spec.md` — "Acoustical Mobility Circuit Solver"'s stale
  impedance-peak-scanning scenario removed, so the file no longer specs two contradictory
  ways of computing sealed Fsc/Qtc.
