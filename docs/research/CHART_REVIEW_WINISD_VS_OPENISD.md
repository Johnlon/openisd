# Chart review: WinISD vs OpenISD — W5-1138SMF sealed

Last refreshed 2026-09-26 against `88e30dd6`. **Refresh this whenever a calculation changes**:
the WinISD side is a debugger capture and does not move, so a refresh is the OpenISD side plus
the compare — §6. The name is stable; do not date it.

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
  Cms, Rms from Qms. Its motor force follows the **entered** BL (§4.1).
- **OpenISD** with "Use WinISD driver calculations" on (the default since `ece3d3b6`) derives
  Cms, Mms and Rms the same way, and derives BL from Qes as well.

Cms, Mms and Rms now agree, so Fc and the curve shapes agree. BL is the one term left, and every
residual in §3 is that one ratio, 7.384 / 7.17 = 1.0299:

| Quantity          | Predicted from the BL ratio | Measured (§3)                  |
|-------------------|-----------------------------|--------------------------------|
| Fc (Z peak)       | unaffected                  | 65.0489 Hz both, to the bit    |
| Passband SPL      | +0.26 dB                    | +0.272 dB, flat 300 Hz–20 kHz  |
| Cone excursion    | +2.99 %                     | +2.99 % at 1 Hz                |
| Z peak height     | higher                      | 19.856 vs 18.631 Ω             |

---

## 3. Chart-by-chart

Verdict: PASS when the worst |OpenISD − WinISD| over all 2086 points is within the tolerance
shown. Tolerances: 0.1 dB, 1°, 0.05 ms, 0.4 W (1 % of Pe), 0.01 mm, 0.05 Ω. Each table has a
row at every 1/3-octave centre, plus a row for every local maximum or minimum, step and phase
wrap the dense scan finds on either curve, plus the worst row. Dense arrays: in the records
above.

| Chart                              | Unit | Worst \|OpenISD − WinISD\| | At (Hz) | Tolerance | Verdict | Was (2026-09-24) |
|------------------------------------|------|-----------------------------|---------|-----------|---------|------------------|
| Transfer function magnitude        | dB   | 0.2704                      | 3.0388  | 0.1       | FAIL    | 0.9093           |
| Transfer function phase            | deg  | 0.5314                      | 1       | 1.0       | PASS    | 3.737            |
| Group delay                        | ms   | 0.1917                      | 1       | 0.05      | FAIL    | 1.249            |
| Maximum power                      | W    | 1.31                        | 3.8902  | 0.4       | FAIL    | 3.5              |
| Maximum SPL                        | dB   | 0.1729                      | 86.499  | 0.1       | FAIL    | 0.5281           |
| SPL                                | dB   | 0.2988                      | 86.499  | 0.1       | FAIL    | 0.5978           |
| Cone excursion                     | mm   | 0.06008                     | 1       | 0.01      | FAIL    | 0.08943          |
| Impedance                          | ohm  | 1.228                       | 65.359  | 0.05      | FAIL    | 2                |
| Impedance phase                    | deg  | 1.599                       | 111.79  | 1.0       | FAIL    | 6.625            |
| Amplifier apparent load power (VA) | VA   | values not captured         | —       | —         | —       | —                |

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

#### Transfer function magnitude (dB) — FAIL

Worst |OpenISD − WinISD| = 0.2704 dB at 3.0388 Hz; tolerance 0.1 dB.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | -77.6522     | -77.9172     | -0.264968        | 1/3 oct       |
| 1.548    | -72.0783     | -72.3453     | -0.267029        | 1/3 oct       |
| 1.9537   | -66.5488     | -66.8177     | -0.268824        | 1/3 oct       |
| 2.4657   | -61.2202     | -61.4902     | -0.270004        | 1/3 oct       |
| 3.0388   | -56.6285     | -56.8988     | -0.270359        | worst         |
| 3.0971   | -56.2204     | -56.4908     | -0.270357        | 1/3 oct       |
| 3.9087   | -51.3463     | -51.6161     | -0.269892        | 1/3 oct       |
| 4.9331   | -46.6861     | -46.9549     | -0.26881         | 1/3 oct       |
| 6.1963   | -42.295      | -42.5625     | -0.267468        | 1/3 oct       |
| 7.8201   | -37.9497     | -38.2158     | -0.266099        | 1/3 oct       |
| 9.8226   | -33.791      | -34.0559     | -0.264917        | 1/3 oct       |
| 12.397   | -29.6155     | -29.8794     | -0.263872        | 1/3 oct       |
| 15.645   | -25.4896     | -25.7524     | -0.262807        | 1/3 oct       |
| 19.652   | -21.486      | -21.7473     | -0.261346        | 1/3 oct       |
| 24.802   | -17.4426     | -17.7014     | -0.258709        | 1/3 oct       |
| 31.301   | -13.4767     | -13.7305     | -0.253753        | 1/3 oct       |
| 39.317   | -9.75556     | -10.0008     | -0.245195        | 1/3 oct       |
| 49.62    | -6.3194      | -6.55141     | -0.232011        | 1/3 oct       |
| 62.623   | -3.55804     | -3.77555     | -0.217515        | 1/3 oct       |
| 78.66    | -1.74649     | -1.9556      | -0.209117        | 1/3 oct       |
| 99.273   | -0.743651    | -0.953245    | -0.209594        | 1/3 oct       |
| 125.29   | -0.29091     | -0.50604     | -0.21513         | 1/3 oct       |
| 157.37   | -0.11141     | -0.332533    | -0.221123        | 1/3 oct       |
| 198.61   | -0.0429113   | -0.268936    | -0.226025        | 1/3 oct       |
| 249.47   | -0.0201204   | -0.249539    | -0.229418        | 1/3 oct       |
| 314.85   | -0.0134907   | -0.245209    | -0.231718        | 1/3 oct       |
| 333.32   | -0.012967    | -0.245109    | -0.232142        | OpenISD max   |
| 382.54   | -0.0125491   | -0.245536    | -0.232987        | WinISD max    |
| 397.36   | -0.0125712   | -0.245752    | -0.233181        | 1/3 oct       |
| 499.11   | -0.0132543   | -0.247323    | -0.234069        | 1/3 oct       |
| 629.91   | -0.0142001   | -0.248814    | -0.234613        | 1/3 oct       |
| 794.98   | -0.0149964   | -0.249924    | -0.234928        | 1/3 oct       |
| 998.56   | -0.0155662   | -0.250663    | -0.235097        | 1/3 oct       |
| 1260.2   | -0.0159648   | -0.251149    | -0.235185        | 1/3 oct       |
| 1590.5   | -0.0162276   | -0.251449    | -0.235222        | 1/3 oct       |
| 1997.8   | -0.0163949   | -0.251625    | -0.23523         | 1/3 oct       |
| 2521.3   | -0.0165045   | -0.251728    | -0.235224        | 1/3 oct       |
| 3182.1   | -0.0165742   | -0.251785    | -0.23521         | 1/3 oct       |
| 3996.9   | -0.0166175   | -0.251812    | -0.235195        | 1/3 oct       |
| 5044.3   | -0.0166456   | -0.251824    | -0.235179        | 1/3 oct       |
| 6306.1   | -0.0166627   | -0.251827    | -0.235165        | OpenISD min   |
| 6336.1   | -0.0166629   | -0.251827    | -0.235164        | 1/3 oct       |
| 7996.5   | -0.0166742   | -0.251825    | -0.235151        | 1/3 oct       |
| 10092    | -0.0166812   | -0.251821    | -0.23514         | 1/3 oct       |
| 12676    | -0.0166856   | -0.251816    | -0.23513         | 1/3 oct       |
| 15998    | -0.0166884   | -0.251811    | -0.235122        | 1/3 oct       |

