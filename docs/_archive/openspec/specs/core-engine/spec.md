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

### Requirement: Sealed-Box Resonance Loss Models

The engine SHALL compute the sealed-box system resonance `Fsc` (and system Q `Qtc`) under a caller-selected
loss model, exposed as a `LossMode` enum with exactly three members — `Lossless`, `ConventionalLossy`, and
`WinisdLossy`. All inputs SHALL be passed by argument (no globals). The three models are:

- **Lossless** — `Fsc = fs·√(1 + Vas/Vb)`; `Qtc = Qts·√(1 + Vas/Vb)`. Independent of `QL`/`QA`.
- **ConventionalLossy** (Small/Thiele) — `Fsc` is the SAME as Lossless (losses do not move the frequency);
  the box losses fold into system Q only: `1/Qtc_total = 1/Qtc + 1/QL + 1/QA`.
- **WinisdLossy** — the pole frequency of the lossy 3rd-order model WinISD reports. With
  `Cas=Vas/(ρc²)`, `Ccab=Vb/(ρc²)`, `Cat=1/(1/Cas+1/Ccab)`, `Mas=1/((2π·fs)²·Cas)`, `ωsc=1/√(Cat·Mas)`,
  `leak=QL/(ωsc·Ccab)`, `qmL=1/(ωsc·Cat·QA)`, `ReSum=1/(2π·fs·Qts·Cas)`, the engine forms
  `denom=Ccab·Cas·Mas·(leak+qmL)` and the cubic `s³ + a3·s² + a2·s + a1` with
  `a1=1/denom`, `a2=(ReSum·Cas+leak·Cas+leak·Ccab+qmL·Ccab)/denom`,
  `a3=(Ccab·Cas·ReSum·(leak+qmL)+Ccab·Cas·qmL·leak+Mas·Cas)/denom`, solves it, and returns
  `Fsc = |complex-pole root| / (2π)`. As `QL→∞` this converges to the Lossless value.
  (Derivation and bit-exact validation: research repo `SEALED_FSC_MODEL.md`, reverse-engineered from
  `winisd.exe` `prod_462480` and confirmed by live capture.)

#### Scenario: Lossless mode is the textbook sealed resonance

- **GIVEN** a driver `fs`, `Vas`, `Qts` and a sealed box volume `Vb`
- **WHEN** `Fsc` is requested in `Lossless` mode
- **THEN** the engine SHALL return `fs·√(1 + Vas/Vb)`, independent of `QL` and `QA`.

#### Scenario: Conventional lossy keeps the frequency fixed and folds losses into Q

- **GIVEN** a sealed box with leakage `QL` and absorption `QA`
- **WHEN** `Fsc` and `Qtc` are requested in `ConventionalLossy` mode
- **THEN** `Fsc` SHALL equal the Lossless value, and `Qtc` SHALL combine the box losses as
  `1/Qtc_total = 1/Qtc + 1/QL + 1/QA`.

#### Scenario: WinISD lossy reproduces WinISD's readout bit-exactly

- **GIVEN** the reference driver (`fs=40`, `Vas=7.47 L`, `Qts` as WinISD derives it) in a 6 L sealed box
- **WHEN** `Fsc` is requested in `WinisdLossy` mode across `QL ∈ {2, 5, 10, 20, 100}`
- **THEN** the returned values SHALL match WinISD's own `[Box] Fr` readout to 4 decimal places
  (`74.60915`, `65.73862`, `62.79619`, `61.35111`, `60.21429`).

#### Scenario: WinISD lossy converges to lossless as leakage vanishes

- **GIVEN** any sealed box and driver
- **WHEN** `Fsc` is requested in `WinisdLossy` mode with `QL → ∞` (and `QA → ∞`)
- **THEN** the result SHALL converge to the `Lossless` value `fs·√(1 + Vas/Vb)`.

Verifying Tests:

- packages/engine/test/loss-mode.test.ts

