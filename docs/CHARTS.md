# Charts — what each one calculates

Every chart in the chart selector: the formula, where OpenISD computes it, what WinISD does
differently from the textbook, and the evidence that OpenISD matches WinISD.

Evidence: [CHART_REVIEW_WINISD_VS_OPENISD.md](research/CHART_REVIEW_WINISD_VS_OPENISD.md) (W5-1138SMF,
4.48 L sealed, 2086 points 1 Hz–20 kHz, WinISD values logged by debugger from the unmodified exe).
The closed-form check is
[`winisd_research/toys/w5_fresh_model_check.py`](http://localhost:8000/winisd/winisd_research/toys/w5_fresh_model_check.py).

Scope of the evidence: **sealed and vented**. Bandpass and passive-radiator charts share the same
driver side but their box side has not been checked against WinISD.

## 0. Checklist — WinISD charts to check

Every chart in WinISD's chart menu, per box type OpenISD has. 50 to check: **24 done** (21 exact
match, 3 within WinISD's own rounding), 26 to do.

Key: ✅ exact match (≤ 1e-12 at all 2086 points) · ≈ matches to WinISD's own rounding noise ·
☐ to check · ✗ OpenISD has no such chart · — does not apply to that box.

| Chart                                   | Sealed | Vented | Bandpass 4th | Passive radiator |
|-----------------------------------------|--------|--------|--------------|------------------|
| Transfer function magnitude             | ✅     | ✅     | ☐            | ☐                |
| Transfer function phase                 | ✅     | ✅     | ☐            | ☐                |
| Group delay                             | ≈      | ≈      | ☐            | ☐                |
| Maximum power                           | ✅     | ✅     | ☐            | ☐                |
| Maximum SPL                             | ✅     | ✅     | ☐            | ☐                |
| Amplifier apparent load power (VA)      | ✅     | ✅     | ☐            | ☐                |
| SPL                                     | ✅     | ✅     | ☐            | ☐                |
| Cone excursion                          | ✅     | ✅     | ☐            | ☐                |
| Impedance                               | ✅     | ✅     | ☐            | ☐                |
| Impedance phase                         | ✅     | ✅     | ☐            | ☐                |
| Transfer function magnitude (PR)        | —      | —      | —            | ✗                |
| Transfer function phase (PR)            | —      | —      | —            | ✗                |
| Cone excursion (PR)                     | —      | —      | —            | ☐                |
| Rear port - Air velocity                | —      | ✅     | —            | —                |
| Rear port - Gain                        | —      | ✗      | —            | —                |
| Front port - Air velocity               | —      | —      | ☐            | —                |
| Front port - Gain                       | —      | —      | ✗            | —                |
| Intrachamber port - Air velocity        | —      | —      | —            | —                |

| EQ/Filter chart (box-independent)       | Status |
|-----------------------------------------|--------|
| Transfer function magnitude (EQ/Filter) | ✅     |
| Transfer function phase (EQ/Filter)     | ✅     |
| Group delay (EQ/Filter)                 | ≈      |

Sealed variants also checked, all ✅: inductance on (SPL, impedance, TF magnitude); impedance at
Rg 0 and 10 Ω with "Rg is at driver side" on and off; every sealed and vented chart with a 4-filter chain
(Linkwitz transform, Butterworth-4 highpass, parametric EQ, raised cosine — group delay ≈).
Every WinISD filter type and subtype, alone: response ≤ 1e-12, group delay ≈ (33 captures,
`filters-winisd.test.ts`). Not in OpenISD at all: bandpass 6th and
ABC boxes (the only boxes with an intrachamber port).

---

## 1. The shared circuit

Every chart except the three EQ/Filter ones comes from one equivalent circuit, solved per
frequency: `packages/design/engine/circuit.ts` `solve()`, sampled by `sweep.ts` `sweep()` and
`maxCurves()`.

### 1.1 Driver side (acoustic units)

| Element | Formula | Notes |
|---|---|---|
| Cas | Cms·Sd² | Cms = Vas/(ρc²·Sd²) under "WinISD driver model" |
| Mas | Mms/Sd² | Mms = 1/((2πFs)²·Cms) under the switch |
| Ras | Rms/Sd² | Rms = 2πFs·Mms/Qms under the switch |
| Rae (damping) | BL_d²/(Sd²·(Re+Rg)) | BL_d² = Re/(2πFs·Qes·Cms) under the switch, so Rae = 1/(2πFs·Qes'·Cas), Qes' = Qes·(Re+Rg)/Re |
| Pg (push) | eg·BL/(Sd·(Re+Rg)) | BL = the **entered** BL, switch on or off |
| eg | √(P·(Re+Rg)) | drive voltage for the Signal tab's power |

n drivers: parallel divides Z by n, series multiplies BL and Re by n.

### 1.2 Sealed box, "WinISD Lossy" loss model (the default)

    Zbox = Ral ∥ (Raa + 1/(jωCab))
    Cab  = Vb/(ρc²)
    Cat  = Cas·Cab/(Cas+Cab)          ωsc = 1/√(Mas·Cat)
    Ral  = Ql/(ωsc·Cab)               leak, constant
    Raa  = ωsc·Mas/Qa                 absorption, in series with Cab

    UD = Pg / (Rae + Ras + jωMas + 1/(jωCas) + Zbox)      cone volume velocity
    U0 = UD − UD·Zbox/Ral                                  radiated: cone minus leak

Solved exactly from WinISD's own complex impedance output (chart review §4).

### 1.3 Radiation

    p = jω·ρ·U0/(2π·r),  r = 1 m         (half space)

---

## 2. WinISD compatibility controls

The default is WinISD's behaviour, bugs included. Each conventional variant sits behind its own
control in the WinISD Compatibility panel (Advanced tab) or the Box losses pane.

| Control | WinISD (default) | Conventional | Charts it moves |
|---|---|---|---|
| WinISD driver model | Cms from Vas; Mms, Rms from Fs, Qms; damping BL from Qes; **entered** BL for push, impedance, TF reference and CLe | entered Cms, Mms, Rms, BL, one BL throughout | all driver charts |
| WinISD VA model | VA = P·Re·\|Hf\|²/\|Z + Rg\| | P·(Re + Rg)·\|Hf\|²/\|Z_amp\|, Rg counted once | Amplifier apparent load power |
| WinISD air model | WinISD's air equations: Hyland-Wexler vapour pressure, no enhancement factor, ρ from γ·p/c² | CIPM-2007 moist air | all (ppm level) |
| Loss model | WinISD Lossy: §1.2 | Conventional Lossy: Zc ∥ Ql/(ωCab) ∥ Qa/(ωCab), U0 = UD. Lossless: Zbox = Zc | sealed charts |

Native WinISD controls behave as WinISD has them, with no conventional variant:

| Control | Effect |
|---|---|
| Rg is at driver side | on: Rg belongs to each coil and shows in the impedance. Off: one Rg at the amplifier, in the drive but not in the impedance |
| Simulate voice coil inductance | off: Le is left out of both the circuit and the impedance. On: Le in the circuit and impedance; with "WinISD driver model" on, the acoustic side uses Le·(BL_d/BL)², WinISD's CLe = Sd²·Le/BL² from the entered BL |
| SPL graph is Xmax limited | SPL chart shows the Xmax-clamped curve |
| Force flat response | inverse gain lifts SPL to the passband, capped at the max boost |

### 2.1 The two-BL behaviour, in one place

The driver has two BLs when its entered BL disagrees with Fs, Vas, Qes and Re. WinISD uses:

| Job | BL | Charts |
|---|---|---|
| Damping (Rae) | Qes-derived | curve shape: SPL, phase, group delay, excursion shape |
| Push (Pg) | entered | SPL level, excursion level, max curves |
| Motional impedance | entered | impedance, impedance phase |
| TF 0 dB reference | entered | TF magnitude |
| Inductance CLe | entered | all, with inductance on |

We judge the two-BL mix a WinISD bug; "WinISD driver model" off gives one BL throughout.
Bugs: [spl-level](../bugs/BUG_20260926_winisd-spl-level-uses-entered-bl.md),
[impedance](../bugs/BUG_20260926_winisd-impedance-uses-entered-bl.md),
[tf-reference](../bugs/BUG_20260926_winisd-tf-reference.md).

---

## 3. Charts

Status key: **match** = OpenISD equals WinISD to ≤ 1e-12 on every point of the chart review;
**close** = within tolerance, residual explained; **unverified** = no WinISD capture; **absent** =
not implemented in OpenISD.

### 3.1 SPL — match

    SPL = 20·log10(|p·Hf|/20 µPa)

- Source: `sweep.ts` `spl`. Hf = the EQ/filter chain's response (line level, ahead of the amp).
- WinISD specifics: level from the entered BL; leak volume velocity subtracted (§1.2); series
  absorption.
- "SPL graph is Xmax limited": where peak excursion > Xmax, SPL + 20·log10(Xmax/x) (`splXlimCurve`);
  the raw curve is drawn dashed alongside.
- Evidence: chart review §3 "SPL", worst 2.8e-14 dB; §3.2 with inductance on, 2.8e-14 dB.

### 3.2 Transfer function magnitude — match

    TF = SPL − 20·log10(ρ·Pg/(2π·r·Mas)/20 µPa)

- Source: `sweep.ts` `tfMag`, reference from `circuit.ts` `hfAsymptotePressure_Pa`.
- The reference is the lossless circuit's high-frequency level: entered BL, Re + Rg, Le excluded.
  It is 0 dB for every driver, switch on or off.
- Evidence: chart review §3, worst 3.3e-14 dB. Before the fix OpenISD used η₀ from Qes and Re,
  0.507 dB off ([bug](../bugs/BUG_20260926_winisd-tf-reference.md)).

### 3.3 Transfer function phase — match

    φ = arg(p·Hf), unwrapped

- Source: `sweep.ts` `phase`.
- Evidence: chart review §3, worst 9.1e-13°.

### 3.4 Group delay — match to WinISD's rounding

    τg = −dφ/dω at f, central difference over f·(1 ± 1e-6)

- Source: `sweep.ts` `groupDelayAtMs`, for the system and the EQ/filter chain alike.
- WinISD (chart 12 of `f_4618f0`): (φ(f−δ) − φ(f+δ))/(2π·2δ), δ = (f + 1e-10) − f. Its 1e-10 Hz
  step turns each rounding step of the phase into 1.77e-4 ms: the staircase in its curve.
- Evidence: chart review §3, worst 0.00049 ms, about 3 of WinISD's rounding steps. Copying WinISD's
  step in double arithmetic agrees worse (0.0018 ms). Before the fix OpenISD differenced grid
  neighbours: 0.025 ms off at 1 Hz ([bug](../bugs/BUG_20260926_group-delay-grid-difference.md)).
- The EQ/filter chain is included: WinISD adds each enabled filter's own group delay (`f_46bd30`,
  kind 3). Checked with a 4-filter chain, worst 0.00069 ms (capture `filt-chain-sealed-1`).

### 3.5 Cone excursion — match

    x_peak = √2·|UD·Hf|/(ω·Sd)

- Source: `sweep.ts` `exc` (mm). Xmax drawn dashed.
- WinISD specifics: level from the entered BL (via Pg).
- Evidence: chart review §3, worst 2.7e-15 mm.

### 3.6 Maximum power — match

    Pmax = min(Pe, (Vx)²/(Re+Rg)),   Vx = 2.83 V · Xmax/x(2.83 V)

- Source: `sweep.ts` `maxCurves` `maxpwr`: the drive at which the cone reaches Xmax, capped at Pe.
- Power is into Re + Rg, the same load the Signal tab's power → voltage uses.
- Evidence: chart review §3, worst 8.9e-14 W. Before the fix OpenISD used Re alone, +2.94 %
  ([bug](../bugs/BUG_20260926_max-power-ignores-rg.md)).

### 3.7 Maximum SPL — match

    SPLmax = SPL(2.83 V) + 20·log10(V/2.83),   V = min(Vx, √(Pe·(Re+Rg)))

- Source: `sweep.ts` `maxCurves` `maxspl`. The legend names the Xmax and Pe limits where both apply.
- Evidence: chart review §3, worst 2.8e-14 dB.

### 3.8 Impedance — match

    Z = Zcoil + (BL²/Sd²) / (Ras + jωMas + 1/(jωCas) + Zbox)

- Source: `circuit.ts` `Zel`, `sweep.ts` `zmag`.
- Zcoil = Re (+ jωLe with inductance on) (+ Rg when Rg is at driver side). Amplifier-side Rg is not
  in the impedance.
- WinISD specifics: BL is the **entered** one; Rae is not in the impedance (Re is in series instead).
- Evidence: chart review §3, worst 2.8e-14 Ω; §3.1, Rg 0 and 10 Ω, driver side on and off, 3.6e-14 Ω.

### 3.9 Impedance phase — match

    arg(Z)

- Source: `sweep.ts` `zph` (degrees).
- Evidence: chart review §3, worst 1.4e-13°.

### 3.10 Rear / front port air velocity — unverified

    v = √2·|UP·Hf|/Sp

- Source: `sweep.ts` `pv`. Vented and bandpass only; 5 % of c drawn as the 17 m/s line.
- The vented box uses Zc ∥ Ql/(ωCab) ∥ Qa/(ωCab) ∥ Zport, not the §1.2 WinISD form: no WinISD
  capture of a vented box has been compared.

### 3.11 Cone excursion (PR) — unverified

    x_PR = √2·|UP·Hf|/(ω·Sd_PR·n_PR)

- Source: `sweep.ts` `excPR`, drawn on the Cone excursion chart with PR Xmax.

### 3.12 EQ/Filter charts — magnitude, phase, group delay — match

    |Hf|, arg(Hf), −d arg(Hf)/dω

- Source: `sweep.ts` `fltMag`, `fltPhase`, `fltGd`; `filters.ts` `applyFilters`. The filter chain
  alone: driver and box do not enter. 0 dB means the driver terminals see the Signal tab's voltage
  (WinISD help, "Filter/equalizer behavioral simulator").
- WinISD (`f_46bd30` kinds 17/18/19): product of each enabled filter's response; group delay is
  the sum of each filter's own 1e-10 Hz central difference. Formulas per type: winisd_research
  GHIDRA_FINDINGS.md "EQ/Filter chain".
- Evidence: `filters-winisd.test.ts` (33 single-filter captures, ≤ 1e-12); capture
  `filt-chain-sealed-1`: magnitude 2.8e-14, phase 8e-13, group delay 0.00066 ms.
- The filter chain multiplies every chart except Maximum SPL and Maximum power, which WinISD
  draws for the driver alone ([bug](../bugs/BUG_20260927_max-spl-and-max-power-include-the-filter-chain.md)).
- ⚠ Unverified: WinISD skips points where the box impedance is 0; what it draws there
  ([bug](../bugs/BUG_20260927_winisd-filter-charts-skip-zero-box-points.md)).

### 3.13 Amplifier apparent load power (VA) — match

    VA = P · Re · |Hf|² / |Z + Rg|,   P = eg²/(Re + Rg)

- Source: `sweep.ts` `va`. Z is the impedance chart's value; Rg is added whatever its placement,
  so with "Rg is at driver side" on Rg is counted twice, as WinISD does.
- WinISD (`f_46bd30` case 0x14): the chart routine returns Z, and the plot code applies this
  formula. WinISD bug, kept by default: Re where the amplifier's apparent power has Re + Rg, so it
  reads Re/(Re + Rg) low ([bug](../bugs/BUG_20260927_winisd-va-uses-re-not-re-plus-rg.md)).
  "WinISD VA model" off: P·(Re + Rg)·|Hf|²/|Z_amp|.
- Evidence: `winisd_research/runs/sweep-w5-sealed-va-rg1` (Rg 1 Ω, driver side off) and
  `sweep-w5-sealed-va-rg1-driverside` (driver side on), all 2087 points each to 3e-16.

### 3.14 Not implemented — absent

- Transfer function magnitude/phase (PR), rear/front port gain, intrachamber port air velocity.