#### Transfer function phase (deg) — PASS

Worst |OpenISD − WinISD| = 0.5314 deg at 1 Hz; tolerance 1.0 deg.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1        | -110.19      | -110.721     | -0.53145         | worst         |
| 1.2324   | -114.461     | -114.978     | -0.51698         | 1/3 oct       |
| 1.548    | -119.901     | -120.397     | -0.496355        | 1/3 oct       |
| 1.9537   | -126.253     | -126.723     | -0.469828        | 1/3 oct       |
| 2.4657   | -133.263     | -133.702     | -0.438528        | 1/3 oct       |
| 3.0971   | -140.523     | -140.928     | -0.405088        | 1/3 oct       |
| 3.9087   | -148.034     | -148.405     | -0.370535        | 1/3 oct       |
| 4.9331   | -155.38      | -155.718     | -0.337466        | 1/3 oct       |
| 6.1963   | -162.262     | -162.569     | -0.307075        | 1/3 oct       |
| 7.8201   | -168.948     | -169.225     | -0.277297        | 1/3 oct       |
| 9.8226   | -175.268     | -175.515     | -0.247673        | 1/3 oct       |
| 11.544   | -179.713     | -179.938     | -0.225289        | OpenISD wrap  |
| 11.599   | -179.844     | 179.931      | -0.224603        | OpenISD max   |
| 11.654   | -179.976     | 179.801      | -0.223916        | WinISD wrap   |
| 11.71    | 179.893      | 179.67       | -0.223227        | WinISD max    |
| 12.397   | 178.308      | 178.093      | -0.214813        | 1/3 oct       |
| 15.645   | 171.615      | 171.438      | -0.177048        | 1/3 oct       |
| 19.652   | 164.429      | 164.295      | -0.133336        | 1/3 oct       |
| 24.802   | 155.96       | 155.879      | -0.0807377       | 1/3 oct       |
| 31.301   | 145.705      | 145.683      | -0.0216788       | 1/3 oct       |
| 39.317   | 133.185      | 133.219      | 0.0340655        | 1/3 oct       |
| 49.62    | 117.259      | 117.327      | 0.0671889        | 1/3 oct       |
| 62.623   | 98.4891      | 98.5368      | 0.0476397        | 1/3 oct       |
| 78.66    | 79.351       | 79.3312      | -0.0197972       | 1/3 oct       |
| 99.273   | 61.8028      | 61.712       | -0.0907979       | 1/3 oct       |
| 125.29   | 47.6908      | 47.5609      | -0.129892        | 1/3 oct       |
| 157.37   | 37.0832      | 36.9445      | -0.138696        | 1/3 oct       |
| 198.61   | 28.8516      | 28.7212      | -0.130452        | 1/3 oct       |
| 249.47   | 22.685       | 22.5698      | -0.115178        | 1/3 oct       |
| 314.85   | 17.8223      | 17.7246      | -0.0977547       | 1/3 oct       |
| 397.36   | 14.0438      | 13.9626      | -0.0811293       | 1/3 oct       |
| 499.11   | 11.1418      | 11.0751      | -0.0666653       | 1/3 oct       |
| 629.91   | 8.80819      | 8.75414      | -0.0540541       | 1/3 oct       |
| 794.98   | 6.96919      | 6.92564      | -0.0435509       | 1/3 oct       |
| 998.56   | 5.54342      | 5.50833      | -0.0350928       | 1/3 oct       |
| 1260.2   | 4.38983      | 4.36177      | -0.0280629       | 1/3 oct       |
| 1590.5   | 3.47705      | 3.45466      | -0.0223903       | 1/3 oct       |
| 1997.8   | 2.76756      | 2.74964      | -0.0179179       | 1/3 oct       |
| 2521.3   | 2.19258      | 2.17832      | -0.014255        | 1/3 oct       |
| 3182.1   | 1.73714      | 1.72581      | -0.0113303       | 1/3 oct       |
| 3996.9   | 1.38291      | 1.37387      | -0.00904184      | 1/3 oct       |
| 5044.3   | 1.09572      | 1.08854      | -0.00717791      | 1/3 oct       |
| 6336.1   | 0.872315     | 0.866593     | -0.00572282      | 1/3 oct       |
| 7996.5   | 0.691175     | 0.686635     | -0.00453978      | 1/3 oct       |
| 10092    | 0.547652     | 0.544052     | -0.0036004       | 1/3 oct       |
| 12676    | 0.435999     | 0.433131     | -0.0028684       | 1/3 oct       |
| 15998    | 0.345466     | 0.343191     | -0.00227408      | 1/3 oct       |

