# Probe: W5-1138SMF sealed — every chart, WinISD vs openisd (2026-09-24)

Case: `/tmp/W5 sealed.owpr` — Tang Band W5-1138SMF in a 4.48 L sealed box, 1 W, 1 m, no
filters, 10 Hz – 20 kHz.

WinISD side: real `WinISD.exe` 0.7 driven under wine/Xvfb this session by
`winisd_research/toys/w5_charts.py`. WinISD has no curve export (no HMENU, cursor readouts are
HWND-less LCL labels), so every WinISD number here is traced out of the plot pixels by
`winisd_research/toys/w5_trace.py` — exact-colour trace (20,175,20) against exact-colour
gridlines (175,175,175), axes fixed by the `[Settings.Plot.Limits]` the run was launched with.
Trace resolution is one pixel ≈ 1/970 of the Y range.

openisd side: `packages/design/test/scratch-w5.test.ts` dumping `Engine.sweep` /
`Engine.maxCurves` with the parameters the app itself passes.

Evidence: `winisd_research/runs/w5_sealed/`.

---

## 1. Baseline — settings on both sides

The `.owpr` states no environment (`temperature_K`, `humidity_pct`, `pressure_Pa`,
`useWinisdAirModel` are all null), so what openisd used had to be read out of the code path
that actually runs, not assumed. `openisdDomain.#sweepParams` (`openisdDomain.ts:3053-3056`)
passes the raw project slot with `?? undefined` and `useWinisdAirModel: … ?? true`, so
`air.ts` supplies 293.15 K / 30 % / 101325 Pa and the WinISD air model. `appSettings
.envDefaults()` is never read by the sweep.

| Setting                        | openisd (as the app runs it) | WinISD (read back this session)          | Same?         |
|--------------------------------|------------------------------|------------------------------------------|---------------|
| Temperature                    | 293.15 K                     | 293.15 (Options + project Advanced tab)  | yes           |
| Relative humidity              | 30 %                         | 30.0000 (Options + Advanced tab)         | yes           |
| Air pressure                   | 101325 Pa                    | 101325.0 (Options + Advanced tab)        | yes           |
| Speed of sound c               | 343.68412096215235 m/s       | 343.68 (label, 2 dp)                     | yes to 2 dp   |
| Air density ρ                  | 1.2009521771468228 kg/m³     | 1.20095 (label, 5 dp)                    | yes to 5 dp   |
| Air model                      | WinISD model (`?? true`)     | n/a — WinISD has one model               | n/a           |
| Box volume Vb                  | 0.0044800000000000005 m³     | 0.0045 displayed; `Vr=0.00448` in `.wpr` | yes           |
| Box type                       | sealed                       | "closed"                                 | yes           |
| Leakage Ql                     | 10                           | `Qlr=10`                                 | yes           |
| Absorption Qa                  | 100                          | `Qar=100`                                | yes           |
| Drive power                    | 1 W → eg 1.8439088914585775 V| Signal tab: 1.000 W, 1.8 V displayed     | yes           |
| Source resistance Rg           | 0.1 Ω                        | Signal tab: 0.100                        | yes           |
| Listening distance             | 1 m                          | Signal tab: 1.000 m                      | yes           |
| Driver count / wiring          | 1, series                    | 1, Parallel                              | identical at n=1 |
| Voice-coil inductance in model | Le = 0.34 mH, impedance only | "Simulate voice coil inductance" OFF     | **no**        |
| Pe (power handling)            | 40 W                         | 40.0                                     | yes           |
| Frequency grid                 | 10 Hz – 20 kHz               | `FreqStart=10`, `FreqEnd=20000`          | yes           |
| Filters                        | none                         | none                                     | yes           |
| Force flat response            | off                          | off                                      | yes           |

Every entered driver parameter reads back out of WinISD's driver editor unchanged:
Qes 0.570, Qms 3.560, Qts 0.490, Fs 45.00, Vas 0.0049, Mms 0.02881, Cms 0.0003687,
Rms 2.28816, Re 3.400, BL 7.17000, Le 0.000340, Sd 0.0094, Xmax 0.009, Pe 40.0, Znom 4.000,
numVC 1. WinISD computed **none** of the derived fields on a CLI-loaded project — Dd, fLe,
KLe, Hc, Hg, Vd, no, USPL, SPL, SPLmax, SPLmaxLF, Rme, gamma, EBP, Gloss all read 0.00. So the
two programs were given identical inputs; nothing here is a data-entry difference.

