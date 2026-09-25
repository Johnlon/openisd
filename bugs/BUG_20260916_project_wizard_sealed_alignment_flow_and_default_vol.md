# BUG 20260916 — project wizard does not follow the WinISD wizard's sealed-alignment flow; and it ships a typed default volume instead of deriving one from the alignment

Status: OPEN (recorded only, per human "record the bug for now — no fix")
Raised: 2026-09-16
Ledger: QO154
Real files (path-verified, the only ones this bug concerns):
  - packages/ui/src/ui/shells/original/OgNewProject.vue   — the project wizard (Original skin)
  - packages/ui/test/ui/wizard-defaults.browser.spec.ts   — today's wizard spec (58 lines)
  - docs/debugging/vue-runtime-debugging.md                — the Signal-pane case history

## What the human observed in real WinISD (verbatim intent, 2026-09-16)

The **WinISD** wizard walks these steps, in order:

  1. pick the driver
  2. pick the number of drivers, and normal (1 driver) vs **isobaric** mounting
  3. **alignment** — the default offered is *vented*, but the human chose *closed / sealed*
  4. the sealed alignment then asked for a target, defaulting to **0.707** (Qtc)
  5. OK -> lands in the project showing: **volume 4.9 L, Fs 45, Qtc 0.704**

openisd's wizard today does NOT follow that multi-step flow, and it has no such step-driven
sealed default.

## The two ruled defects (both recorded, neither fixed — human asked "record for now")

### Defect 1 — the wizard is not the WinISD walk
Our wizard omits the sequence above (driver pick -> count+normal/isobaric -> alignment-with-its-
own default -> alignment target -> derive volume). We do not claim guesswork about which steps we
do have; the gap to close is exactly the WinISD walk the human listed.

### Defect 2 — a typed DEFAULT VOLUME where none belongs
"we shouldn't have a default vol - we should derive from alignment for sealed".  A sealed
enclosure's volume is an OUTPUT of the alignment (given Qtc target ≈ 0.707, Fs, Vas and the
drive), not an INPUT you type. Shipping a typed default volume is the same blunder class as the
Signal-pane bug (BUG_20260916_signal-pane-blur…) — presenting a derived quantity as an entered
one, so it can silently disagree with the law. The sealed default must be DERIVED from the
alignment; a typed parity default is the wrong fix and should not land.

## Test truth (why this is a real gap, not a phantom)

Today packages/ui/test/ui/wizard-defaults.browser.spec.ts asserts: a wizard-created project draws
a chart for EVERY simulatable box type (sealed / vented / PR / bandpass4), and that a vented
project shows a vent diameter + tuning and a PR project shows a radiator. It does NOT assert the
sealed tab's display values for a specific driver + 6 L — the per-tab value assertions the human
is asking about do not exist yetknowledge_for_sealed.

Per the creed: only the test that WANTS to know the default may assert the default. Any new
sealed-default-acceptance test must first pick its own alignment/Qtc and driver (never rely on
wizard state), and assert the DERIVED volume against the law, not a typed constant.

## Next action (record-only, nothing to implement yet)

Open. Revisit when the human rules whether we rebuild the wizard to the WinISD walk (steps 1-5
above) and replace the typed default volume with a derived one.
