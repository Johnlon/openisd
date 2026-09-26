# ui-presentation

## ADDED Requirements

### Requirement: Box Tab Loss-Mode Selector

The Box tab SHALL present a loss-mode selector offering exactly three options — **Lossless**,
**Conventional Lossy**, and **WinISD Lossy** — bound to the box `lossMode` state. The default SHALL be
**WinISD Lossy**. The Box tab `Fsc`/`Qtc` readout SHALL be computed by the engine for the currently
selected mode, and SHALL update when the selection changes.

#### Scenario: Selector defaults to WinISD Lossy

- **GIVEN** a newly opened sealed-box design
- **WHEN** the Box tab is shown
- **THEN** the loss-mode selector SHALL be present with **WinISD Lossy** selected, and the `Fsc` readout
  SHALL reflect the WinISD lossy value.

#### Scenario: Changing the mode recomputes the readout

- **GIVEN** a sealed box with a non-trivial leakage `QL`
- **WHEN** the user switches the selector from **WinISD Lossy** to **Lossless**
- **THEN** the Box tab `Fsc` readout SHALL change to the lossless value `fs·√(1 + Vas/Vb)`.

Verifying Tests:

- packages/ui/test/ui/box-loss-mode.browser.spec.ts
