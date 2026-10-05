# BUG_20261005_winisd-multi-driver-impedance-is-one-drivers

**Status:** RESOLVED (fixed by default; yellow switch "Enable WinISD per-driver impedance bug" brings WinISD back)

## Symptom
With more than one driver, WinISD's impedance chart shows one driver's impedance, not the array
the amplifier drives. WinISD has no series/parallel wiring setting.

## Evidence
WinISD probe (winisd_research `bugs/BUG_20261005_winisd_multi_driver_impedance_is_one_drivers.md`),
W5-1138SMF sealed, 1 W, 1 → 4 drivers:

| Chart          | 1 driver   | 4 drivers  | Reading                         |
|----------------|-----------:|-----------:|---------------------------------|
| Impedance peak | 18.609 Ω   | 18.609 Ω   | one driver's (the bug)          |
| VA             | 0.968 VA   | 0.968 VA   | the whole array's (one: 0.242)  |
| SPL            |            | +6.02 dB   | array, each in Vb/N fed P/N     |
| Max power      |            | ×4         | array                           |

## OpenISD
- Unticked (default): impedance chart = one driver's ÷ N in parallel, × N in series.
- Ticked: one driver's, as WinISD.
- SPL, excursion, VA and maximum power are WinISD's in both states. OpenISD's VA had been one
  driver's (0.242 for 0.968): a parity error, fixed (`SimulationEngine.sweep`, VA × N).
- Test: `packages/design/test/domain/winisdDriverCountModel.test.ts`.
