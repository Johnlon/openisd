# Project hides published voice-coil readings when their basis is unknown

## Symptom

John reports that bundled drivers loaded into projects show blank Re/BL fields and appear to
lose published values (2026-10-30; prod, test and T607). The current bundle records retain the
manufacturer readings, but after projection they are `state: N`; the project embedding drops
those entries, so neither the value nor its explicit unknown coil metadata reaches the project.

Concrete records in `/home/john/work/winisd/openisd-codex-tuple/packages/ui/public/drivers/`:

- `eminence/sigma-pro-18a.json`: Re 6.29 Ω and BL 22.1 T-M, each with one manufacturer reading;
- `faitalpro/12pr300-8.json`: Re 5.4 Ohm and BL `14.1 N/A`, each with one manufacturer reading;
- `sb-acoustics/sb15bac30-8-coax-aluminum.json`: woofer Re 5.7 Ω and BL 5.3 Tm, each with two manufacturer readings; tweeter Re 3.8 Ω with two readings and no BL reading.

The source records under `/home/john/work/winisd/winisd_drivers/db/datasheets/` retain these
values in `specs.*.voice_coil`. Their tuples explicitly contain `basis: unknown`,
`connection: not-stated`, and `numVC: not-stated`. The readings are known; their per-coil or
connection basis is not established. FaitalPRO's BL unit is literally printed as `N/A` and must
remain unparsed.

Resolvable manufacturer sources:

- https://eminence.com/products/sigma_pro_18a
- https://faitalpro.com/en/products/LF_Loudspeakers/product_details/datasheet.php?id=101050110
- https://sbacoustics.com/product/sb15bac30-8-coax/

## Cause

`packages/design/domain/driverRecordConverter.ts` maps unknown-basis Re/BL to `state: N` while
retaining their source `readings`. `packages/design/domain/project/slimDriver.ts` then removes
every `state: N` entry (`slimmedEntry` returns `undefined`), based on the comment that no screen
shows those readings. The source numbers and tuple metadata therefore disappear from the project.

## Required fix

Keep the manufacturer readings and the explicit voice-coil tuple states available to the project
and surface them to the user. Do not silently promote an unknown-basis reading to a simulation
input or infer coil count/connection. A published raw reading must not look like missing source
data merely because it cannot yet be used for per-coil calculations. Keep FaitalPRO's printed
`14.1 N/A` text without numeric BL conversion.

## Regression check

Load each real bundled record into a project, inspect the visible field/detail, save and reload the
project, and assert that the exact raw readings and explicit coil tuple states survive. Also assert
that unknown-basis fields are not silently consumed as per-coil calculation inputs and that the
FaitalPRO `14.1 N/A` reading remains unparsed.
