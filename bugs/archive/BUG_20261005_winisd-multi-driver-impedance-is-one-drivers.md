# BUG_20261005_winisd-multi-driver-impedance-is-one-drivers

**Status:** WONTFIX 2026-11-15 (withdrawn: QO941; see "Withdrawn" below)

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

## Withdrawn (15 Nov 2026, QO941)
WinISD's one-driver impedance chart is not a bug OpenISD corrects. The 5 Oct 2026 change (commit 64a18829) was an
agent's classification that John did not intend, added to the calculation-bug list in `CLAUDE.md`; John withdrew it on
15 Nov 2026 (QO941.c33, c34: "I never intended that"). WinISD has no wiring of several drivers: its impedance routine
never scales Re by the driver count (winisd_research FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code).
Now: with several drivers the impedance chart is one driver's, as WinISD's. The yellow switch "Per-driver impedance",
its ≠W cue by Num. of drivers, the array wiring and its list entries are gone. The array's impedance is ticket
Johnlon/openisd#519. A project saved with the old array wiring keeps the saved value; nothing is
shown on loading (QO946.c23). Test: `packages/design/test/domain/severalDriversImpedance.test.ts`.
