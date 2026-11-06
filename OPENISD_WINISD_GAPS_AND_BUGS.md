# OpenISD vs WinISD — behaviour gaps

How OpenISD behaves differently from WinISD 0.7, and what each difference costs. Each row links
to the bug doc that tracks it.

Sources:
- [`docs/research/WINISD_EQUIVALENCE.md`](docs/research/WINISD_EQUIVALENCE.md) — the register: every chart, box and setting with its measured deviation from WinISD. The Open table below lists its open cells.
- [`docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md`](docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md) — WinISD 0.7 under wine vs `Engine.sweep`, every chart, Tang Band W5-1138SMF in a 4.48 L sealed box.
- [`docs/research/WINISD_PARITY.md`](docs/research/WINISD_PARITY.md) — Feature comparison matrix, field-by-field evidence ledger, and calculation axis discrepancy analysis.

## Open

Differences from the register's open cells, and readouts it has not yet compared.

| Behaviour                                                                                                                                                                | Benefit of closing it                                                              | Tracked in                                                                                              |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Terminal Re/BL are in the model but no driver-editor field shows them.                                                                                                   | Users can see the voice-coil values WinISD writes back.                            | —                                                                                                       |
| Number of voice coils (sealed box). WinISD ignores it; OpenISD keeps Re and BL per coil, so changing the count changes the charts and the sensitivity.                   | None planned: OpenISD uses the input on purpose.                                   | [numvc](bugs/BUG_20261019_winisd-numvc-is-not-a-simulation-input.md)                                    |
| Driver editor, fLe, KLe, Hc and Hg when the file does not state them (sealed, vented, 6th-order bandpass). WinISD shows entered zeros; OpenISD leaves them blank.        | None planned: blank is kept on purpose, with no Difference cue.                    | [unstated-fle](bugs/archive/BUG_20261019_winisd-editor-shows-unstated-fle-kle-hc-hg-as-entered-zero.md) |
| Passive radiator Vas typed with more than 4 decimals. WinISD acts as if it were rounded to 4 decimals; OpenISD uses what is typed.                                       | None planned: WinISD bug, not copied.                                              | [pr-vas](bugs/BUG_20261019_winisd-pr-vas-edit-rounded-to-4-decimals.md)                                 |
| Passive radiator Sd typed in the editor. WinISD ignores it; OpenISD uses it, so the radiator excursion chart changes.                                                    | None planned: WinISD bug, not copied.                                              | [pr-sd](bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md)                                                 |
| Vent end correction typed in the Vents tab (vented box). WinISD does not take the typed value, and uses a loaded one; OpenISD uses what is typed. No typed-edit capture. | A capture would confirm the two agree on a loaded value and differ on a typed one. | [end-correction](bugs/BUG_20261019_winisd-vent-end-correction-edit-not-taken.md)                        |
| Sealed Fsc and Qtc readouts: not yet compared with WinISD.                                                                                                               | Proves the readouts equal WinISD's.                                                | [register, table 3](docs/research/WINISD_EQUIVALENCE.md)                                                |
| Peak impedance in the key stats: not yet compared with WinISD.                                                                                                           | Proves the readout equals WinISD's.                                                | [register, table 3](docs/research/WINISD_EQUIVALENCE.md)                                                |
| Bandpass Fr and Ff readouts: not yet compared with WinISD.                                                                                                               | Proves the readouts equal WinISD's.                                                | [register, table 3](docs/research/WINISD_EQUIVALENCE.md)                                                |
| Maximum-power and Xmax crossover readouts: not yet compared with WinISD.                                                                                                 | Proves the readouts equal WinISD's.                                                | [register, table 3](docs/research/WINISD_EQUIVALENCE.md)                                                |

## Resolved

- **Sealed-box leakage (Ql)**: the leak is WinISD's fixed Ral = Ql/(ωsc·Cab); raising Ql moves phase and group delay the same way as WinISD ([sealed-box-leakage](bugs/archive/BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak.md)).
- **Transfer-function 0 dB reference**: the circuit's own HF asymptote, from the same parameters as the SPL ([tfmag-reference](bugs/archive/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md)).
- **Air model**: the driver solve and the sweep use the same ρ and c ([air-models](bugs/archive/BUG_20260924_driver-solve-and-sweep-use-different-air-models.md)).
- **Voice-coil inductance ($L_e$)**: `circuitModel` switch now controls $L_e$ in both electrical impedance ($Z_{el}$) and acoustic response ($Z_{\text{coil,AC}}$) together ([BUG_20260924](bugs/archive/BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl.md)).
- **Drive Voltage ($e_g$)**: Drive voltage is sized as $e_g = \sqrt{P(R_e + R_s)}$, matching WinISD's reference-power convention.
- **Vents tab cross area**: the box now shows the area of all ports together, as WinISD does ([cross-area](bugs/archive/BUG_20261019_openisd-vents-tab-cross-area-is-one-port-winisd-shows-all-ports.md)).

## Not a gap

- **Max power and max SPL:** the difference came from the inputs, Pe 80 W vs 40 W. At matched Pe the two agree to 0.03% and 0.95%.
- **W5-1138SMF passband SPL and resonance:** the driver record's own values contradict each other (Fs implies an Mms 12.2% off the entered Mms). Each program derives from a different consistent subset. The `inconsistent-inputs` DQ flags the affected fields.
