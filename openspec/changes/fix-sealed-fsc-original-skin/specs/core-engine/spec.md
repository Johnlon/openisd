## MODIFIED Requirements

### Requirement: Acoustical Mobility Circuit Solver

The engine SHALL build and solve an equivalent mobility circuit model of the speaker in an enclosure, incorporating box compliance ($C_{ab}$), leakage losses ($Q_L$), and absorption losses ($Q_a$).

Sealed-box system resonance `Fsc` and system Q `Qtc` are NOT derived from this circuit's swept
impedance curve — that approach cannot distinguish the true low-frequency resonance peak from
a voice-coil-inductance-driven impedance rise elsewhere in the sweep, and degenerates when the
apparent peak falls at the sweep's frequency boundary. `Fsc`/`Qtc` are owned exclusively by the
"Sealed-Box Resonance Loss Models" requirement's closed-form `sealedResonance()` calculation.

#### Scenario: Circuit incorporates box losses

- **GIVEN** a sealed enclosure with box leakage loss QL and absorption loss QA
- **WHEN** the mobility circuit is built and solved for the enclosure's impedance and SPL sweep
- **THEN** the solved circuit SHALL incorporate the box compliance and both loss terms in its
  swept impedance and SPL output.

#### Scenario: Lossy system resonance (Fsc) and Q (Qtc) sealed peak tracking

- **GIVEN** a sealed enclosure with box leakage loss QL
- **WHEN** `Fsc` and `Qtc` are requested for that enclosure
- **THEN** the system SHALL NOT scan the circuit's swept impedance magnitude for a peak to
  derive them — it SHALL delegate to the "Sealed-Box Resonance Loss Models" requirement's
  closed-form `sealedResonance()` calculation, which is well-defined everywhere the circuit's
  impedance-peak scan degenerates (e.g. when voice-coil inductance makes the impedance curve's
  global maximum fall outside the true low-frequency resonance region).

Verifying Tests:

- packages/engine/test/circuit.test.ts
- packages/engine/test/engine.test.ts
- packages/engine/test/advanced-options.test.ts
- packages/engine/test/complex.test.ts
- packages/ui/test/logic/micka-crosscheck.browser.spec.ts
