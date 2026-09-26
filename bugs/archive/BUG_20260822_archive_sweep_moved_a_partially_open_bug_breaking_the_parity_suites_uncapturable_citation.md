# Archive sweep moved a partially OPEN bug, breaking the parity suite's UNCAPTURABLE citation

Status: FIXED — file moved back to `bugs/`; parity suite green (verification below)

## Symptom

`packages/winisd/test/winisd-parity.test.ts` red (1 of 436): "solve-from-mms-cms > has no
golden and none is obtainable" asserts the UNCAPTURABLE entry's cited bug record exists at
`bugs/BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md`
— the path returns nothing. This red blocked every non-doc commit (the pre-commit hook runs
the full unit suite).

## Evidence

The cited file is at `bugs/archive/` (same name). Its own Status block reads
"harness dialog handling: FIXED 2026-08-14 / **missing golden for solve-from-mms-cms: OPEN**"
— a partially open bug. The peer session's 73-file archive sweep (2026-08-22, resolved-bugs
pass) moved it with the resolved cohort.

## Cause

The sweep classified by file, not by status line: a record with a two-line status where one
line is OPEN was treated as resolved.

## Fix

`git mv` the file back from `bugs/archive/` to `bugs/`. No test edit — the citation path was
correct; the file's location was wrong.

A grep audit of the remaining 72 archived files for OPEN status lines found FIVE more
partially open records, moved back in the same pass (their OPEN residue must be visible to
the release gate's every-bug-RESOLVED/DEFERRED check):

- `BUG_20260817_provenance_panel_fs_shows_a_formula...` — engine/WinISD parity (QO50): OPEN
- `BUG_20260813_wdr-spl-is-discarded-on-import...` — adjacent item: OPEN
- `BUG_20260817_deploy_verifies_asset_freshness...` — underlying app fault: OPEN
- `BUG_20260817_wpr_passive_radiator_vas_written_in_litres...` — F2/F3 sub-findings: OPEN
- `BUG_20260816_cycling_a_wdr_through_openisd_destroys_15...` — KLe never computed: OPEN

The archive keeps 68 fully-resolved records.

## Verification

`npx vitest run packages/winisd/test/winisd-parity.test.ts` → 436/436. Post-move grep of
`bugs/archive/` for OPEN status lines → zero hits.
