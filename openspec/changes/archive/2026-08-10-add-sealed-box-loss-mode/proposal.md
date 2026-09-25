# Add sealed-box resonance loss-mode selector (Lossless / Conventional Lossy / WinISD Lossy)

## Why

The Box tab reports the sealed-box system resonance `Fsc`. Today the engine derives it by scanning
the **impedance-magnitude peak** of the lossy mobility circuit ("Acoustical Mobility Circuit Solver").
That peak barely moves with the box leakage `QL`, so OpenISD's `Fsc` sits at essentially the lossless
value — whereas **WinISD reports a value that rises as `QL` falls** (e.g. a 6 L box with a 40 Hz / 7.47 L
/ Qts≈0.39 driver reads 60.3 Hz lossless but **62.8 Hz at QL=10** and **74.6 Hz at QL=2**).

Reverse-engineering `winisd.exe` (function `prod_462480`, confirmed by live gdb capture) showed WinISD's
`Fsc` is the **pole frequency of a lossy 3rd-order model** — the leak adds a third pole; WinISD builds
the characteristic cubic, solves it, and reports `|complex pole| / (2π)`. This is neither the textbook
lossless formula nor the impedance peak. The full derivation and bit-exact validation live in the
research repo's `SEALED_FSC_MODEL.md` / `SEALED_FSC_DERIVATION.md`.

Users cross-checking OpenISD against WinISD see the mismatch and lose trust. We want OpenISD to reproduce
WinISD's number **by default**, while still offering the textbook models for users who want them.

## What Changes

- **Engine:** add a `LossMode` enum — `Lossless`, `ConventionalLossy`, `WinisdLossy` — and pure functions
  that compute the sealed-box system resonance for each mode. `WinisdLossy` ports the bit-exact cubic from
  `SEALED_FSC_MODEL.md`. `Lossless` is `fs·√(1+Vas/Vb)`. `ConventionalLossy` keeps `fc` fixed at the
  lossless value and folds losses into `Qtc` only (Small/Thiele). Input is passed by argument only (no
  globals), per the `@engine` boundary.
- **State/UI:** add a `lossMode` box parameter (default `WinisdLossy`) and a **Box tab selector** offering
  the three modes. The Box tab `Fsc`/`Qtc` readout is computed from the selected mode.
- **Spec:** ADD a "Sealed-Box Resonance Loss Models" requirement to `core-engine`, and a "Box Tab
  Loss-Mode Selector" requirement to `ui-presentation`.

## Impact

- Specs: `core-engine`, `ui-presentation`.
- Code: `packages/engine/src` (new loss-mode functions + enum), `packages/ui/src/logic` (state field),
  `packages/ui/src/ui/components/BoxPanel.vue` (selector + readout).
- Default behaviour CHANGES: the Box tab `Fsc` will now match WinISD (WinISD Lossy) instead of the
  impedance-peak value. This is intentional and is the motivation for the change.
- Calculation-logic change — authorised by the human in the current conversation.
