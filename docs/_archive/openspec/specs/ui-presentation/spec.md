# UI Presentation and Charting Specification

## Purpose

Defines user interface presentation rules, chart mapping contracts, and skin layouts in `@openisd/ui`.
## Requirements
### Requirement: Decoupled Chart Series Adaptation

The UI series utility MUST map raw engine sweep results into graph renderer series arrays without executing physics math or peak normalization.

#### Scenario: SPL and Transfer Function series mapping

- **GIVEN** simulated sweep data
- **WHEN** UI series mapping is invoked
- **THEN** series are populated with pre-normalized values alongside 0 dB and -3 dB target reference line sweeps.

Verifying Tests:

- packages/ui/test/ui/chart-types.test.ts
- packages/ui/test/ui/chart-zoom.browser.spec.ts
- packages/ui/test/ui/record-animation.browser.spec.ts

### Requirement: Multi-Skin UI Presentation Layouts

The UI SHALL support multiple distinct skin layouts (Modern, Classic, Original) mapping the enclosure simulator features onto different design paradigms.

#### Scenario: Original layout simulation panel

- **GIVEN** original skin selected
- **WHEN** layout is loaded
- **THEN** parameters, projects, readouts, and charts SHALL fit into the quad-window arrangement with narrow-screen layout folding capability.

Verifying Tests:

- packages/ui/test/ui/skins.test.ts
- packages/ui/test/ui/visual.browser.spec.ts
- packages/ui/test/ui/original-narrow.browser.spec.ts
- packages/ui/test/ui/original-layout.browser.spec.ts
- packages/ui/test/ui/classic-skin.browser.spec.ts
- packages/ui/test/ui/original-skin.browser.spec.ts

### Requirement: Tone Generator Utility

The UI SHALL provide a tone generator modal tool generating acoustic test waveforms from selected project frequencies.

#### Scenario: Generating sine wave sweep audio

- **GIVEN** a frequency range selection
- **WHEN** tone play is clicked
- **THEN** the audio output is synthesized at the specified frequencies.

Verifying Tests:

- packages/ui/test/logic/toneGenerator.test.ts

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

