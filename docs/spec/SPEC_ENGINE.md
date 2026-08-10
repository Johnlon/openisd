# OpenISD — Core Engine Calculation Specification (`SPEC_ENGINE.md`)

This specification defines the electro-acoustic calculation rules, physical formulas, and circuit solver requirements implemented by `@openisd/engine` (`packages/engine/src/`).

---

## 1. Driver Parameter Consistency & Derivations

### 1.1 Motor & Mechanical Relationships

- **DC Coil Resistance ($\text{Re}$)**:
  $$\text{Re} = \frac{\text{BL}^2 \cdot \text{Qes}}{2\pi \cdot \text{Fs} \cdot \text{Mms}}$$
- **Moving Mass ($\text{Mms}$)**:
  $$\text{Mms} = \frac{\text{BL}^2 \cdot \text{Qes}}{2\pi \cdot \text{Fs} \cdot \text{Re}}$$
- **Mechanical Compliance ($\text{Cms}$)**:
  $$\text{Cms} = \frac{1}{4\pi^2 \cdot \text{Fs}^2 \cdot \text{Mms}} = \frac{\text{Vas}}{\rho \cdot c^2 \cdot \text{Sd}^2}$$
- **Mechanical Resistance ($\text{Rms}$)**:
  $$\text{Rms} = \frac{2\pi \cdot \text{Fs} \cdot \text{Mms}}{\text{Qms}}$$

**Verifying Tests**:

- [`packages/engine/test/consistency.test.ts`](../../packages/engine/test/consistency.test.ts)
- [`packages/engine/test/driver.test.ts`](../../packages/engine/test/driver.test.ts)

---

## 2. Acoustical Mobility Circuit Solver

### 2.1 Enclosure Acoustic Compliance & Losses

- **Box Compliance ($C_{ab}$)**:
  $$C_{ab} = \frac{V_b}{\rho \cdot c^2}$$
- **Box Leakage Loss ($Q_L$)**: Parallel resistance $R_{al} = \frac{Q_L}{\omega C_{ab}}$ (default $Q_L = 7$ for vented, $Q_L = 10$ for sealed).
- **Absorption Loss ($Q_a$)**: Parallel resistance $R_{aa} = \frac{Q_a}{\omega C_{ab}}$ (default $Q_a = 100$).
- **Total Sealed Box Acoustic Impedance ($Z_{box}$)**:
  $$Z_{box} = Z_{Cab} \parallel R_{al} \parallel R_{aa}$$

### 2.2 System Resonance ($F_{sc}$) & Q ($Q_{tc}$) in Sealed Enclosures

- **Lossless Calculation**:
  For an idealized lossless enclosure ($Q_L \to \infty$), the system resonance frequency $F_{sc}$ and Q-factor $Q_{tc}$ are computed analytically as:
  $$F_{sc} = F_s \cdot \sqrt{1 + \frac{V_{as}}{V_b}}$$
  $$Q_{tc} = Q_{ts} \cdot \sqrt{1 + \frac{V_{as}}{V_b}}$$
- **Lossy Enclosure Peak Tracking**:
  For a physical enclosure with leakage losses ($Q_L < \infty$), the leakage acts as a high-pass vent in parallel with the box compliance. At resonance, this parallel reactance shifts the electrical impedance ($Z_{el}$) peak upward.
  OpenISD extracts the true lossy $F_{sc}$ and $Q_{tc}$ by locating the absolute magnitude peak of the simulated electrical impedance sweep ($Z_{el}$):
  1. Find peak frequency $F_{sc}$ where $|Z_{el}(f)|$ is maximum.
  2. Compute impedance ratio $r_0 = \frac{|Z_{el}(F_{sc})|}{R_e}$.
  3. Locate the lower ($f_1$) and upper ($f_2$) frequencies where $|Z_{el}(f)| = R_e \sqrt{r_0}$.
  4. Compute mechanical and system Q-factors:
     $$Q_{mc} = \frac{F_{sc} \sqrt{r_0}}{f_2 - f_1}$$
     $$Q_{tc} = \frac{Q_{mc}}{r_0}$$

**Verifying Tests**:

- [`packages/engine/test/circuit.test.ts`](../../packages/engine/test/circuit.test.ts)
- [`packages/engine/test/alignments.test.ts`](../../packages/engine/test/alignments.test.ts)

---

## 3. Frequency Sweeps & Output Quantities

### 3.1 Transfer Function Magnitude ($\text{TFMag}$)

- **Passband Baseline Reference ($0\text{ dB}$)**:
  The $0\text{ dB}$ reference level for Transfer Function Magnitude is defined strictly by the driver's theoretical **high-frequency passband asymptote** ($\lim_{f \to \infty} \text{SPL}_{\text{driver}}(f) = \text{SPL}_{\text{ref\_limit}}$ based on the reference efficiency $\eta_0$ at the nominal drive voltage and temperature), NOT the last element of the sweep array which is affected by filters or acoustic roll-offs.
- **Formula**:
  $$\text{TFMag}(f) = \text{SPL}(f) - \text{SPL}_{\text{ref\_limit}}$$
  where:
  $$\text{SPL}_{\text{ref\_limit}} = 10 \log_{10} \left( \frac{\rho \cdot c}{2 \pi \cdot r^2 \cdot P_0^2} \cdot \eta_0 \cdot \frac{E_g^2}{R_e} \cdot n_p^2 \right)$$
  $$\eta_0 = \frac{4 \pi^2}{c^3} \cdot \frac{f_s^3 \cdot V_{as}}{Q_{es}}$$

**Verifying Tests**:

- [`packages/engine/test/sweep.test.ts`](../../packages/engine/test/sweep.test.ts#L231)

### 3.2 Cutoff Frequency Readouts ($F_3, F_6, F_{10}$)

- **Formula**: `rolloffFreq(sw, dropDb)` identifies the lowest frequency ($f$, Hz) where $\text{SPL}(f) \ge \text{SPL}_{\text{peak}} - \text{dropDb}$.

**Verifying Tests**:

- [`packages/engine/test/sweep.test.ts`](../../packages/engine/test/sweep.test.ts#L235)
