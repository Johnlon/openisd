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

### 1.2 USPL / SPLmax / Mpow — the 2.83 V reference and the 3 dB derating

These three fields (`solveConsistencyGroup`/`deriveDriver`, `packages/engine/src/driver.ts`)
were corrected 2026-08-14 against WinISD 0.7.0.0 goldens in
`packages/winisd/test/fixtures/winisd-parity/goldens/*.wpr` — the evidence for each is a
prediction from the golden's OWN stated inputs that reproduces WinISD's stored output value
to float precision, not a plausibility argument.

- **`SPLref`** — the reference sensitivity (1 W / 1 m) derived from efficiency: $\text{SPLref} =
  \text{splFromEfficiency}(\eta_0, \rho, c)$ (`efficiency.ts`, §3.1's $\eta_0$ formula). This is
  openisd's own COMPUTED sensitivity, independent of any sensitivity a driver record states.

- **The base for USPL/SPLmax is the record's STATED `SPL` when it has one, else `SPLref`.**
  A `.wdr`'s `SPL=` line is an independently entered figure of merit — WinISD's own ParState
  marks it `E` (entered) exactly like any other typed field, distinct from the `C` (computed)
  mark on its derived `no`/`SPLref` — so a datasheet SPL and the η₀-derived sensitivity are two
  different numbers that need not agree, and don't on `sealed-small` (stated `SPL=90`, computed
  `SPLref=87.65068346041753`). Predicting `USPL`/`SPLmax` from the STATED `SPL` matches WinISD;
  predicting from `SPLref` does not, on the same golden.

