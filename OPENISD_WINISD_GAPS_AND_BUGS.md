# OpenISD vs WinISD — behaviour gaps

How OpenISD behaves differently from WinISD 0.7, and what each difference costs. Each row links
to the bug doc that tracks it. Work order: [`docs/plans/PLAN_WINISD_GAPS.md`](docs/plans/PLAN_WINISD_GAPS.md).

Sources:
- [`docs/research/PROBE_W5_SEALED_20260924.md`](docs/research/PROBE_W5_SEALED_20260924.md) — WinISD 0.7 under wine vs `Engine.sweep`, every chart, Tang Band W5-1138SMF in a 4.48 L sealed box.
- [`docs/research/WINISD_PARITY.md`](docs/research/WINISD_PARITY.md) — Feature comparison matrix, field-by-field evidence ledger, and calculation axis discrepancy analysis.

## Open

| Behaviour                                                                                                    | Benefit of closing it                                       | Tracked in                                                                                                   |
|--------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| Raising sealed-box leakage Ql lowers low-frequency phase and group delay. In WinISD it raises them.          | Leaky sealed boxes match WinISD's phase and group delay.    | [sealed-box-leakage](bugs/BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak.md)                 |
| The driver solve and the sweep use different speed-of-sound and air-density values for the same project.     | One air per project; Vas↔Cms and SPL use the same ρ and c.  | [air-models](bugs/BUG_20260924_driver-solve-and-sweep-use-different-air-models.md)                           |
| The transfer-function chart's 0 dB reference differs from the sweep's own passband SPL.                       | One sensitivity figure across the readout and the chart.    | [tfmag-reference](bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md)                      |
| Terminal Re/BL are in the model but no driver-editor field shows them.                                       | Users can see the voice-coil values WinISD writes back.     | —                                                                                                            |
## Resolved

- **Voice-coil inductance ($L_e$)**: `circuitModel` switch now controls $L_e$ in both electrical impedance ($Z_{el}$) and acoustic response ($Z_{\text{coil,AC}}$) together ([BUG_20260924](bugs/BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl.md)).
- **Drive Voltage ($e_g$)**: Drive voltage is sized as $e_g = \sqrt{P(R_e + R_s)}$, matching WinISD's reference-power convention.

## Not a gap

- **Max power and max SPL:** the difference came from the inputs, Pe 80 W vs 40 W. At matched Pe the two agree to 0.03% and 0.95%.
- **W5-1138SMF passband SPL and resonance:** the driver record's own values contradict each other (Fs implies an Mms 12.2% off the entered Mms). Each program derives from a different consistent subset. The `inconsistent-inputs` DQ flags the affected fields.