#### Group delay (ms) — FAIL

Worst |OpenISD − WinISD| = 0.1917 ms at 1 Hz; tolerance 0.05 ms.

WinISD: 189 extrema/steps each smaller than 0.5 % of the chart's range between 34.1 and 1.981e+04 Hz (a staircase in the curve), not listed row by row.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1        | 52.2964      | 52.1048      | -0.191674        | worst         |
| 1.2324   | 49.741       | 49.5631      | -0.177957        | 1/3 oct       |
| 1.548    | 45.9774      | 45.7939      | -0.183505        | 1/3 oct       |
| 1.9537   | 41.0281      | 40.8497      | -0.178358        | 1/3 oct       |
| 2.4657   | 35.1458      | 34.9855      | -0.160285        | 1/3 oct       |
| 3.0971   | 28.9423      | 28.8081      | -0.134276        | 1/3 oct       |
| 3.9087   | 22.7972      | 22.693       | -0.104147        | 1/3 oct       |
| 4.9331   | 17.4164      | 17.3389      | -0.0774609       | 1/3 oct       |
| 6.1963   | 13.1926      | 13.1344      | -0.0581889       | 1/3 oct       |
| 7.8201   | 9.98199      | 9.93659      | -0.045401        | 1/3 oct       |
| 9.8226   | 7.77204      | 7.73415      | -0.0378875       | 1/3 oct       |
| 12.397   | 6.25986      | 6.22642      | -0.0334382       | 1/3 oct       |
| 15.645   | 5.29916      | 5.26797      | -0.0311829       | 1/3 oct       |
| 19.652   | 4.73982      | 4.71035      | -0.0294658       | 1/3 oct       |
| 24.802   | 4.44685      | 4.41965      | -0.0272001       | 1/3 oct       |
| 31.301   | 4.34683      | 4.32388      | -0.0229509       | 1/3 oct       |
| 34.585   | 4.33882      | 4.3188       | -0.0200165       | OpenISD min   |
| 37.493   | 4.3367       | 4.31952      | -0.0171769       | OpenISD max   |
| 39.317   | 4.33361      | 4.31843      | -0.0151794       | 1/3 oct       |
| 49.62    | 4.21889      | 4.21624      | -0.00264157      | 1/3 oct       |
| 62.623   | 3.74179      | 3.75113      | 0.00933877       | 1/3 oct       |
| 78.66    | 2.87495      | 2.88677      | 0.0118181        | 1/3 oct       |
| 99.273   | 1.91254      | 1.91954      | 0.00700321       | 1/3 oct       |
| 125.29   | 1.17714      | 1.17912      | 0.0019839        | 1/3 oct       |
| 157.37   | 0.714565     | 0.714406     | -0.000158624     | 1/3 oct       |
| 198.61   | 0.429958     | 0.429206     | -0.000752212     | 1/3 oct       |
| 249.47   | 0.264019     | 0.263065     | -0.000953361     | 1/3 oct       |
| 314.85   | 0.161698     | 0.161193     | -0.000505536     | 1/3 oct       |
| 397.36   | 0.100023     | 0.099555     | -0.000468177     | 1/3 oct       |
| 499.11   | 0.0627354    | 0.0624347    | -0.000300685     | 1/3 oct       |
| 629.91   | 0.0392094    | 0.0389233    | -0.00028611      | 1/3 oct       |
| 794.98   | 0.02455      | 0.0243269    | -0.000223097     | 1/3 oct       |
| 998.56   | 0.0155425    | 0.0153752    | -0.000167319     | 1/3 oct       |
| 1260.2   | 0.00989067   | 0.009635     | -0.000255661     | 1/3 oct       |
| 1590.5   | 0.00600505   | 0.00604194   | 3.68969e-05      | 1/3 oct       |
| 1997.8   | 0.00388562   | 0.00382665   | -5.89694e-05     | 1/3 oct       |
| 2521.3   | 0.00229605   | 0.0024013    | 0.000105251      | 1/3 oct       |
| 3182.1   | 0.00176619   | 0.00150713   | -0.000259064     | 1/3 oct       |
| 3996.9   | 0.00105971   | 0.000955056  | -0.000104658     | 1/3 oct       |
| 5044.3   | 0.000529857  | 0.000599531  | 6.96738e-05      | 1/3 oct       |
| 6336.1   | 0.000176619  | 0.000379962  | 0.000203343      | 1/3 oct       |
| 7996.5   | 0.000176619  | 0.000238537  | 6.19183e-05      | 1/3 oct       |
| 10092    | 0.000176619  | 0.000149755  | -2.68644e-05     | 1/3 oct       |
| 12676    | 0            | 9.49152e-05  | 9.49152e-05      | 1/3 oct       |
| 15998    | 0.000176619  | 5.95894e-05  | -0.00011703      | 1/3 oct       |

#### Maximum power (W) — FAIL

