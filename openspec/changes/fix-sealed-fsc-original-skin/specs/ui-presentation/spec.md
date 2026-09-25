## MODIFIED Requirements

### Requirement: Box Tab Loss-Mode Selector

Every skin's Box tab (Original, Classic, Modern) SHALL present a loss-mode selector offering
exactly three options — **Lossless**, **Conventional Lossy**, and **WinISD Lossy** — bound to
the box `lossMode` state. The default SHALL be **WinISD Lossy**. The Box tab `Fsc`/`Qtc`
readout, on every skin, SHALL be computed by the shared engine `sealedResonance()` call for
the currently selected mode, and SHALL update when the selection changes. No skin SHALL
compute its own, independent estimate of sealed-box `Fsc`/`Qtc` — a skin-local estimator that
can diverge from the shared engine result (in value, or in failure behavior) is a violation of
this requirement regardless of how it derives its number.

#### Scenario: Selector defaults to WinISD Lossy

- **GIVEN** a newly opened sealed-box design
- **WHEN** the Box tab is shown
- **THEN** the loss-mode selector SHALL be present with **WinISD Lossy** selected, and the `Fsc` readout
  SHALL reflect the WinISD lossy value.

#### Scenario: Changing the mode recomputes the readout

- **GIVEN** a sealed box with a non-trivial leakage `QL`
- **WHEN** the user switches the selector from **WinISD Lossy** to **Lossless**
- **THEN** the Box tab `Fsc` readout SHALL change to the lossless value `fs·√(1 + Vas/Vb)`.

#### Scenario: Every skin agrees on the sealed-box readout for the same design

- **GIVEN** the same driver, sealed box volume, and loss-mode selection
- **WHEN** the Box tab `Fsc`/`Qtc` readout is read on the Original skin and on the Modern skin
- **THEN** both skins SHALL display the same `Fsc` and `Qtc` values, to the display precision
  each skin uses, because both compute them via the same shared engine call.

#### Scenario: A driver whose impedance rises above resonance at high frequency still reports a valid low-frequency Fsc

- **GIVEN** a driver whose voice-coil inductance makes its swept impedance magnitude exceed the
  height of its low-frequency resonance peak somewhere in the displayed frequency range
- **WHEN** the Box tab `Fsc`/`Qtc` readout is computed for a sealed box
- **THEN** the readout SHALL report the driver's actual low-frequency sealed-box resonance
  (order of magnitude consistent with `fs·√(1 + Vas/Vb)`) and a nonzero `Qtc`, never the
  frequency-sweep's upper bound with `Qtc = 0`.

Verifying Tests:

- packages/ui/test/ui/box-loss-mode.browser.spec.ts
- packages/ui/test/ui/original-sealed-fsc.browser.spec.ts
