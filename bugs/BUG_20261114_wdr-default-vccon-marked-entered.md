# BUG_20261114_wdr-default-vccon-marked-entered

**Status:** OPEN (root-caused; fix is plan Phase 1 step 2)

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml`: QO900 (R1, c6: "C when unknown").

## Symptom
Exporting a .wdr writes a defaulted VCCon as `1` marked E (entered). A guess is claimed as typed. The MX6-22 has a defaulted VCCon (C = 1) but exports it as entered parallel.

## Steps to reproduce
1. Open the MX6-22 (`/home/johnl/work/winisd/winisd_drivers/snapshot/datasheets/dayton-audio/mx6-22/openisd.json`, VCCon C = 1).
2. Export the driver as .wdr.
3. Observed: VCCon = 1, state E. Expected: marked C.

## Cause
`/home/johnl/work/winisd/openisd/packages/design/domain/driverRecordConverter.ts:338-347` `wdrVCCon` returns `{value: cell.value === "series" ? "2" : "1", state: "entered"}` always (the 5 Oct "always E" ruling). Same fault John rejected in WinISD: `/home/johnl/work/winisd/winisd_research/findings/FINDING_20260828_silently-rewrites-Re-and-BL-and-still-marks-them-entered.md`.

## Fix
Plan Phase 1 step 2: write VCCon C when the wiring is unknown, E when stated (QO900.c6, overrides the 5 Oct ruling for the unknown case only).

## Verification
Exporter unit tests: VCCon C when unknown, E when stated; `scripts/roundTripGate.mjs` byte-identical on the fixtures.

## Prevention (mechanical)
The exporter unit tests, and the round-trip gate in pr-gate.
