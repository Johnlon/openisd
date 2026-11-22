# WinISD .wpr vent shapes

Evidence: WinISD 0.7.0 decompile (Ghidra) and wine captures. Nothing here comes from OpenISD code.
Research repo: `winisd_research` (dumps in `re_ghidra/dumps/ventshape_*.out`, runs in `runs/ventshape-*`).

## Short answer

- WinISD has **two** vent shapes. `Shape=1` is round, `Shape=2` is rectangular (slot). The UI Shape icon
  (click to change) toggles circle and rectangle; there is no third shape.
- The same keys are written for all three vent sections (`VentFront`, `VentRear`, `VentIntra`).
- `crosscalc` changes nothing in any calculation. It is loaded, kept and saved, and its checkbox is hidden.

## Table

| Shape | Name | dia1 | dia2 | crosscalc | Area (`carea`) | End correction |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Round | diameter, m | not used. WinISD still writes the old value (0.05 after a round vent was edited) | no effect | `pi * dia1^2 * 0.25` | `endcorrection * d`, `d = 2 * sqrt(A/pi)` |
| 2 | Rectangle / slot | one side, m | the other side, m | no effect | `dia1 * dia2` | same, with `A = dia1 * dia2` (the circle of equal area) |
| other | none in the UI | | | | area 0, so WinISD skips the calculation | |

Length and tuning, both shapes (`Num` vents, `Vb` box volume, `c` speed of sound, `A` area, `d` as above):

- Length from tuning (when `len` is 0): `len = c^2 * Num * A / ((2*pi*Fb)^2 * Vb) - endcorrection * d`.
- Tuning from length (when `Fb` is 0): `Fb = c / (2*pi) * sqrt(Num * A / ((len + endcorrection * d) * Vb))`.
- "1st port resonance" shown: `c / (2 * len)`. It uses the bare length.
- `endcorrection` is a plain number in the file (0.732 default; the UI list is Two Free Ends, One flanged end, Two flanged ends).
- A new vent (constructor `0x468920`) starts with `Num=1`, `Shape=1`, `dia1=dia2=0.102`, `endcorrection=0.732`, `crosscalc` true. The loader's own defaults for a missing key were not read out.

## Evidence

| Fact | Where |
| --- | --- |
| Saver writes the keys in this order: Num, Shape, Fb, Vb, dia1, dia2, carea, len, endcorrection, crosscalc, from object offsets +0x50, +0x54, +0x30, +0x58, +0x20, +0x28, +0x10, +0x48, +0x40, byte +0x18 | `ventshape_wpr_vent_load_save.out`, saver `0x4558a0` |
| Loader reads the same keys with setters (Num `0x468ba0`, Shape `0x468bb0`, Vb `0x468bc0`) | same file, loader `0x455b00` |
| Area, length, Fb and end-correction maths: `Shape==1` circle, `Shape==2` rectangle, anything else area 0; no read of the crosscalc byte | `ventshape_tvent_calc_listing.out`, `0x468c20`; constants 2.0 at `0x5e9408`, 0.25 at `0x5e9410`, 0.732 at `0x5e9400` |
| Shape icon: circle (TShape value 5) gives `Shape=1`, any other gives `Shape=2`; click toggles | `ventshape_ui_handlers.out`, `ventshape_accessors_callers.out`: `0x465120` (sync), `0x466ac0` (mouse-up) |
| `Shape==2` shows the second size box for each vent | `ventshape_ui_handlers.out` (UI refresh, three tests of `+0x54 == 2`) |
| Setter for crosscalc `0x468a70` is called only by the loader (`0x455dde`) and the new-vent constructor (`0x4689ad`); no click handler calls it | caller scan, `toys/re_callers_scan.py` |
| Captures: W5-1138SMF, vented, Fb 38, 10 L, one rear vent, dia 0.08 (rect 0.08 x 0.03), `c` = 343.684 | below |

Captures (each folder holds `start.wpr`, `saved.wpr` written by WinISD, `readback.json`, screenshots, `reload.json`):

| Folder | Shape | dia1 | dia2 | crosscalc | carea | len | Shown: length, area, 1st resonance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `runs/ventshape-round-xc1` | 1 | 0.08 | 0.05 (stale) | 1 | 0.00502654824574367 | 0.982946200191273 | 0.983 m, 0.0050, 174.82 Hz |
| `runs/ventshape-round-xc0` | 1 | 0.08 | 0.05 (stale) | 0 | same | same | same |
| `runs/ventshape-rect-xc1` | 2 | 0.08 | 0.03 | 1 | 0.0024 | 0.456818305277811 | 0.457 m, 0.0024, 376.17 Hz |
| `runs/ventshape-rect-xc0` | 2 | 0.08 | 0.03 | 0 | same | same | same |

- The formula above reproduces both `len` values to 15 digits with one `c` (343.684121). It is checked, not fitted.
- Each saved `.wpr` was loaded back into WinISD: Vents tab and Box tab show the same values (`reload.json`, `matches_final_shown: true`).
- Changing the shape alone (square 0.05 x 0.05, area 0.0025) keeps `Fb`; only `len` is recomputed (0.370 m to 0.477 m).

## Open doubts

- `crosscalc` is hidden in the UI, so "on" and "off" came from editing `start.wpr`; WinISD wrote it back unchanged. No code that reads it was found. A full scan for every reader of the byte was not done.
- Shape values other than 1 and 2 were not loaded under wine. The decompile says area becomes 0 and nothing is calculated.
- The brief's address `0x4538c0` is the `[SimulatorOptions]` loader, not the vent loader (`0x455b00`).
- Only the rear vent was captured under wine; front and intra use the same code and keys.
