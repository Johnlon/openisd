# WinISD equivalence — every chart, box and setting, with its measured deviation

The one register of how far OpenISD is from WinISD 0.7.0.950. Each cell is the **worst deviation
measured over a full sweep** (1 Hz – 20 kHz, WinISD's own 2086/2087-point grid), OpenISD minus the
value WinISD itself computed (debugger capture, never pixels). The name is stable; do not date it.

**Maintain it.** Any new capture, any calculation change, any new WinISD-parity test updates the cell
it touches, the same commit. A cell with no evidence is ❔, never a guess. Detail and records per
case: [CHART_REVIEW_WINISD_VS_OPENISD.md](CHART_REVIEW_WINISD_VS_OPENISD.md?html). WinISD's decoded
formulas: winisd_research [GHIDRA_FINDINGS.md](http://localhost:8000/winisd/winisd_research/GHIDRA_FINDINGS.md?html).

Last updated 2026-09-28.

Key:

| Mark   | Meaning                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- |
| number | worst \|OpenISD − WinISD\| in the chart's unit (rel = relative)                           |
| ✅     | matched, number in the cited test/record                                                  |
| ≈      | matches to WinISD's own rounding noise (group delay: WinISD's 1e-10 Hz finite difference) |
| ✗      | known deviation, bug linked                                                               |
| ❔     | never compared against a WinISD capture                                                   |
| ⛔     | OpenISD does not have it yet                                                              |
| —      | does not exist in WinISD for that box                                                     |

Deviation is multi-dimensional: chart × box × settings × driver. The captures so far use **one
driver** (Tang Band W5-1138SMF) — every number below is for that driver only.

---

## Aggregate

| Scope                                | Cells | Matched (✅/≈) | Deviation (✗) | Never compared (❔) | Not in OpenISD (⛔) |
| ------------------------------------ | ----: | -------------: | ------------: | ------------------: | ------------------: |
| Table 1 — chart × box, base settings | 76    | 47             | 0             | 2                   | 27                  |
| Table 2 — setting × box              | 100   | 18             | 0             | 48                  | 34                  |
| Table 3 — readouts and tools         | 8     | 2              | 1             | 5                   | 0                   |

Worst matched deviation anywhere, excluding group delay: 2e-12 relative (port air velocity). Group
delay: 0.015 ms (4th-order bandpass, rounding noise).

---

## Table 1 — chart × box (base settings)

Base settings: W5-1138SMF, 1 W, Rg 0.1 Ω not at driver side, VCInd off, winisd-lossy losses, the
4-filter chain of CHART_REVIEW §3.4 (sealed also without filters: the larger of the two is shown).
BP6 and ABC: OpenISD has no such box yet; the bracket gives WinISD's decoded formula against its own
capture (relative), which is what the engine class must reproduce.

| Chart                            | Unit | Sealed   | Vented    | Bandpass 4th | Passive radiator | Bandpass 6th               | ABC                        |
| -------------------------------- | ---- | -------- | --------- | ------------ | ---------------- | -------------------------- | -------------------------- |
| Transfer function magnitude      | dB   | 4.8e-14  | 5.7e-14   | 4.5e-13      | 5.7e-14          | ⛔ (formula 3.5e-13 rel)   | ⛔ (formula 1.6e-15 rel)   |
| Transfer function phase          | deg  | 9.1e-13  | 1.3e-12   | 2.3e-12      | 1.4e-12          | ⛔ (formula, same capture) | ⛔ (formula, same capture) |
| Group delay                      | ms   | ≈ 6.9e-4 | ≈ 1.0e-3  | ≈ 0.015      | ≈ 8e-4           | ⛔                         | ⛔                         |
| Maximum power                    | W    | 8.9e-14  | 9.6e-14   | 9.2e-14      | 8.5e-14          | ⛔                         | ⛔                         |
| Maximum SPL                      | dB   | 2.8e-14  | 2.8e-14   | 4.3e-13      | 2.8e-14          | ⛔                         | ⛔                         |
| Amplifier apparent load power    | VA   | 8.9e-14  | 5.5e-14   | 7.3e-14      | 7.8e-14          | ⛔                         | ⛔                         |
| SPL                              | dB   | 4.3e-14  | 4.3e-14   | 4.3e-13      | 4.3e-14          | ⛔                         | ⛔                         |
| Cone excursion                   | mm   | 1e-14    | 1.9e-14   | 1.4e-14      | 1.5e-14          | ⛔                         | ⛔                         |
| Impedance                        | Ω    | 2.8e-14  | 2.1e-14   | 1.8e-14      | 2.3e-14          | ⛔ (formula 9.9e-16 rel)   | ⛔ (formula 1.1e-15 rel)   |
| Impedance phase                  | deg  | 1.4e-13  | 8.5e-14   | 1.1e-13      | 1.1e-13          | ⛔ (formula, same capture) | ⛔ (formula, same capture) |
| Transfer function magnitude (PR) | dB   | —        | —         | —            | 2.8e-14          | —                          | —                          |
| Transfer function phase (PR)     | deg  | —        | —         | —            | 4.5e-13          | —                          | —                          |
| Cone excursion (PR)              | mm   | —        | —         | —            | 8.3e-15          | —                          | —                          |
| Rear port - Air velocity         | m/s  | —        | 2e-12 rel | —            | —                | ⛔ (formula 1.9e-15 rel)   | ⛔ (formula 2.7e-15 rel)   |
| Rear port - Gain                 | dB   | —        | 5.0e-14   | —            | —                | ❔                         | ❔                         |
| Front port - Air velocity        | m/s  | —        | —         | 2e-12 rel    | —                | ⛔ (formula 1.7e-15 rel)   | ⛔ (formula 3.1e-15 rel)   |
| Front port - Gain                | dB   | —        | —         | 4.6e-14      | —                | ⛔                         | ⛔                         |
| Intrachamber port - Air velocity | m/s  | —        | —         | —            | —                | —                          | ⛔ (formula 2.9e-15 rel)   |

Box-independent EQ/Filter charts (4-filter chain, every box): magnitude 2.8e-14 dB, phase 8e-13 deg,
group delay ≈ 6.6e-4 ms.

Sources: sealed — CHART_REVIEW §3, §3.4; vented — §3.5, §3.8; bandpass 4th — §3.9, §3.10; passive
radiator — §3.6, §3.7; BP6/ABC — winisd_research runs `bp6-w5-1`, `abc-w5-1` and
GHIDRA_FINDINGS.md "6th-order bandpass — `0x5668c0`", "ABC — `0x4591b0`". Unit tests holding these:
`packages/design/test/engine/{vented,bandpass4,passive-radiator,passive-radiator-tf,vented-port-gain,bp4-front-port-gain,filters}-winisd.test.ts`.

WinISD warts reproduced on purpose (not deviations): PR phase chart plots arg(Upr) without the 90°
of its magnitude chart; Maximum SPL / Maximum power leave the filter chain out; VA uses Re, not
Re + Rg; BP6 transfer is rear minus front; ABC intra-port velocity leaves the inter-chamber leak out.
Candidates for a conventional switch: [ACCURACY_IMPROVEMENTS.md](ACCURACY_IMPROVEMENTS.md?html).

---

## Table 2 — setting × box

Each row is one WinISD setting moved off the base. Cell: the charts compared and their worst
deviation, or ❔.

| Setting                                            | Sealed                                                 | Vented                                           | Bandpass 4th                                  | Passive radiator                                | Bandpass 6th | ABC |
| -------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------- | ----------------------------------------------- | ------------ | --- |
| Simulate voice coil inductance on                  | ✅ SPL, Z, TF mag ≤ 4e-14                              | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Rg 0 / 10 Ω, not at driver side                    | ✅ Z ≤ 4e-14 Ω                                         | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Rg at driver side on (0 / 10 Ω)                    | ✅ Z ≤ 4e-14 Ω, 1.5e-13°                               | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Rg 1 Ω, driver side off / on                       | ✅ VA 1e-9                                             | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| No filters                                         | ✅ all charts (§3)                                     | ✅ vented-w5-2: Z, TF, port velocity ≤ 1e-12 rel | ✅ bp4-w5-1: Z, TF, port velocity ≤ 1e-12 rel | ✅ pr-w5-1/-2: Z, TF, PR excursion ≤ 1e-12 rel  | ⛔           | ⛔  |
| 4-filter chain                                     | ✅                                                     | ✅                                               | ✅                                            | ✅                                              | ⛔           | ⛔  |
| Each filter type alone (33 captures)               | ✅ ≤ 1e-12 rel, group delay 5e-4 rel (box-independent) | ✅                                               | ✅                                            | ✅                                              | ⛔           | ⛔  |
| Radiator count Npr 2                               | —                                                      | —                                                | —                                             | ✅ pr-w5-npr-1: Z, TF, PR excursion ≤ 1e-12 rel | —            | —   |
| Radiator added mass Me 10 g                        | —                                                      | —                                                | —                                             | ✅ pr-w5-me-npr-1: same                         | —            | —   |
| Driver count Nd > 1                                | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Iso-barik loading                                  | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Driver added mass Med                              | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Voice-coil temperature rise dTVC                   | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Force flat response                                | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Transmission-line ports                            | —                                                      | ❔                                               | ❔                                            | —                                               | ⛔           | ⛔  |
| SPL graph is Xmax limited                          | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| Air T / p / humidity ≠ 293.15 K / 101325 Pa / 30 % | ❔ charts; ✅ c, ρ ≤ 1e-12 rel (air.test.ts)           | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |
| More than one port / slot port                     | —                                                      | ❔                                               | ❔                                            | —                                               | ⛔           | ⛔  |
| Another driver than W5-1138SMF                     | ❔                                                     | ❔                                               | ❔                                            | ❔                                              | ⛔           | ⛔  |

---

## Table 3 — readouts and design tools

| Measure                                           | Status                                                        | Evidence                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Vented alignment wizard (Vb, Fb, every alignment) | ✅ 35/35 ≤ 1e-12 rel                                          | `vented-alignment.test.ts`                                                                                                      |
| Air c, ρ (WinISD air model)                       | ✅ ≤ 1e-12 rel at every measured environment                  | `air.test.ts`                                                                                                                   |
| Passive radiator system tuning, Npr > 1           | ✗                                                             | [BUG_20260928_pr-system-tuning-ignores-radiator-count](../../bugs/BUG_20260928_pr-system-tuning-ignores-radiator-count.md?html) |
| Sealed Fsc, Qtc readouts                          | ❔                                                            | —                                                                                                                               |
| Vented vent length readout                        | ❔ (end-correction default differs: ACCURACY_IMPROVEMENTS #7) | —                                                                                                                               |
| Key stats (F3, peak Z)                            | ❔                                                            | —                                                                                                                               |
| Bandpass Fr/Ff readouts                           | ❔                                                            | —                                                                                                                               |
| Maximum-power / Xmax crossover readouts           | ❔                                                            | —                                                                                                                               |

---

## Open deviations outside the calculation

| Deviation                                                                         | Bug                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WinISD skips chart points whose box value is exactly 0, EQ/Filter charts included | [BUG_20260927_winisd-filter-charts-skip-zero-box-points](../../bugs/BUG_20260927_winisd-filter-charts-skip-zero-box-points.md?html)                               |
| `.wpr` import drops Rg and the simulator options                                  | [BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options](../../bugs/BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options.md?html) |
| WinISD save drops the allpass and later filters                                   | [BUG_20260927_winisd-save-drops-allpass-and-later-filters](../../bugs/BUG_20260927_winisd-save-drops-allpass-and-later-filters.md?html)                           |
