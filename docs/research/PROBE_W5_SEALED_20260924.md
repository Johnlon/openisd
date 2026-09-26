# Probe: W5-1138SMF sealed — every chart, WinISD vs OpenISD (2026-09-24, refreshed 2026-09-26)

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
- [sweep-w5-sealed-vcind1-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-vcind1-charts.json) — SPL, impedance, TF magnitude, VCInd on, Rg 0.1 Ω, driver side off
- [sweep-w5-sealed-impedance-rg0-vcind1-driverside-off](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg0-vcind1-driverside-off.json) — impedance, VCInd on, Rg 0 Ω, driver side off
- [sweep-w5-sealed-impedance-rg0-vcind1-driverside-on](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg0-vcind1-driverside-on.json) — impedance, VCInd on, Rg 0 Ω, driver side on
- [sweep-w5-sealed-impedance-rg10-vcind1-driverside-off](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1-driverside-off.json) — impedance, VCInd on, Rg 10 Ω, driver side off
- [sweep-w5-sealed-impedance-rg10-vcind1-driverside-on](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-impedance-rg10-vcind1-driverside-on.json) — impedance, VCInd on, Rg 10 Ω, driver side on

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
| Driver mass derivation         | —                                              | `advanced.useWinisdDriverModel` = true                | no-counterpart | WinISD has no switch: it simulates from Fs, Vas, Qes, Qms (Cms from Vas, Mms from Fs and Cms, Rms from Qms). OpenISD 'Use WinISD driver calculations' on replaces Mms from the entered Cms and keeps the entered Rms and BL, so this row is a known difference (PROBE_W5_SEALED_20260924.md section 4.2) |
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

## 2. The inputs are mutually inconsistent, and the two programs resolve that differently

The entered parameter set does not satisfy its own identities:

| Identity                   | Implied value | Entered value | Disagreement |
|----------------------------|---------------|---------------|--------------|
| Fs = 1/(2π√(Mms·Cms))      | 48.831 Hz     | 45 Hz         | +8.5 %       |
| Vas = ρc²Sd²·Cms           | 4.622 L       | 4.85 L        | −4.7 %       |
| Mms = ρc²Sd²/((2πFs)²·Vas) | 0.032328 kg   | 0.02881 kg    | +12.2 %      |
| Rms = 2πFs·Mms/Qms         | 2.56753       | 2.28816       | +12.2 %      |

Which half each program simulates:

- **WinISD** builds its circuit from Fs, Vas, Qes, Qms, Sd, Re (and BL for the inductance
  element only): Cms from Vas, Mms from Fs and Cms, Rms from Qms.
- **OpenISD** with "Use WinISD driver calculations" on replaces Mms by 1/((2πFs)²·Cms), using
  the **entered** Cms. It keeps the entered Rms and BL
  ([BUG_20260926_winisd-driver-mode-substitutes-mms-only](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_winisd-driver-mode-substitutes-mms-only.md?html)).

What that predicts, checked against §3:

| Quantity      | WinISD set                   | OpenISD set                   | Predicted      | Measured (§3)                 |
|---------------|------------------------------|-------------------------------|----------------|-------------------------------|
| Fc            | 45·√(1+4.85/4.48) = 64.94 Hz | 45·√(1+4.622/4.48) = 64.07 Hz | —              | Z peak 65.05 / 64.13 Hz       |
| Passband SPL  | Mms 0.032328 kg              | Mms 0.033926 kg               | −0.42 dB       | −0.40 dB (80.531 / 80.133 dB) |
| Z peak height | Rms 2.568 (from Qms)         | Rms 2.288 (entered)           | OpenISD higher | 18.631 / 20.388 Ω             |

---

## 3. Chart-by-chart

Verdict: PASS when the worst |OpenISD − WinISD| over all 2086 points is within the tolerance
shown. Tolerances: 0.1 dB, 1°, 0.05 ms, 0.4 W (1 % of Pe), 0.01 mm, 0.05 Ω. Each table has a
row at every 1/3-octave centre, plus a row for every local maximum or minimum, step and phase
wrap the dense scan finds on either curve, plus the worst row. Dense arrays: in the records
above.

| Chart                              | Unit | Worst \|OpenISD − WinISD\| | At (Hz) | Tolerance | Verdict |
|------------------------------------|------|----------------------------|---------|-----------|---------|
| Transfer function magnitude        | dB   | 0.9093                     | 20000   | 0.1       | FAIL    |
| Transfer function phase            | deg  | 3.737                      | 112.86  | 1.0       | FAIL    |
| Group delay                        | ms   | 1.249                      | 1       | 0.05      | FAIL    |
| Maximum power                      | W    | 3.5                        | 3.4383  | 0.4       | FAIL    |
| Maximum SPL                        | dB   | 0.5281                     | 20000   | 0.1       | FAIL    |
| SPL                                | dB   | 0.5978                     | 62.031  | 0.1       | FAIL    |
| Cone excursion                     | mm   | 0.08943                    | 1       | 0.01      | FAIL    |
| Impedance                          | ohm  | 2                          | 62.623  | 0.05      | FAIL    |
| Impedance phase                    | deg  | 6.625                      | 68.213  | 1.0       | FAIL    |
| Amplifier apparent load power (VA) | VA   | values not captured        | —       | —         | —       |

How each WinISD value is read from the logged complex `out` (chart byte in brackets). Each
mapping is checked against the curve drawn in the screenshot:

| Chart                              | WinISD value                                                                                                    |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| Transfer function magnitude        | 20·log10\|out\| [0]                                                                                             |
| Transfer function phase            | arg(out) [0]                                                                                                    |
| Group delay                        | Re(out) s → ms [12]                                                                                             |
| Maximum power                      | Re(out) W [11]                                                                                                  |
| Maximum SPL                        | 20·log10\|out\| [14]                                                                                            |
| SPL                                | 20·log10\|out\| [13]                                                                                            |
| Cone excursion                     | √2·\|out\| m → mm [8]. The logged value is RMS; the curve drawn is √2 × that (peak), and so is OpenISD's `exc`. |
| Impedance                          | \|out\| [10]                                                                                                    |
| Impedance phase                    | arg(out) [10]                                                                                                   |
| Amplifier apparent load power (VA) | values not captured: the routine returns Z [10] and the VA drawn from it is not established                     |

#### Transfer function magnitude (dB) — FAIL

Worst |OpenISD − WinISD| = 0.9093 dB at 20000 Hz; tolerance 0.1 dB.

