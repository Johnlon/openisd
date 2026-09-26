# Two bug records each state two contradicting statuses

## Status
FIXED — both bodies aligned to RESOLVED against the code, and the pair merged into one record.

## Symptom

Two files each carry two status markers that disagree:

- `BUG_20260817_dvol_depth_magdepth_magnet_relation_is_documented_but_never_implemented.md`
- `BUG_20260817_dvol_relation_is_fully_documented_but_zero_percent_implemented.md`

Each has a bare `Status: RESOLVED` on line 1, above the title, and a `# Status` section on lines
5-6 reading `OPEN`. Each also carries two Fix sections stating opposite things: a "Fix (not yet
applied)" section describing work to be scheduled, and a later "Fix (applied 2026-08-21)" section
describing that same work in place with its verification.

A reader cannot tell from either file whether the work is done.

## Evidence

The code says the work is done. `packages/engine/src/dvolRelation.ts` implements all four solve
directions of the WINISD_SCHEMA.md §3.10.1 geometry relation; `packages/engine/src/driver.ts:254-273`
wires them into `solveConsistencyGroup` as block 9b, guarded per direction;
`packages/engine/test/dvolRelation.test.ts` and six integration cases in
`packages/engine/test/driver.test.ts` cover it.

So `Status: RESOLVED` is the true marker in both files and the `# Status / OPEN` body is false.

## Cause

The resolution was recorded by APPENDING to each file — a `Status:` line added above the title and
a "Fix (applied)" section added at the end — without rewriting the sections those additions
contradict. The pre-fix status and the pre-fix Fix section were left in place beside the new ones.

## What this does NOT do

It does not defeat `scripts/archive-bugs.py`. Measured directly against both files:

```
region lines: ['Status: RESOLVED', 'OPEN']
is_closed_bug -> False
```

The classifier gathers the whole status region, including a `Status:` line above the title, and one
OPEN term anywhere in that region keeps the file in `bugs/`. Given a file that states both, refusing
to archive is the correct conservative answer, and it is what the classifier returns.

The damage is to readers and to the release gate, not to the tooling: release-gate row 4 counts
these two as OPEN when the work behind them is complete and verified, and a human opening either
file gets two contradicting answers.

## Second defect in the same pair

The two files describe the SAME relation — WINISD_SCHEMA.md §3.10.1, the `DVol`/`Depth`/`MagDepth`/
`Magnet` geometry lock. Two records for one defect double every future status sweep and give the
relation two places to be wrong in.

## Fix

Both bodies state RESOLVED once, with the verification evidence above and no second Fix section.
The pair is merged: `BUG_20260817_dvol_relation_is_fully_documented_but_zero_percent_implemented.md`
is deleted and its content absorbed into
`BUG_20260817_dvol_depth_magdepth_magnet_relation_is_documented_but_never_implemented.md`.

## Verification

`python3 scripts/archive-bugs.py` classifies the surviving record as closed
(`is_closed_bug -> True`), and its status region reads a single `RESOLVED` with no competing term.
