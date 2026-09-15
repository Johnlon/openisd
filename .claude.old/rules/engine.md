---
paths:
  - "packages/engine/**"
  - "packages/design/engine/**"
---

# Engine

**Never change calculation logic without explicit human permission in the current conversation.**
Covers formulas (alignments, circuit, engine, filters, sweep), physical constants (`RHO`, `C`,
end-correction coefficients), `toFixed()` and any display precision, and default parameter values
that affect a computed result.

Cross-checks against micka.de, REW or WinISD are reference only. A discrepancy is documented, not
fixed.

Model: a lumped-element electro-mechano-acoustical circuit solved in the acoustical impedance
analogy, one complex value per frequency (`sweep.ts`/`circuit.ts`). `eg` is RMS, so SPL is
RMS-referenced; excursion and port velocity are peak (×√2) against Xmax/chuffing limits. For a
vented/PR box net radiated volume velocity is `U_0 = U_D − U_port` — the minus sign is what gives
the 24 dB/oct rolloff.

Formulas with test citations: `docs/spec/SPEC_ENGINE.md`. Layer diagram: `ARCHITECTURE.md` AD-6.
Extraction rule: `ARCHITECTURE.md` §AD-4 "Extract, do not rewrite".