| f (Hz) | WinISD     | OpenISD   | OpenISD − WinISD | row         |
|--------|------------|-----------|------------------|-------------|
| 1.2324 | -77.6522   | -78.4561  | -0.803839        | 1/3 oct     |
| 1.548  | -72.0783   | -72.8715  | -0.793265        | 1/3 oct     |
| 1.9537 | -66.5488   | -67.3271  | -0.778286        | 1/3 oct     |
| 2.4657 | -61.2202   | -61.9794  | -0.759234        | 1/3 oct     |
| 3.0971 | -56.2204   | -56.9582  | -0.737732        | 1/3 oct     |
| 3.9087 | -51.3463   | -52.061   | -0.71472         | 1/3 oct     |
| 4.9331 | -46.6861   | -47.3785  | -0.692369        | 1/3 oct     |
| 6.1963 | -42.295    | -42.9669  | -0.67186         | 1/3 oct     |
| 7.8201 | -37.9497   | -38.6015  | -0.651752        | 1/3 oct     |
| 9.8226 | -33.791    | -34.422   | -0.630977        | 1/3 oct     |
| 12.397 | -29.6155   | -30.2209  | -0.605385        | 1/3 oct     |
| 15.645 | -25.4896   | -26.06    | -0.570392        | 1/3 oct     |
| 19.652 | -21.486    | -22.0059  | -0.519973        | 1/3 oct     |
| 24.802 | -17.4426   | -17.8846  | -0.441919        | 1/3 oct     |
| 31.301 | -13.4767   | -13.8015  | -0.324788        | 1/3 oct     |
| 39.317 | -9.75556   | -9.92235  | -0.166792        | 1/3 oct     |
| 49.62  | -6.3194    | -6.31153  | 0.00786797       | 1/3 oct     |
| 62.623 | -3.55804   | -3.46751  | 0.0905309        | 1/3 oct     |
| 78.66  | -1.74649   | -1.76205  | -0.0155629       | 1/3 oct     |
| 99.273 | -0.743651  | -0.992191 | -0.24854         | 1/3 oct     |
| 125.29 | -0.29091   | -0.763217 | -0.472307        | 1/3 oct     |
| 145.86 | -0.153653  | -0.73845  | -0.584796        | OpenISD max |
| 157.37 | -0.11141   | -0.742143 | -0.630733        | 1/3 oct     |
| 198.61 | -0.0429113 | -0.778856 | -0.735945        | 1/3 oct     |
| 249.47 | -0.0201204 | -0.820818 | -0.800697        | 1/3 oct     |
| 314.85 | -0.0134907 | -0.8554   | -0.84191         | 1/3 oct     |
| 382.54 | -0.0125491 | -0.876629 | -0.864079        | WinISD max  |
| 397.36 | -0.0125712 | -0.880037 | -0.867466        | 1/3 oct     |
| 499.11 | -0.0132543 | -0.89634  | -0.883085        | 1/3 oct     |
| 629.91 | -0.0142001 | -0.907254 | -0.893054        | 1/3 oct     |
| 794.98 | -0.0149964 | -0.914253 | -0.899256        | 1/3 oct     |
| 998.56 | -0.0155662 | -0.918618 | -0.903052        | 1/3 oct     |
| 1260.2 | -0.0159648 | -0.921436 | -0.905471        | 1/3 oct     |
| 1590.5 | -0.0162276 | -0.923198 | -0.90697         | 1/3 oct     |
| 1997.8 | -0.0163949 | -0.924276 | -0.907881        | 1/3 oct     |
| 2521.3 | -0.0165045 | -0.924961 | -0.908456        | 1/3 oct     |
| 3182.1 | -0.0165742 | -0.925382 | -0.908808        | 1/3 oct     |
| 3996.9 | -0.0166175 | -0.925635 | -0.909017        | 1/3 oct     |
| 5044.3 | -0.0166456 | -0.925792 | -0.909147        | 1/3 oct     |
| 6336.1 | -0.0166629 | -0.925885 | -0.909222        | 1/3 oct     |
| 7996.5 | -0.0166742 | -0.925941 | -0.909267        | 1/3 oct     |
| 10092  | -0.0166812 | -0.925973 | -0.909292        | 1/3 oct     |
| 12676  | -0.0166856 | -0.92599  | -0.909305        | 1/3 oct     |
| 15998  | -0.0166884 | -0.926    | -0.909311        | 1/3 oct     |
| 20000  | -0.0166901 | -0.926004 | -0.909314        | worst       |

#### Transfer function phase (deg) — FAIL

Worst |OpenISD − WinISD| = 3.737 deg at 112.86 Hz; tolerance 1.0 deg.

| f (Hz) | WinISD   | OpenISD  | OpenISD − WinISD | row          |
|--------|----------|----------|------------------|--------------|
| 1.2324 | -114.461 | -114.437 | 0.0238436        | 1/3 oct      |
| 1.548  | -119.901 | -119.761 | 0.139935         | 1/3 oct      |
| 1.9537 | -126.253 | -125.991 | 0.261565         | 1/3 oct      |
| 2.4657 | -133.263 | -132.887 | 0.376576         | 1/3 oct      |
| 3.0971 | -140.523 | -140.048 | 0.474852         | 1/3 oct      |
| 3.9087 | -148.034 | -147.476 | 0.558763         | 1/3 oct      |
| 4.9331 | -155.38  | -154.747 | 0.633166         | 1/3 oct      |
| 6.1963 | -162.262 | -161.552 | 0.710153         | 1/3 oct      |
| 7.8201 | -168.948 | -168.139 | 0.808675         | 1/3 oct      |
| 9.8226 | -175.268 | -174.329 | 0.938389         | 1/3 oct      |
| 11.654 | -179.976 | -178.912 | 1.06325          | WinISD wrap  |
| 11.71  | 179.893  | -179.04  | 1.06708          | WinISD max   |
| 12.106 | 178.97   | -179.936 | 1.0945           | OpenISD wrap |
| 12.163 | 178.837  | 179.936  | 1.09849          | OpenISD max  |
| 12.397 | 178.308  | 179.422  | 1.11468          | 1/3 oct      |
| 15.645 | 171.615  | 172.953  | 1.33853          | 1/3 oct      |
| 19.652 | 164.429  | 166.023  | 1.59418          | 1/3 oct      |
| 24.802 | 155.96   | 157.812  | 1.85294          | 1/3 oct      |
| 31.301 | 145.705  | 147.709  | 2.00344          | 1/3 oct      |
| 39.317 | 133.185  | 135.004  | 1.81938          | 1/3 oct      |
| 49.62  | 117.259  | 118.185  | 0.925801         | 1/3 oct      |
| 62.623 | 98.4891  | 97.6659  | -0.823241        | 1/3 oct      |
| 78.66  | 79.351   | 76.709   | -2.64193         | 1/3 oct      |
| 99.273 | 61.8028  | 58.1818  | -3.62103         | 1/3 oct      |
| 112.86 | 53.5852  | 49.848   | -3.73714         | worst        |
| 125.29 | 47.6908  | 44.0126  | -3.67818         | 1/3 oct      |
| 157.37 | 37.0832  | 33.7933  | -3.28982         | 1/3 oct      |
| 198.61 | 28.8516  | 26.083   | -2.7686          | 1/3 oct      |
| 249.47 | 22.685   | 20.4097  | -2.27529         | 1/3 oct      |
| 314.85 | 17.8223  | 15.9859  | -1.83645         | 1/3 oct      |
| 397.36 | 14.0438  | 12.5726  | -1.47115         | 1/3 oct      |
| 499.11 | 11.1418  | 9.96275  | -1.17901         | 1/3 oct      |
| 629.91 | 8.80819  | 7.86997  | -0.938219        | 1/3 oct      |
| 794.98 | 6.96919  | 6.22372  | -0.745473        | 1/3 oct      |
| 998.56 | 5.54342  | 4.94886  | -0.594561        | 1/3 oct      |
| 1260.2 | 4.38983  | 3.91815  | -0.471687        | 1/3 oct      |
| 1590.5 | 3.47705  | 3.10299  | -0.374058        | 1/3 oct      |
| 1997.8 | 2.76756  | 2.46959  | -0.297968        | 1/3 oct      |
| 2521.3 | 2.19258  | 1.95638  | -0.236193        | 1/3 oct      |
| 3182.1 | 1.73714  | 1.54994  | -0.187203        | 1/3 oct      |
| 3996.9 | 1.38291  | 1.23384  | -0.149069        | 1/3 oct      |
| 5044.3 | 1.09572  | 0.977587 | -0.118134        | 1/3 oct      |
| 6336.1 | 0.872315 | 0.778255 | -0.09406         | 1/3 oct      |
| 7996.5 | 0.691175 | 0.616639 | -0.0745353       | 1/3 oct      |
| 10092  | 0.547652 | 0.48859  | -0.0590623       | 1/3 oct      |
| 12676  | 0.435999 | 0.388976 | -0.0470235       | 1/3 oct      |
| 15998  | 0.345466 | 0.308205 | -0.0372607       | 1/3 oct      |