Worst |OpenISD − WinISD| = 1.31 W at 3.8902 Hz; tolerance 0.4 W.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 22.1569      | 21.498       | -0.658978        | 1/3 oct       |
| 1.548    | 23.6344      | 22.9246      | -0.709758        | 1/3 oct       |
| 1.9537   | 25.9061      | 25.1161      | -0.789994        | 1/3 oct       |
| 2.4657   | 29.2472      | 28.336       | -0.911144        | 1/3 oct       |
| 3.0971   | 33.8527      | 32.7711      | -1.08158         | 1/3 oct       |
| 3.8902   | 39.9666      | 38.657       | -1.3096          | worst         |
| 3.9087   | 40           | 38.7952      | -1.20484         | 1/3 oct       |
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

#### Maximum SPL (dB) — FAIL

Worst |OpenISD − WinISD| = 0.1729 dB at 86.499 Hz; tolerance 0.1 dB.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 16.35        | 16.3351      | -0.0148813       | 1/3 oct       |
| 1.548    | 22.2043      | 22.1861      | -0.0182377       | 1/3 oct       |
| 1.9537   | 28.1323      | 28.1102      | -0.0221103       | 1/3 oct       |
| 2.4657   | 33.9878      | 33.9615      | -0.0262419       | 1/3 oct       |
| 3.0971   | 39.6226      | 39.5924      | -0.0301654       | 1/3 oct       |
| 3.9087   | 45.2214      | 45.1999      | -0.0215054       | 1/3 oct       |
| 4.9331   | 49.8816      | 49.994       | 0.112401         | 1/3 oct       |
| 6.1963   | 54.2727      | 54.3864      | 0.113743         | 1/3 oct       |
| 7.8201   | 58.618       | 58.7331      | 0.115112         | 1/3 oct       |
| 9.8226   | 62.7767      | 62.893       | 0.116294         | 1/3 oct       |
| 12.397   | 66.9522      | 67.0695      | 0.117339         | 1/3 oct       |
| 15.645   | 71.0781      | 71.1965      | 0.118404         | 1/3 oct       |
| 19.652   | 75.0817      | 75.2016      | 0.119865         | 1/3 oct       |
| 24.802   | 79.1251      | 79.2476      | 0.122502         | 1/3 oct       |
| 31.301   | 83.091       | 83.2184      | 0.127458         | 1/3 oct       |
| 39.317   | 86.8121      | 86.9482      | 0.136016         | 1/3 oct       |
| 49.62    | 90.2483      | 90.3975      | 0.1492           | 1/3 oct       |
| 62.623   | 93.0097      | 93.1734      | 0.163696         | 1/3 oct       |
| 78.66    | 94.8212      | 94.9933      | 0.172094         | 1/3 oct       |
| 86.499   | 95.3188      | 95.4917      | 0.172871         | worst         |
| 99.273   | 95.824       | 95.9957      | 0.171617         | 1/3 oct       |
| 125.29   | 96.2768      | 96.4429      | 0.166081         | 1/3 oct       |
| 157.37   | 96.4563      | 96.6164      | 0.160088         | 1/3 oct       |
| 198.61   | 96.5248      | 96.68        | 0.155186         | 1/3 oct       |
| 249.47   | 96.5476      | 96.6994      | 0.151793         | 1/3 oct       |
| 314.85   | 96.5542      | 96.7037      | 0.149493         | 1/3 oct       |
| 333.32   | 96.5547      | 96.7038      | 0.149069         | OpenISD max   |
| 382.54   | 96.5552      | 96.7034      | 0.148224         | WinISD max    |
| 397.36   | 96.5551      | 96.7032      | 0.14803          | 1/3 oct       |
| 499.11   | 96.5544      | 96.7016      | 0.147143         | 1/3 oct       |
| 629.91   | 96.5535      | 96.7001      | 0.146598         | 1/3 oct       |
| 794.98   | 96.5527      | 96.699       | 0.146283         | 1/3 oct       |
| 998.56   | 96.5521      | 96.6982      | 0.146114         | 1/3 oct       |
| 1260.2   | 96.5517      | 96.6978      | 0.146027         | 1/3 oct       |
| 1590.5   | 96.5515      | 96.6975      | 0.14599          | 1/3 oct       |
| 1997.8   | 96.5513      | 96.6973      | 0.145981         | 1/3 oct       |
| 2521.3   | 96.5512      | 96.6972      | 0.145987         | 1/3 oct       |
| 3182.1   | 96.5511      | 96.6971      | 0.146001         | 1/3 oct       |
| 3996.9   | 96.5511      | 96.6971      | 0.146016         | 1/3 oct       |
| 5044.3   | 96.5511      | 96.6971      | 0.146032         | 1/3 oct       |
| 6306.1   | 96.551       | 96.6971      | 0.146047         | OpenISD min   |
| 6336.1   | 96.551       | 96.6971      | 0.146047         | 1/3 oct       |
| 7996.5   | 96.551       | 96.6971      | 0.14606          | 1/3 oct       |
| 10092    | 96.551       | 96.6971      | 0.146071         | 1/3 oct       |
| 12676    | 96.551       | 96.6971      | 0.146081         | 1/3 oct       |
| 15998    | 96.551       | 96.6971      | 0.146089         | 1/3 oct       |

#### SPL (dB) — FAIL

