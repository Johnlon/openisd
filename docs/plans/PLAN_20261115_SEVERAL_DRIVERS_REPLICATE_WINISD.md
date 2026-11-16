# Plan: several drivers are WinISD's (QO941, QO942)

Written 15 Nov 2026 for John. Short sentences on purpose. This is PR B of two: it removes the wiring of several drivers.
PR A (coil wiring, `PLAN_20261115_COIL_WIRING_REPLICATES_WINISD.md`) is separate; neither needs the other.

Labels: **read in the code** and **observed** are in WinISD 0.7.0.950, from `winisd_research`
`findings/FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code.md` and
`findings/FINDING_20261115_winisd-voice-coil-connection-observed.md` (written `R/`). OpenISD statements name their file.

## The question, in John's words

- "openisd is meant to replicate WinISD so that sounds like a bug" (QO941.c21).
- "for now replicate winisd" (QO941.c24).
- "wtf - I never intended that" about the array impedance (QO941.c33, c34).
- "can we isolate the two issues?" (QO942.c2).

## What WinISD does with several drivers

1. The number of drivers never wires anything. **Read in the code** (the simulation build 0x45e090 and the impedance routine 0x45e740): Vas and Sd times Nd, one shared box, each driver fed P/Nd. Re is never multiplied or divided by Nd.
2. The impedance chart is one driver's at any Nd. **Observed** 5 Oct 2026 (W5 sealed, 1 W): 18.609 ohm peak at 1 and at 4 drivers. **Observed under Wine** 15 Nov 2026 (`R/runs/qo941_wiring_20261115`): Nd 1 to 2 changes SPL and max power (times 2) and leaves the impedance one driver's.
3. SPL, maximum power and VA are the array's. VA is 0.968 VA at 1 and at 4 drivers.
4. WinISD has no control for wiring several drivers. Its "Voice coil connection" is the coil wiring of one driver, enabled only for more than one coil.

## What OpenISD did before this PR

- `driver_ArrayWiring` (`packages/design/fields/field.ts`), stored as `driverEmbedding.wiring`, was labelled "Voice coil connection" on the desktop Driver tab and "Connection" on the phone Driver tab, and in both New Project wizards.
- It changed only the impedance chart: times N in series, divided by N in parallel (`SimulationEngine.ts` `arrayImpedanceScale`). Every other chart already followed WinISD through `oneBoxOfN`.
- The yellow switch "Per-driver impedance" brought WinISD's figure back, with a ≠W cue by Num. of drivers and a list entry.
- Where it came from: commit 64a18829 of 5 Oct 2026, an agent's classification of WinISD's one-driver chart as a bug, written into the calculation-bug list in `CLAUDE.md`. John did not intend it (QO941.c33, c34) and withdrew it on 15 Nov 2026. It was not a ruling of John's.

## What this PR does

- With several drivers the impedance chart is one driver's, as WinISD.
- Removed: the array wiring control on the desktop and phone Driver tabs and in both wizards; the engine's reading of `wiring` and `winisdDriverCountModel`; the switch "Per-driver impedance" (Advanced tab, both skins); its ≠W cue by Num. of drivers; its entries in the compatibility list and the phone help text.
- `CLAUDE.md`: only the words ", the per-driver impedance" come out of the calculation-bug list.
- The bug file `bugs/archive/BUG_20261005_winisd-multi-driver-impedance-is-one-drivers.md` is moved to WONTFIX with the reason. It is kept, not deleted. The ACCURACY_IMPROVEMENTS row and the WINISD_PARITY row are removed; the WINISD_EQUIVALENCE row says the impedance is one driver's with no switch.
- Saved projects: the field `driverEmbedding.wiring` (the project's Connection setting, WinISD's project VCCon) STAYS in place and is simply no longer applied across drivers (John, QO942.c54); `advanced.winisdDriverCountModel` is still accepted by the schema and ignored. The saved value is kept exactly as saved (John, QO946.c23: "the project VcCon is preserved as is"). No notice is shown on loading (John's rulings of 16 Nov 2026: no one-time notice); a new project writes no `wiring`.
- The word "Connection" means only WinISD's concept, the coil wiring of one driver (John, QO943.c4). Removed with the control: the phone label `PhoneLabels.CONNECTION` and the phone help row "Connection: parallel or series wiring of the drivers"; the desktop Placement help row for "Voice coil connection"; the New Project wizard's Driver Array help row "Connection" and the words "how they are wired" in the Driver, Placement and Driver Array help intros. `DesktopLabels.VOICE_COIL_CONNECTION` stays for PR A. Test: `packages/design/test/fields/connection-label.test.ts`.
- "My wiring" is not touched (PR A).
- The array's impedance and any wiring of drivers to each other are ticket Johnlon/openisd#519.

## Fixtures, goldens and tests

- Two golden fixtures set the array wiring with two drivers: `sealed-2drv-parallel` (parallel, the default) and `vented-2drv-series` (series). Renamed `sealed-2drv` and `vented-2drv` and regenerated. The four one-driver goldens are byte-identical, which shows nothing else moved.
- Replaced: `winisdDriverCountModel.test.ts` by `severalDriversImpedance.test.ts`. Changed, each naming the finding: `error-switches`, `compat-switch`, `every-input-recalculates`, `project-sweep-source`, `find-impedance-peak`, `rg-placement`, `field-registry`, the Original and phone Advanced-tab specs, the wizard walk, the phone Driver tab spec, the field-layout rule for the Driver tab dropdowns, the phone field inventory.
- `driver-count-winisd.test.ts` (WinISD captures for two drivers) now runs on the default; it no longer sets the switch.

## No wiring arithmetic is left in the simulation (John, QO942.c29)

The coil wiring is CALCULATED at the moment the solver is given the driver's entered values, its measured wiring and the project's coil wiring (PR A; "it's not a copy it's just a calc"). After this PR the simulation engine and the circuit hold no wiring arithmetic at all: the array scaling in `circuit.ts` and `arrayImpedanceScale` are gone. The gate `packages/design/test/architecture-coil-wiring-arithmetic-has-one-site.test.ts` fails if a series or parallel branch, a conversion call or a terminal-motor read appears there, or if `convertWiring` is named outside its four allowed files.

## If only this PR is merged

- Desktop Driver tab: Num. of drivers, Standard / Iso-Barik, then the coil block ("This driver's voice coils", "My wiring"). No "Voice coil connection" box.
- Phone Driver tab: Drivers, then "My wiring" for a multi-coil driver with a known wiring. No "Connection" row.
- Advanced tab: no "Per-driver impedance" switch.
- Two drivers: the impedance chart is one driver's.
