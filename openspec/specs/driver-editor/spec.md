# Driver Editor Specification

## Purpose

Defines driver parameter editing, validation rules, consistency calculations, and provenance inspections in the Driver Editor modal.

## Requirements

### Requirement: Consistency Markings (E/C/N)

The driver editor SHALL clearly mark parameter fields based on their derivation status: Entered (E), Calculated (C), or Not specified (N).

#### Scenario: Visual marks update on input

- **GIVEN** an empty driver parameter field in state N
- **WHEN** the user types a value
- **THEN** it SHALL switch to state E (green mark) and trigger derivation solving, which marks derived fields as state C (blue mark).

Verifying Tests:

- packages/ui/test/driver-editor-solver.browser.spec.ts
- packages/ui/test/driver-editor-provenance.browser.spec.ts
- packages/ui/test/driver-type-chips.browser.spec.ts
- packages/ui/test/driver-type-chips.test.ts

### Requirement: Auto-calculate and Solving Controls

The editor SHALL provide a toggle to disable the consistency solver, allowing users to input exact parameters without auto-derivations.

#### Scenario: Disabling auto-calculation

- **GIVEN** "Auto calculate unknowns" is unchecked
- **WHEN** the user types parameters
- **THEN** no consistency solving is executed, and derived fields remain uncalculated.

Verifying Tests:

- packages/ui/test/driver-editor-solver.browser.spec.ts
- packages/ui/test/provenance.test.ts

### Requirement: Parameter Validation & Integrity Guards

The editor MUST block saving or exporting drivers containing invalid parameters (such as required values ≤ 0) and raise data quality warnings.

#### Scenario: Missing brand or model input lockout

- **GIVEN** the editor is open with blank brand and model fields
- **WHEN** the user clicks OK
- **THEN** save SHALL be blocked, and an alert dialog pops up directing focus to the missing fields.

Verifying Tests:

- packages/ui/test/driver-editor-mandatory.browser.spec.ts
- packages/ui/test/consistency-dq.browser.spec.ts
- packages/ui/test/driver-invalid.browser.spec.ts

### Requirement: Interactive Provenance and Equation Inspector

The editor SHALL support parameter provenance inspection, highlighting dependent fields and showing detailed equations for derived values.

#### Scenario: Show Equation Inspector Modal

- **GIVEN** provenance inspection is enabled
- **WHEN** clicking a derived parameter field
- **THEN** the Equation Inspector modal SHALL display containing the equations and substituted values.

Verifying Tests:

- packages/ui/test/driver-provenance-inspector.browser.spec.ts