Worst |OpenISD − WinISD| = 0.2988 dB at 86.499 Hz; tolerance 0.1 dB.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 2.89488      | 3.13702      | 0.242135         | 1/3 oct       |
| 1.548    | 8.46885      | 8.70892      | 0.240074         | 1/3 oct       |
| 1.9537   | 13.9983      | 14.2366      | 0.238278         | 1/3 oct       |
| 2.4657   | 19.3269      | 19.564       | 0.237098         | 1/3 oct       |
| 3.0971   | 24.3267      | 24.5634      | 0.236746         | 1/3 oct       |
| 3.9087   | 29.2008      | 29.4381      | 0.23721          | 1/3 oct       |
| 4.9331   | 33.861       | 34.0993      | 0.238292         | 1/3 oct       |
| 6.1963   | 38.2521      | 38.4917      | 0.239634         | 1/3 oct       |
| 7.8201   | 42.5974      | 42.8384      | 0.241003         | 1/3 oct       |
| 9.8226   | 46.7561      | 46.9983      | 0.242185         | 1/3 oct       |
| 12.397   | 50.9316      | 51.1748      | 0.24323          | 1/3 oct       |
| 15.645   | 55.0575      | 55.3018      | 0.244296         | 1/3 oct       |
| 19.652   | 59.0611      | 59.3069      | 0.245756         | 1/3 oct       |
| 24.802   | 63.1045      | 63.3529      | 0.248393         | 1/3 oct       |
| 31.301   | 67.0704      | 67.3237      | 0.25335          | 1/3 oct       |
| 39.317   | 70.7915      | 71.0534      | 0.261908         | 1/3 oct       |
| 49.62    | 74.2277      | 74.5028      | 0.275091         | 1/3 oct       |
| 62.623   | 76.9891      | 77.2786      | 0.289588         | 1/3 oct       |
| 78.66    | 78.8006      | 79.0986      | 0.297985         | 1/3 oct       |
| 86.499   | 79.2982      | 79.597       | 0.298763         | worst         |
| 99.273   | 79.8034      | 80.101       | 0.297508         | 1/3 oct       |
| 125.29   | 80.2562      | 80.5482      | 0.291972         | 1/3 oct       |
| 157.37   | 80.4357      | 80.7217      | 0.285979         | 1/3 oct       |
| 198.61   | 80.5042      | 80.7853      | 0.281077         | 1/3 oct       |
| 249.47   | 80.527       | 80.8047      | 0.277684         | 1/3 oct       |
| 314.85   | 80.5336      | 80.809       | 0.275384         | 1/3 oct       |
| 333.32   | 80.5341      | 80.8091      | 0.27496          | OpenISD max   |
| 382.54   | 80.5346      | 80.8087      | 0.274116         | WinISD max    |
| 397.36   | 80.5345      | 80.8084      | 0.273921         | 1/3 oct       |
| 499.11   | 80.5338      | 80.8069      | 0.273034         | 1/3 oct       |
| 629.91   | 80.5329      | 80.8054      | 0.272489         | 1/3 oct       |
| 794.98   | 80.5321      | 80.8043      | 0.272175         | 1/3 oct       |
| 998.56   | 80.5315      | 80.8035      | 0.272005         | 1/3 oct       |
| 1260.2   | 80.5311      | 80.8031      | 0.271918         | 1/3 oct       |
| 1590.5   | 80.5309      | 80.8028      | 0.271881         | 1/3 oct       |
| 1997.8   | 80.5307      | 80.8026      | 0.271872         | 1/3 oct       |
| 2521.3   | 80.5306      | 80.8025      | 0.271879         | 1/3 oct       |
| 3182.1   | 80.5305      | 80.8024      | 0.271892         | 1/3 oct       |
| 3996.9   | 80.5305      | 80.8024      | 0.271908         | 1/3 oct       |
| 5044.3   | 80.5305      | 80.8024      | 0.271924         | 1/3 oct       |
| 6306.1   | 80.5304      | 80.8024      | 0.271938         | OpenISD min   |
| 6336.1   | 80.5304      | 80.8024      | 0.271938         | 1/3 oct       |
| 7996.5   | 80.5304      | 80.8024      | 0.271951         | 1/3 oct       |
| 10092    | 80.5304      | 80.8024      | 0.271963         | 1/3 oct       |
| 12676    | 80.5304      | 80.8024      | 0.271972         | 1/3 oct       |
| 15998    | 80.5304      | 80.8024      | 0.27198          | 1/3 oct       |

#### Cone excursion (mm) — FAIL