#### Group delay (ms) — FAIL

Worst |OpenISD − WinISD| = 1.249 ms at 1 Hz; tolerance 0.05 ms.

WinISD: 189 extrema/steps each smaller than 0.5 % of the chart's range between 34.1 and 1.981e+04 Hz (a staircase in the curve), not listed row by row.

| f (Hz) | WinISD      | OpenISD     | OpenISD − WinISD | row         |
|--------|-------------|-------------|------------------|-------------|
| 1      | 52.2964     | 51.0473     | -1.2491          | worst       |
| 1.2324 | 49.741      | 48.6346     | -1.10643         | 1/3 oct     |
| 1.548  | 45.9774     | 45.0402     | -0.93723         | 1/3 oct     |
| 1.9537 | 41.0281     | 40.2947     | -0.733369        | 1/3 oct     |
| 2.4657 | 35.1458     | 34.6204     | -0.525399        | 1/3 oct     |
| 3.0971 | 28.9423     | 28.5883     | -0.354055        | 1/3 oct     |
| 3.9087 | 22.7972     | 22.561      | -0.236177        | 1/3 oct     |
| 4.9331 | 17.4164     | 17.2375     | -0.178881        | 1/3 oct     |
| 6.1963 | 13.1926     | 13.0271     | -0.165479        | 1/3 oct     |
| 7.8201 | 9.98199     | 9.80854     | -0.173458        | 1/3 oct     |
| 9.8226 | 7.77204     | 7.58622     | -0.185816        | 1/3 oct     |
| 12.397 | 6.25986     | 6.0672      | -0.192659        | 1/3 oct     |
| 15.645 | 5.29916     | 5.11161     | -0.187552        | 1/3 oct     |
| 19.652 | 4.73982     | 4.57574     | -0.164079        | 1/3 oct     |
| 24.802 | 4.44685     | 4.33578     | -0.111064        | 1/3 oct     |
| 27.797 | 4.37917     | 4.30968     | -0.0694926       | OpenISD min |
| 31.301 | 4.34683     | 4.33475     | -0.0120876       | 1/3 oct     |
| 39.317 | 4.33361     | 4.47693     | 0.143329         | 1/3 oct     |
| 47.094 | 4.26743     | 4.55643     | 0.288998         | OpenISD max |
| 49.62  | 4.21889     | 4.54512     | 0.326229         | 1/3 oct     |
| 62.623 | 3.74179     | 4.12349     | 0.381702         | 1/3 oct     |
| 78.66  | 2.87495     | 3.10529     | 0.230338         | 1/3 oct     |
| 99.273 | 1.91254     | 1.96663     | 0.0540916        | 1/3 oct     |
| 125.29 | 1.17714     | 1.15365     | -0.0234918       | 1/3 oct     |
| 157.37 | 0.714565    | 0.677036    | -0.0375293       | 1/3 oct     |
| 198.61 | 0.429958    | 0.398422    | -0.0315366       | 1/3 oct     |
| 249.47 | 0.264019    | 0.241165    | -0.022854        | 1/3 oct     |
| 314.85 | 0.161698    | 0.146619    | -0.0150794       | 1/3 oct     |
| 397.36 | 0.100023    | 0.0901187   | -0.00990454      | 1/3 oct     |
| 499.11 | 0.0627354   | 0.0563513   | -0.00638406      | 1/3 oct     |
| 629.91 | 0.0392094   | 0.0350651   | -0.00414429      | 1/3 oct     |
| 794.98 | 0.02455     | 0.02189     | -0.00266002      | 1/3 oct     |
| 998.56 | 0.0155425   | 0.013825    | -0.00171745      | 1/3 oct     |
| 1260.2 | 0.00989067  | 0.00865959  | -0.00123108      | 1/3 oct     |
| 1590.5 | 0.00600505  | 0.0054287   | -0.000576352     | 1/3 oct     |
| 1997.8 | 0.00388562  | 0.00343763  | -0.000447989     | 1/3 oct     |
| 2521.3 | 0.00229605  | 0.00215693  | -0.000139118     | 1/3 oct     |
| 3182.1 | 0.00176619  | 0.00135365  | -0.000412537     | 1/3 oct     |
| 3996.9 | 0.00105971  | 0.000857762 | -0.000201952     | 1/3 oct     |
| 5044.3 | 0.000529857 | 0.000538439 | 8.58197e-06      | 1/3 oct     |
| 6336.1 | 0.000176619 | 0.000341238 | 0.000164619      | 1/3 oct     |
| 7996.5 | 0.000176619 | 0.000214224 | 3.76049e-05      | 1/3 oct     |
| 10092  | 0.000176619 | 0.00013449  | -4.21295e-05     | 1/3 oct     |
| 12676  | 0           | 8.52397e-05 | 8.52397e-05      | 1/3 oct     |
| 15998  | 0.000176619 | 5.35148e-05 | -0.000123104     | 1/3 oct     |

