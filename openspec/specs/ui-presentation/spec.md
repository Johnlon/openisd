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