**Finding (John's point 5).** The `.owpr`'s own `c_m_per_s = 343.6826980479399` and
`roo_kg_per_m3 = 1.2009621215255684` are *not* the ρ/c the sweep used. They are openisd's
**full** air model (`useWinisdAirModel` absent → false), written by the driver solve, whose air
provider (`openisdDomain.ts:1687-1690` and `:2597-2600`) omits `useWinisdAirModel` entirely.
The sweep uses the **WinISD** model. One project, two air models — 8 ppm in ρ, 4 ppm in c here
(≈ 0.00007 dB, invisible in these tables) but wrong in principle. Recorded as
`bugs/BUG_20260924_driver-solve-and-sweep-use-different-air-models.md`.

The baselines match. Nothing below is attributable to the environment.

---

## 2. The inputs are mutually inconsistent, and the two programs resolve that differently

The entered parameter set does not satisfy its own identities:

| Identity                     | Implied value | Entered value | Disagreement |
|------------------------------|---------------|---------------|--------------|
| Fs = 1/(2π√(Mms·Cms))        | 48.831 Hz     | 45 Hz         | +8.5 %       |
| Vas = ρc²Sd²·Cms             | 4.622 L       | 4.85 L        | −4.7 %       |
| Mms = ρc²Sd²/((2πFs)²·Vas)   | 0.032328 kg   | 0.02881 kg    | +12.2 %      |
| Rms = 2πFs·Mms/Qms           | 2.56753       | 2.28816       | +12.2 %      |

Which subset each program's sweep consumes was established empirically.

**WinISD.** `toys/w5_sens.sh` — 13 separate WinISD launches, one entered value perturbed ×1.1
per launch, passband SPL read at 1 kHz off the SPL chart:

| perturbed input | SPL @1 kHz | Δ dB     | amplitude exponent |
|-----------------|------------|----------|--------------------|
| (none)          | 80.5258    | +0.0000  | 0                  |
| BL              | 81.3505    | +0.8247  | +1.00              |
| Sd              | 79.7010    | −0.8247  | −1.00              |
| Fs              | 82.1959    | +1.6701  | +2.02              |
| Vas             | 81.3711    | +0.8454  | +1.02              |
| Re              | 80.1340    | −0.3918  | −0.47              |
| P (×1.21)       | 81.3505    | +0.8247  | +0.50 in P         |
| Qes             | 80.5464    | +0.0206  | +0.03 (1 pixel)    |
| **Mms**         | 80.5258    | **0.000**| **0**              |
| **Cms**         | 80.5258    | **0.000**| **0**              |
| **Qms**         | 80.5258    | **0.000**| **0**              |
| **Qts**         | 80.5258    | **0.000**| **0**              |
| Rg 0.1 → 0      | 80.6495    | +0.1237  | —                  |

p ∝ Bl · Fs² · Vas / (Sd · √Re) is exactly what p ∝ ρ·Bl·Sd·eg/(2π·Re·Mms) becomes once Mms is
replaced by ρc²Sd²/((2πFs)²·Vas) and eg by √(P·Re). **WinISD's sweep derives Mms from Fs, Vas
and Sd and ignores the entered Mms, Cms, Rms.** Predicted passband: 80.548 dB; traced 80.526 dB
(0.022 dB = 1 pixel).

The Rg result pins WinISD's drive convention: a plain Re/(Re+Rg) divider would be 0.2518 dB,
observed 0.1237 dB. eg = √(P·(Re+Rg)) followed by the divider Z/(Z+Rg) predicts 0.1249 dB.
**WinISD sizes the source EMF from the total load, openisd from Re alone** (the `.owpr`'s
`driveVoltage_V` = √(1 × 3.4) = 1.8439088914585775).

WinISD's impedance peak height separates Rms from Qms: with Mms derived and Rms from the
entered Qms the peak computes to 18.92 Ω, with the entered Rms to 20.35 Ω; WinISD traces
18.63 Ω. WinISD uses Qms, not the entered Rms.

**openisd.** `circuit.ts:148-152` builds the acoustic circuit from `Cms_m_per_N`, `Mms_kg`,
`Rms_kg_per_s`, `Sd_m2`, `BL_terminal_Tm`, `Re_terminal_ohm` — all entered. Fs, Vas, Qts, Qes,
Qms never reach the sweep.

Consequences, both arithmetic, both confirmed against the traces:

- Passband SPL: 20·log10(0.032328/0.02881) = 1.000 dB lower for WinISD, less 0.10 dB for the
  eg convention → 0.90 dB. Traced gap 0.917 dB.
- System resonance: WinISD Fc = 45·√(1+4.85/4.48) = 64.94 Hz (traced impedance peak 64.89 Hz,
  impedance-phase zero 64.69 Hz); openisd Fc = 48.831·√(1+Cms/Cmb) = 69.60 Hz (dump: peak
  69.46 Hz, phase zero 69.39 Hz).

**Neither is an openisd defect.** Both programs are self-consistent; they disagree because the
driver record is not self-consistent and they pick different halves of it.

---

## 3. Chart-by-chart

Every WinISD value traced from the `charts_base` run (all defaults, VCInd off, Pe 40 W).
Every openisd value from the `app` variant. `diff %` is 100·(openisd − WinISD)/|WinISD|; for dB
and degree charts that ratio is a poor test near a zero crossing, so the absolute difference
column is the one to read there.

| Chart                       | Unit | Worst diff | Verdict |
|-----------------------------|------|-----------:|---------|
| Transfer function magnitude | dB   |    3816 %  | FAIL    |
| Transfer function phase     | deg  |     194 %  | FAIL    |
| Group delay                 | ms   |    58.8 %  | FAIL    |
| Maximum power               | W    |    0.03 %  | PASS    |
| Maximum SPL                 | dB   |    0.95 %  | PASS    |
| SPL                         | dB   |    1.22 %  | FAIL    |
| Cone excursion              | m    |    51.9 %  | FAIL    |
| Impedance magnitude         | Ω    |    1164 %  | FAIL    |
| Impedance phase             | deg  |   30750 %  | FAIL    |

WinISD's chart menu also offers "Cone velocity"; `Engine.sweep` exposes no matching curve, so
it is not compared. There is no port-velocity chart for a sealed box.

#### Transfer function magnitude (dB)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | -33.459      | -33.251      | +0.20775         | +0.621      |
| 20       | -21.179      | -21.283      | -0.10412         | -0.492      |
| 30       | -14.189      | -14.369      | -0.17998         | -1.268      |
| 45       | -7.694       | -7.8376      | -0.14357         | -1.866      |
| 63       | -3.4925      | -3.4273      | +0.065148        | +1.865      |
| 100.88   | -0.68299     | -0.26694     | +0.41605         | +60.916     |
| 200      | -0.033505    | 0.4938       | +0.52731         | +1573.810   |
| 500      | 0.012887     | 0.50467      | +0.49178         | +3816.225   |
| 1000     | 0.012887     | 0.49682      | +0.48393         | +3755.305   |
| 5000     | 0.012887     | 0.49365      | +0.48077         | +3730.744   |
| 20000    | 0.012887     | 0.49352      | +0.48063         | +3729.704   |

#### Transfer function phase (deg)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | -176.1       | 165.66       | +341.76          | +194.071    |
| 20       | 163.83       | 154.11       | -9.7218          | -5.934      |
| 30       | 147.71       | 141.8        | -5.9116          | -4.002      |
| 45       | 124.22       | 121.87       | -2.3518          | -1.893      |
| 63       | 97.838       | 97.8         | -0.037762        | -0.039      |
| 100.88   | 60.49        | 61.138       | +0.64802         | +1.071      |
| 200      | 28.577       | 28.399       | -0.17796         | -0.623      |
| 500      | 11.114       | 10.887       | -0.2272          | -2.044      |
| 1000     | 5.3814       | 5.3987       | +0.017274        | +0.321      |
| 5000     | 0.92784      | 1.0754       | +0.14753         | +15.901     |
| 20000    | 0.18557      | 0.26871      | +0.08314         | +44.803     |

WinISD's −176.10° at 10 Hz is the traced value on a ±180° axis; unwrapped it is **+183.90°**.

#### Group delay (ms)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | off-grid     | 3.999        | n/a              | n/a         |
| 20       | 4.7058       | 4.1079       | -0.59793         | -12.707     |
| 30       | 4.3563       | 4.1930       | -0.16331         | -3.749      |
| 45       | 4.2967       | 4.0022       | -0.29449         | -6.854      |
| 63       | 3.7242       | 3.2150       | -0.50922         | -13.673     |
| 100.88   | 1.8509       | 1.5900       | -0.26097         | -14.099     |
| 200      | 0.42287      | 0.39626      | -0.026607        | -6.292      |
| 500      | 0.064367     | 0.060637     | -0.003730        | -5.795      |
| 1000     | 0.018023     | 0.015009     | -0.003013        | -16.718     |
| 5000     | 0.002575     | 0.000597     | -0.001977        | n/a         |
| 20000    | 0.002575     | 0.000037     | -0.002537        | n/a         |

WinISD's 0 above ~2 kHz is the trace sitting on the axis floor, not a measured zero.

#### Maximum power (W)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | 39.99        | 40           | +0.010309        | +0.026      |
| 20       | 39.99        | 40           | +0.010309        | +0.026      |
| 30       | 39.99        | 40           | +0.010309        | +0.026      |
| 45       | 39.99        | 40           | +0.010309        | +0.026      |
| 63       | 39.99        | 40           | +0.010309        | +0.026      |
| 100.88   | 39.99        | 40           | +0.010309        | +0.026      |
| 200      | 39.99        | 40           | +0.010309        | +0.026      |
| 500      | 39.99        | 40           | +0.010309        | +0.026      |
| 1000     | 39.99        | 40           | +0.010309        | +0.026      |
| 5000     | 39.99        | 40           | +0.010309        | +0.026      |
| 20000    | 39.99        | 40           | +0.010309        | +0.026      |

#### Maximum SPL (dB)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | 63.119       | 63.698       | +0.57934         | +0.918      |
| 20       | 75.391       | 75.666       | +0.27556         | +0.366      |
| 30       | 82.408       | 82.579       | +0.17131         | +0.208      |
| 45       | 88.89        | 89.111       | +0.22179         | +0.250      |
| 63       | 93.072       | 93.522       | +0.44943         | +0.483      |
| 100.88   | 95.887       | 96.682       | +0.79456         | +0.829      |
| 200      | 96.523       | 97.443       | +0.91952         | +0.953      |
| 500      | 96.59        | 97.454       | +0.86337         | +0.894      |
| 1000     | 96.59        | 97.446       | +0.85552         | +0.886      |
| 5000     | 96.59        | 97.443       | +0.85236         | +0.882      |
| 20000    | 96.59        | 97.442       | +0.85222         | +0.882      |

#### SPL (dB)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | 47.103       | 47.677       | +0.5742          | +1.219      |
| 20       | 59.342       | 59.646       | +0.30393         | +0.512      |
| 30       | 66.326       | 66.559       | +0.23318         | +0.352      |
| 45       | 72.841       | 73.091       | +0.25016         | +0.343      |
| 63       | 77.053       | 77.501       | +0.4483          | +0.582      |
| 100.88   | 79.838       | 80.661       | +0.82293         | +1.031      |
| 200      | 80.508       | 81.422       | +0.91438         | +1.136      |
| 500      | 80.575       | 81.433       | +0.85824         | +1.065      |
| 1000     | 80.508       | 81.425       | +0.9174          | +1.140      |
| 5000     | 80.508       | 81.422       | +0.91423         | +1.136      |
| 20000    | 80.508       | 81.422       | +0.9141          | +1.135      |

#### Cone excursion (m)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | 0.0010751    | 0.00096511   | -0.00010994      | -10.227     |
| 20       | 0.00097662   | 0.00095704   | -1.9576e-05      | -2.004      |
| 30       | 0.00094392   | 0.00094278   | -1.136e-06       | -0.120      |
| 45       | 0.00087428   | 0.00088884   | +1.4563e-05      | +1.666      |
| 63       | 0.00072022   | 0.0007535    | +3.3273e-05      | +4.620      |
| 100.88   | 0.00038592   | 0.00042284   | +3.6916e-05      | +9.566      |
| 200      | 0.00010469   | 0.00011742   | +1.2739e-05      | +12.169     |
| 500      | 1.6636e-05   | 1.8811e-05   | +2.1755e-06      | +13.077     |
| 1000     | 3.0928e-06   | 4.6986e-06   | +1.6058e-06      | +51.922     |
| 5000     | 0            | 1.8788e-07   | +1.8788e-07      | n/a         |
| 20000    | 0            | 1.1742e-08   | +1.1742e-08      | n/a         |

Above ~2 kHz WinISD's trace is on the axis floor (Y range 0–1.2 mm); the % there is a
resolution artefact, not a model difference.

#### Impedance magnitude (Ω)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | 3.6727       | 3.6036       | -0.069076        | -1.881      |
| 20       | 3.9562       | 3.878        | -0.078144        | -1.975      |
| 30       | 4.5454       | 4.4255       | -0.11987         | -2.637      |
| 45       | 6.963        | 6.4139       | -0.54912         | -7.886      |
| 63       | 18.079       | 16.121       | -1.9575          | -10.827     |
| 100.88   | 5.9272       | 6.8174       | +0.89023         | +15.019     |
| 200      | 3.766        | 3.8136       | +0.047603        | +1.264      |
| 500      | 3.4407       | 3.5495       | +0.10873         | +3.160      |
| 1000     | 3.4149       | 3.9626       | +0.54763         | +16.036     |
| 5000     | 3.3892       | 11.186       | +7.7971          | +230.060    |
| 20000    | 3.3892       | 42.855       | +39.465          | +1164.456   |

#### Impedance phase (deg)

| f (Hz)   | WinISD       | openisd      | openisd − WinISD | diff %      |
|----------|--------------|--------------|------------------|-------------|
| 10       | 10.392       | 9.8992       | -0.49251         | -4.739      |
| 20       | 19.497       | 19.768       | +0.27112         | +1.391      |
| 30       | 29.015       | 29.549       | +0.53415         | +1.841      |
| 45       | 40.415       | 42.09        | +1.6751          | +4.145      |
| 63       | 9.3188       | 31.104       | +21.785          | +233.779    |
| 100.88   | -42.493      | -43.809      | -1.3167          | -3.099      |
| 200      | -21.897      | -17.976      | +3.9212          | +17.907     |
| 500      | -8.6191      | 7.9254       | +16.544          | +191.951    |
| 1000     | -4.268       | 27.847       | +32.115          | +752.452    |
| 5000     | -0.83505     | 71.766       | +72.601          | +8694.219   |
| 20000    | -0.27835     | 85.315       | +85.594          | +30750.326  |

The 63 Hz column is not a model difference, it is the 64.89 vs 69.46 Hz resonance split from
section 2 sampled next to the zero crossing.

---

## 4. Cause of each FAIL

Classification: **(a)** different inputs given, **(b)** same inputs, different derivation,
**(c)** a different model.

### 4.1 Voice-coil inductance — (c), and an openisd defect

WinISD has one switch, "Simulate voice coil inductance", and it governs both the impedance and
the acoustic output. Probed both ways in separate launches:

| f (Hz) | W VCInd=0 Z | W VCInd=1 Z | openisd Z | W VCInd=0 SPL | W VCInd=1 SPL | openisd SPL |
|--------|-------------|-------------|-----------|---------------|---------------|-------------|
| 200    | 3.766       | 3.634       | 3.814     | 80.508        | 80.843        | 81.422      |
| 1000   | 3.415       | 3.872       | 3.963     | 80.508        | 79.335        | 81.425      |
| 5000   | 3.389       | 11.153      | 11.186    | 80.508        | 69.954        | 81.422      |
| 20000  | 3.389       | 42.861      | 42.855    | 80.508        | 58.227        | 81.422      |

openisd's impedance matches WinISD's **inductance-on** curve (42.855 vs 42.861 Ω at 20 kHz)
while its SPL matches WinISD's **inductance-off** curve (flat to 20 kHz). openisd is running
half of each. `circuit.ts:115-142` does this deliberately — `ZcoilAC` excludes Le for the
acoustic circuit, `Zcoil` includes it for the impedance plot, citing
`aboutequivalentcircuits.html`. This session's probing shows that split is not what WinISD does
in either switch position.

openisd's existing `circuitModel: 'gyrator'` is the correct model: with Le it reproduces
WinISD's inductance-on roll-off shape to within the 0.92 dB passband offset of section 2
(59.663 vs 58.227 dB at 20 kHz, i.e. 1.44 dB, of which 0.92 dB is the Mms offset).

Recorded: `bugs/BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl.md`.

**This is the only chart difference that is large *and* is openisd's fault.** It drives the
impedance magnitude/phase FAILs above 1 kHz and part of the TF-magnitude FAIL at HF.

### 4.2 Sealed-box leakage Ql — (c), and an openisd defect

WinISD's sealed TF phase reaches **183.90°** at 10 Hz. A second-order high-pass cannot exceed
180°, so WinISD's sealed alignment is third order. openisd's reaches 165.66° and is second
order. Isolated by four launches:

| WinISD run                  | phase @10 Hz | max group delay | openisd equivalent | phase @10 Hz |
|-----------------------------|-------------:|----------------:|--------------------|-------------:|
| base (Ql 10, Qa 100)        |      183.90° |        7.61 ms  | app                |      165.66° |
| lossless (Ql 1e5, Qa 1e5)   |      167.94° |        4.24 ms  | lossless           |      168.82° |
| no leak (Ql 1e5, Qa 100)    |      167.94° |        4.22 ms  | —                  |            — |
| no absorption (Ql 10, Qa 1e5)|     183.90° |        7.58 ms  | —                  |            — |
| leaky (Ql 3)                |      207.84° |       10.97 ms  | leaky              |      159.32° |

Three facts, all observed:

1. With the box made lossless the two programs agree (167.94° vs 168.82°, group delay 3.45 vs
   3.16 ms). The disagreement is entirely in how the loss Q's are modelled.
2. Qa contributes nothing; Ql alone produces the whole effect.
3. The two move in **opposite directions**: raising the leakage raises WinISD's LF phase and
   group delay, and lowers openisd's.

openisd (`circuit.ts:157-162`) sets `Ral = Ql/(ωCab)` — recomputed at every frequency — puts it
in parallel with the box compliance, and radiates `U0 = UD`. Because Ral tracks |Zc| at every
frequency, that parallel combination is a scaled compliance in series with a 1/ω resistance: it
adds damping and cannot change the order.

A model with (i) Ral held **constant** at its value at Fc and (ii) the leak's own volume
velocity subtracted from the driver's, `U0 = UD − UD·Zbox/Ral`, reproduces WinISD's traced
phase to 0.94° RMS over 10–200 Hz (best-fit reference frequency 67.0 Hz against Fc = 64.94 Hz)
and its group delay to ~10 %. That is a model that fits the observation; WinISD's actual
formula was not read out of WinISD, so the two structural claims carry **⚠ unverified**. The
three numbered facts above do not.

Recorded: `bugs/BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak.md`.
This drives the TF-phase FAIL below 63 Hz, the whole group-delay FAIL, and the excursion FAIL
at 10–20 Hz.

### 4.3 Passband SPL, 0.92 dB — (b), NOT an openisd defect

Section 2. WinISD derives Mms from Fs/Vas/Sd, openisd uses the entered Mms, and the entered set
is inconsistent by 12.2 % in Mms. 1.000 dB from Mms, −0.10 dB from the eg = √(P·(Re+Rg)) vs
√(P·Re) convention, net 0.90 dB predicted against 0.917 dB traced. Affects SPL, max SPL, and
the LF half of the excursion and impedance tables.

The eg convention is a genuine difference of definition (WinISD's "input power" is the power
into Re+Rg, openisd's into Re) worth a decision, but it is 0.1 dB and it is not a bug in either
program.

### 4.4 Resonance frequency 64.89 vs 69.46 Hz — (b), NOT an openisd defect

Section 2. WinISD takes Fc from the entered Fs and Vas, openisd from the entered Mms·Cms. The
entered Fs and the entered Mms·Cms disagree by 8.5 %. This is the entire impedance FAIL below
200 Hz and the impedance-phase FAIL at 63 Hz.

### 4.5 TF-magnitude 0 dB reference, 0.494 dB — openisd internal inconsistency

WinISD's TF magnitude is exactly 0 dB in the passband: its reference is its own passband level.
openisd's sits at +0.494 dB, because `tfMag = spl − SPLref` with SPLref = 80.92838 dB taken
from the driver record — and that number is the classical efficiency route,
η0 = 4π²·Fs³·Vas/(c³·Qes) → 80.919 dB, computed from Fs, Vas and Qes. openisd's own sweep gives
81.42 dB from Bl, Mms and Sd. Two openisd numbers for the same fact, 0.494 dB apart, for the
same reason as 4.3: the entered set is inconsistent and the two code paths read different
halves of it.

Recorded: `bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md`.

### 4.6 John's reported observations

| Quantity            | John's openisd | John's WinISD | This session                                           | Verdict |
|---------------------|----------------|---------------|--------------------------------------------------------|---------|
| TF phase @ 20 Hz    | 154.108°       | 163.7°        | 154.11° / 163.83° — reproduced                          | 4.2     |
| TF phase @ 100.88Hz | 61.689°        | 60.715°       | 61.14° / 60.49° — reproduced                            | 4.2     |
| Max power (peak)    | 40 W           | 80 W          | both 40 W at Pe 40; a Pe = 80 launch gives 79.90 W      | **(a)** |
| Max SPL (peak)      | 97.4 dB        | 99.561 dB     | 97.44 / 96.59 at Pe 40; Pe = 80 launch gives 99.606 dB  | **(a)** |
| Group delay         | "very different"| —            | 3.13 vs 7.61 ms at 10 Hz — reproduced                   | 4.2     |

**Max power and max SPL are an input difference.** WinISD's max-power plateau equals the
driver's Pe exactly; John's WinISD had Pe = 80 W and his openisd had Pe = 40 W. At matched Pe
the two agree to 0.03 % (max power) and 0.95 % (max SPL, the residual being the 4.3 offset).
Not an openisd defect.

---

## 5. Not established

- WinISD's actual leak formula. The structure in 4.2 is a fit to the traced curves, not
  something read out of WinISD. `⚠ unverified`.
- The 10 % residual in group delay at 10 Hz under that fitted model.
- The state of WinISD's five Advanced-tab checkboxes was not read directly — they are
  owner-drawn LCL controls with no readable text. "Simulate voice coil inductance" OFF is
  established from the impedance curve being flat at 3.389 Ω to 20 kHz, not from the checkbox.
- Whether WinISD applies Le to the acoustic circuit through the same gyrator topology openisd's
  `circuitModel: 'gyrator'` uses, or some other one. Only that the two curves agree in shape.

## 6. Reproducing

```
cd /home/john/work/winisd/winisd_research
scripts/headless.sh python3 toys/w5_charts.py base                      # all 10 charts
scripts/headless.sh python3 toys/w5_charts.py vcind VCInd=1             # inductance on
scripts/headless.sh python3 toys/w5_charts.py lossless charts=0,1,2 DelayEnd=20 Qlr=100000 Qar=100000
scripts/headless.sh python3 toys/w5_charts.py pe80 charts=3,4 Pe=80 MaxPowerEnd=200
bash toys/w5_sens.sh                                                    # 13-launch sensitivity
python3 toys/w5_trace.py runs/w5_sealed/charts_base/charts.json runs/w5_sealed/charts_base/traced.json
```

openisd side: `npx vitest run packages/design/test/scratch-w5.test.ts` (scratch, deleted after
this report — see git history if it is needed again).