Worst |OpenISD − WinISD| = 0.06008 mm at 1 Hz; tolerance 0.01 mm.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1        | 2.00638      | 2.06646      | 0.0600845        | worst         |
| 1.2324   | 1.96511      | 2.02413      | 0.0590166        | 1/3 oct       |
| 1.548    | 1.9027       | 1.96013      | 0.0574345        | 1/3 oct       |
| 1.9537   | 1.81736      | 1.87266      | 0.0553062        | 1/3 oct       |
| 2.4657   | 1.71041      | 1.76306      | 0.0526506        | 1/3 oct       |
| 3.0971   | 1.58981      | 1.63942      | 0.0496121        | 1/3 oct       |
| 3.9087   | 1.46054      | 1.50677      | 0.0462272        | 1/3 oct       |
| 4.9331   | 1.33707      | 1.37985      | 0.0427775        | 1/3 oct       |
| 6.1963   | 1.23139      | 1.27094      | 0.0395529        | 1/3 oct       |
| 7.8201   | 1.14432      | 1.18091      | 0.0365942        | 1/3 oct       |
| 9.8226   | 1.0799       | 1.11402      | 0.034122         | 1/3 oct       |
| 12.397   | 1.03273      | 1.0648       | 0.0320655        | 1/3 oct       |
| 15.645   | 1.0001       | 1.03056      | 0.0304641        | 1/3 oct       |
| 19.652   | 0.977731     | 1.00703      | 0.0292989        | 1/3 oct       |
| 24.802   | 0.959731     | 0.988208     | 0.0284764        | 1/3 oct       |
| 31.301   | 0.939847     | 0.967799     | 0.0279527        | 1/3 oct       |
| 39.317   | 0.907379     | 0.934906     | 0.0275273        | 1/3 oct       |
| 49.62    | 0.841956     | 0.868522     | 0.0265663        | 1/3 oct       |
| 62.623   | 0.724167     | 0.748061     | 0.0238942        | 1/3 oct       |
| 78.66    | 0.564337     | 0.583398     | 0.0190603        | 1/3 oct       |
| 99.273   | 0.39717      | 0.41049      | 0.0133207        | 1/3 oct       |
| 125.29   | 0.262489     | 0.271083     | 0.00859358       | 1/3 oct       |
| 157.37   | 0.169762     | 0.17518      | 0.00541819       | 1/3 oct       |
| 198.61   | 0.107392     | 0.110747     | 0.00335545       | 1/3 oct       |
| 249.47   | 0.0682326    | 0.0703323    | 0.00209972       | 1/3 oct       |
| 314.85   | 0.0428657    | 0.0441707    | 0.00130501       | 1/3 oct       |
| 397.36   | 0.0269131    | 0.0277265    | 0.000813479      | 1/3 oct       |
| 499.11   | 0.0170559    | 0.0175691    | 0.000513151      | 1/3 oct       |
| 629.91   | 0.0107067    | 0.0110278    | 0.000321135      | 1/3 oct       |
| 794.98   | 0.00672122   | 0.00692242   | 0.000201196      | 1/3 oct       |
| 998.56   | 0.00425972   | 0.00438708   | 0.000127354      | 1/3 oct       |
| 1260.2   | 0.00267423   | 0.00275412   | 7.98871e-05      | 1/3 oct       |
| 1590.5   | 0.0016789    | 0.00172903   | 5.01278e-05      | 1/3 oct       |
| 1997.8   | 0.0010641    | 0.00109586   | 3.17611e-05      | 1/3 oct       |
| 2521.3   | 0.000668063  | 0.000687999  | 1.99361e-05      | 1/3 oct       |
| 3182.1   | 0.000419425  | 0.00043194   | 1.25147e-05      | 1/3 oct       |
| 3996.9   | 0.000265839  | 0.000273771  | 7.9314e-06       | 1/3 oct       |
| 5044.3   | 0.000166901  | 0.00017188   | 4.97928e-06      | 1/3 oct       |
| 6336.1   | 0.000105785  | 0.000108941  | 3.15586e-06      | 1/3 oct       |
| 7996.5   | 6.64149e-05  | 6.83962e-05  | 1.9813e-06       | 1/3 oct       |
| 10092    | 4.16971e-05  | 4.2941e-05   | 1.2439e-06       | 1/3 oct       |
| 12676    | 2.64285e-05  | 2.72169e-05  | 7.88403e-07      | 1/3 oct       |
| 15998    | 1.65926e-05  | 1.70876e-05  | 4.94979e-07      | 1/3 oct       |

#### Impedance (ohm) — FAIL

Worst |OpenISD − WinISD| = 1.228 ohm at 65.359 Hz; tolerance 0.05 ohm.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 3.43137      | 3.43342      | 0.00205243       | 1/3 oct       |
| 1.548    | 3.44591      | 3.44891      | 0.00300249       | 1/3 oct       |
| 1.9537   | 3.4655       | 3.4698       | 0.00429623       | 1/3 oct       |
| 2.4657   | 3.48964      | 3.49557      | 0.00592784       | 1/3 oct       |
| 3.0971   | 3.51647      | 3.52429      | 0.00781947       | 1/3 oct       |
| 3.9087   | 3.54528      | 3.55527      | 0.00998929       | 1/3 oct       |
| 4.9331   | 3.57414      | 3.5865       | 0.0123661        | 1/3 oct       |
| 6.1963   | 3.60257      | 3.61752      | 0.0149498        | 1/3 oct       |
| 7.8201   | 3.63402      | 3.65207      | 0.0180482        | 1/3 oct       |
| 9.8226   | 3.67188      | 3.6938       | 0.0219189        | 1/3 oct       |
| 12.397   | 3.72594      | 3.75334      | 0.0273971        | 1/3 oct       |
| 15.645   | 3.80976      | 3.84533      | 0.0355657        | 1/3 oct       |
| 19.652   | 3.94592      | 3.99404      | 0.0481263        | 1/3 oct       |
| 24.802   | 4.19248      | 4.26184      | 0.069368         | 1/3 oct       |
| 31.301   | 4.67129      | 4.77843      | 0.107139         | 1/3 oct       |
| 39.317   | 5.70096      | 5.88068      | 0.179721         | 1/3 oct       |
| 49.62    | 8.60595      | 8.96983      | 0.363885         | 1/3 oct       |
| 62.623   | 17.8811      | 18.9975      | 1.11646          | 1/3 oct       |
| 65.049   | 18.631       | 19.8558      | 1.22487          | WinISD max OpenISD max |
| 65.359   | 18.6201      | 19.8477      | 1.22758          | worst         |
| 78.66    | 10.6904      | 11.2353      | 0.544896         | 1/3 oct       |
| 99.273   | 6.11376      | 6.32911      | 0.215349         | 1/3 oct       |
| 125.29   | 4.67187      | 4.78063      | 0.108753         | 1/3 oct       |
| 157.37   | 4.08077      | 4.1417       | 0.0609328        | 1/3 oct       |
| 198.61   | 3.78475      | 3.82011      | 0.0353601        | 1/3 oct       |
| 249.47   | 3.62883      | 3.65016      | 0.0213313        | 1/3 oct       |
| 314.85   | 3.53796      | 3.55092      | 0.0129614        | 1/3 oct       |
| 397.36   | 3.48446      | 3.49242      | 0.00796639       | 1/3 oct       |
| 499.11   | 3.45271      | 3.45769      | 0.00498068       | 1/3 oct       |
| 629.91   | 3.43276      | 3.43586      | 0.00309824       | 1/3 oct       |
| 794.98   | 3.42044      | 3.42237      | 0.00193324       | 1/3 oct       |
| 998.56   | 3.41291      | 3.41413      | 0.00122037       | 1/3 oct       |
| 1260.2   | 3.40808      | 3.40885      | 0.000764019      | 1/3 oct       |
| 1590.5   | 3.40507      | 3.40555      | 0.000478742      | 1/3 oct       |
| 1997.8   | 3.40321      | 3.40351      | 0.000303034      | 1/3 oct       |
| 2521.3   | 3.40201      | 3.4022       | 0.000190071      | 1/3 oct       |
| 3182.1   | 3.40126      | 3.40138      | 0.00011925       | 1/3 oct       |
| 3996.9   | 3.4008       | 3.40088      | 7.55462e-05      | 1/3 oct       |
| 5044.3   | 3.4005       | 3.40055      | 4.74127e-05      | 1/3 oct       |
| 6336.1   | 3.40032      | 3.40035      | 3.00431e-05      | 1/3 oct       |
| 7996.5   | 3.4002       | 3.40022      | 1.88581e-05      | 1/3 oct       |
| 10092    | 3.40013      | 3.40014      | 1.18378e-05      | 1/3 oct       |
| 12676    | 3.40008      | 3.40009      | 7.50219e-06      | 1/3 oct       |
| 15998    | 3.40005      | 3.40005      | 4.70966e-06      | 1/3 oct       |