#### Maximum power (W) — FAIL

Worst |OpenISD − WinISD| = 3.5 W at 3.4383 Hz; tolerance 0.4 W.

| f (Hz) | WinISD  | OpenISD | OpenISD − WinISD | row     |
|--------|---------|---------|------------------|---------|
| 1.2324 | 22.1569 | 24.9258 | 2.76885          | 1/3 oct |
| 1.548  | 23.6344 | 26.4899 | 2.85551          | 1/3 oct |
| 1.9537 | 25.9061 | 28.889  | 2.98286          | 1/3 oct |
| 2.4657 | 29.2472 | 32.406  | 3.15888          | 1/3 oct |
| 3.0971 | 33.8527 | 37.2348 | 3.38216          | 1/3 oct |
| 3.4383 | 36.464  | 39.9636 | 3.49966          | worst   |
| 3.9087 | 40      | 40      | 0                | 1/3 oct |
| 4.9331 | 40      | 40      | 0                | 1/3 oct |
| 6.1963 | 40      | 40      | 0                | 1/3 oct |
| 7.8201 | 40      | 40      | 0                | 1/3 oct |
| 9.8226 | 40      | 40      | 0                | 1/3 oct |
| 12.397 | 40      | 40      | 0                | 1/3 oct |
| 15.645 | 40      | 40      | 0                | 1/3 oct |
| 19.652 | 40      | 40      | 0                | 1/3 oct |
| 24.802 | 40      | 40      | 0                | 1/3 oct |
| 31.301 | 40      | 40      | 0                | 1/3 oct |
| 39.317 | 40      | 40      | 0                | 1/3 oct |
| 49.62  | 40      | 40      | 0                | 1/3 oct |
| 62.623 | 40      | 40      | 0                | 1/3 oct |
| 78.66  | 40      | 40      | 0                | 1/3 oct |
| 99.273 | 40      | 40      | 0                | 1/3 oct |
| 125.29 | 40      | 40      | 0                | 1/3 oct |
| 157.37 | 40      | 40      | 0                | 1/3 oct |
| 198.61 | 40      | 40      | 0                | 1/3 oct |
| 249.47 | 40      | 40      | 0                | 1/3 oct |
| 314.85 | 40      | 40      | 0                | 1/3 oct |
| 397.36 | 40      | 40      | 0                | 1/3 oct |
| 499.11 | 40      | 40      | 0                | 1/3 oct |
| 629.91 | 40      | 40      | 0                | 1/3 oct |
| 794.98 | 40      | 40      | 0                | 1/3 oct |
| 998.56 | 40      | 40      | 0                | 1/3 oct |
| 1260.2 | 40      | 40      | 0                | 1/3 oct |
| 1590.5 | 40      | 40      | 0                | 1/3 oct |
| 1997.8 | 40      | 40      | 0                | 1/3 oct |
| 2521.3 | 40      | 40      | 0                | 1/3 oct |
| 3182.1 | 40      | 40      | 0                | 1/3 oct |
| 3996.9 | 40      | 40      | 0                | 1/3 oct |
| 5044.3 | 40      | 40      | 0                | 1/3 oct |
| 6336.1 | 40      | 40      | 0                | 1/3 oct |
| 7996.5 | 40      | 40      | 0                | 1/3 oct |
| 10092  | 40      | 40      | 0                | 1/3 oct |
| 12676  | 40      | 40      | 0                | 1/3 oct |
| 15998  | 40      | 40      | 0                | 1/3 oct |

#### Maximum SPL (dB) — FAIL

Worst |OpenISD − WinISD| = 0.5281 dB at 20000 Hz; tolerance 0.1 dB.

| f (Hz) | WinISD  | OpenISD | OpenISD − WinISD | row         |
|--------|---------|---------|------------------|-------------|
| 1.2324 | 16.35   | 16.4387 | 0.0887635        | 1/3 oct     |
| 1.548  | 22.2043 | 22.2876 | 0.0833056        | 1/3 oct     |
| 1.9537 | 28.1323 | 28.2085 | 0.0762232        | 1/3 oct     |
| 2.4657 | 33.9878 | 34.0552 | 0.0673994        | 1/3 oct     |
| 3.0971 | 39.6226 | 39.6796 | 0.0570438        | 1/3 oct     |
| 3.9087 | 45.2214 | 44.8879 | -0.333509        | 1/3 oct     |
| 4.9331 | 49.8816 | 49.5704 | -0.311158        | 1/3 oct     |
| 6.1963 | 54.2727 | 53.982  | -0.290649        | 1/3 oct     |
| 7.8201 | 58.618  | 58.3475 | -0.270541        | 1/3 oct     |
| 9.8226 | 62.7767 | 62.5269 | -0.249766        | 1/3 oct     |
| 12.397 | 66.9522 | 66.728  | -0.224174        | 1/3 oct     |
| 15.645 | 71.0781 | 70.8889 | -0.189181        | 1/3 oct     |
| 19.652 | 75.0817 | 74.943  | -0.138762        | 1/3 oct     |
| 24.802 | 79.1251 | 79.0644 | -0.060708        | 1/3 oct     |
| 31.301 | 83.091  | 83.1474 | 0.0564232        | 1/3 oct     |
| 39.317 | 86.8121 | 87.0266 | 0.21442          | 1/3 oct     |
| 49.62  | 90.2483 | 90.6374 | 0.389079         | 1/3 oct     |
| 62.623 | 93.0097 | 93.4814 | 0.471742         | 1/3 oct     |
| 78.66  | 94.8212 | 95.1869 | 0.365648         | 1/3 oct     |
| 99.273 | 95.824  | 95.9567 | 0.132671         | 1/3 oct     |
| 125.29 | 96.2768 | 96.1857 | -0.0910958       | 1/3 oct     |
| 145.86 | 96.414  | 96.2105 | -0.203585        | OpenISD max |
| 157.37 | 96.4563 | 96.2068 | -0.249522        | 1/3 oct     |
| 198.61 | 96.5248 | 96.1701 | -0.354734        | 1/3 oct     |
| 249.47 | 96.5476 | 96.1281 | -0.419486        | 1/3 oct     |
| 314.85 | 96.5542 | 96.0935 | -0.460699        | 1/3 oct     |
| 382.54 | 96.5552 | 96.0723 | -0.482868        | WinISD max  |
| 397.36 | 96.5551 | 96.0689 | -0.486255        | 1/3 oct     |
| 499.11 | 96.5544 | 96.0526 | -0.501874        | 1/3 oct     |
| 629.91 | 96.5535 | 96.0417 | -0.511843        | 1/3 oct     |
| 794.98 | 96.5527 | 96.0347 | -0.518045        | 1/3 oct     |
| 998.56 | 96.5521 | 96.0303 | -0.521841        | 1/3 oct     |
| 1260.2 | 96.5517 | 96.0275 | -0.52426         | 1/3 oct     |
| 1590.5 | 96.5515 | 96.0257 | -0.525759        | 1/3 oct     |
| 1997.8 | 96.5513 | 96.0246 | -0.52667         | 1/3 oct     |
| 2521.3 | 96.5512 | 96.024  | -0.527245        | 1/3 oct     |
| 3182.1 | 96.5511 | 96.0235 | -0.527596        | 1/3 oct     |
| 3996.9 | 96.5511 | 96.0233 | -0.527806        | 1/3 oct     |
| 5044.3 | 96.5511 | 96.0231 | -0.527935        | 1/3 oct     |
| 6336.1 | 96.551  | 96.023  | -0.528011        | 1/3 oct     |
| 7996.5 | 96.551  | 96.023  | -0.528055        | 1/3 oct     |
| 10092  | 96.551  | 96.0229 | -0.52808         | 1/3 oct     |
| 12676  | 96.551  | 96.0229 | -0.528094        | 1/3 oct     |
| 15998  | 96.551  | 96.0229 | -0.5281          | 1/3 oct     |
| 20000  | 96.551  | 96.0229 | -0.528103        | worst       |

