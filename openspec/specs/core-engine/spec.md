# Core Engine Calculations Specification

## Purpose

Defines electro-acoustic calculation rules, physical formulas, and circuit solver requirements implemented by `@openisd/engine`.

## Requirements

### Requirement: Driver Parameter Consistency & Derivations

The engine MUST compute mechanical, electrical, and acoustical parameter consistency validations and solve for missing parameters (Fs, Vas, Qes, Sd, Re, Mms, Cms, Rms, Bl) when given sufficient inputs.

#### Scenario: Mechanical and electrical relationships solver

- **GIVEN** a driver with Re, Fs, Qes, and Bl
- **WHEN** mechanical parameter consistency solving is triggered
- **THEN** Mms, Cms, and Rms SHALL be derived mathematically using standard electro-acoustic formulas.

Verifying Tests:

- packages/engine/test/consistency.test.ts
- packages/engine/test/driver.test.ts
- packages/engine/test/formulas.test.ts
- packages/engine/test/hardening.test.ts
- packages/engine/test/added-mass.test.ts

### Requirement: Acoustical Mobility Circuit Solver

The engine SHALL build and solve an equivalent mobility circuit model of the speaker in an enclosure, incorporating box compliance ($C_{ab}$), leakage losses ($Q_L$), and absorption losses ($Q_a$).

#### Scenario: Lossy system resonance (Fsc) and Q (Qtc) sealed peak tracking

- **GIVEN** a sealed enclosure with box leakage loss QL
- **WHEN** electrical impedance is simulated
- **THEN** the system SHALL track the resonance peak Fsc and system Q factor Qtc by scanning the impedance magnitude peak of the lossy circuit.

Verifying Tests:

- packages/engine/test/circuit.test.ts
- packages/engine/test/alignments.test.ts
- packages/engine/test/engine.test.ts
- packages/engine/test/advanced-options.test.ts
- packages/engine/test/complex.test.ts
- packages/ui/test/logic/micka-crosscheck.browser.spec.ts

### Requirement: Frequency Sweeps & Output Quantities

The engine SHALL perform frequency response sweeps returning SPL, Transfer Function Magnitude (relative to high-frequency passband asymptote), cone excursion, port velocity, group delay, and phase.

#### Scenario: Transfer Function Magnitude calculation

- **GIVEN** simulated SPL output arrays
- **WHEN** Transfer Function Magnitude is requested
- **THEN** the values SHALL be normalized relative to the nominal high-frequency passband reference asymptote.

Verifying Tests:

- packages/engine/test/sweep.test.ts
- packages/engine/test/filter-chain-charts.test.ts
- packages/engine/test/golden.test.ts
- packages/engine/test/power-compression.test.ts
- packages/engine/test/architecture.test.ts