#### Impedance phase (deg) — FAIL

Worst |OpenISD − WinISD| = 1.599 deg at 111.79 Hz; tolerance 1.0 deg.

| f (Hz)   | WinISD       | OpenISD      | OpenISD − WinISD | row           |
|----------|--------------|--------------|------------------|---------------|
| 1.2324   | 2.38707      | 2.53081      | 0.143732         | 1/3 oct       |
| 1.548    | 2.87881      | 3.05192      | 0.173109         | 1/3 oct       |
| 1.9537   | 3.43287      | 3.63907      | 0.206194         | 1/3 oct       |
| 2.4657   | 4.02827      | 4.27002      | 0.241753         | 1/3 oct       |
| 3.0971   | 4.65116      | 4.92999      | 0.278838         | 1/3 oct       |
| 3.9087   | 5.35192      | 5.67191      | 0.319989         | 1/3 oct       |
| 4.9331   | 6.17449      | 6.54142      | 0.366928         | 1/3 oct       |
| 6.1963   | 7.1783       | 7.60035      | 0.422058         | 1/3 oct       |
| 7.8201   | 8.50301      | 8.99487      | 0.491855         | 1/3 oct       |
| 9.8226   | 10.2011      | 10.7785      | 0.577443         | 1/3 oct       |
| 12.397   | 12.4679      | 13.1536      | 0.685669         | 1/3 oct       |
| 15.645   | 15.4251      | 16.2413      | 0.81622          | 1/3 oct       |
| 19.652   | 19.1718      | 20.1341      | 0.962312         | 1/3 oct       |
| 24.802   | 24.0767      | 25.1923      | 1.11562          | 1/3 oct       |
| 31.301   | 30.223       | 31.4585      | 1.23553          | 1/3 oct       |
| 39.317   | 37.0389      | 38.2882      | 1.24923          | 1/3 oct       |
| 48.226   | 41.0602      | 42.1754      | 1.11525          | OpenISD max   |
| 48.456   | 41.062       | 42.1726      | 1.11063          | WinISD max    |
| 49.62    | 40.9495      | 42.0364      | 1.08692          | 1/3 oct       |
| 62.623   | 11.3944      | 11.8977      | 0.503286         | 1/3 oct       |
| 78.66    | -42.7221     | -43.9569     | -1.23473         | 1/3 oct       |
| 86.911   | -45.2587     | -46.6847     | -1.42604         | WinISD min OpenISD min |
| 99.273   | -42.9362     | -44.4997     | -1.5635          | 1/3 oct       |
| 111.79   | -39.1392     | -40.7386     | -1.59937         | worst         |
| 125.29   | -35.2196     | -36.7928     | -1.5732          | 1/3 oct       |
| 157.37   | -27.9971     | -29.4108     | -1.4137          | 1/3 oct       |
| 198.61   | -22.0039     | -23.1994     | -1.19546         | 1/3 oct       |
| 249.47   | -17.3875     | -18.3729     | -0.985351        | 1/3 oct       |
| 314.85   | -13.6985     | -14.495      | -0.796546        | 1/3 oct       |
| 397.36   | -10.8114     | -11.4499     | -0.638517        | 1/3 oct       |
| 499.11   | -8.58524     | -9.09704     | -0.5118          | 1/3 oct       |
| 629.91   | -6.791       | -7.19824     | -0.407236        | 1/3 oct       |
| 794.98   | -5.37504     | -5.69855     | -0.323505        | 1/3 oct       |
| 998.56   | -4.27632     | -4.53427     | -0.257953        | 1/3 oct       |
| 1260.2   | -3.38687     | -3.59147     | -0.204593        | 1/3 oct       |
| 1590.5   | -2.68287     | -2.84508     | -0.16221         | 1/3 oct       |
| 1997.8   | -2.13554     | -2.26473     | -0.129189        | 1/3 oct       |
| 2521.3   | -1.69192     | -1.79431     | -0.102388        | 1/3 oct       |
| 3182.1   | -1.34051     | -1.42165     | -0.0811405       | 1/3 oct       |
| 3996.9   | -1.06717     | -1.13178     | -0.0646043       | 1/3 oct       |
| 5044.3   | -0.845558    | -0.896751    | -0.0511927       | 1/3 oct       |
| 6336.1   | -0.673162    | -0.713919    | -0.0407575       | 1/3 oct       |
| 7996.5   | -0.533378    | -0.565674    | -0.0322952       | 1/3 oct       |
| 10092    | -0.422623    | -0.448213    | -0.0255897       | 1/3 oct       |
| 12676    | -0.336461    | -0.356834    | -0.0203729       | 1/3 oct       |
| 15998    | -0.266596    | -0.282739    | -0.0161427       | 1/3 oct       |

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
| 0      | off         |         3.4217 |    4.8773 | 42.8481 |          3.4232 |    5.0076 | 42.8474 |
| 0      | on          |         3.4217 |    4.8773 | 42.8481 |          3.4232 |    5.0076 | 42.8474 |
| 10     | off         |         3.4217 |    4.8773 | 42.8481 |          3.4232 |    5.0076 | 42.8474 |
| 10     | on          |        13.4201 |   14.2476 | 44.7656 |         13.4214 |   14.3045 | 44.7649 |