#### SPL (dB) — FAIL

Worst |OpenISD − WinISD| = 0.5978 dB at 62.031 Hz; tolerance 0.1 dB.

| f (Hz) | WinISD  | OpenISD | OpenISD − WinISD | row         |
|--------|---------|---------|------------------|-------------|
| 1.2324 | 2.89488 | 2.59814 | -0.296737        | 1/3 oct     |
| 1.548  | 8.46885 | 8.18269 | -0.286162        | 1/3 oct     |
| 1.9537 | 13.9983 | 13.7271 | -0.271184        | 1/3 oct     |
| 2.4657 | 19.3269 | 19.0748 | -0.252131        | 1/3 oct     |
| 3.0971 | 24.3267 | 24.096  | -0.230629        | 1/3 oct     |
| 3.9087 | 29.2008 | 28.9932 | -0.207618        | 1/3 oct     |
| 4.9331 | 33.861  | 33.6757 | -0.185266        | 1/3 oct     |
| 6.1963 | 38.2521 | 38.0873 | -0.164758        | 1/3 oct     |
| 7.8201 | 42.5974 | 42.4528 | -0.144649        | 1/3 oct     |
| 9.8226 | 46.7561 | 46.6322 | -0.123875        | 1/3 oct     |
| 12.397 | 50.9316 | 50.8333 | -0.0982827       | 1/3 oct     |
| 15.645 | 55.0575 | 54.9942 | -0.06329         | 1/3 oct     |
| 19.652 | 59.0611 | 59.0483 | -0.0128707       | 1/3 oct     |
| 24.802 | 63.1045 | 63.1696 | 0.0651833        | 1/3 oct     |
| 31.301 | 67.0704 | 67.2527 | 0.182314         | 1/3 oct     |
| 39.317 | 70.7915 | 71.1318 | 0.340311         | 1/3 oct     |
| 49.62  | 74.2277 | 74.7427 | 0.51497          | 1/3 oct     |
| 62.031 | 76.8936 | 77.4914 | 0.597797         | worst       |
| 62.623 | 76.9891 | 77.5867 | 0.597633         | 1/3 oct     |
| 78.66  | 78.8006 | 79.2922 | 0.49154          | 1/3 oct     |
| 99.273 | 79.8034 | 80.062  | 0.258562         | 1/3 oct     |
| 125.29 | 80.2562 | 80.291  | 0.0347954        | 1/3 oct     |
| 145.86 | 80.3934 | 80.3158 | -0.0776938       | OpenISD max |
| 157.37 | 80.4357 | 80.3121 | -0.123631        | 1/3 oct     |
| 198.61 | 80.5042 | 80.2753 | -0.228843        | 1/3 oct     |
| 249.47 | 80.527  | 80.2334 | -0.293595        | 1/3 oct     |
| 314.85 | 80.5336 | 80.1988 | -0.334807        | 1/3 oct     |
| 382.54 | 80.5346 | 80.1776 | -0.356977        | WinISD max  |
| 397.36 | 80.5345 | 80.1742 | -0.360364        | 1/3 oct     |
| 499.11 | 80.5338 | 80.1579 | -0.375983        | 1/3 oct     |
| 629.91 | 80.5329 | 80.1469 | -0.385951        | 1/3 oct     |
| 794.98 | 80.5321 | 80.1399 | -0.392154        | 1/3 oct     |
| 998.56 | 80.5315 | 80.1356 | -0.395949        | 1/3 oct     |
| 1260.2 | 80.5311 | 80.1328 | -0.398368        | 1/3 oct     |
| 1590.5 | 80.5309 | 80.131  | -0.399868        | 1/3 oct     |
| 1997.8 | 80.5307 | 80.1299 | -0.400779        | 1/3 oct     |
| 2521.3 | 80.5306 | 80.1292 | -0.401354        | 1/3 oct     |
| 3182.1 | 80.5305 | 80.1288 | -0.401705        | 1/3 oct     |
| 3996.9 | 80.5305 | 80.1286 | -0.401915        | 1/3 oct     |
| 5044.3 | 80.5305 | 80.1284 | -0.402044        | 1/3 oct     |
| 6336.1 | 80.5304 | 80.1283 | -0.402119        | 1/3 oct     |
| 7996.5 | 80.5304 | 80.1283 | -0.402164        | 1/3 oct     |
| 10092  | 80.5304 | 80.1282 | -0.402189        | 1/3 oct     |
| 12676  | 80.5304 | 80.1282 | -0.402202        | 1/3 oct     |
| 15998  | 80.5304 | 80.1282 | -0.402209        | 1/3 oct     |

#### Cone excursion (mm) — FAIL

Worst |OpenISD − WinISD| = 0.08943 mm at 1 Hz; tolerance 0.01 mm.

