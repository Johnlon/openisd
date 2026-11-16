# BUG_20261114_sync-ignores-dq-alert

**Status:** FIXED on branch t789 (T789), closes after release

Links: issue https://github.com/Johnlon/openisd/issues/512 · plan `/home/johnl/work/winisd/openisd/docs/plans/PLAN_20261114_DVC_WIRING_AND_DQ.md` · rulings in `/home/johnl/work/winisd/questions.yml` and https://github.com/Johnlon/openisd/issues/513: QO903 (R6, "the Gate A baseline only falls").

## Symptom
Records with data-quality warnings ship in the app. 1,077 of 2,001 records in `/home/johnl/work/winisd/winisd_drivers/snapshot/datasheets/` have a `dq.alert` file (e.g. dayton-audio/mx6-22: Qes disagree by 49.5%), and nothing refuses the sync.

## Cause
`/home/johnl/work/winisd/openisd/scripts/sync-driver-snapshot.sh` and `/home/johnl/work/winisd/openisd/scripts/bundle-drivers.mjs` never read `dq.alert` (bundle-drivers.mjs mentions dq only to say dq marks stay in driver.json, QO395).

## Fix
T789: Gate A in `scripts/sync-driver-snapshot.sh`. `scripts/dqRatchet.mjs` counts `dq.alert` lines in the extracted snapshot by kind (field plus message with digit runs as `#`). `scripts/driver-snapshot.dq-baseline.json` (beside the pin) holds the counts, generated from the pinned commit b1e1075 (176 kinds, 2,662 lines). Sync refuses (exit 1) when any kind's count rises or a kind is new, printing each kind old -> new and its lines (record path and line; first 50 per kind). On success it rewrites the baseline to the new counts. `--dq-ruling QO<n>` (checked against `^QO[0-9]+$`) allows a rise and records the ruling id beside the raised kinds. The plan's "scan" findings are not counted yet: only `dq.alert`. Tests: `scripts/land/test/sync-driver-snapshot-dq.test.sh`.

## Verification
Fixture with +1 warning is refused and names it; equal passes; fewer passes and lowers the baseline; a raise without `--ruling` is refused. Run in a scratch copy with real processes first (`.claude/rules/processes.md` rule 7).

## Prevention (mechanical)
Gate A and its tests; sync is the gate.
