# OpenISD — Design → Curves Contract (v1)

This document defines the data contract between the physics core (`packages/engine/src/`)
and any consumer — the OpenISD web UI, the test suite, the self-test, and any
third-party tool that links against the core.

**All functions and types described here are stable.** Internal helpers inside
`packages/engine/src/` are not part of this contract and may change without notice.

---

## Entry point

```js
import { deriveDriver, sweep, maxCurves } from "./packages/engine/src/index.ts";
// or individually from their modules
```

---

## 1. Driver — `deriveDriver(raw) → Driver`

Derives the full Thiele/Small parameter set from a minimal input object.

### Input — `RawDriver`

All physical units are SI unless otherwise stated.

| Field   | Type   | Unit | Required       | Description                       |
| ------- | ------ | ---- | -------------- | --------------------------------- |
| `Fs`    | number | Hz   | ✓              | Free-air resonance frequency      |
| `Qts`   | number | —    | ✓ (or Qes+Qms) | Total Q at Fs                     |
| `Qes`   | number | —    | ✓ (or Qts+Qms) | Electrical Q at Fs                |
| `Qms`   | number | —    | ✓ (or Qts+Qes) | Mechanical Q at Fs                |
| `Vas`   | number | m³   | ✓              | Equivalent compliance volume      |
| `Sd`    | number | m²   | ✓              | Effective piston area             |
| `Re`    | number | Ω    | ✓              | Voice-coil DC resistance          |
| `Le`    | number | H    | —              | Voice-coil inductance (default 0) |
| `Xmax`  | number | m    | —              | Maximum linear one-way excursion  |
| `Pe`    | number | W    | —              | Rated thermal power               |
| `Z`     | number | Ω    | —              | Nominal impedance (display only)  |
| `brand` | string | —    | —              | Manufacturer name                 |
| `model` | string | —    | —              | Model number                      |

Any two of {`Qts`, `Qes`, `Qms`} are sufficient; the third is derived.

### Output — `Driver`

Everything in `RawDriver`, plus the derived quantities:

| Field | Type   | Unit | Description                                |
| ----- | ------ | ---- | ------------------------------------------ |
| `Cms` | number | m/N  | Mechanical compliance of suspension        |
| `Mms` | number | kg   | Moving mass (cone + voice coil + air load) |
| `Rms` | number | kg/s | Mechanical resistance of suspension        |
| `Bl`  | number | T·m  | Force factor (motor strength)              |

### Equations

```
Qts  = Qes·Qms / (Qes + Qms)
Cms  = Vas / (ρ·c²·Sd²)
Mms  = 1 / ((2π·Fs)²·Cms)
Rms  = 2π·Fs·Mms / Qms
Bl   = √(2π·Fs·Mms·Re / Qes)
```

Reference: [Wikipedia — Thiele/Small parameters](https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters)

---

## 2. Sweep — `sweep(drv, box, P) → Curves`

Runs a frequency sweep and returns all simulation curves.

### Input

**`drv`** — a `Driver` object (output of `deriveDriver`).

**`box`** — one of `'sealed'` | `'vented'` | `'bandpass4'` | `'pr'`

**`P`** — sweep parameters (all optional unless marked ✓):

#### Common parameters (all box types)

| Field             | Type     | Unit | Default      | Description                                                                  |
| ----------------- | -------- | ---- | ------------ | ---------------------------------------------------------------------------- |
| `Vb`              | number   | m³   | 0.030        | Net acoustic box volume (excludes driver/port displacement)                  |
| `Ql`              | number   | —    | 10           | Leakage loss Q. WinISD default: 10                                           |
| `Qa`              | number   | —    | 100          | Absorption loss Q (stuffing). WinISD default: 100                            |
| `Qp`              | number   | —    | 100          | Port loss Q. WinISD default: 100                                             |
| `eg`              | number   | V    | —            | Drive voltage (RMS). Use `sqrt(Pin × Re)` to match WinISD                    |
| `nDrivers`        | integer  | —    | 1            | Number of identical drivers                                                  |
| `wiring`          | string   | —    | `'parallel'` | `'parallel'` or `'series'`                                                   |
| `Rs`              | number   | Ω    | 0.1          | Source (amplifier + cable) resistance                                        |
| `fmin`            | number   | Hz   | 10           | Sweep start frequency                                                        |
| `fmax`            | number   | Hz   | 1000         | Sweep end frequency                                                          |
| `N`               | integer  | —    | 400          | Number of frequency points                                                   |
| `filters`         | Filter[] | —    | `[]`         | Filter chain (see §4)                                                        |
| `circuitModel`    | string   | —    | `'winisd'`   | `'winisd'` (constant elements) or `'gyrator'` (frequency-dependent Le)       |
| `driverAddedMass` | number   | kg   | 0            | Mass added to the driver cone → raises Mms, lowers Fs. 0 = no-op             |
| `vcTempRise`      | number   | K    | 0            | Voice-coil temperature rise → hot Re (power compression). 0 = no-op          |
| `alfaVC`          | number   | /K   | 0            | VC resistance temp-coefficient (SI; copper ≈ 0.0039). Used with `vcTempRise` |