| f (Hz) | WinISD      | OpenISD     | OpenISD − WinISD | row     |
|--------|-------------|-------------|------------------|---------|
| 1      | 2.00638     | 1.91695     | -0.0894281       | worst   |
| 1.2324 | 1.96511     | 1.8798      | -0.0853092       | 1/3 oct |
| 1.548  | 1.9027      | 1.82346     | -0.079237        | 1/3 oct |
| 1.9537 | 1.81736     | 1.7461      | -0.0712539       | 1/3 oct |
| 2.4657 | 1.71041     | 1.64863     | -0.0617781       | 1/3 oct |
| 3.0971 | 1.58981     | 1.53802     | -0.0517915       | 1/3 oct |
| 3.9087 | 1.46054     | 1.41867     | -0.0418778       | 1/3 oct |
| 4.9331 | 1.33707     | 1.30396     | -0.0331123       | 1/3 oct |
| 6.1963 | 1.23139     | 1.20533     | -0.0260551       | 1/3 oct |
| 7.8201 | 1.14432     | 1.12396     | -0.02036         | 1/3 oct |
| 9.8226 | 1.0799      | 1.06404     | -0.0158584       | 1/3 oct |
| 12.397 | 1.03273     | 1.02102     | -0.0117185       | 1/3 oct |
| 15.645 | 1.0001      | 0.992887    | -0.00721272      | 1/3 oct |
| 19.652 | 0.977731    | 0.97628     | -0.00145095      | 1/3 oct |
| 24.802 | 0.959731    | 0.966797    | 0.00706527       | 1/3 oct |
| 31.301 | 0.939847    | 0.95941     | 0.0195638        | 1/3 oct |
| 39.317 | 0.907379    | 0.943059    | 0.0356802        | 1/3 oct |
| 49.62  | 0.841956    | 0.892645    | 0.0506891        | 1/3 oct |
| 62.623 | 0.724167    | 0.774957    | 0.0507899        | 1/3 oct |
| 78.66  | 0.564337    | 0.596488    | 0.0321512        | 1/3 oct |
| 99.273 | 0.39717     | 0.408629    | 0.0114597        | 1/3 oct |
| 125.29 | 0.262489    | 0.263164    | 0.000674575      | 1/3 oct |
| 157.37 | 0.169762    | 0.167107    | -0.00265554      | 1/3 oct |
| 198.61 | 0.107392    | 0.104431    | -0.00296076      | 1/3 oct |
| 249.47 | 0.0682326   | 0.0658546   | -0.00237801      | 1/3 oct |
| 314.85 | 0.0428657   | 0.0411739   | -0.00169186      | 1/3 oct |
| 397.36 | 0.0269131   | 0.0257738   | -0.00113922      | 1/3 oct |
| 499.11 | 0.0170559   | 0.0163041   | -0.000751837     | 1/3 oct |
| 629.91 | 0.0107067   | 0.0102227   | -0.000483964     | 1/3 oct |
| 794.98 | 0.00672122  | 0.00641269  | -0.000308526     | 1/3 oct |
| 998.56 | 0.00425972  | 0.00406235  | -0.000197377     | 1/3 oct |
| 1260.2 | 0.00267423  | 0.00254958  | -0.000124656     | 1/3 oct |
| 1590.5 | 0.0016789   | 0.00160035  | -7.85528e-05     | 1/3 oct |
| 1997.8 | 0.0010641   | 0.0010142   | -4.9902e-05      | 1/3 oct |
| 2521.3 | 0.000668063 | 0.000636687 | -3.13758e-05     | 1/3 oct |
| 3182.1 | 0.000419425 | 0.000399709 | -1.97168e-05     | 1/3 oct |
| 3996.9 | 0.000265839 | 0.000253335 | -1.2504e-05      | 1/3 oct |
| 5044.3 | 0.000166901 | 0.000159048 | -7.85323e-06     | 1/3 oct |
| 6336.1 | 0.000105785 | 0.000100807 | -4.97867e-06     | 1/3 oct |
| 7996.5 | 6.64149e-05 | 6.32887e-05 | -3.1262e-06      | 1/3 oct |
| 10092  | 4.16971e-05 | 3.97342e-05 | -1.9629e-06      | 1/3 oct |
| 12676  | 2.64285e-05 | 2.51843e-05 | -1.2442e-06      | 1/3 oct |
| 15998  | 1.65926e-05 | 1.58114e-05 | -7.81172e-07     | 1/3 oct |

#### Impedance (ohm) — FAIL

Worst |OpenISD − WinISD| = 2 ohm at 62.623 Hz; tolerance 0.05 ohm.

| f (Hz) | WinISD  | OpenISD | OpenISD − WinISD | row           |
|--------|---------|---------|------------------|---------------|
| 1.2324 | 3.43137 | 3.5287  | 0.0973331        | 1/3 oct       |
| 1.548  | 3.44591 | 3.54209 | 0.0961776        | 1/3 oct       |
| 1.9537 | 3.4655  | 3.56021 | 0.0947102        | 1/3 oct       |
| 2.4657 | 3.48964 | 3.58269 | 0.0930511        | 1/3 oct       |
| 3.0971 | 3.51647 | 3.60788 | 0.0914057        | 1/3 oct       |
| 3.9087 | 3.54528 | 3.63515 | 0.0898664        | 1/3 oct       |
| 4.9331 | 3.57414 | 3.66266 | 0.0885224        | 1/3 oct       |
| 6.1963 | 3.60257 | 3.68986 | 0.0872918        | 1/3 oct       |
| 7.8201 | 3.63402 | 3.71989 | 0.0858668        | 1/3 oct       |
| 9.8226 | 3.67188 | 3.7558  | 0.0839195        | 1/3 oct       |
| 12.397 | 3.72594 | 3.80674 | 0.080796         | 1/3 oct       |
| 15.645 | 3.80976 | 3.88543 | 0.0756691        | 1/3 oct       |
| 19.652 | 3.94592 | 4.01339 | 0.067474         | 1/3 oct       |
| 24.802 | 4.19248 | 4.24668 | 0.0542016        | 1/3 oct       |
| 31.301 | 4.67129 | 4.70654 | 0.0352423        | 1/3 oct       |
| 39.317 | 5.70096 | 5.724   | 0.0230322        | 1/3 oct       |
| 49.62  | 8.60595 | 8.77729 | 0.171344         | 1/3 oct       |
| 62.623 | 17.8811 | 19.8813 | 2.00027          | 1/3 oct worst |
| 64.129 | 18.5163 | 20.3879 | 1.87157          | OpenISD max   |
| 65.049 | 18.631  | 20.2756 | 1.64464          | WinISD max    |
| 78.66  | 10.6904 | 10.1806 | -0.50981         | 1/3 oct       |
| 99.273 | 6.11376 | 5.89415 | -0.219605        | 1/3 oct       |
| 125.29 | 4.67187 | 4.60644 | -0.0654364       | 1/3 oct       |
| 157.37 | 4.08077 | 4.08776 | 0.00699319       | 1/3 oct       |
| 198.61 | 3.78475 | 3.83069 | 0.0459343        | 1/3 oct       |
| 249.47 | 3.62883 | 3.69614 | 0.0673134        | 1/3 oct       |
| 314.85 | 3.53796 | 3.61805 | 0.0800867        | 1/3 oct       |
| 397.36 | 3.48446 | 3.57218 | 0.0877279        | 1/3 oct       |
| 499.11 | 3.45271 | 3.54501 | 0.0923083        | 1/3 oct       |
| 629.91 | 3.43276 | 3.52797 | 0.0952046        | 1/3 oct       |
| 794.98 | 3.42044 | 3.51744 | 0.097002         | 1/3 oct       |
| 998.56 | 3.41291 | 3.51101 | 0.0981044        | 1/3 oct       |
| 1260.2 | 3.40808 | 3.50689 | 0.0988117        | 1/3 oct       |
| 1590.5 | 3.40507 | 3.50432 | 0.0992545        | 1/3 oct       |
| 1997.8 | 3.40321 | 3.50274 | 0.0995277        | 1/3 oct       |
| 2521.3 | 3.40201 | 3.50172 | 0.0997036        | 1/3 oct       |
| 3182.1 | 3.40126 | 3.50108 | 0.0998139        | 1/3 oct       |
| 3996.9 | 3.4008  | 3.50068 | 0.0998821        | 1/3 oct       |
| 5044.3 | 3.4005  | 3.50043 | 0.0999259        | 1/3 oct       |
| 6336.1 | 3.40032 | 3.50027 | 0.0999531        | 1/3 oct       |
| 7996.5 | 3.4002  | 3.50017 | 0.0999705        | 1/3 oct       |
| 10092  | 3.40013 | 3.50011 | 0.0999815        | 1/3 oct       |
| 12676  | 3.40008 | 3.50007 | 0.0999883        | 1/3 oct       |
| 15998  | 3.40005 | 3.50004 | 0.0999926        | 1/3 oct       |