- **USPL — the 2.83 V/1 m sensitivity**:
  $$\text{USPL} = \text{SPL} + 10\log_{10}\left(\frac{2.83^2}{\text{Re}}\right)$$
  `2.83` is the industry-standard reference DRIVE VOLTAGE — the voltage that puts exactly 1 W
  into a nominal 8 Ω load, $V=\sqrt{1\cdot 8}=2.828\ldots$, rounded to WinISD's own printed
  label. `2.83^2 = 8.0089`, not the bare `8` this code read before 2026-08-14: on
  `sealed-small` (`SPL=90`, `Re=6.4`), `90+10\log_{10}(8.0089/6.4) = 90.9739289706469`, WinISD's
  own stored `USPL` to the last digit (agreement 4.3e-14 relative); the bare-8 form gives
  `90.9691...`, off by 0.0048 dB — small enough to look like formatting noise, but a real,
  wrong formula. Confirmed identically on all `winisd-parity` goldens with a stated `SPL`.
  **Provenance of the `2.83 = 2.828…` rounding is the industry 1 W/8 Ω convention** (not found
  independently stated as WinISD's own reasoning in `winisd_research/`); the numeric match to
  WinISD's stored output is the primary evidence.

- **SPLmax — the thermal-limit SPL at rated power**:
  $$\text{SPLmax} = \text{SPL} + 10\log_{10}(\text{Pe}) - 3$$
  The flat **3 dB derating is measured exactly**, not $10\log_{10}(2)=3.0103$: on
  `sealed-small` (`SPL=90`, `Pe=100`), `90+20-3=107`, WinISD's stored value to the printed
  digit — a $10\log_{10}(2)$ derating would print `106.9897`, which the golden does not. ⚠
  **The WHY of the 3 dB is NOT established** — no text found in `winisd_research/` explains it
  as a program-power convention, a half-power headroom margin, or anything else; only the
  numeric fact (exactly −3 dB) is proven, over the two golden values available
  (`sealed-small`, `vented-small`).

- **Mpow — the "power capability" figure**:
  $$\text{Mpow} = \frac{\text{BL}}{\sqrt{\text{Re}}}$$
  falling back to $\sqrt{\text{Rme}}$ only when `Bl` is absent. Recovered from
  `goldens/inconsistent-fs.wpr`, built specifically to separate the two candidate formulas —
  its stored `Fs` is written at exactly twice the record's true value from `Mms`/`Cms`, and the
  two routes are algebraically identical on any SELF-consistent record (every other golden), so
  only a deliberately inconsistent one can tell them apart. On that record WinISD wrote
  `Rme = 17.578125`, `Mpow = 2.96463530640786`. `Bl / sqrt(Re) = 7.5 / sqrt(6.4) =
2.96463530640786` matches to the last digit; `sqrt(Rme) = sqrt(17.578125) = 4.1926274578121`
  does not. `Mpow = sqrt(Rme)` is not an identity WinISD holds — `Rme` and `Mpow` are
  independently sourced.

**Verifying Tests**:

- [`packages/engine/test/advanced-figures.test.ts`](../../packages/engine/test/advanced-figures.test.ts)
- [`packages/winisd/test/winisd-parity.test.ts`](../../packages/winisd/test/winisd-parity.test.ts) — `USPL`, `SPLmax`, `Mpow` rows
- `bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md`
- `bugs/BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md`

---

## 2. Acoustical Mobility Circuit Solver

### 2.1 Enclosure Acoustic Compliance & Losses

- **Box Compliance ($C_{ab}$)**:
  $$C_{ab} = \frac{V_b}{\rho \cdot c^2}$$
- **Box Leakage Loss ($Q_L$)**: Parallel resistance $R_{al} = \frac{Q_L}{\omega C_{ab}}$ (default $Q_L = 10$ for every enclosure type).
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

---

## 4. Data Shapes & Public API

Types are defined in [`packages/engine/src/types.ts`](../../packages/engine/src/types.ts);
physical constants in [`packages/engine/src/constants.ts`](../../packages/engine/src/constants.ts).

### 4.1 Driver — `deriveDriver(raw: DriverRaw) → Result<Driver>`

> `DriverRaw`/`Driver` are condemned by `ARCHITECTURE.md` AD-8/AD-9 — `OpenISDDriver` is
> their planned successor ([`../plans/PLAN_OPENISD_DRIVER_MODEL.md`](../plans/PLAN_OPENISD_DRIVER_MODEL.md)),
> not yet built. This section describes the shapes as they exist today.

**Input `DriverRaw`** — every field optional (a partial driver is a valid intermediate state).
The modeled Thiele/Small fields:

| Field                 | Unit | Description                                                                                            |
| --------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `Fs`                  | Hz   | Free-air resonance                                                                                     |
| `Qts` / `Qes` / `Qms` | —    | Total/electrical/mechanical Q at Fs — any two of the three are sufficient, the third is derived (§1.1) |
| `Vas`                 | m³   | Equivalent compliance volume                                                                           |
| `Sd`                  | m²   | Effective piston area                                                                                  |
| `Re`                  | Ω    | Voice-coil DC resistance                                                                               |
| `Le`                  | H    | Voice-coil inductance                                                                                  |
| `Xmax`                | m    | Maximum linear one-way excursion                                                                       |
| `Pe`                  | W    | Rated thermal power                                                                                    |
| `Z`                   | Ω    | Nominal impedance (display only, not simulated)                                                        |

`DriverRaw` also carries ~40 pass-through metadata/dimension fields (brand, model, thermal,
magnet geometry, datasheet/source URLs, …) the engine does not simulate but preserves for a
lossless round-trip — see the type definition for the full list.

**Output `Driver`** extends `DriverRaw` with `Fs`/`Re`/`Sd`/`Vas`/`Qts`/`Qes`/`Qms` now
required, plus the derived quantities `Cms`/`Mms`/`Rms`/`Bl` (formulas: §1.1).

`deriveDriver` returns `Result<Driver>` (`{ value, errors }`) and never throws.

### 4.2 Physical Constants

| Export              | Value                  | Description                                                                      |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `RHO`               | 1.20095217714682 kg/m³ | Air density, 20 °C — WinISD's own Advanced-pane derived value, full precision    |
| `C`                 | 343.684120962153 m/s   | Speed of sound, 20 °C — WinISD's own Advanced-pane derived value, full precision |
| `P0`                | 20×10⁻⁶ Pa             | Reference sound pressure (0 dB SPL)                                              |
| `END_CORRECTION`    | 0.732                  | Vent end-correction factor, × diameter per open (unflanged) end                  |
| `FLAT_MAX_BOOST_DB` | 20 dB                  | Default ceiling on the force-flat auto-EQ boost                                  |

`RHO`/`C` are the reference values at `tempK = 293.15` K (20 °C); `sweep`/`circuit` rescale
both by the live `SweepParams.tempK` when present (§4.3).

**Full precision, corrected 2026-08-14.** Previously `1.20095`/`343.68` (6/5 significant
figures) — a truncation, not a different value: `winisd-parity` goldens (all eight, across
every humidity leg) and `drivers/sample/winisd/john-all-defaults.wdr` (a WinISD-authored blank
driver, ParState `C` on `c`/`roo`) directly carry `1.20095217714682`/`343.684120962153`. The
truncation cost 1.8e-6 (ρ) / 1.2e-5 (c) relative, propagating into `no` (∝ 1/c³, 3.6e-5) and
`SPLmaxLF` (2e-7) — see
`bugs/BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md`.
Fixing it moved `packages/engine/test/fixtures/golden/*.json` (rebaselined in the same commit —
max delta 3.6e-3 relative on one near-zero impedance-phase bin, 3.2e-6 relative on `spl`; every
delta traces to this ~1e-5-level correction propagating through the resonant circuit, not to a
behaviour change) — see `npm run gen-golden`.

⚠ **`winisdAir()`'s temperature scaling of this pair is a SEPARATE, still-open divergence** —
WinISD's own frozen compatibility air does not move with a record's stated temperature at all
(`goldens/env-t-303.wpr` and its 293.15 K twin `env-rh-30.wpr` carry byte-identical `c`/`roo`),
but `airFor({ ignoreHumidityAndPressure: true, tempK })` currently scales both by `tempK`. See
`bugs/BUG_20260814_winisd-compatibility-air-does-not-scale-with-temperature-but-winisdair-does.md`
(not fixed — awaiting a human ruling, same permission gate).

### 4.3 Sweep Parameters — `sweep(drv: Driver, box: BoxType, P: SweepParams) → SweepResult`

`box` is one of `'sealed' | 'vented' | 'pr' | 'bandpass4'`. `Vb` is required for every box
type, and `Sp`/`prSd`/`prCms`/`prMmd`/`Vf` where the box type reads them — absent or
non-positive is a blocking `DriverError`, not a silently-substituted default (`validateParams`,
`params.ts`).

**Common to all box types:**

| Field               | Unit                     | Default                  | Description                                                                                                                       |
| ------------------- | ------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `Vb`                | m³                       | — (required)             | Net acoustic box volume                                                                                                           |
| `eg`                | V                        | — (required)             | Drive voltage RMS — use `√(Pin·Re)` to match WinISD's power-in convention                                                         |
| `Ql`                | —                        | 10                       | Leakage loss Q, every enclosure type                                                                                              |
| `Qa`                | —                        | 100                      | Absorption loss Q (stuffing)                                                                                                      |
| `Qp`                | —                        | 100                      | Port loss Q                                                                                                                       |
| `nDrivers`          | integer                  | 1                        | Number of identical drivers                                                                                                       |
| `wiring`            | `'series' \| 'parallel'` | `'parallel'`             | Multi-driver wiring                                                                                                               |
| `Rs`                | Ω                        | 0                        | Source (amplifier + cable) resistance                                                                                             |
| `circuitModel`      | `'winisd' \| 'gyrator'`  | `'winisd'`               | `'winisd'`: Le excluded from the acoustic path (constant elements). `'gyrator'`: full frequency-dependent Le                      |
| `fmin` / `fmax`     | Hz                       | 10 / 1000                | Sweep frequency range                                                                                                             |
| `N`                 | integer                  | 400                      | Number of frequency points                                                                                                        |
| `filters`           | `Filter[]`               | `[]`                     | Signal-chain filters (`SPEC_UI.md` §3.2)                                                                                          |
| `tempK`             | K                        | 293.15                   | Ambient temperature — rescales `RHO`/`C` for the sweep (§4.2); `humidityPct`/`pressurePa` are UI-only, not consumed by the engine |
| `driverAddedMass`   | kg                       | 0 (no-op)                | Added mass to the cone — raises Mms, lowers Fs                                                                                    |
| `vcTempRise`        | K                        | 0 (no-op)                | Coil temperature rise → hot Re, combined with `alfaVC`                                                                            |
| `alfaVC`            | /K                       | 0 (no-op)                | Copper thermal coefficient for `vcTempRise`                                                                                       |
| `rgAtDriverSide`    | boolean                  | `true`/absent            | `true`: Rs scales per-driver (Rs/n in parallel). `false`: one Rs for the whole array                                              |
| `tlPortModel`       | boolean                  | `false`/absent           | Model the vent as a lossy transmission line instead of a lumped mass (`vented`/`bandpass4` only)                                  |
| `forceFlatResponse` | boolean                  | `false`/absent           | Auto-EQ flat, bounded by `flatMaxBoostDb`                                                                                         |
| `flatMaxBoostDb`    | dB                       | `FLAT_MAX_BOOST_DB` (20) | Ceiling on the force-flat boost                                                                                                   |

**Vented / bandpass4 additional:**

| Field  | Unit | Description                                  |
| ------ | ---- | -------------------------------------------- |
| `Sp`   | m²   | Port cross-sectional area                    |
| `Leff` | m    | Effective duct length (incl. end correction) |
| `Vf`   | m³   | Front chamber volume (`bandpass4` only)      |

**Passive radiator (`pr`) additional:**

| Field    | Unit    | Description                         |
| -------- | ------- | ----------------------------------- |
| `prSd`   | m²      | PR piston area                      |
| `prMmd`  | kg      | PR moving mass (without added mass) |
| `prMadd` | kg      | Added tuning mass                   |
| `prCms`  | m/N     | PR suspension compliance            |
| `prRms`  | kg/s    | PR suspension mechanical resistance |
| `prXmax` | m       | PR maximum excursion                |
| `prNum`  | integer | Number of identical PRs             |

**Output `SweepResult`** — all arrays the same length (`N+1` points, log-spaced `fmin`→`fmax`):

| Field                           | Unit          | Description                                                                                                                                          |
| ------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fs`                            | Hz            | Frequency points                                                                                                                                     |
| `spl`                           | dB SPL        | Sound pressure at 1 m, half-space, re 20 µPa — IEC 60268-5 anechoic condition                                                                        |
| `splXlim`                       | dB SPL        | `spl` with drive backed off wherever excursion would exceed Xmax — always computed, never substituted for `spl`                                      |
| `xlimited`                      | boolean       | `true` where `splXlim` backed the drive off                                                                                                          |
| `phase`                         | rad           | Unwrapped transfer-function phase                                                                                                                    |
| `tfMag`                         | dB            | Transfer-function magnitude, 0 dB = high-frequency passband asymptote (§3.1)                                                                         |
| `exc`                           | mm            | Driver peak cone excursion                                                                                                                           |
| `excPR`                         | mm            | PR peak excursion (0 for non-PR boxes)                                                                                                               |
| `pv`                            | m/s           | Port peak air velocity (0 for sealed)                                                                                                                |
| `zmag`                          | Ω             | Electrical impedance magnitude                                                                                                                       |
| `zph`                           | deg           | Electrical impedance phase                                                                                                                           |
| `gd`                            | ms            | Group delay (−dφ/dω)                                                                                                                                 |
| `flatClamped`                   | Hz \| null    | Lowest frequency where force-flat's boost hit `flatMaxBoostDb`, or null if it never bound (including force-flat off)                                 |
| `fltMag` / `fltPhase` / `fltGd` | dB / rad / ms | The filter chain's own electrical response (WinISD's "(EQ/Filter)" charts) — depends only on `filters` and the frequency grid, not the driver or box |
| `H`                             | complex[]     | Internal use, not part of the stable contract                                                                                                        |

### 4.4 Maximum Curves — `maxCurves(drv: Driver, box: BoxType, P: SweepParams) → MaxCurvesResult`

| Field      | Unit    | Description                                                                        |
| ---------- | ------- | ---------------------------------------------------------------------------------- |
| `fs`       | Hz      | Same frequency grid as `sweep`                                                     |
| `maxspl`   | dB SPL  | Maximum achievable SPL at each frequency                                           |
| `maxpwr`   | W       | Electrical power at the limit condition                                            |
| `xlim`     | boolean | `true` where excursion (not power) is the binding limit                            |
| `peAbsent` | boolean | `true` when the driver publishes no `Pe`, so the power limit could not be computed |

### 4.5 Enclosure Alignment Helpers

The PR helpers take a `{ Vb, prMmd, prMadd, prSd, prCms }` params object — any object
carrying those fields (a live `SweepParams`, or a bare fixture) satisfies it:

| Function                                      | Signature                                           | Returns                                                           |
| --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `ebp(drv)`                                    | `{Fs, Qes} → number`                                | Efficiency Bandwidth Product = Fs/Qes                             |
| `sealedFromQtc(drv, Qtc)`                     | `{Qts, Vas}, number → number\|null`                 | Vb (m³) for a target Qtc, or null if unreachable                  |
| `sealedFc(drv, Vb)`                           | `{Fs, Vas}, number → number\|null`                  | Fc (Hz) for a given Vb — the inverse of `sealedFromQtc`           |
| `ventedAlignment(drv)`                        | `{Fs, Qts, Vas} → { Vb, Fb }`                       | QB3 alignment volume and tuning                                   |
| `ventLength(Vb, fb, Sp, endCorrection?)`      | `numbers → number`                                  | Effective duct length (m) for a target Fb                         |
| `tuningFromLength(Vb, L, Sp, endCorrection?)` | `numbers → number`                                  | Fb (Hz) from duct dimensions                                      |
| `prTuning(P)`                                 | `{Vb, prMmd, prMadd, prSd, prCms} → number`         | In-box Fp (Hz)                                                    |
| `prMassForFp(P, fp)`                          | `{Vb, prMmd, prMadd, prSd, prCms}, number → number` | Added mass (kg) to hit a target Fp                                |
| `findImpedancePeak(result, Re)`               | `SweepResult\|null, number → {Fsc, Qtc}\|null`      | Lossy sealed-box Fsc/Qtc from the simulated impedance peak (§2.2) |

### 4.6 File I/O — `.wdr` round-trip (`@openisd/winisd`)

WDR parsing/serialization is not part of `@openisd/engine` — file-format concerns live one
layer up, in `@openisd/winisd` (`ARCHITECTURE.md` AD-6: dependency arrows point up only).

| Member                 | Signature                 | Description                                                                                                                                                                                                                 |
| ---------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Driver.fromWdr(text)` | `static, string → Driver` | Parse a `.wdr` file. Reads every `[Driver]` key and replays `ParState`'s E-marks via `enter()`; C/N fields are left for the app to recompute. Best-effort — never throws; absent or unparsable fields are simply left unset |
| `driver.toWdr()`       | `instance, () → string`   | Serialise back to `.wdr` text — echoes every carried key, overlays edited values, rebuilds `ParState` from live cell state                                                                                                  |

`packages/winisd/src/classic/wdr.ts` also exports a lower-level `toWdr(raw: DriverRaw):
string`, used internally by `Driver.toWdr()` for a fresh-authored driver with no carried WDR
to echo.

**Verifying Tests**:

- [`packages/winisd/test/driver-class.test.ts`](../../packages/winisd/test/driver-class.test.ts)
- [`packages/engine/test/hardening.test.ts`](../../packages/engine/test/hardening.test.ts)

### 4.7 `openisd.yml` → `winisd.wdr` projection — the `winisd_tools` entry point

`winisd_tools` does not write `.wdr` itself. It calls OpenISD's JS in-process (embedded V8)
to project an `openisd.yml` record into the `winisd.wdr` it stores in `winisd_drivers`
(`ARCHITECTURE.md` AD-8: one implementation of each transform, never one per language).

#### The requirements

Stated by the human (2026-08-13) and reproduced verbatim — these are the authority; everything
after them is derived detail, and where the two ever disagree, these win.

> **Goal:** emulate a human copying the datasheet into the WinISD UI and then exporting the
> file.
>
> **R1.** `winisd.wdr` is defined from the independent WinISD data-model research we created
> AND exemplified by the `sample/winisd` files.
>
> **R2.** The `winisd.wdr` must be solely created from the `openisd.yml` file by mechanical
> transformation.
>
> **R3.** `openisd.yml` does not carry calculated fields — only human-entered fields, or a calc
> field that a human has overridden by entering. Therefore any field present in `openisd.yml`
> is an **E**; a missing calculatable field is a **C** and MUST be calculated by the extract
> process; any field not present in `openisd.yml` that is not calculatable is an **N** and has
> the default values exemplified in the `samples/`.
>
> **R4.** Use the WinISD Lossy model where applicable.

**What R3 settles, precisely.** The E/C/N mark is decided by _presence_ and _calculability_
alone — never by the magnitude of a value:

**The complete rule, as a table.** Read left to right; the first three columns decide the mark.
There is no other case.

| In `openisd.yml`? | Calculatable?                | Calculated?                                 | Mark  | Value written                                     |
| ----------------- | ---------------------------- | ------------------------------------------- | ----- | ------------------------------------------------- |
| **Yes**           | — (irrelevant)               | — (irrelevant)                              | **E** | the entered value, **including `0`**              |
| No                | **Yes**                      | **Yes** — inputs present, calc ran          | **C** | the calculated value, **including a genuine `0`** |
| No                | **Yes**                      | **No** — inputs missing, calc could not run | **N** | the WinISD default from `samples/`                |
| No                | **No** — never a calc target | —                                           | **N** | the WinISD default from `samples/`                |

Row 3 is the one that is easy to get wrong: a field can be **calculatable and still N**. Being
the target of a calc does not make it calculated — if its inputs are absent, nothing was
computed, so there is no calculated value to mark. `john-all-defaults.wdr` is row 3 and row 4
for every numeric field at once: nothing entered, so every calculatable field is `N`, and only
`numVC` (`E`) and `c`/`roo` (`C` — they always have a value) differ.

Row 1 holds even for a field WinISD would normally compute (the human overrode it, which is
exactly what R3 says the record may carry) and even when the value looks wrong: an erroneous
`0` from a bad scrape is written as an entered `0`, because R2 makes this a mechanical
transformation. Suppressing it would hide a record defect that belongs upstream in the record's
DQ marks — so the projection instead writes it and emits a `warn` naming the field. (Related:
QO17 — the app currently treats `value <= 0` as "not entered".)

**Two terms, deliberately distinct** (the human's vernacular, 2026-08-13 — keep them apart, the
rule is unreadable if they blur):

| Term                 | Means                                                                                                                                                                           | Kind of statement                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **calculatable**     | the field is the _target of a calc_ — `Vd`, `Dd`, `Dia`, `no`, `EBP`, `Cms`, `Mms`, `Rms`, `SPLmax`, `USPL`, `Rme`, `Mpow`, `gamma`, `c`, `roo` — **regardless of input state** | a property of the FIELD           |
| **calculated value** | it has _actually been calculated_, as opposed to manually entered                                                                                                               | a property of THIS record's field |

`C` marks a **calculated value**, not a calculatable field. So a calculatable field whose inputs
are absent has not been calculated, and is `N` carrying its default — which is exactly what
`drivers/sample/winisd/john-all-defaults.wdr` shows: nothing entered, so every calculatable
field is `N`; only `numVC` (`E`) and `c`/`roo` (`C`, they always have a value) differ.

A legitimately-calculated `0` is still a calculated value and stays **C**, never demoted to N:
`Vd = Sd·Xmax`, and WinISD writes `Vd=0` when Xmax is unset (`classic/wdr.ts:20`). The mark
follows whether a calculation produced the value — never the magnitude of the answer.

**R4's scope, stated rather than assumed.** No field among the 48 numerics is box-dependent —
`LossMode` / `sealedResonanceWinisd` compute sealed-box Fsc/Qtc, and a driver `.wdr` carries no
enclosure. So R4 binds no field of _this_ projection today; it governs any future quantity here
whose value depends on a box model, and it forbids reaching for the lossless or
conventional-lossy variant when one is added. Flagged as a live question rather than silently
treated as satisfied.

**(a) The field set is FIXED — 56 fields, always, in this exact order** (R1, from
`john-all-defaults.wdr`). Nothing is omitted because it was not supplied; an unsupplied field is
written with its default, not skipped.

```
Brand Model Manufacturer ProvidedBy Comment DateAdded DateModified
Qts Znom Fs Pe SPL Re Le fLe KLe BL Xmax Cms Qms Qes Rms Mms Sd Vas
Dia Vd no Dd EBP numVC Hc Hg SPLmax SPLmaxLF USPL alfaVC Rt Ct gamma
Rme Mpow Mcost Gloss VCCon c roo Thick Depth MagDepth Magnet Basket
Outer Vcd DVol ParState
```

Defaults are `0`, except `numVC=1`, `VCCon=1`, `c=343.684120962152`, `roo=1.20095217714682`.

**(b) Every calculatable field is CALCULATED, not left at its default** (R3). The projection
runs the full consistency-group derivation (§1.1) before writing, exactly as the WinISD UI
populates the computed fields the moment the human finishes typing. `Vd`, `Dd`, `Dia`, `no`,
`EBP`, `Rms`, `Cms`, `Mms`, `BL`, `SPLmax`, `SPLmaxLF`, `USPL`, `Rme`, `Mpow`, `gamma`, `Znom`
and the rest are outputs of that pass. `Znom` is the one that surprises: WinISD calculates it
from `Re` as `2·round_half_to_even(0.75·Re)` (probed — `../design/WINISD_SCHEMA.md` §4.2), so a
`.wdr` written with `Znom` copied from `Re`, or with slot 0 marked `N`, disagrees with WinISD.

A `0` on a line is therefore ambiguous on its own and must be read together with its ParState
slot: `C` ⇒ calculated, and the answer was genuinely zero; `N` ⇒ not calculatable, so the line
carries the default. What a `0` never means is "calculation not attempted".

**(c) Where a value depends on a box model, use WinISD's lossy one** (R4) — `LossMode` /
`sealedResonanceWinisd()` (`packages/engine/src/lossMode.ts`), never the lossless closed form
or the conventional-lossy variant. See the scope note under the requirements: no field of this
projection is box-dependent today, so this constrains future additions rather than current
output.

> ### 🔒 THE ONLY ORACLE IS `drivers/sample/winisd/`
>
> Every file in that directory was prepared by `johnl` **out of WinISD itself** — typed into
> the real UI and saved by it. That provenance is the entire reason it is authoritative, and
> it is the only such reason. **No `.wdr` from any other source may be used to decide what
> correct output looks like**, whatever it appears to demonstrate:
>
> - **A third-party database's export of driver data into `.wdr` shape is NOT an oracle**,
>   however plausible or complete it looks. Such a file is one program's guess at WinISD's
>   format, so its key set, its precision and its `ParState` are all unverified — and it will
>   happily agree with a bug in our writer. Never take an expected value from one; never use one
>   to assert conformance. Parse-robustness input is the only legitimate use, and it must be
>   labelled as such at the point of use.
> - **`winisd_drivers/**/winisd.wdr`** — produced by the Python writer this entry point
>   replaces. Non-conformant: a partial field set missing 16 fields every genuine save carries
>   (`fLe`, `KLe`, `Rms`, `Dia`, `no`, `SPLmax`, `SPLmaxLF`, `USPL`, `alfaVC`, `Rt`, `Ct`,
>   `gamma`, `Rme`, `Mpow`, `Mcost`, `Gloss`). Regenerating through this entry point therefore
>   CHANGES those files — the correction landing, not a regression.
>
> A test that takes its expected value from either source is asserting a known-wrong answer.

**Format authority** — [`drivers/sample/winisd/john-all-defaults.wdr`](../../drivers/sample/winisd/john-all-defaults.wdr):
driver editor → New → Save with nothing typed. It fixes the field set, the order and every
default. [`John-all-manu-populated.wdr`](../../drivers/sample/winisd/John-all-manu-populated.wdr)
is its fully-populated counterpart.

**Per-field behaviour authority** — the `s-*.wdr` probes in the same directory each isolate ONE
field (`s-fs.wdr`, `s-qts.wdr`, `s-no.wdr`, `s-gloss.wdr`, `s-vcd.wdr`, `s-connection-*.wdr`,
…). When a question is "what does WinISD do with field X", the probe for X answers it; do not
infer it from a multi-field file.

**`ParState`** is 49 characters, one slot per field position (§8 of
[`../design/WINISD_SCHEMA.md`](../design/WINISD_SCHEMA.md)). In WinISD's New+Save skeleton every slot
is `N` except `numVC` (`E`) and `c`/`roo` (`C` — computed).

**openisd writes `C` in the `numVC` slot, not `E`** — a deliberate one-character divergence.
`Driver#derive()` autofills `numVC = 1` beside the `c`/`roo` autofills
([`packages/winisd/src/driver.ts:432`](../../packages/winisd/src/driver.ts)), so the app supplied
that value; `E` asserts a human typed it. The side-by-side parity suite ([`BACKLOG.md`](../../BACKLOG.md)
§"Quality / infrastructure") expects this slot to differ.

**Contract.** String in, string out, and it never throws — invalid YAML and a
well-formed-but-not-an-OpenISD-record input both come back as `Result{value: null, errors}`,
because a thrower cannot cross an embedded-V8 boundary usefully.