#### Vented / bandpass4 additional parameters

| Field  | Type   | Unit | Description                                      |
| ------ | ------ | ---- | ------------------------------------------------ |
| `Sp`   | number | m²   | Port cross-sectional area                        |
| `Leff` | number | m    | Effective duct length (including end correction) |
| `Vf`   | number | m³   | Front chamber volume (bandpass4 only)            |

#### Passive radiator (`pr`) additional parameters

| Field    | Type    | Unit | Description                         |
| -------- | ------- | ---- | ----------------------------------- |
| `prSd`   | number  | m²   | PR effective piston area            |
| `prMmd`  | number  | kg   | PR moving mass (without added mass) |
| `prMadd` | number  | kg   | Added mass (tuning weight)          |
| `prCms`  | number  | m/N  | PR suspension compliance            |
| `prRms`  | number  | kg/s | PR suspension mechanical resistance |
| `prNum`  | integer | —    | Number of identical PRs (default 1) |

### Output — `Curves`

All arrays have the same length (`N + 1` points on a log frequency grid).

| Field   | Type      | Unit   | Description                                                               |
| ------- | --------- | ------ | ------------------------------------------------------------------------- |
| `fs`    | number[]  | Hz     | Frequency points (log-spaced, `fmin` to `fmax`)                           |
| `spl`   | number[]  | dB SPL | Sound pressure level at 1 m, half-space                                   |
| `phase` | number[]  | rad    | Unwrapped transfer-function phase                                         |
| `exc`   | number[]  | mm     | Driver peak cone excursion                                                |
| `excPR` | number[]  | mm     | PR peak excursion (zero for non-PR boxes)                                 |
| `pv`    | number[]  | m/s    | Port peak air velocity (zero for sealed)                                  |
| `zmag`  | number[]  | Ω      | Electrical impedance magnitude                                            |
| `zph`   | number[]  | deg    | Electrical impedance phase                                                |
| `gd`    | number[]  | ms     | Group delay (−dφ/dω)                                                      |
| `H`     | complex[] | —      | Complex transfer function (internal use; not part of the stable contract) |

**SPL reference:** half-space (2π sr, infinite baffle), 1 m, re 20 µPa.
Equivalent to the IEC 60268-5 anechoic free-field condition on an IEC baffle.

---

## 3. Maximum curves — `maxCurves(drv, box, P) → MaxCurves`

Returns the excursion-limited and power-limited maximum SPL and power curves.

### Output — `MaxCurves`

| Field    | Type      | Unit   | Description                                                            |
| -------- | --------- | ------ | ---------------------------------------------------------------------- |
| `fs`     | number[]  | Hz     | Same frequency grid as `sweep`                                         |
| `maxspl` | number[]  | dB SPL | Maximum achievable SPL at each frequency                               |
| `maxpwr` | number[]  | W      | Electrical power at the limit condition                                |
| `xlim`   | boolean[] | —      | `true` at frequencies where excursion (not power) is the binding limit |

**Limit voltages:**

```
v_Xmax = 2.83 · (Xmax / x_at_2.83V)    — excursion limit
v_Pe   = √(Pe · Re)                      — thermal limit  (T/S power definition)
v_used = min(v_Xmax, v_Pe)
```

---

## 4. Filter chain — `Filter[]`

Filters are applied upstream of the amplifier (line level). Each filter is a
plain object with a `type` field and type-specific parameters.