#### Impedance phase (deg) — FAIL

Worst |OpenISD − WinISD| = 6.625 deg at 68.213 Hz; tolerance 1.0 deg.

| f (Hz) | WinISD    | OpenISD   | OpenISD − WinISD | row         |
|--------|-----------|-----------|------------------|-------------|
| 1.2324 | 2.38707   | 2.22083   | -0.166242        | 1/3 oct     |
| 1.548  | 2.87881   | 2.68469   | -0.194126        | 1/3 oct     |
| 1.9537 | 3.43287   | 3.21165   | -0.22122         | 1/3 oct     |
| 2.4657 | 4.02827   | 3.78346   | -0.244809        | 1/3 oct     |
| 3.0971 | 4.65116   | 4.38704   | -0.264121        | 1/3 oct     |
| 3.9087 | 5.35192   | 5.06962   | -0.282295        | 1/3 oct     |
| 4.9331 | 6.17449   | 5.87092   | -0.303569        | 1/3 oct     |
| 6.1963 | 7.1783    | 6.84576   | -0.332537        | 1/3 oct     |
| 7.8201 | 8.50301   | 8.12833   | -0.374681        | 1/3 oct     |
| 9.8226 | 10.2011   | 9.77047   | -0.430583        | 1/3 oct     |
| 12.397 | 12.4679   | 11.966    | -0.501944        | 1/3 oct     |
| 15.645 | 15.4251   | 14.8438   | -0.581321        | 1/3 oct     |
| 19.652 | 19.1718   | 18.5235   | -0.648305        | 1/3 oct     |
| 24.802 | 24.0767   | 23.4189   | -0.657799        | 1/3 oct     |
| 31.301 | 30.223    | 29.7292   | -0.493741        | 1/3 oct     |
| 39.317 | 37.0389   | 37.1075   | 0.068551         | 1/3 oct     |
| 48.456 | 41.062    | 42.2337   | 1.17169          | WinISD max  |
| 49.151 | 41.0204   | 42.2794   | 1.25903          | OpenISD max |
| 49.62  | 40.9495   | 42.2654   | 1.31588          | 1/3 oct     |
| 62.623 | 11.3944   | 8.59447   | -2.79992         | 1/3 oct     |
| 68.213 | -18.3515  | -24.9765  | -6.62502         | worst       |
| 78.66  | -42.7221  | -45.7355  | -3.01339         | 1/3 oct     |
| 83.274 | -44.9032  | -46.6507  | -1.74753         | OpenISD min |
| 86.911 | -45.2587  | -46.2768  | -1.01813         | WinISD min  |
| 99.273 | -42.9362  | -42.508   | 0.428222         | 1/3 oct     |
| 125.29 | -35.2196  | -33.8448  | 1.37478          | 1/3 oct     |
| 157.37 | -27.9971  | -26.4942  | 1.50292          | 1/3 oct     |
| 198.61 | -22.0039  | -20.6389  | 1.36499          | 1/3 oct     |
| 249.47 | -17.3875  | -16.2262  | 1.16126          | 1/3 oct     |
| 314.85 | -13.6985  | -12.7438  | 0.954619         | 1/3 oct     |
| 397.36 | -10.8114  | -10.039   | 0.772432         | 1/3 oct     |
| 499.11 | -8.58524  | -7.96273  | 0.622504         | 1/3 oct     |
| 629.91 | -6.791    | -6.29401  | 0.496992         | 1/3 oct     |
| 794.98 | -5.37504  | -4.97942  | 0.395627         | 1/3 oct     |
| 998.56 | -4.27632  | -3.96046  | 0.315862         | 1/3 oct     |
| 1260.2 | -3.38687  | -3.13615  | 0.250727         | 1/3 oct     |
| 1590.5 | -2.68287  | -2.48398  | 0.198889         | 1/3 oct     |
| 1997.8 | -2.13554  | -1.97709  | 0.158452         | 1/3 oct     |
| 2521.3 | -1.69192  | -1.56631  | 0.125606         | 1/3 oct     |
| 3182.1 | -1.34051  | -1.24096  | 0.0995528        | 1/3 oct     |
| 3996.9 | -1.06717  | -0.987903 | 0.0792706        | 1/3 oct     |
| 5044.3 | -0.845558 | -0.782741 | 0.0628176        | 1/3 oct     |
| 6336.1 | -0.673162 | -0.623148 | 0.0500143        | 1/3 oct     |
| 7996.5 | -0.533378 | -0.493747 | 0.0396309        | 1/3 oct     |
| 10092  | -0.422623 | -0.39122  | 0.0314027        | 1/3 oct     |
| 12676  | -0.336461 | -0.31146  | 0.025001         | 1/3 oct     |
| 15998  | -0.266596 | -0.246786 | 0.01981          | 1/3 oct     |

#### Amplifier apparent load power (VA)

Values not captured: the routine returns the impedance for this chart and the VA it draws from it is not established. OpenISD has no VA curve.

### 3.1 Impedance vs Rg and "Rg is at driver side"