Both programs now agree on where Rg belongs: Z carries it only with the checkbox on, and then
Z = Z(off) + Rg at every point. The 2026-09-24 review recorded OpenISD adding Rg in both
positions; that is fixed. What is left in these four records is the §4.1 BL term.

### 3.2 "Simulate voice coil inductance" on

Record
[sweep-w5-sealed-vcind1-charts](http://localhost:8000/winisd/winisd_research/runs/sweep-w5-sealed-vcind1-charts.json)
has SPL, impedance and TF magnitude, with OpenISD on `winisdGyrator`. Worst gaps: SPL +0.2997 dB
at 89 Hz, impedance +1.2277 Ω at 65.36 Hz, TF magnitude −0.2704 dB at 3.04 Hz — the same
numbers as VCInd off, so the inductance model itself adds nothing.

| f (Hz) | WinISD SPL off | WinISD SPL on | WinISD roll-off | OpenISD SPL off | OpenISD SPL on | OpenISD roll-off |
|--------|---------------:|--------------:|----------------:|----------------:|---------------:|-----------------:|
| 998.56 |         80.532 |        79.340 |          −1.191 |          80.804 |         79.612 |           −1.191 |
| 4996.7 |         80.530 |        69.977 |         −10.553 |          80.802 |         70.249 |          −10.553 |
| 20000  |         80.530 |        58.264 |         −22.266 |          80.802 |         58.536 |          −22.266 |

The roll-off is now identical to the last digit at every one of those frequencies. The
2026-09-24 review measured OpenISD 0.42 dB deeper at 20 kHz and marked "⚠ unverified: the
driver-parameter difference feeding the inductance element". That is now settled: it was the
driver parameters, and the inductance element matches.

---

## 4. Cause of each FAIL

### 4.1 BL — one term, and it is every remaining gap

There are two BLs, the entered 7.17 Tm and the 7.384 Tm that Qes implies. WinISD's motor force
follows the entered one; OpenISD's "Use WinISD driver calculations" derives it from Qes. Use the
entered BL.

Evidence, baseline record, all three independent of each other:

| Observable        | OpenISD − WinISD | BL ratio predicts |
|-------------------|------------------|-------------------|
| SPL, 300 Hz–20 kHz | +0.2719…+0.2758 dB (flat) | +0.256 dB     |
| Cone excursion at 1 Hz | +2.99 %      | +2.99 %           |
| Z peak height     | +1.225 Ω          | higher            |

Verified on WinISD's side the same day: the W5 run at entered BL 5.0
(`winisd_research/runs/sweep-w5-sealed-bl5-spl`, SPL logged under the debugger) sits −3.1310 dB
below the BL 7.17 baseline at every frequency, which is 20·log10(5/7.17). WinISD's level follows
the entered BL and its shape does not change.

The impedance peak is not covered by that: its height is motional, ∝ BL²/Rms, so a fix that
scales the acoustic drive leaves this chart where it is. Peak − Re is 15.209 Ω for WinISD
against 16.433 for OpenISD, a ratio of 1.0805 where BL² predicts 1.0605; the extra 1.9 % is
unexplained.
[BUG_20260926_winisd-spl-level-uses-entered-bl](http://localhost:8000/winisd/openisd/bugs/BUG_20260926_winisd-spl-level-uses-entered-bl.md?html)
carries both.

### 4.2 TF magnitude reference — OpenISD defect, open

OpenISD's TF magnitude levels off at −0.2507 dB, where WinISD's levels off at −0.0156 dB.
[BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl](http://localhost:8000/winisd/openisd/bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md?html).
Below resonance the two agree in shape. The gap was −0.926 vs −0.017 dB on 2026-09-24; §4.1
accounts for the change in size, not for the reference itself.

### 4.3 Group delay

- WinISD's curve is a staircase above 34 Hz: steps of 1.77e-4 ms, each smaller than 0.5 % of
  range. It is WinISD's own numerical resolution, not a model effect, and it is what keeps this
  chart failing a 0.05 ms tolerance.
- Worst gap is at 1 Hz: 52.2964 vs 52.1048 ms (0.37 %), down from 2.4 %.

### 4.4 Sealed-box leakage — the 2026-09-24 claim does not hold on this data

Both TF-phase curves wrap near 11.7 Hz: WinISD at 11.71 Hz, OpenISD at 11.60 Hz, and the whole
phase chart now passes at 0.53°. The 2026-09-24 conclusion was drawn from traced pixels: WinISD
third order, OpenISD second order, the leak acting as damping. It is not borne out.

---

## 5. Not established

- The VA chart's value: the chart-point routine returns Z for it, and the transform from Z to
  VA was not read out of WinISD.
- Why the impedance peak is 1.9 % further out than BL² accounts for, once the entered-BL level
  is taken out (§4.1).
- WinISD's Cms-from-Vas is inferred from the passband level and has not been read from memory.
- The max-power gap, 1.31 W at 3.89 Hz, where both curves are Xmax-limited: §4.1 in size, not
  separately checked.

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
