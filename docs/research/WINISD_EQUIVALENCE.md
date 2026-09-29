# WinISD equivalence — every chart, box and setting, with its measured deviation

The one register of how far OpenISD is from WinISD 0.7.0.950. Each cell is the **worst deviation
measured over a full sweep** (1 Hz – 20 kHz, WinISD's own 2086/2087-point grid), OpenISD minus the
value WinISD itself computed (debugger capture, never pixels). The name is stable; do not date it.

**Maintain it.** Any new capture, any calculation change, any new WinISD-parity test updates the cell
it touches, the same commit, together with the README's parity summary (`.claude/rules/winisd-parity-summary.md`). A cell with no evidence is ❔, never a guess. Detail and records per
case: [CHART_REVIEW_WINISD_VS_OPENISD.md](CHART_REVIEW_WINISD_VS_OPENISD.md?html). WinISD's decoded
formulas: winisd_research [GHIDRA_FINDINGS.md](http://localhost:8000/winisd/winisd_research/GHIDRA_FINDINGS.md?html).

Last updated 2026-09-29.

Every cell is either **matched** or a **gap to close**. There are three kinds of gap, and all
three count against equivalence:

| Mark   | Meaning                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- |
| number | matched: worst \|OpenISD − WinISD\| in the chart's unit (rel = relative)                  |
| ✅     | matched, number in the cited test/record                                                  |
| ≈      | matched to WinISD's own rounding noise (group delay: WinISD's 1e-10 Hz finite difference) |
| ✗      | gap — deviation: OpenISD differs from WinISD, bug linked                                  |
| ❔     | gap — unverified: never compared against a WinISD capture                                 |
| ⛔     | gap — missing: WinISD has it, OpenISD does not yet (OpenISD must be a superset)           |
| —      | not a cell: does not exist in WinISD for that box                                         |

Equivalence is multi-dimensional: chart × box × settings × driver. The captures so far use **one
driver** (Tang Band W5-1138SMF) — every number below is for that driver only.

---

## Aggregate

| Scope                                | Cells | Matched | Gaps | Deviation (✗) | Unverified (❔) | Missing (⛔) |
| ------------------------------------ | ----: | ------: | ---: | ------------: | --------------: | -----------: |
| Table 1 — chart × box, base settings | 76    | 74      | 2    | 2             | 0               | 0            |
| Table 2 — setting × box              | 100   | 50      | 50   | 0             | 50              | 0            |
| Table 3 — readouts and tools         | 8     | 3       | 5    | 0             | 5               | 0            |
| Total                                | 184   | 127     | 57   | 2             | 55              | 0            |

Worst matched deviation anywhere, excluding group delay: ≤ 1e-9 (BP6/ABC transfer function
magnitude, impedance, and rear/front/intrachamber port velocity — `bp6-w5-1`/`abc-w5-1`, exact
figure not yet recorded here). Next best, and worst among the boxes measured before BP6/ABC:
2e-12 relative (port air velocity). Group delay: 0.015 ms (4th-order bandpass, rounding noise).

---

## Table 1 — chart × box (base settings)

Base settings: W5-1138SMF, 1 W, Rg 0.1 Ω not at driver side, VCInd off, winisd-lossy losses, the
4-filter chain of CHART_REVIEW §3.4 (sealed also without filters: the larger of the two is shown).
BP6 and ABC: landed 2026-09-28 (merge `df81902c`, box `356c5234`). Transfer function magnitude,
impedance, and rear/front/intrachamber port air velocity are measured against a real WinISD
capture (≤ 1e-9); every other chart from runs/bp6-w5-base2 and abc-w5-base2 (2026-09-29).

| Chart                            | Unit | Sealed   | Vented    | Bandpass 4th | Passive radiator | Bandpass 6th                                                                                     | ABC                                                                                   |
| -------------------------------- | ---- | -------- | --------- | ------------ | ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Transfer function magnitude      | dB   | 4.8e-14  | 5.7e-14   | 4.5e-13      | 5.7e-14          | ≤ 1e-9                                                                                           | ≤ 1e-9                                                                                |
| Transfer function phase          | deg  | 9.1e-13  | 1.3e-12   | 2.3e-12      | 1.4e-12          | ✅ 7.8e-12                                                                                       | ✅ 8.2e-13                                                                            |
| Group delay                      | ms   | ≈ 6.9e-4 | ≈ 1.0e-3  | ≈ 0.015      | ≈ 8e-4           | ✗ 0.11 ms @ 4 kHz [bug](../../bugs/BUG_20260929_bp6-abc-group-delay-not-winisd.md?html)          | ✗ 7.1 ms @ 1 Hz [bug](../../bugs/BUG_20260929_bp6-abc-group-delay-not-winisd.md?html) |
| Maximum power                    | W    | 8.9e-14  | 9.6e-14   | 9.2e-14      | 8.5e-14          | ✅ 7.8e-14                                                                                       | ✅ 9.2e-14                                                                            |
| Maximum SPL                      | dB   | 2.8e-14  | 2.8e-14   | 4.3e-13      | 2.8e-14          | ✅ 3.4e-12                                                                                       | ✅ 2.8e-14                                                                            |
| Amplifier apparent load power    | VA   | 8.9e-14  | 5.5e-14   | 7.3e-14      | 7.8e-14          | ✅ 7.8e-16                                                                                       | ✅ 6.7e-16                                                                            |
| SPL                              | dB   | 4.3e-14  | 4.3e-14   | 4.3e-13      | 4.3e-14          | ✅ 3.5e-12                                                                                       | ✅ 2.8e-14                                                                            |
| Cone excursion                   | mm   | 1e-14    | 1.9e-14   | 1.4e-14      | 1.5e-14          | ✅ 4.6e-15 m                                                                                     | ✅ 4.6e-15 m                                                                          |
| Impedance                        | Ω    | 2.8e-14  | 2.1e-14   | 1.8e-14      | 2.3e-14          | ≤ 1e-10 rel                                                                                      | ≤ 1e-10 rel                                                                           |
| Impedance phase                  | deg  | 1.4e-13  | 8.5e-14   | 1.1e-13      | 1.1e-13          | ✅ 1.4e-13                                                                                       | ✅ 8.5e-14                                                                            |
| Transfer function magnitude (PR) | dB   | —        | —         | —            | 2.8e-14          | —                                                                                                | —                                                                                     |
| Transfer function phase (PR)     | deg  | —        | —         | —            | 4.5e-13          | —                                                                                                | —                                                                                     |
| Cone excursion (PR)              | mm   | —        | —         | —            | 8.3e-15          | —                                                                                                | —                                                                                     |
| Rear port - Air velocity         | m/s  | —        | 2e-12 rel | —            | —                | ≤ 1e-9 rel                                                                                       | ≤ 1e-9 rel                                                                            |
| Rear port - Gain                 | dB   | —        | 5.0e-14   | —            | —                | ✅ ≤ 1e-12 (was missing) [bug](../../bugs/BUG_20260929_bp6-abc-port-gain-charts-missing.md?html) | ✅ ≤ 1e-12 (was missing)                                                              |
| Front port - Air velocity        | m/s  | —        | —         | 2e-12 rel    | —                | ≤ 1e-9 rel                                                                                       | ≤ 1e-9 rel                                                                            |
| Front port - Gain                | dB   | —        | —         | 4.6e-14      | —                | ✅ ≤ 1e-12 (was missing)                                                                         | ✅ ≤ 1e-12 (was missing)                                                              |
| Intrachamber port - Air velocity | m/s  | —        | —         | —            | —                | —                                                                                                | ≤ 1e-9 rel                                                                            |

Box-independent EQ/Filter charts (4-filter chain, every box): magnitude 2.8e-14 dB, phase 8e-13 deg,
group delay ≈ 6.6e-4 ms.

Sources: sealed — CHART_REVIEW §3, §3.4; vented — §3.5, §3.8; bandpass 4th — §3.9, §3.10; passive
radiator — §3.6, §3.7; BP6/ABC — winisd_research runs `bp6-w5-1`, `abc-w5-1` against
`packages/design/test/engine/{bandpass6,abc}-winisd.test.ts` and
`packages/design/test/winisd/bp6-abc-wpr.test.ts`. Unit tests holding the rest:
`packages/design/test/engine/{vented,bandpass4,passive-radiator,passive-radiator-tf,vented-port-gain,bp4-front-port-gain,filters}-winisd.test.ts`.

WinISD warts reproduced on purpose (not deviations): PR phase chart plots arg(Upr) without the 90°
of its magnitude chart; Maximum SPL / Maximum power leave the filter chain out; VA uses Re, not
Re + Rg; BP6 transfer is rear minus front; ABC intra-port velocity leaves the inter-chamber leak out
(drops Ricl — [ACCURACY_IMPROVEMENTS.md #11](ACCURACY_IMPROVEMENTS.md?html#worth-a-switch)).
Candidates for a conventional switch: [ACCURACY_IMPROVEMENTS.md](ACCURACY_IMPROVEMENTS.md?html).

---

## Table 2 — setting × box

Each row is one WinISD setting moved off the base. Cell: the charts compared and their worst
deviation, or ❔.

| Setting                                            | Sealed                                                                                                                                                       | Vented                                                                                                                                      | Bandpass 4th                                                                         | Passive radiator                                                         | Bandpass 6th | ABC |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------ | --- |
| Simulate voice coil inductance on                  | ✅ SPL, Z, TF mag ≤ 4e-14                                                                                                                                    | ✅ vented-w5-vcind1-rg10-ds: Z, TF, SPL, excursion, VA ≤ 3e-14; port velocity 2e-12 rel                                                     | ✅ bp4-w5-vcind1-rg10-ds: Z, TF, SPL, excursion, VA ≤ 4e-13; port velocity 2e-12 rel | ✅ pr-w5-vcind1-rg10-ds: Z, TF, SPL, excursion, VA, PR excursion ≤ 4e-14 | ❔           | ❔  |
| Rg 0 / 10 Ω, not at driver side                    | ✅ Z ≤ 4e-14 Ω                                                                                                                                               | ✅ SPL, TF, Z ≤ 4e-14 (vented-w5-rg10)                                                                                                      | ✅ SPL, TF ≤ 4e-13, Z ≤ 2e-14 (bp4-w5-rg10)                                          | ✅ SPL, TF, Z ≤ 3e-14 (pr-w5-rg10)                                       | ❔           | ❔  |
| Rg at driver side on (0 / 10 Ω)                    | ✅ Z ≤ 4e-14 Ω, 1.5e-13°                                                                                                                                     | ✅ Rg 10 Ω, same capture as inductance on                                                                                                   | ✅ Rg 10 Ω, same capture as inductance on                                            | ✅ Rg 10 Ω, same capture as inductance on                                | ❔           | ❔  |
| Rg 1 Ω, driver side off / on                       | ✅ VA 1e-9                                                                                                                                                   | ❔                                                                                                                                          | ❔                                                                                   | ❔                                                                       | ❔           | ❔  |
| No filters                                         | ✅ all charts (§3)                                                                                                                                           | ✅ vented-w5-2: Z, TF, port velocity ≤ 1e-12 rel                                                                                            | ✅ bp4-w5-1: Z, TF, port velocity ≤ 1e-12 rel                                        | ✅ pr-w5-1/-2: Z, TF, PR excursion ≤ 1e-12 rel                           | ❔           | ❔  |
| 4-filter chain                                     | ✅                                                                                                                                                           | ✅                                                                                                                                          | ✅                                                                                   | ✅                                                                       | ❔           | ❔  |
| Each filter type alone (33 captures)               | ✅ ≤ 1e-12 rel, group delay 5e-4 rel (box-independent)                                                                                                       | ✅                                                                                                                                          | ✅                                                                                   | ✅                                                                       | ❔           | ❔  |
| Radiator count Npr 2                               | —                                                                                                                                                            | —                                                                                                                                           | —                                                                                    | ✅ pr-w5-npr-1: Z, TF, PR excursion ≤ 1e-12 rel                          | —            | —   |
| Radiator added mass Me 10 g                        | —                                                                                                                                                            | —                                                                                                                                           | —                                                                                    | ✅ pr-w5-me-npr-1: same                                                  | —            | —   |
| Driver count Nd > 1                                | ✅ SPL, Z, max power ≤ 1e-12, TF ≤ 1e-12 dB, excursion ≤ 1e-11 (sealed-w5-nd2) [bug](../../bugs/BUG_20260928_driver-count-not-winisd.md?html)                | ✅ SPL ≤ 2e-13, max power ≤ 3e-15 (vented-w5-nd2)                                                                                           | ✅ SPL, Z, max power ≤ 1e-12 (bp4-w5-nd2)                                            | ✅ SPL, Z, max power ≤ 1e-12 (pr-w5-nd2)                                 | ❔           | ❔  |
| Iso-barik loading                                  | ✅ SPL, TF, Z ≤ 1e-12, excursion ≤ 1e-11 (sealed-w5-isobarik) [bug](../../bugs/BUG_20260928_isobarik-loading-not-simulated.md?html) resolved                 | ✅ SPL, excursion ≤ 3e-14 (vented-w5-isobarik)                                                                                              | ✅ SPL, Z, excursion ≤ 3e-13 (bp4-w5-isobarik)                                       | ✅ SPL, Z, excursion ≤ 3e-14 (pr-w5-isobarik)                            | ❔           | ❔  |
| Driver added mass Med                              | ✅ sealed-w5-med5g: Z, TF, SPL, excursion, max power ≤ 7e-14                                                                                                 | ✅ SPL, Z, excursion ≤ 3e-14 (vented-w5-med5g)                                                                                              | ✅ SPL, Z, excursion ≤ 4e-13 (bp4-w5-med5g)                                          | ✅ SPL, Z, excursion ≤ 3e-14 (pr-w5-med5g)                               | ❔           | ❔  |
| Voice-coil temperature rise dTVC                   | ✅ SPL, max power, Z ≤ 1e-12 (sealed-w5-dtvc20) [bug](../../bugs/BUG_20260928_vc-temperature-drive-uses-hot-re.md?html) resolved                             | ✅ SPL, max power ≤ 8e-14 (vented-w5-dtvc20, -b)                                                                                            | ✅ SPL, max power ≤ 5e-13 (bp4-w5-dtvc20)                                            | ✅ SPL, max power ≤ 8e-14 (pr-w5-dtvc20)                                 | ❔           | ❔  |
| Force flat response                                | ✅ SPL ≤ 1e-12, TF ≤ 1e-12 dB, excursion ≤ 1e-11, Z unchanged (sealed-w5-flatresponse) [bug](../../bugs/BUG_20260928_force-flat-response-not-winisd.md?html) | ✅ SPL, TF ≤ 2e-14, excursion ≤ 5e-12 relative (vented-w5-flat)                                                                             | ✅ SPL ≤ 3e-13, TF ≤ 2e-15, excursion ≤ 3e-12 relative (bp4-w5-flat)                 | ✅ SPL, TF ≤ 2e-14, excursion ≤ 3e-12 relative (pr-w5-flat)              | ❔           | ❔  |
| Transmission-line ports                            | —                                                                                                                                                            | ✅ SPL, Z ≤ 1e-12, TF ≤ 1e-12 dB, port velocity ≤ 1e-10 (vented-w5-tlports) [bug](../../bugs/BUG_20260928_tl-port-model-not-winisd.md?html) | ✅ SPL, Z ≤ 1e-12, TF ≤ 1e-11 dB (bp4-w5-tlports)                                    | —                                                                        | ❔           | ❔  |
| SPL graph is Xmax limited                          | ❔                                                                                                                                                           | ✅ SPL, excursion ≤ 5e-14, 751 points limited (sealed-w5-xmaxlim, 100 W)                                                                    | ❔                                                                                   | ❔                                                                       | ❔           | ❔  |
| Air T / p / humidity ≠ 293.15 K / 101325 Pa / 30 % | ❔ charts; ✅ c, ρ ≤ 1e-12 rel (air.test.ts)                                                                                                                 | ❔                                                                                                                                          | ❔                                                                                   | ❔                                                                       | ❔           | ❔  |
| More than one port / slot port                     | —                                                                                                                                                            | ❔                                                                                                                                          | ❔                                                                                   | —                                                                        | ❔           | ❔  |
| Another driver than W5-1138SMF                     | ❔                                                                                                                                                           | ❔                                                                                                                                          | ❔                                                                                   | ❔                                                                       | ❔           | ❔  |

---

## Table 3 — readouts and design tools

| Measure                                           | Status                                                        | Evidence                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Vented alignment wizard (Vb, Fb, every alignment) | ✅ 35/35 ≤ 1e-12 rel                                          | `vented-alignment.test.ts`                                                                                       |
| Air c, ρ (WinISD air model)                       | ✅ ≤ 1e-12 rel at every measured environment                  | `air.test.ts`                                                                                                    |
| Passive radiator system tuning, Npr > 1           | ✅ 39.45 Hz = WinISD's displayed Fb (2 decimals), ec8d2016    | `pr-tuning-count-winisd.test.ts`; [bug](../../bugs/BUG_20260928_pr-system-tuning-ignores-radiator-count.md?html) |
| Sealed Fsc, Qtc readouts                          | ❔                                                            | —                                                                                                                |
| Vented vent length readout                        | ❔ (end-correction default differs: ACCURACY_IMPROVEMENTS #7) | —                                                                                                                |
| Key stats (F3, peak Z)                            | ❔                                                            | —                                                                                                                |
| Bandpass Fr/Ff readouts                           | ❔                                                            | —                                                                                                                |
| Maximum-power / Xmax crossover readouts           | ❔                                                            | —                                                                                                                |

---

## Open deviations outside the calculation

| Deviation                                                                         | Bug                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WinISD skips chart points whose box value is exactly 0, EQ/Filter charts included | [BUG_20260927_winisd-filter-charts-skip-zero-box-points](../../bugs/BUG_20260927_winisd-filter-charts-skip-zero-box-points.md?html)                               |
| `.wpr` import drops Rg and the simulator options                                  | [BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options](../../bugs/BUG_20260926_wpr-import-drops-source-resistance-and-simulator-options.md?html) |
| WinISD save drops the allpass and later filters                                   | [BUG_20260927_winisd-save-drops-allpass-and-later-filters](../../bugs/BUG_20260927_winisd-save-drops-allpass-and-later-filters.md?html)                           |