VCInd on, 1 Hz–20 kHz. For each Rg (0 and 10 Ω), one WinISD launch logs the impedance chart with
the checkbox off, then ticks it on the Advanced tab and logs the chart again. The option byte
(project+0x53) and Rg (project+0x38) are read back from memory at every point. On the OpenISD
side `Rs_ohm` and `rgAtDriverSide` are set to match: the `.wpr` import drops Rg
([BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options.md?html)).

| Rg (Ω) | Driver side | WinISD Z @1 Hz | @115.6 Hz | @20 kHz | OpenISD Z @1 Hz | @115.6 Hz | @20 kHz |
|--------|-------------|---------------:|----------:|--------:|----------------:|----------:|--------:|
| 0      | off         |         3.4217 |    4.8773 | 42.8481 |          3.4199 |    4.6935 | 42.8487 |
| 0      | on          |         3.4217 |    4.8773 | 42.8481 |          3.4199 |    4.6935 | 42.8487 |
| 10     | off         |         3.4217 |    4.8773 | 42.8481 |         13.4185 |   14.0998 | 44.7662 |
| 10     | on          |        13.4201 |   14.2476 | 44.7656 |         13.4185 |   14.0998 | 44.7662 |

- WinISD, driver side off: Z does not depend on Rg. The Rg 0 and Rg 10 curves are identical to the bit.
- WinISD, driver side on: Z = Z(off) + Rg exactly at every point.
- OpenISD adds Rg in both positions.

The per-chart tables for these four records are in the records. Their other gaps are §4.2.

### 3.2 "Simulate voice coil inductance" on

Record
[sweep-w5-sealed-vcind1-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-vcind1-charts.json)
has the SPL, impedance and TF magnitude, with OpenISD on `winisdGyrator`. All three FAIL: SPL
worst 0.82 dB at 20 kHz, impedance 1.99 Ω at 62.6 Hz, TF magnitude 1.33 dB at 20 kHz. The
full tables are in the record.

| f (Hz) | WinISD SPL off | WinISD SPL on | WinISD roll-off | OpenISD SPL off | OpenISD SPL on | OpenISD roll-off |
|--------|---------------:|--------------:|----------------:|----------------:|---------------:|-----------------:|
| 998.56 |         80.532 |        79.340 |          −1.192 |          80.136 |         78.788 |           −1.348 |
| 4996.7 |         80.530 |        69.977 |         −10.553 |          80.128 |         69.186 |          −10.942 |
| 20000  |         80.530 |        58.264 |         −22.266 |          80.128 |         57.445 |          −22.683 |

OpenISD's inductance roll-off is 0.42 dB deeper at 20 kHz. That is the same size as the §4.2
passband gap. ⚠ unverified: that it is the §4.2 driver-parameter difference feeding WinISD's
inductance element (Rae from Qes/Fs/Cas, where WinISD's Cas comes from Vas), rather than a
difference in the element itself.

---

## 4. Cause of each FAIL

### 4.1 Impedance +0.1 Ω everywhere — OpenISD defect

There are two impedance conventions, WinISD's and OpenISD's. WinISD adds Rg to Z only when
"Rg is at driver side" is on; OpenISD always does. OpenISD needs to drop Rg from Z when the flag
is off. §3.1,
[BUG_20260926_impedance-includes-rg-when-rg-is-not-at-driver-side](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_impedance-includes-rg-when-rg-is-not-at-driver-side.md?html).
In the baseline (Rg 0.1 Ω, off) this is the flat +0.100 Ω above 1 kHz.

### 4.2 Driver parameter set — Cms, Rms: the gap left by "Use WinISD driver calculations"

§2. This accounts for:

- the passband SPL and max-SPL offset;
- the 0.9 Hz resonance shift and 1.76 Ω peak-height gap in impedance;
- the impedance-phase and TF-phase gaps around resonance (worst 6.6° at 68 Hz, 3.7° at 113 Hz);
- the LF excursion gap: WinISD's compliance is 4.9 % larger, and its excursion is 4.7 % larger
  at 1 Hz;
- the max-power gap below 5 Hz, where both curves are Xmax-limited.

The BUG_20260926 fix as written derives Mms from the **entered** Cms. For this driver that
still leaves the 0.42 dB gap: WinISD's Cms comes from Vas.

### 4.3 TF magnitude reference — OpenISD defect, open

OpenISD's TF magnitude levels off at −0.926 dB, where WinISD's levels off at −0.017 dB.
[BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl](http://localhost:8000/winisd/openisd/bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md?html).
Below resonance the two agree in shape. The −0.6 to −0.8 dB offset under 20 Hz is this
reference gap plus §4.2.

### 4.4 Group delay

- WinISD's curve is a staircase above 34 Hz: 189 extrema/steps, each smaller than 0.5 % of
  range, in steps of 1.77e-4 ms. It is WinISD's own numerical resolution, not a model effect.
- Worst gap is at 1 Hz: 52.30 vs 51.05 ms (2.4 %).
- From 20 Hz to 1 kHz the gap is ≤ 0.39 ms and follows §4.2.

### 4.5 Sealed-box leakage — the 2026-09-24 claim does not hold on this data

Both TF-phase curves cross ±180° near 12 Hz: WinISD at 11.65 Hz, OpenISD at 12.11 Hz. Below
20 Hz they agree within 1.6°. The 2026-09-24 conclusion was drawn from traced pixels: WinISD
third order, OpenISD second order, the leak acting as damping. That conclusion is not borne
out.

---

## 5. Not established

- The VA chart's value: the chart-point routine returns Z for it, and the transform from Z to
  VA was not read out of WinISD.
- WinISD's Cms-from-Vas is inferred from the 0.42 dB prediction (§2) and has not been read
  from memory.
- The cause of the group-delay gap at 1–10 Hz.
- The max-SPL gap is 0.53 dB, which is 0.13 dB more than the SPL gap. The extra is not
  explained.

## 6. Reproducing

```
cd /home/john/work/winisd/winisd_research
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-baseline-charts VCInd=0 Rg=0.1
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-vcind1-charts VCInd=1 Rg=0.1 "charts=spl|impedance|tfmag"
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-impedance-rg0-vcind1 VCInd=1 Rg=0 charts=impedance toggleAfter=1
scripts/headless.sh python3 toys/w5_chart_refresh.py sweep-w5-sealed-impedance-rg10-vcind1 VCInd=1 Rg=10 charts=impedance toggleAfter=1
# OpenISD side (openisd repo, scratch in build/tmp):
npx tsx build/tmp/w5_openisd_dump.ts <run>/w5.wpr fs_1_20k.json out.json useWinisdDriverModel=true rgAtDriverSide=false
toys/chart_refresh_records.sh <dir of OpenISD dumps> <scratch dir>   # every record, compared and validated
```