| `type`       | Parameters           | Description                                   |
| ------------ | -------------------- | --------------------------------------------- |
| `'hp'`       | `{ fc, order }`      | High-pass (Butterworth). `fc` Hz, `order` 1–4 |
| `'lp'`       | `{ fc, order }`      | Low-pass (Butterworth). `fc` Hz, `order` 1–4  |
| `'linkwitz'` | `{ f0, q0, fp, qp }` | Linkwitz transform. All frequencies in Hz     |
| `'peak'`     | `{ fc, gain, q }`    | Peaking EQ. `gain` dB, `q` dimensionless      |

Filters are evaluated with `evalFilter(f, filter)` and composed with
`applyFilters(f, filters)`, both exported from `packages/engine/src/index.ts`.

---

## 5. Alignment helpers

| Function                                               | Signature                       | Returns                                       |
| ------------------------------------------------------ | ------------------------------- | --------------------------------------------- |
| `ebp(drv)`                                             | `Driver → number`               | Efficiency Bandwidth Product = Fs/Qes         |
| `sealedFromQtc(drv, Qtc)`                              | `Driver, number → number\|null` | Vb (m³) for target Qtc, or null if impossible |
| `ventedAlignment(drv)`                                 | `Driver → { Vb, Fb }`           | QB3 or B4 alignment volume and tuning         |
| `ventLength(Vb, Fb, Sp)`                               | `numbers → number`              | Effective duct length for target Fb (m)       |
| `tuningFromLength(Vb, Leff, Sp)`                       | `numbers → number`              | Fb (Hz) from duct dimensions                  |
| `prTuning(Vb, prMms, prCms, prSd, prNum)`              | `numbers → number`              | In-box Fp (Hz)                                |
| `prMassForFp(Vb, prMmd, prCms, prSd, prNum, targetFp)` | `numbers → number`              | Added mass (kg) to hit target Fp              |

## 5a. UI-facing closed-form helpers (`formulas.ts`)

Pure display/derivation forms shared by every skin (extracted from duplicated component code).

| Function                             | Signature          | Returns                                      |
| ------------------------------------ | ------------------ | -------------------------------------------- |
| `prVas(prCms, prSd)`                 | `numbers → number` | PR compliance-equivalent volume Vas (litres) |
| `prFs(prMmd, prCms)`                 | `numbers → number` | PR free-air resonance (Hz); 0 if undefined   |
| `prFsWithMass(prMmd, prMadd, prCms)` | `numbers → number` | PR resonance with added mass (Hz)            |
| `prQms(prMmd, prCms, prRms)`         | `numbers → number` | PR mechanical Q; 0 if Rms ≤ 0                |
| `driveVoltage(pin, re)`              | `numbers → number` | Drive voltage V = √(Pin·Re)                  |
| `soundVelocity(tempKelvin)`          | `number → number`  | Speed of sound c = 20.05·√(T) (m/s)          |

## 5b. Driver transforms (`driver.ts`)

| Function                        | Signature                 | Returns                                                                                    |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `withAddedMass(driver, MaddKg)` | `Driver, number → Driver` | Copy with `Mms += Madd`, Fs/Q's recomputed (Cms/Rms/Bl/Re/Sd fixed). `Madd ≤ 0` = identity |
| `hotRe(Re, alfaVC, dT)`         | `numbers → number`        | `Re·(1 + alfaVC·ΔT)` — voice-coil resistance at temperature. ΔT/alfaVC = 0 → `Re`          |

---

## 6. File I/O

| Function         | Signature            | Description                                               |
| ---------------- | -------------------- | --------------------------------------------------------- |
| `parseWdr(text)` | `string → RawDriver` | Parse a WinISD `.wdr` file; throws on missing core params |
| `toWdr(raw)`     | `RawDriver → string` | Serialise a driver to `.wdr` format                       |

`.wdr` round-trips are exact to `toPrecision(6)` formatting precision.

---

## 7. Physical constants

| Export | Value        | Description                                  |
| ------ | ------------ | -------------------------------------------- |
| `RHO`  | 1.2041 kg/m³ | Air density at 20 °C, 1 atm                  |
| `C`    | 343.21 m/s   | Speed of sound in air at 20 °C               |
| `P0`   | 20e-6 Pa     | Reference sound pressure (hearing threshold) |

---

## Versioning

This is **v1** of the contract. Breaking changes (removed exports, changed
argument order, changed unit conventions) require a version bump and a migration
note in this file. Additive changes (new exports, new optional P fields) are
non-breaking and do not require a version bump.
