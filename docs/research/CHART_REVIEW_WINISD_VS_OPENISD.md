# Chart review: WinISD vs OpenISD — W5-1138SMF sealed

Last refreshed 2026-09-26 against the group-delay fix. **Refresh this whenever a calculation changes**:
the WinISD side is a debugger capture and does not move, so a refresh is the OpenISD side plus
the compare — §6. The name is stable; do not date it.

This is the evidence for [CHARTS.md](../CHARTS.md), which describes each chart's calculation and
the WinISD compatibility controls.

Case: Tang Band W5-1138SMF in a 4.48 L sealed box, 1 W, Rg 0.1 Ω, no filters, 1 Hz – 20 kHz.

WinISD side: unmodified `WinISD.exe` 0.7.0.950 under wine/Xvfb, with gdb breakpoints on the
epilogue of the routine that computes each chart point
(`winisd_research/scripts/gdb_log_chart_points.py`, method in
[DEBUGGER_CHART_LOGGING.md](http://localhost:8000/winisd/winisd_research/DEBUGGER_CHART_LOGGING.md?html)).
Every WinISD number below is the double WinISD itself computed. None is traced from pixels.
Screenshots are kept only to check the chart title and that the curve drawn matches the value
logged. Driver: `winisd_research/toys/w5_chart_refresh.py`.

- The range is `[Settings.Plot.Limits] FreqStart=1`, `FreqEnd=20000`, read back after launch.
  The drawn x-axis starts at 1 Hz.
- WinISD's grid is f_i = 20000^(i/2085), i = 0..2085: 2086 points, read off the logged
  frequencies.

OpenISD side: the WinISD `.wpr` imported with `OpenISDProject.fromWprText`, with the settings
in §1 applied. The project is written as `.owpr`, read back with `fromOwprText`, then
`sweep` / `maxCurves` are run with `fmin=1, fmax=20000, N=2085`. That grid is identical to
WinISD's; the compare script checks this to 1e-9.

Records (format `winisd-run-record/1`, all validated):

- [sweep-w5-sealed-baseline-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-baseline-charts.json) — every chart, VCInd off, Rg 0.1 Ω, driver side off
- [sweep-w5-sealed-fresh-20260926](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-fresh-20260926.json) — every chart, a second capture of the baseline settings; identical to it
- [sweep-w5-sealed-vcind1-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-vcind1-charts.json) — SPL, impedance, TF magnitude, VCInd on, Rg 0.1 Ω, driver side off
- [sweep-w5-sealed-impedance-rg0-vcind1-driverside-off](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg0-vcind1-driverside-off.json) — impedance, VCInd on, Rg 0 Ω, driver side off
- [sweep-w5-sealed-impedance-rg0-vcind1-driverside-on](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg0-vcind1-driverside-on.json) — impedance, VCInd on, Rg 0 Ω, driver side on
- [sweep-w5-sealed-impedance-rg10-vcind1-driverside-off](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1-driverside-off.json) — impedance, VCInd on, Rg 10 Ω, driver side off
- [sweep-w5-sealed-impedance-rg10-vcind1-driverside-on](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1-driverside-on.json) — impedance, VCInd on, Rg 10 Ω, driver side on

## 0. Checklist — WinISD charts to check

Every chart in WinISD's chart menu, per box type OpenISD has. 50 to check: **13 done** (11 exact
match, 2 within WinISD's own rounding), 37 to do.

Key: ✅ exact match (≤ 1e-12 at all 2086 points) · ≈ matches to WinISD's own rounding noise ·
☐ to check · ✗ OpenISD has no such chart · — does not apply to that box.

| Chart                                   | Sealed | Vented | Bandpass 4th | Passive radiator |
|-----------------------------------------|--------|--------|--------------|------------------|
| Transfer function magnitude             | ✅     | ☐      | ☐            | ☐                |
| Transfer function phase                 | ✅     | ☐      | ☐            | ☐                |
| Group delay                             | ≈      | ☐      | ☐            | ☐                |
| Maximum power                           | ✅     | ☐      | ☐            | ☐                |
| Maximum SPL                             | ✅     | ☐      | ☐            | ☐                |
| Amplifier apparent load power (VA)      | ✅     | ☐      | ☐            | ☐                |
| SPL                                     | ✅     | ☐      | ☐            | ☐                |
| Cone excursion                          | ✅     | ☐      | ☐            | ☐                |
| Impedance                               | ✅     | ☐      | ☐            | ☐                |
| Impedance phase                         | ✅     | ☐      | ☐            | ☐                |
| Transfer function magnitude (PR)        | —      | —      | —            | ✗                |
| Transfer function phase (PR)            | —      | —      | —            | ✗                |
| Cone excursion (PR)                     | —      | —      | —            | ☐                |
| Rear port - Air velocity                | —      | ☐      | —            | —                |
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
Rg 0 and 10 Ω with "Rg is at driver side" on and off; every sealed chart with a 4-filter chain
(§3.4). Not in OpenISD at all: bandpass 6th and
ABC boxes (the only boxes with an intrachamber port).

---

## 1. Settings — equivalence before the sweep

Every setting that can move a curve, with where each app holds it. `wpr` paths are the `.wpr`
fed to WinISD. `memory` paths are WinISD's project bytes +0x50..+0x54, read by the logger at
every point. OpenISD paths are the `.owpr` `edited` block, which is the one the sweep runs on.

| Setting                        | WinISD                                         | OpenISD                                               | Status         | Note                                                                                                                                                                                                                                                                                                     |
|--------------------------------|------------------------------------------------|-------------------------------------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Air temperature                | `wpr Box.T` = "293.15"                         | `environment.temperature_K.value` = 293.15            | matched        |                                                                                                                                                                                                                                                                                                          |
| Air pressure                   | `wpr Box.p` = "101325"                         | `environment.pressure_Pa.value` = 101325              | matched        |                                                                                                                                                                                                                                                                                                          |
| Relative humidity              | `wpr Box.phi` = "0.3"                          | `environment.humidity_pct.value` = 30                 | matched        | WinISD stores a fraction, OpenISD a percentage                                                                                                                                                                                                                                                           |
| Air model                      | —                                              | —                                                     | no-counterpart | WinISD has one air model; OpenISD's environment.useWinisdAirModel is null and reads as its WinISD air model                                                                                                                                                                                              |
| Source resistance Rg           | `wpr SignalSource.Rg` = "0.1"                  | `driverEmbedding.Rs_ohm` = 0.1                        | matched        |                                                                                                                                                                                                                                                                                                          |
| Drive level                    | `wpr SignalSource.P` = "1.0"                   | `signal.power_W.value` = 1.0                          | matched        |                                                                                                                                                                                                                                                                                                          |
| Simulate voice coil inductance | `wpr SimulatorOptions.VCInd` = "0"             | `advanced.circuitModel` = "winisd"                    | matched        | VCInd=0 <-> 'winisd'; VCInd=1 <-> 'winisdGyrator' (WinISD's own inductance-on model)                                                                                                                                                                                                                     |
| Force flat response            | `wpr SimulatorOptions.FlatResponse` = "0"      | `advanced.forceFlatResponse` = false                  | matched        |                                                                                                                                                                                                                                                                                                          |
| Transmission-line ports        | `wpr SimulatorOptions.TLPorts` = "0"           | `advanced.useTransmissionLinePortModel` = false       | matched        |                                                                                                                                                                                                                                                                                                          |
| Rg is at driver side           | `memory options_project_0x50` = ["0000000000"] | `advanced.rgAtDriverSide` = false                     | matched        | not saved in .wpr; set by the Advanced-tab checkbox and read back from WinISD memory (project+0x53, 4th byte) by the logger                                                                                                                                                                              |
| SPL graph is Xmax limited      | `memory options_project_0x50` = ["0000000000"] | `advanced.splGraphIsXmaxLimited` = false              | matched        | not saved in .wpr; project+0x54 (5th byte) read back from WinISD memory                                                                                                                                                                                                                                  |
| Box volume                     | `wpr Box.Vr` = "0.00448"                       | `box.sealed.volume_m3` = 0.00448                      | matched        |                                                                                                                                                                                                                                                                                                          |
| Leakage Ql                     | `wpr Box.Qlr` = "10"                           | `box.sealed.losses.Ql` = 10                           | matched        |                                                                                                                                                                                                                                                                                                          |
| Absorption Qa                  | `wpr Box.Qar` = "100"                          | `box.sealed.losses.Qa` = 100                          | matched        |                                                                                                                                                                                                                                                                                                          |
| Port loss Qp                   | `wpr Box.Qpr` = "100"                          | —                                                     | no-counterpart | sealed box: no port, Qp unused by either app                                                                                                                                                                                                                                                             |
| Loss model                     | —                                              | —                                                     | no-counterpart | WinISD has one loss model; OpenISD's advanced.lossMode is absent from the project and reads as 'winisd-lossy'                                                                                                                                                                                            |
| Driver mass derivation         | —                                              | `advanced.winisdDriverModel` = true                | no-counterpart | WinISD has no switch: it simulates from Fs, Vas, Qes, Qms (Cms from Vas, Mms from Fs and Cms, Rms from Qms). OpenISD 'WinISD driver model' on derives the same set, and uses the entered BL for the motor's push and the Qes-derived BL for the damping, as WinISD does (§4.1) |
| Driver count                   | `wpr Box.Nd` = "1"                             | `driverEmbedding.nDrivers` = 1                        | matched        |                                                                                                                                                                                                                                                                                                          |
| Voice-coil temperature rise    | `wpr Box.dTVC` = "0"                           | `driverEmbedding.vcTempRise_K` = 0                    | matched        |                                                                                                                                                                                                                                                                                                          |
| Voice-coil resistance TC       | `wpr Box.alfaVC` = "0.0039"                    | `driverEmbedding.alfaVC_per_K` = 0.0039               | matched        |                                                                                                                                                                                                                                                                                                          |
| Added mass to cone             | `wpr Box.Med` = "0"                            | `driverEmbedding.driverAddedMass_kg` = 0              | matched        |                                                                                                                                                                                                                                                                                                          |
| Loading (standard / iso-barik) | `wpr Box.Isobarik` = "0"                       | `driverEmbedding.loading` = "standard"                | matched        |                                                                                                                                                                                                                                                                                                          |
| Pe                             | `wpr Driver.Pe` = "40"                         | `driverEmbedding.device.specs.woofer.Pe_W.value` = 40 | matched        |                                                                                                                                                                                                                                                                                                          |
| Frequency range start          | `winisdFreqStart` = "1"                        | `openisdFmin` = 1                                     | matched        | WinISD [Settings.Plot.Limits] FreqStart read back after launch (the section name has dots, so the where points at a copy); OpenISD's range is not in the project: sweep(fmin, fmax, N)                                                                                                                   |
| Frequency range end            | `winisdFreqEnd` = "20000"                      | `openisdFmax` = 20000                                 | matched        |                                                                                                                                                                                                                                                                                                          |
| Frequency grid                 | —                                              | `openisdN` = 2085                                     | no-counterpart | WinISD's grid f_i = 1·20000^(i/2085), read off the logged frequencies; OpenISD called with the same N                                                                                                                                                                                                    |
| Filters                        | `wpr Filters.Count` = "0"                      | `filters.filters` = []                                | matched        |                                                                                                                                                                                                                                                                                                          |

`memory` `0000000000` is, byte by byte: VCInd, FlatResponse, TLPorts, "Rg is at driver
side", "SPL graph is Xmax limited" — all off. The last two are not in the `.wpr`, so they are
set through the Advanced-tab checkbox and confirmed from memory.

---

## 2. The inputs are mutually inconsistent, and each program resolves that its own way

The entered parameter set does not satisfy its own identities:

| Identity                   | Implied value | Entered value | Disagreement |
|----------------------------|---------------|---------------|--------------|
| Fs = 1/(2π√(Mms·Cms))      | 48.831 Hz     | 45 Hz         | +8.5 %       |
| Vas = ρc²Sd²·Cms           | 4.622 L       | 4.85 L        | −4.7 %       |
| Mms = ρc²Sd²/((2πFs)²·Vas) | 0.032329 kg   | 0.02881 kg    | +12.2 %      |
| Rms = 2πFs·Mms/Qms         | 2.5676        | 2.28816       | +12.2 %      |
| BL = √(2πFs·Mms·Re/Qes)    | 7.384 Tm      | 7.17 Tm       | +3.0 %       |

Which half each program simulates:

- **WinISD** builds its circuit from Fs, Vas, Qes, Qms, Sd, Re: Cms from Vas, Mms from Fs and
  Cms, Rms from Qms, the damping from Qes. The **entered** BL sets the push, the impedance's
  motional term and the TF reference (§4).
- **OpenISD** with "WinISD driver model" on (the default) does the same.

The closed form in
[`toys/w5_fresh_model_check.py`](http://localhost:8000/winisd/winisd_research/toys/w5_fresh_model_check.py)
reproduces every WinISD chart of this case to ≤ 1e-13 (group delay to 5e-7 s, its own numeric
derivative).

---

## 3. Chart-by-chart

Verdict: PASS when the worst |OpenISD − WinISD| over all 2086 points is within the tolerance
shown. Tolerances: 0.1 dB, 1°, 0.05 ms, 0.4 W (1 % of Pe), 0.01 mm, 0.05 Ω. Each table has a
row at every 1/3-octave centre, plus a row for every local maximum or minimum, step and phase
wrap the dense scan finds on either curve, plus the worst row. Dense arrays: in the records
above.

| Chart                              | Unit | Worst \|OpenISD − WinISD\| | At (Hz) | Tolerance | Verdict | Was (earlier 2026-09-26) |
|------------------------------------|------|-----------------------------|---------|-----------|---------|--------------------------|
| Transfer function magnitude        | dB   | 3.34e-14                    | 259.14  | 0.1       | PASS    | 0.2704                   |
| Transfer function phase            | deg  | 9.095e-13                   | 269.17  | 1.0       | PASS    | 0.5314                   |
| Group delay                        | ms   | 0.0004881                   | 2.1382  | 0.05      | PASS    | 0.1917                   |
| Maximum power                      | W    | 8.882e-14                   | 2.7373  | 0.4       | PASS    | 1.31                     |
| Maximum SPL                        | dB   | 2.842e-14                   | 13.062  | 0.1       | PASS    | 0.1729                   |
| SPL                                | dB   | 2.842e-14                   | 55.876  | 0.1       | PASS    | 0.2988                   |
| Cone excursion                     | mm   | 2.665e-15                   | 1.1809  | 0.01      | PASS    | 0.06008                  |
| Impedance                          | ohm  | 2.842e-14                   | 69.853  | 0.05      | PASS    | 1.228                    |
| Impedance phase                    | deg  | 1.421e-13                   | 64.434  | 1.0       | PASS    | 1.599                    |
| Amplifier apparent load power (VA) | VA   | see §3.3                    | —       | —         | PASS    | not captured             |

How each WinISD value is read from the logged complex `out` (chart byte in brackets). Each
mapping is checked against the curve drawn in the screenshot:

| Chart                              | WinISD value                    |
|------------------------------------|---------------------------------|
| Transfer function magnitude        | 20·log10\|out\| [0]           |
| Transfer function phase            | arg(out) [0]                    |
| Group delay                        | Re(out) s → ms [12]             |
| Maximum power                      | Re(out) W [11]                  |
| Maximum SPL                        | 20·log10\|out\| [14]          |
| SPL                                | 20·log10\|out\| [1]           |
| Cone excursion                     | Re(out) m → mm [13]             |
| Impedance                          | \|out\| ohm [7]               |
| Impedance phase                    | arg(out) [7]                    |

#### Transfer function magnitude (dB) — PASS

Worst |OpenISD − WinISD| = 3.34e-14 dB at 259.14 Hz; tolerance 0.1 dB.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | -77.6522     | -77.6522     | -1.42109e-14     | 1/3 oct       |
| 1.548    | -72.0783     | -72.0783     | -1.42109e-14     | 1/3 oct       |
| 1.9537   | -66.5488     | -66.5488     | 0                | 1/3 oct       |
| 2.4657   | -61.2202     | -61.2202     | -1.42109e-14     | 1/3 oct       |
| 3.0971   | -56.2204     | -56.2204     | -2.13163e-14     | 1/3 oct       |
| 3.9087   | -51.3463     | -51.3463     | -1.42109e-14     | 1/3 oct       |
| 4.9331   | -46.6861     | -46.6861     | -2.13163e-14     | 1/3 oct       |
| 6.1963   | -42.295      | -42.295      | -7.10543e-15     | 1/3 oct       |
| 7.8201   | -37.9497     | -37.9497     | -7.10543e-15     | 1/3 oct       |
| 9.8226   | -33.791      | -33.791      | -1.42109e-14     | 1/3 oct       |
| 12.397   | -29.6155     | -29.6155     | -2.13163e-14     | 1/3 oct       |
| 15.645   | -25.4896     | -25.4896     | -1.42109e-14     | 1/3 oct       |
| 19.652   | -21.486      | -21.486      | -1.42109e-14     | 1/3 oct       |
| 24.802   | -17.4426     | -17.4426     | -1.06581e-14     | 1/3 oct       |
| 31.301   | -13.4767     | -13.4767     | -1.24345e-14     | 1/3 oct       |
| 39.317   | -9.75556     | -9.75556     | -1.42109e-14     | 1/3 oct       |
| 49.62    | -6.3194      | -6.3194      | -8.88178e-15     | 1/3 oct       |
| 62.623   | -3.55804     | -3.55804     | -5.32907e-15     | 1/3 oct       |
| 78.66    | -1.74649     | -1.74649     | -1.86517e-14     | 1/3 oct       |
| 99.273   | -0.743651    | -0.743651    | -2.39808e-14     | 1/3 oct       |
| 125.29   | -0.29091     | -0.29091     | -1.11577e-14     | 1/3 oct       |
| 157.37   | -0.11141     | -0.11141     | -8.71525e-15     | 1/3 oct       |
| 198.61   | -0.0429113   | -0.0429113   | -9.6867e-15      | 1/3 oct       |
| 249.47   | -0.0201204   | -0.0201204   | -2.31759e-15     | 1/3 oct       |
| 259.14   | -0.0183164   | -0.0183164   | -3.34004e-14     | worst         |
| 314.85   | -0.0134907   | -0.0134907   | -9.91221e-15     | 1/3 oct       |
| 382.54   | -0.0125491   | -0.0125491   | -8.46892e-15     | WinISD max OpenISD max |
| 397.36   | -0.0125712   | -0.0125712   | -9.62772e-15     | 1/3 oct       |
| 499.11   | -0.0132543   | -0.0132543   | -2.43226e-14     | 1/3 oct       |
| 629.91   | -0.0142001   | -0.0142001   | -1.50747e-14     | 1/3 oct       |
| 794.98   | -0.0149964   | -0.0149964   | -1.73056e-14     | 1/3 oct       |
| 998.56   | -0.0155662   | -0.0155662   | -1.21691e-14     | 1/3 oct       |
| 1260.2   | -0.0159648   | -0.0159648   | 3.26128e-16      | 1/3 oct       |
| 1590.5   | -0.0162276   | -0.0162276   | -1.85719e-14     | 1/3 oct       |
| 1997.8   | -0.0163949   | -0.0163949   | -2.27388e-14     | 1/3 oct       |
| 2521.3   | -0.0165045   | -0.0165045   | -1.00718e-14     | 1/3 oct       |
| 3182.1   | -0.0165742   | -0.0165742   | -1.96579e-14     | 1/3 oct       |
| 3996.9   | -0.0166175   | -0.0166175   | -1.22263e-14     | 1/3 oct       |
| 5044.3   | -0.0166456   | -0.0166456   | -1.89015e-14     | 1/3 oct       |
| 6336.1   | -0.0166629   | -0.0166629   | -1.83707e-14     | 1/3 oct       |
| 7996.5   | -0.0166742   | -0.0166742   | -1.33747e-14     | 1/3 oct       |
| 10092    | -0.0166812   | -0.0166812   | -1.13728e-14     | 1/3 oct       |
| 12676    | -0.0166856   | -0.0166856   | -7.80626e-15     | 1/3 oct       |
| 15998    | -0.0166884   | -0.0166884   | -2.07265e-14     | 1/3 oct       |

#### Transfer function phase (deg) — PASS

Worst |OpenISD − WinISD| = 9.095e-13 deg at 269.17 Hz; tolerance 1.0 deg.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | -114.461     | -114.461     | 0                | 1/3 oct       |
| 1.548    | -119.901     | -119.901     | 0                | 1/3 oct       |
| 1.9537   | -126.253     | -126.253     | 5.68434e-14      | 1/3 oct       |
| 2.4657   | -133.263     | -133.263     | 0                | 1/3 oct       |
| 3.0971   | -140.523     | -140.523     | 2.84217e-14      | 1/3 oct       |
| 3.9087   | -148.034     | -148.034     | 0                | 1/3 oct       |
| 4.9331   | -155.38      | -155.38      | 0                | 1/3 oct       |
| 6.1963   | -162.262     | -162.262     | 0                | 1/3 oct       |
| 7.8201   | -168.948     | -168.948     | 0                | 1/3 oct       |
| 9.8226   | -175.268     | -175.268     | 0                | 1/3 oct       |
| 11.654   | -179.976     | -179.976     | 0                | WinISD wrap OpenISD wrap |
| 11.71    | 179.893      | 179.893      | 0                | WinISD max OpenISD max |
| 12.397   | 178.308      | 178.308      | 0                | 1/3 oct       |
| 15.645   | 171.615      | 171.615      | 0                | 1/3 oct       |
| 19.652   | 164.429      | 164.429      | -2.84217e-14     | 1/3 oct       |
| 24.802   | 155.96       | 155.96       | -2.84217e-14     | 1/3 oct       |
| 31.301   | 145.705      | 145.705      | 0                | 1/3 oct       |
| 39.317   | 133.185      | 133.185      | -2.84217e-14     | 1/3 oct       |
| 49.62    | 117.259      | 117.259      | -1.98952e-13     | 1/3 oct       |
| 62.623   | 98.4891      | 98.4891      | -3.12639e-13     | 1/3 oct       |
| 78.66    | 79.351       | 79.351       | -5.11591e-13     | 1/3 oct       |
| 99.273   | 61.8028      | 61.8028      | -3.97904e-13     | 1/3 oct       |
| 125.29   | 47.6908      | 47.6908      | -7.38964e-13     | 1/3 oct       |
| 157.37   | 37.0832      | 37.0832      | -7.95808e-13     | 1/3 oct       |
| 198.61   | 28.8516      | 28.8516      | -7.38964e-13     | 1/3 oct       |
| 249.47   | 22.685       | 22.685       | -7.67386e-13     | 1/3 oct       |
| 269.17   | 20.9581      | 20.9581      | -9.09495e-13     | worst         |
| 314.85   | 17.8223      | 17.8223      | -8.52651e-13     | 1/3 oct       |
| 397.36   | 14.0438      | 14.0438      | -7.10543e-13     | 1/3 oct       |
| 499.11   | 11.1418      | 11.1418      | -6.82121e-13     | 1/3 oct       |
| 629.91   | 8.80819      | 8.80819      | -5.96856e-13     | 1/3 oct       |
| 794.98   | 6.96919      | 6.96919      | -6.53699e-13     | 1/3 oct       |
| 998.56   | 5.54342      | 5.54342      | -7.38964e-13     | 1/3 oct       |
| 1260.2   | 4.38983      | 4.38983      | -7.38964e-13     | 1/3 oct       |
| 1590.5   | 3.47705      | 3.47705      | -7.38964e-13     | 1/3 oct       |
| 1997.8   | 2.76756      | 2.76756      | -7.38964e-13     | 1/3 oct       |
| 2521.3   | 2.19258      | 2.19258      | -7.10543e-13     | 1/3 oct       |
| 3182.1   | 1.73714      | 1.73714      | -5.96856e-13     | 1/3 oct       |
| 3996.9   | 1.38291      | 1.38291      | -4.83169e-13     | 1/3 oct       |
| 5044.3   | 1.09572      | 1.09572      | -4.26326e-13     | 1/3 oct       |
| 6336.1   | 0.872315     | 0.872315     | -2.84217e-13     | 1/3 oct       |
| 7996.5   | 0.691175     | 0.691175     | -1.42109e-13     | 1/3 oct       |
| 10092    | 0.547652     | 0.547652     | -1.13687e-13     | 1/3 oct       |
| 12676    | 0.435999     | 0.435999     | -1.7053e-13      | 1/3 oct       |
| 15998    | 0.345466     | 0.345466     | -1.42109e-13     | 1/3 oct       |

#### Group delay (ms) — PASS

Worst |OpenISD − WinISD| = 0.0004881 ms at 2.1382 Hz; tolerance 0.05 ms.

WinISD: 189 extrema/steps each smaller than 0.5 % of the chart's range between 34.1 and 1.981e+04 Hz (a staircase in the curve), not listed row by row.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 49.741       | 49.7412      | 0.000186234      | 1/3 oct       |
| 1.548    | 45.9774      | 45.9775      | 0.000108738      | 1/3 oct       |
| 1.9537   | 41.0281      | 41.028       | -7.46449e-05     | 1/3 oct       |
| 2.1382   | 38.8381      | 38.8376      | -0.000488068     | worst         |
| 2.4657   | 35.1458      | 35.1461      | 0.000274475      | 1/3 oct       |
| 3.0971   | 28.9423      | 28.9421      | -0.00022554      | 1/3 oct       |
| 3.9087   | 22.7972      | 22.7971      | -9.46299e-05     | 1/3 oct       |
| 4.9331   | 17.4164      | 17.4164      | 5.757e-05        | 1/3 oct       |
| 6.1963   | 13.1926      | 13.1926      | -1.44106e-05     | 1/3 oct       |
| 7.8201   | 9.98199      | 9.9819       | -9.00123e-05     | 1/3 oct       |
| 9.8226   | 7.77204      | 7.77202      | -1.50829e-05     | 1/3 oct       |
| 12.397   | 6.25986      | 6.26006      | 0.000201285      | 1/3 oct       |
| 15.645   | 5.29916      | 5.2992       | 4.25176e-05      | 1/3 oct       |
| 19.652   | 4.73982      | 4.73981      | -7.00331e-06     | 1/3 oct       |
| 24.802   | 4.44685      | 4.44682      | -2.60785e-05     | 1/3 oct       |
| 31.301   | 4.34683      | 4.34687      | 3.61882e-05      | 1/3 oct       |
| 39.317   | 4.33361      | 4.3336       | -1.09219e-06     | 1/3 oct       |
| 49.62    | 4.21889      | 4.21885      | -4.0043e-05      | 1/3 oct       |
| 62.623   | 3.74179      | 3.7417       | -9.09786e-05     | 1/3 oct       |
| 78.66    | 2.87495      | 2.87485      | -9.88929e-05     | 1/3 oct       |
| 99.273   | 1.91254      | 1.91268      | 0.000141384      | 1/3 oct       |
| 125.29   | 1.17714      | 1.17704      | -0.000100198     | 1/3 oct       |
| 157.37   | 0.714565     | 0.714527     | -3.83655e-05     | 1/3 oct       |
| 198.61   | 0.429958     | 0.429998     | 3.99379e-05      | 1/3 oct       |
| 249.47   | 0.264019     | 0.263884     | -0.000134768     | 1/3 oct       |
| 314.85   | 0.161698     | 0.161848     | 0.000150147      | 1/3 oct       |
| 397.36   | 0.100023     | 0.100029     | 5.71076e-06      | 1/3 oct       |
| 499.11   | 0.0627354    | 0.0627625    | 2.70899e-05      | 1/3 oct       |
| 629.91   | 0.0392094    | 0.0391417    | -6.76994e-05     | 1/3 oct       |
| 794.98   | 0.02455      | 0.0244698    | -8.02298e-05     | 1/3 oct       |
| 998.56   | 0.0155425    | 0.0154683    | -7.41467e-05     | 1/3 oct       |
| 1260.2   | 0.00989067   | 0.00969475   | -0.000195917     | 1/3 oct       |
| 1590.5   | 0.00600505   | 0.00608004   | 7.49913e-05      | 1/3 oct       |
| 1997.8   | 0.00388562   | 0.00385107   | -3.45494e-05     | 1/3 oct       |
| 2521.3   | 0.00229605   | 0.00241676   | 0.000120717      | 1/3 oct       |
| 3182.1   | 0.00176619   | 0.0015169    | -0.00024929      | 1/3 oct       |
| 3996.9   | 0.00105971   | 0.000961282  | -9.84318e-05     | 1/3 oct       |
| 5044.3   | 0.000529857  | 0.000603455  | 7.35982e-05      | 1/3 oct       |
| 6336.1   | 0.000176619  | 0.000382457  | 0.000205838      | 1/3 oct       |
| 7996.5   | 0.000176619  | 0.000240107  | 6.34883e-05      | 1/3 oct       |
| 10092    | 0.000176619  | 0.000150742  | -2.58768e-05     | 1/3 oct       |
| 12676    | 0            | 9.55421e-05  | 9.55421e-05      | 1/3 oct       |
| 15998    | 0.000176619  | 5.99834e-05  | -0.000116636     | 1/3 oct       |

#### Maximum power (W) — PASS

Worst |OpenISD − WinISD| = 8.882e-14 W at 2.7373 Hz; tolerance 0.4 W.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 22.1569      | 22.1569      | 2.4869e-14       | 1/3 oct       |
| 1.548    | 23.6344      | 23.6344      | 3.90799e-14      | 1/3 oct       |
| 1.9537   | 25.9061      | 25.9061      | 2.4869e-14       | 1/3 oct       |
| 2.4657   | 29.2472      | 29.2472      | 4.26326e-14      | 1/3 oct       |
| 2.7373   | 31.1787      | 31.1787      | 8.88178e-14      | worst         |
| 3.0971   | 33.8527      | 33.8527      | 4.9738e-14       | 1/3 oct       |
| 3.9087   | 40           | 40           | 0                | 1/3 oct       |
| 4.9331   | 40           | 40           | 0                | 1/3 oct       |
| 6.1963   | 40           | 40           | 0                | 1/3 oct       |
| 7.8201   | 40           | 40           | 0                | 1/3 oct       |
| 9.8226   | 40           | 40           | 0                | 1/3 oct       |
| 12.397   | 40           | 40           | 0                | 1/3 oct       |
| 15.645   | 40           | 40           | 0                | 1/3 oct       |
| 19.652   | 40           | 40           | 0                | 1/3 oct       |
| 24.802   | 40           | 40           | 0                | 1/3 oct       |
| 31.301   | 40           | 40           | 0                | 1/3 oct       |
| 39.317   | 40           | 40           | 0                | 1/3 oct       |
| 49.62    | 40           | 40           | 0                | 1/3 oct       |
| 62.623   | 40           | 40           | 0                | 1/3 oct       |
| 78.66    | 40           | 40           | 0                | 1/3 oct       |
| 99.273   | 40           | 40           | 0                | 1/3 oct       |
| 125.29   | 40           | 40           | 0                | 1/3 oct       |
| 157.37   | 40           | 40           | 0                | 1/3 oct       |
| 198.61   | 40           | 40           | 0                | 1/3 oct       |
| 249.47   | 40           | 40           | 0                | 1/3 oct       |
| 314.85   | 40           | 40           | 0                | 1/3 oct       |
| 397.36   | 40           | 40           | 0                | 1/3 oct       |
| 499.11   | 40           | 40           | 0                | 1/3 oct       |
| 629.91   | 40           | 40           | 0                | 1/3 oct       |
| 794.98   | 40           | 40           | 0                | 1/3 oct       |
| 998.56   | 40           | 40           | 0                | 1/3 oct       |
| 1260.2   | 40           | 40           | 0                | 1/3 oct       |
| 1590.5   | 40           | 40           | 0                | 1/3 oct       |
| 1997.8   | 40           | 40           | 0                | 1/3 oct       |
| 2521.3   | 40           | 40           | 0                | 1/3 oct       |
| 3182.1   | 40           | 40           | 0                | 1/3 oct       |
| 3996.9   | 40           | 40           | 0                | 1/3 oct       |
| 5044.3   | 40           | 40           | 0                | 1/3 oct       |
| 6336.1   | 40           | 40           | 0                | 1/3 oct       |
| 7996.5   | 40           | 40           | 0                | 1/3 oct       |
| 10092    | 40           | 40           | 0                | 1/3 oct       |
| 12676    | 40           | 40           | 0                | 1/3 oct       |
| 15998    | 40           | 40           | 0                | 1/3 oct       |

#### Maximum SPL (dB) — PASS

Worst |OpenISD − WinISD| = 2.842e-14 dB at 13.062 Hz; tolerance 0.1 dB.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 16.35        | 16.35        | 0                | 1/3 oct       |
| 1.548    | 22.2043      | 22.2043      | 3.55271e-15      | 1/3 oct       |
| 1.9537   | 28.1323      | 28.1323      | 3.55271e-15      | 1/3 oct       |
| 2.4657   | 33.9878      | 33.9878      | 0                | 1/3 oct       |
| 3.0971   | 39.6226      | 39.6226      | -7.10543e-15     | 1/3 oct       |
| 3.9087   | 45.2214      | 45.2214      | -1.42109e-14     | 1/3 oct       |
| 4.9331   | 49.8816      | 49.8816      | -7.10543e-15     | 1/3 oct       |
| 6.1963   | 54.2727      | 54.2727      | -7.10543e-15     | 1/3 oct       |
| 7.8201   | 58.618       | 58.618       | 0                | 1/3 oct       |
| 9.8226   | 62.7767      | 62.7767      | -7.10543e-15     | 1/3 oct       |
| 12.397   | 66.9522      | 66.9522      | -1.42109e-14     | 1/3 oct       |
| 13.062   | 67.8822      | 67.8822      | -2.84217e-14     | worst         |
| 15.645   | 71.0781      | 71.0781      | -1.42109e-14     | 1/3 oct       |
| 19.652   | 75.0817      | 75.0817      | -1.42109e-14     | 1/3 oct       |
| 24.802   | 79.1251      | 79.1251      | 1.42109e-14      | 1/3 oct       |
| 31.301   | 83.091       | 83.091       | -1.42109e-14     | 1/3 oct       |
| 39.317   | 86.8121      | 86.8121      | 0                | 1/3 oct       |
| 49.62    | 90.2483      | 90.2483      | -2.84217e-14     | 1/3 oct       |
| 62.623   | 93.0097      | 93.0097      | 0                | 1/3 oct       |
| 78.66    | 94.8212      | 94.8212      | -1.42109e-14     | 1/3 oct       |
| 99.273   | 95.824       | 95.824       | -1.42109e-14     | 1/3 oct       |
| 125.29   | 96.2768      | 96.2768      | -1.42109e-14     | 1/3 oct       |
| 157.37   | 96.4563      | 96.4563      | 0                | 1/3 oct       |
| 198.61   | 96.5248      | 96.5248      | -1.42109e-14     | 1/3 oct       |
| 249.47   | 96.5476      | 96.5476      | -1.42109e-14     | 1/3 oct       |
| 314.85   | 96.5542      | 96.5542      | 0                | 1/3 oct       |
| 382.54   | 96.5552      | 96.5552      | 0                | WinISD max OpenISD max |
| 397.36   | 96.5551      | 96.5551      | -1.42109e-14     | 1/3 oct       |
| 499.11   | 96.5544      | 96.5544      | 0                | 1/3 oct       |
| 629.91   | 96.5535      | 96.5535      | 0                | 1/3 oct       |
| 794.98   | 96.5527      | 96.5527      | -1.42109e-14     | 1/3 oct       |
| 998.56   | 96.5521      | 96.5521      | 0                | 1/3 oct       |
| 1260.2   | 96.5517      | 96.5517      | -2.84217e-14     | 1/3 oct       |
| 1590.5   | 96.5515      | 96.5515      | 0                | 1/3 oct       |
| 1997.8   | 96.5513      | 96.5513      | 0                | 1/3 oct       |
| 2521.3   | 96.5512      | 96.5512      | -1.42109e-14     | 1/3 oct       |
| 3182.1   | 96.5511      | 96.5511      | -1.42109e-14     | 1/3 oct       |
| 3996.9   | 96.5511      | 96.5511      | 0                | 1/3 oct       |
| 5044.3   | 96.5511      | 96.5511      | 0                | 1/3 oct       |
| 6336.1   | 96.551       | 96.551       | 0                | 1/3 oct       |
| 7996.5   | 96.551       | 96.551       | 0                | 1/3 oct       |
| 10092    | 96.551       | 96.551       | -1.42109e-14     | 1/3 oct       |
| 12676    | 96.551       | 96.551       | 0                | 1/3 oct       |
| 15998    | 96.551       | 96.551       | 0                | 1/3 oct       |

#### SPL (dB) — PASS

Worst |OpenISD − WinISD| = 2.842e-14 dB at 55.876 Hz; tolerance 0.1 dB.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 2.89488      | 2.89488      | -8.88178e-15     | 1/3 oct       |
| 1.548    | 8.46885      | 8.46885      | -1.77636e-15     | 1/3 oct       |
| 1.9537   | 13.9983      | 13.9983      | -3.55271e-15     | 1/3 oct       |
| 2.4657   | 19.3269      | 19.3269      | -7.10543e-15     | 1/3 oct       |
| 3.0971   | 24.3267      | 24.3267      | -1.42109e-14     | 1/3 oct       |
| 3.9087   | 29.2008      | 29.2008      | 0                | 1/3 oct       |
| 4.9331   | 33.861       | 33.861       | -7.10543e-15     | 1/3 oct       |
| 6.1963   | 38.2521      | 38.2521      | 0                | 1/3 oct       |
| 7.8201   | 42.5974      | 42.5974      | 0                | 1/3 oct       |
| 9.8226   | 46.7561      | 46.7561      | -7.10543e-15     | 1/3 oct       |
| 12.397   | 50.9316      | 50.9316      | -7.10543e-15     | 1/3 oct       |
| 15.645   | 55.0575      | 55.0575      | -1.42109e-14     | 1/3 oct       |
| 19.652   | 59.0611      | 59.0611      | -1.42109e-14     | 1/3 oct       |
| 24.802   | 63.1045      | 63.1045      | 0                | 1/3 oct       |
| 31.301   | 67.0704      | 67.0704      | 0                | 1/3 oct       |
| 39.317   | 70.7915      | 70.7915      | 0                | 1/3 oct       |
| 49.62    | 74.2277      | 74.2277      | -1.42109e-14     | 1/3 oct       |
| 55.876   | 75.7416      | 75.7416      | -2.84217e-14     | worst         |
| 62.623   | 76.9891      | 76.9891      | 0                | 1/3 oct       |
| 78.66    | 78.8006      | 78.8006      | -1.42109e-14     | 1/3 oct       |
| 99.273   | 79.8034      | 79.8034      | -1.42109e-14     | 1/3 oct       |
| 125.29   | 80.2562      | 80.2562      | 0                | 1/3 oct       |
| 157.37   | 80.4357      | 80.4357      | 0                | 1/3 oct       |
| 198.61   | 80.5042      | 80.5042      | -1.42109e-14     | 1/3 oct       |
| 249.47   | 80.527       | 80.527       | 0                | 1/3 oct       |
| 314.85   | 80.5336      | 80.5336      | 0                | 1/3 oct       |
| 382.54   | 80.5346      | 80.5346      | 0                | WinISD max OpenISD max |
| 397.36   | 80.5345      | 80.5345      | 0                | 1/3 oct       |
| 499.11   | 80.5338      | 80.5338      | -2.84217e-14     | 1/3 oct       |
| 629.91   | 80.5329      | 80.5329      | -1.42109e-14     | 1/3 oct       |
| 794.98   | 80.5321      | 80.5321      | -1.42109e-14     | 1/3 oct       |
| 998.56   | 80.5315      | 80.5315      | 0                | 1/3 oct       |
| 1260.2   | 80.5311      | 80.5311      | 0                | 1/3 oct       |
| 1590.5   | 80.5309      | 80.5309      | 0                | 1/3 oct       |
| 1997.8   | 80.5307      | 80.5307      | -1.42109e-14     | 1/3 oct       |
| 2521.3   | 80.5306      | 80.5306      | 0                | 1/3 oct       |
| 3182.1   | 80.5305      | 80.5305      | -1.42109e-14     | 1/3 oct       |
| 3996.9   | 80.5305      | 80.5305      | 0                | 1/3 oct       |
| 5044.3   | 80.5305      | 80.5305      | 0                | 1/3 oct       |
| 6336.1   | 80.5304      | 80.5304      | 0                | 1/3 oct       |
| 7996.5   | 80.5304      | 80.5304      | 0                | 1/3 oct       |
| 10092    | 80.5304      | 80.5304      | -1.42109e-14     | 1/3 oct       |
| 12676    | 80.5304      | 80.5304      | 0                | 1/3 oct       |
| 15998    | 80.5304      | 80.5304      | -1.42109e-14     | 1/3 oct       |

#### Cone excursion (mm) — PASS

Worst |OpenISD − WinISD| = 2.665e-15 mm at 1.1809 Hz; tolerance 0.01 mm.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.1809   | 1.97469      | 1.97469      | -2.66454e-15     | worst         |
| 1.2324   | 1.96511      | 1.96511      | -1.33227e-15     | 1/3 oct       |
| 1.548    | 1.9027       | 1.9027       | -1.55431e-15     | 1/3 oct       |
| 1.9537   | 1.81736      | 1.81736      | -6.66134e-16     | 1/3 oct       |
| 2.4657   | 1.71041      | 1.71041      | -1.77636e-15     | 1/3 oct       |
| 3.0971   | 1.58981      | 1.58981      | -1.33227e-15     | 1/3 oct       |
| 3.9087   | 1.46054      | 1.46054      | -6.66134e-16     | 1/3 oct       |
| 4.9331   | 1.33707      | 1.33707      | -6.66134e-16     | 1/3 oct       |
| 6.1963   | 1.23139      | 1.23139      | -6.66134e-16     | 1/3 oct       |
| 7.8201   | 1.14432      | 1.14432      | -6.66134e-16     | 1/3 oct       |
| 9.8226   | 1.0799       | 1.0799       | -4.44089e-16     | 1/3 oct       |
| 12.397   | 1.03273      | 1.03273      | -6.66134e-16     | 1/3 oct       |
| 15.645   | 1.0001       | 1.0001       | -2.22045e-16     | 1/3 oct       |
| 19.652   | 0.977731     | 0.977731     | -4.44089e-16     | 1/3 oct       |
| 24.802   | 0.959731     | 0.959731     | -6.66134e-16     | 1/3 oct       |
| 31.301   | 0.939847     | 0.939847     | -6.66134e-16     | 1/3 oct       |
| 39.317   | 0.907379     | 0.907379     | -3.33067e-16     | 1/3 oct       |
| 49.62    | 0.841956     | 0.841956     | -7.77156e-16     | 1/3 oct       |
| 62.623   | 0.724167     | 0.724167     | -5.55112e-16     | 1/3 oct       |
| 78.66    | 0.564337     | 0.564337     | -3.33067e-16     | 1/3 oct       |
| 99.273   | 0.39717      | 0.39717      | -4.996e-16       | 1/3 oct       |
| 125.29   | 0.262489     | 0.262489     | -2.22045e-16     | 1/3 oct       |
| 157.37   | 0.169762     | 0.169762     | -3.05311e-16     | 1/3 oct       |
| 198.61   | 0.107392     | 0.107392     | 5.55112e-17      | 1/3 oct       |
| 249.47   | 0.0682326    | 0.0682326    | 4.16334e-17      | 1/3 oct       |
| 314.85   | 0.0428657    | 0.0428657    | -6.93889e-18     | 1/3 oct       |
| 397.36   | 0.0269131    | 0.0269131    | -2.42861e-17     | 1/3 oct       |
| 499.11   | 0.0170559    | 0.0170559    | 0                | 1/3 oct       |
| 629.91   | 0.0107067    | 0.0107067    | -1.73472e-17     | 1/3 oct       |
| 794.98   | 0.00672122   | 0.00672122   | 5.20417e-18      | 1/3 oct       |
| 998.56   | 0.00425972   | 0.00425972   | 8.67362e-19      | 1/3 oct       |
| 1260.2   | 0.00267423   | 0.00267423   | -4.33681e-19     | 1/3 oct       |
| 1590.5   | 0.0016789    | 0.0016789    | -1.51788e-18     | 1/3 oct       |
| 1997.8   | 0.0010641    | 0.0010641    | -8.67362e-19     | 1/3 oct       |
| 2521.3   | 0.000668063  | 0.000668063  | -8.67362e-19     | 1/3 oct       |
| 3182.1   | 0.000419425  | 0.000419425  | 1.0842e-19       | 1/3 oct       |
| 3996.9   | 0.000265839  | 0.000265839  | 5.42101e-20      | 1/3 oct       |
| 5044.3   | 0.000166901  | 0.000166901  | 0                | 1/3 oct       |
| 6336.1   | 0.000105785  | 0.000105785  | 0                | 1/3 oct       |
| 7996.5   | 6.64149e-05  | 6.64149e-05  | -4.06576e-20     | 1/3 oct       |
| 10092    | 4.16971e-05  | 4.16971e-05  | -4.06576e-20     | 1/3 oct       |
| 12676    | 2.64285e-05  | 2.64285e-05  | -3.04932e-20     | 1/3 oct       |
| 15998    | 1.65926e-05  | 1.65926e-05  | -2.03288e-20     | 1/3 oct       |

#### Impedance (ohm) — PASS

Worst |OpenISD − WinISD| = 2.842e-14 ohm at 69.853 Hz; tolerance 0.05 ohm.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 3.43137      | 3.43137      | -4.44089e-16     | 1/3 oct       |
| 1.548    | 3.44591      | 3.44591      | 4.44089e-16      | 1/3 oct       |
| 1.9537   | 3.4655       | 3.4655       | 0                | 1/3 oct       |
| 2.4657   | 3.48964      | 3.48964      | 0                | 1/3 oct       |
| 3.0971   | 3.51647      | 3.51647      | 0                | 1/3 oct       |
| 3.9087   | 3.54528      | 3.54528      | -4.44089e-16     | 1/3 oct       |
| 4.9331   | 3.57414      | 3.57414      | -4.44089e-16     | 1/3 oct       |
| 6.1963   | 3.60257      | 3.60257      | 0                | 1/3 oct       |
| 7.8201   | 3.63402      | 3.63402      | -4.44089e-16     | 1/3 oct       |
| 9.8226   | 3.67188      | 3.67188      | 0                | 1/3 oct       |
| 12.397   | 3.72594      | 3.72594      | -4.44089e-16     | 1/3 oct       |
| 15.645   | 3.80976      | 3.80976      | 4.44089e-16      | 1/3 oct       |
| 19.652   | 3.94592      | 3.94592      | -4.44089e-16     | 1/3 oct       |
| 24.802   | 4.19248      | 4.19248      | 8.88178e-16      | 1/3 oct       |
| 31.301   | 4.67129      | 4.67129      | -8.88178e-16     | 1/3 oct       |
| 39.317   | 5.70096      | 5.70096      | -1.77636e-15     | 1/3 oct       |
| 49.62    | 8.60595      | 8.60595      | 7.10543e-15      | 1/3 oct       |
| 62.623   | 17.8811      | 17.8811      | -3.55271e-15     | 1/3 oct       |
| 65.049   | 18.631       | 18.631       | -3.55271e-15     | WinISD max OpenISD max |
| 69.853   | 16.3628      | 16.3628      | -2.84217e-14     | worst         |
| 78.66    | 10.6904      | 10.6904      | -8.88178e-15     | 1/3 oct       |
| 99.273   | 6.11376      | 6.11376      | -4.44089e-15     | 1/3 oct       |
| 125.29   | 4.67187      | 4.67187      | -8.88178e-16     | 1/3 oct       |
| 157.37   | 4.08077      | 4.08077      | -1.77636e-15     | 1/3 oct       |
| 198.61   | 3.78475      | 3.78475      | 0                | 1/3 oct       |
| 249.47   | 3.62883      | 3.62883      | 8.88178e-16      | 1/3 oct       |
| 314.85   | 3.53796      | 3.53796      | -4.44089e-16     | 1/3 oct       |
| 397.36   | 3.48446      | 3.48446      | 4.44089e-16      | 1/3 oct       |
| 499.11   | 3.45271      | 3.45271      | 0                | 1/3 oct       |
| 629.91   | 3.43276      | 3.43276      | -4.44089e-16     | 1/3 oct       |
| 794.98   | 3.42044      | 3.42044      | 0                | 1/3 oct       |
| 998.56   | 3.41291      | 3.41291      | 4.44089e-16      | 1/3 oct       |
| 1260.2   | 3.40808      | 3.40808      | -4.44089e-16     | 1/3 oct       |
| 1590.5   | 3.40507      | 3.40507      | 0                | 1/3 oct       |
| 1997.8   | 3.40321      | 3.40321      | 0                | 1/3 oct       |
| 2521.3   | 3.40201      | 3.40201      | 0                | 1/3 oct       |
| 3182.1   | 3.40126      | 3.40126      | 0                | 1/3 oct       |
| 3996.9   | 3.4008       | 3.4008       | -4.44089e-16     | 1/3 oct       |
| 5044.3   | 3.4005       | 3.4005       | 4.44089e-16      | 1/3 oct       |
| 6336.1   | 3.40032      | 3.40032      | 0                | 1/3 oct       |
| 7996.5   | 3.4002       | 3.4002       | -4.44089e-16     | 1/3 oct       |
| 10092    | 3.40013      | 3.40013      | 0                | 1/3 oct       |
| 12676    | 3.40008      | 3.40008      | 0                | 1/3 oct       |
| 15998    | 3.40005      | 3.40005      | 4.44089e-16      | 1/3 oct       |

#### Impedance phase (deg) — PASS

Worst |OpenISD − WinISD| = 1.421e-13 deg at 64.434 Hz; tolerance 1.0 deg.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 2.38707      | 2.38707      | 0                | 1/3 oct       |
| 1.548    | 2.87881      | 2.87881      | 0                | 1/3 oct       |
| 1.9537   | 3.43287      | 3.43287      | 0                | 1/3 oct       |
| 2.4657   | 4.02827      | 4.02827      | 0                | 1/3 oct       |
| 3.0971   | 4.65116      | 4.65116      | 0                | 1/3 oct       |
| 3.9087   | 5.35192      | 5.35192      | 0                | 1/3 oct       |
| 4.9331   | 6.17449      | 6.17449      | 0                | 1/3 oct       |
| 6.1963   | 7.1783       | 7.1783       | 0                | 1/3 oct       |
| 7.8201   | 8.50301      | 8.50301      | 0                | 1/3 oct       |
| 9.8226   | 10.2011      | 10.2011      | 0                | 1/3 oct       |
| 12.397   | 12.4679      | 12.4679      | 0                | 1/3 oct       |
| 15.645   | 15.4251      | 15.4251      | 0                | 1/3 oct       |
| 19.652   | 19.1718      | 19.1718      | 0                | 1/3 oct       |
| 24.802   | 24.0767      | 24.0767      | 0                | 1/3 oct       |
| 31.301   | 30.223       | 30.223       | 0                | 1/3 oct       |
| 39.317   | 37.0389      | 37.0389      | 0                | 1/3 oct       |
| 48.456   | 41.062       | 41.062       | 0                | WinISD max OpenISD max |
| 49.62    | 40.9495      | 40.9495      | 0                | 1/3 oct       |
| 62.623   | 11.3944      | 11.3944      | -5.68434e-14     | 1/3 oct       |
| 64.434   | 1.53549      | 1.53549      | -1.42109e-13     | worst         |
| 78.66    | -42.7221     | -42.7221     | 0                | 1/3 oct       |
| 86.911   | -45.2587     | -45.2587     | 0                | WinISD min OpenISD min |
| 99.273   | -42.9362     | -42.9362     | 0                | 1/3 oct       |
| 125.29   | -35.2196     | -35.2196     | 0                | 1/3 oct       |
| 157.37   | -27.9971     | -27.9971     | 2.84217e-14      | 1/3 oct       |
| 198.61   | -22.0039     | -22.0039     | 0                | 1/3 oct       |
| 249.47   | -17.3875     | -17.3875     | 0                | 1/3 oct       |
| 314.85   | -13.6985     | -13.6985     | 0                | 1/3 oct       |
| 397.36   | -10.8114     | -10.8114     | 0                | 1/3 oct       |
| 499.11   | -8.58524     | -8.58524     | 0                | 1/3 oct       |
| 629.91   | -6.791       | -6.791       | 0                | 1/3 oct       |
| 794.98   | -5.37504     | -5.37504     | 0                | 1/3 oct       |
| 998.56   | -4.27632     | -4.27632     | 0                | 1/3 oct       |
| 1260.2   | -3.38687     | -3.38687     | 0                | 1/3 oct       |
| 1590.5   | -2.68287     | -2.68287     | 0                | 1/3 oct       |
| 1997.8   | -2.13554     | -2.13554     | 0                | 1/3 oct       |
| 2521.3   | -1.69192     | -1.69192     | 0                | 1/3 oct       |
| 3182.1   | -1.34051     | -1.34051     | 0                | 1/3 oct       |
| 3996.9   | -1.06717     | -1.06717     | 0                | 1/3 oct       |
| 5044.3   | -0.845558    | -0.845558    | 0                | 1/3 oct       |
| 6336.1   | -0.673162    | -0.673162    | 0                | 1/3 oct       |
| 7996.5   | -0.533378    | -0.533378    | 0                | 1/3 oct       |
| 10092    | -0.422623    | -0.422623    | 0                | 1/3 oct       |
| 12676    | -0.336461    | -0.336461    | 0                | 1/3 oct       |
| 15998    | -0.266596    | -0.266596    | 0                | 1/3 oct       |

#### Amplifier apparent load power (VA)

See §3.3: the chart routine returns Z for this chart; the VA is applied in the plot code.

### 3.1 Impedance vs Rg and "Rg is at driver side"

VCInd on, 1 Hz–20 kHz. For each Rg (0 and 10 Ω), one WinISD launch logs the impedance chart with
the checkbox off, then ticks it on the Advanced tab and logs the chart again. The option byte
(project+0x53) and Rg (project+0x38) are read back from memory at every point. On the OpenISD
side `Rs_ohm` and `rgAtDriverSide` are set to match: the `.wpr` import drops Rg
([BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options.md?html)).

| Rg (Ω) | Driver side | WinISD Z @1 Hz | @115.6 Hz | @20 kHz | OpenISD Z @1 Hz | @115.6 Hz | @20 kHz |
|--------|-------------|---------------:|----------:|--------:|----------------:|----------:|--------:|
| 0      | off         |         3.4217 |    4.8773 | 42.8481 |          3.4217 |    4.8773 | 42.8481 |
| 0      | on          |         3.4217 |    4.8773 | 42.8481 |          3.4217 |    4.8773 | 42.8481 |
| 10     | off         |         3.4217 |    4.8773 | 42.8481 |          3.4217 |    4.8773 | 42.8481 |
| 10     | on          |        13.4201 |   14.2476 | 44.7656 |         13.4201 |   14.2476 | 44.7656 |

Both programs agree on where Rg belongs: Z carries it only with the checkbox on, and then
Z = Z(off) + Rg at every point. All four records match to ≤ 4e-14 Ω and 1.5e-13°.

### 3.2 "Simulate voice coil inductance" on

Record
[sweep-w5-sealed-vcind1-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-vcind1-charts.json)
has SPL, impedance and TF magnitude, with OpenISD on `winisdGyrator`. All three match to
≤ 4e-14.

| f (Hz) | WinISD SPL off | WinISD SPL on | WinISD roll-off | OpenISD SPL off | OpenISD SPL on | OpenISD roll-off |
|--------|---------------:|--------------:|----------------:|----------------:|---------------:|-----------------:|
| 998.56 |         80.532 |        79.340 |          −1.191 |          80.532 |         79.340 |           −1.191 |
| 4996.7 |         80.530 |        69.977 |         −10.553 |          80.530 |         69.977 |          −10.553 |
| 20000  |         80.530 |        58.264 |         −22.266 |          80.530 |         58.264 |          −22.266 |

### 3.3 Amplifier apparent load power (VA)

Record
[sweep-w5-sealed-va-rg1](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-va-rg1/gdb.log)
(Rg 1 Ω, driver side off): the plotted value, logged at 0x46c05c in `f_46bd30` with its inputs.
VA = P·Re·|Hf|²/|Z + Rg| reproduces all 2087 points to 3e-16, and OpenISD's `va` matches WinISD's
to 1e-9 at 1, 65.36 and 20000 Hz (`winisdDriverModel.test.ts`). WinISD uses Re where the apparent
power has Re + Rg: [BUG_20260927_winisd-va-uses-re-not-re-plus-rg](http://localhost:8000/winisd/openisd/bugs/BUG_20260927_winisd-va-uses-re-not-re-plus-rg.md?html).

Record
[sweep-w5-sealed-va-rg1-driverside](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-va-rg1-driverside/gdb.log)
(Rg 1 Ω, driver side on): Z already holds Rg (4.4 Ω at 20 kHz) and WinISD adds Rg again, so VA =
1 W·3.4/|4.4 + 1| = 0.6296 there. Same formula, all 2087 points to 3e-16; OpenISD matches to 1e-9.

### 3.4 Sealed with a 4-filter chain

Record
[filt-chain-sealed-1](http://localhost:8000/winisd/winisd_research/runs/filt-chain-sealed-1/gdb.log):
W5 sealed with Linkwitz transform 67.234/0.49 → 25/0.6, Butterworth-4 highpass 18 Hz, parametric
EQ 45 Hz Q 3 −4 dB, raised cosine 120 Hz 0.5 oct +5 dB. Plotted values logged at 0x46c0f5 in
`f_46bd30`. Compared with `toys/chart_plot_compare.py`.

| Chart                     | Max difference |
|---------------------------|----------------|
| Transfer function mag     | 4.8e-14        |
| Transfer function phase   | 8e-13          |
| Group delay               | 0.00069 ms     |
| Maximum power             | 8.9e-14        |
| Maximum SPL               | 2.8e-14        |
| VA                        | 8.9e-14        |
| SPL                       | 4.3e-14        |
| Cone excursion            | 1e-14          |
| EQ/Filter magnitude       | 2.8e-14        |
| EQ/Filter phase           | 8e-13          |
| EQ/Filter group delay     | 0.00066 ms     |

Maximum SPL and Maximum power leave the filter chain out in WinISD; OpenISD included it until
[max-spl-and-max-power-include-the-filter-chain](http://localhost:8000/winisd/openisd/bugs/BUG_20260927_max-spl-and-max-power-include-the-filter-chain.md?html).
Each filter type alone: 33 captures, `packages/design/test/engine/filters-winisd.test.ts`.

---

## 4. Causes, all fixed on 2026-09-26

Each gap in the earlier refresh was one of these, found by solving WinISD's own complex output
for its circuit (`toys/w5_fresh_model_check.py`):

| Gap                                   | WinISD                                          | OpenISD before                  | Bug |
|---------------------------------------|-------------------------------------------------|---------------------------------|-----|
| SPL level, excursion                  | push from the entered BL                        | Qes-derived BL                  | [winisd-spl-level-uses-entered-bl](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_winisd-spl-level-uses-entered-bl.md?html) |
| SPL/phase near resonance, max curves  | absorption ωsc·Mas/Qa in series with Cab        | Qa/(ωCab) in parallel           | [winisd-box-absorption-is-series](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_winisd-box-absorption-is-series.md?html) |
| Impedance peak                        | motional term from the entered BL               | Qes-derived BL                  | [winisd-impedance-uses-entered-bl](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_winisd-impedance-uses-entered-bl.md?html) |
| TF magnitude, flat 0.507 dB           | 0 dB = ρ·Pg/(2π·Mas), entered BL, Re + Rg       | η₀ from Qes, Re                 | [winisd-tf-reference](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_winisd-tf-reference.md?html) |
| Max power +2.94 %, max SPL −0.126 dB  | power into Re + Rg                              | power into Re                   | [max-power-ignores-rg](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_max-power-ignores-rg.md?html) |
| Group delay 0.025 ms at 1 Hz          | slope at the point, f ± ((f + 1e-10) − f)       | grid difference, one-sided at the ends | [group-delay-grid-difference](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_group-delay-grid-difference.md?html) |

WinISD's box, exactly: Zbox = Ral ∥ (Raa + 1/(jωCab)), Ral = Ql/(ωsc·Cab), Raa = ωsc·Mas/Qa,
ωsc = 1/√(Mas·Cat); the radiated volume velocity is the cone's minus the leak's.

WinISD's group delay (chart 12 of `f_4618f0`, decompiled): gd = (φ(f−δ) − φ(f+δ))/(2π·2δ),
δ = (f + 1e-10) − f. One rounding step of a double phase, 2.2e-16 rad, over 4π·1e-10 is 1.77e-4 ms:
the staircase in its curve. OpenISD takes the slope at f·(1 ± 1e-6), which agrees with WinISD to
0.0005 ms, about 3 of those steps. Copying WinISD's 1e-10 step in double arithmetic agrees worse
(0.0018 ms, 207/2086 points bit-exact): the rounding noise cannot be reproduced.

---

## 6. Reproducing

The WinISD side is a debugger capture and does not change when OpenISD does. A refresh after a
calculation change is the OpenISD side plus the compare — no wine, about a minute:

```
cd /home/john/work/winisd/openisd
D=build/tmp/chartrefresh; mkdir -p $D; R=/home/john/work/winisd/winisd_research/runs
npx tsx scripts/research/w5-openisd-dump.ts $R/sweep-w5-sealed-baseline-charts/w5.wpr build/tmp/fs_1_20k.json $D/oid_base.json winisdDriverModel=true rgAtDriverSide=false
npx tsx scripts/research/w5-openisd-dump.ts $R/sweep-w5-sealed-vcind1-charts/w5.wpr build/tmp/fs_1_20k.json $D/oid_vcind1.json winisdDriverModel=true circuitModel=winisdGyrator rgAtDriverSide=false Rs_ohm=0.1
for rg in 0 10; do for side in off on; do
  s=false; [ $side = on ] && s=true
  npx tsx scripts/research/w5-openisd-dump.ts $R/sweep-w5-sealed-impedance-rg$rg-vcind1/w5.wpr build/tmp/fs_1_20k.json $D/oid_rg$rg-vcind1_$side.json winisdDriverModel=true circuitModel=winisdGyrator rgAtDriverSide=$s Rs_ohm=$rg.0
done; done
bash /home/john/work/winisd/winisd_research/toys/chart_refresh_records.sh $PWD/$D <scratch dir>
```

That rewrites every `runs/sweep-w5-sealed-*.json` record and its `.md`, validates each one, and
leaves the per-chart tables in `<scratch dir>/cmp*.md` — §3's body is `cmp.md` verbatim.

Capturing the WinISD side again (only needed when the WinISD-side settings change) is four wine
runs:

```
cd /home/john/work/winisd/winisd_research
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-baseline-charts VCInd=0 Rg=0.1
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-vcind1-charts VCInd=1 Rg=0.1 "charts=spl|impedance|tfmag"
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-impedance-rg0-vcind1 VCInd=1 Rg=0 charts=impedance toggleAfter=1
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-impedance-rg10-vcind1 VCInd=1 Rg=10 charts=impedance toggleAfter=1
```
