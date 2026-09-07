# Session handover — bridge

Session `33d3ea3a-c73c-4482-a883-e33bd3ed4b56`, branch `dev`, working on the V8 bridge
(`packages/design/winisd/driverYmlToOpenisdAndWdr.ts`) and the round-trip test suite.

## Uncommitted changes

- `packages/design/engine/solver.ts` — added the missing `SPL_dB` derivation from `no`
  (relation 18, `docs/design/WINISD_SCHEMA.md:876`). The solver had `SPLref_dB`/`USPL_dB`
  cross-derivations but nothing produced `SPL_dB` itself, so a `.wdr` whose `SPL` was
  WinISD-computed (`C` mark) lost it on round trip, writing back `0`.
- `packages/design/test/engine/efficiency.test.ts` — added a test proving
  `solveConsistencyGroup` (not just the raw `splFromEfficiency` formula) fills `SPL_dB`
  from `no` against the `John-all-manu-populated.wdr` oracle.
- `packages/design/test/winisd/wdr-openisd-round-trip.test.ts`:
  - Ported `cycle()` off the dead `OpenISDDriver.fromWinISDDriver`/`.toWinISDDriver()` API
    onto the live `winISDDriverToOpenISDDeviceJson` / `conformingRecordToOpenIsdDriver` /
    `openIsdDriverToWinIsdDriver` functions.
  - Added a `numVC` exception to `lostEntered()`: an out-of-range `numVC` (not 1-4) coerces
    to `1` per `WDR_LOGIC.md` "`numVC` — read on mark, value checked" — not a lost value.
  - Added a VCCon (slot 46) exception to the N-slot-promotion check: VCCon's ParState is
    unproven, so a reader trusts the value over the mark (`WDR_LOGIC.md` "`VCCon` exception
    — read on presence, not mark"). An unstated wiring saved as the `.wdr` default `1`/mark
    `N` reads back `entered` — documented, not invented.
- `packages/design/winisd/driverYmlToOpenisdAndWdr.ts` — exported `openIsdDriverToWinIsdDriver`
  (was module-private) so the round-trip test can call it directly.

Result: `wdr-openisd-round-trip.test.ts` went from 160/247 to 244/247 passing.

## Known but unfixed — 3 remaining failures

`inconsistency-test-qts-N.wdr`, `s-dd.wdr`, `s-dia-roundtrip-123.wdr` — all `N -> E` on an
unchanged nonzero value, currently flagged by the test's `MARK_WITHOUT_DERIVATION` check.

These are NOT a new bug. `WDR_LOGIC.md:31`'s decision table already states the general rule:
`N` mark + nonzero value = entered, value. My VCCon/numVC fixes above were field-specific
(slot 23, slot 46) instead of implementing this general rule, so these 3 files still trip
the same check for the same underlying reason. The fix is to replace the two narrow
exceptions with the one general rule from the table — not yet done, not yet approved by John.

## Also uncommitted, not part of this session's work

Per `git status` at resume: `docs/design/WDR_LOGIC.md`, `docs/plans/PLAN_OPENISD_DRIVER_MODEL.md`,
`packages/design/winisd/parstate.ts`, `packages/design/winisd/winisdDriver.ts`,
`packages/ui/src/ui/components/DriverEditorModal.vue`, `questions.yml`,
`docs/design/WINISD_CALCULABLE.md`, `docs/plans/PLAN_PROJECT_PERSISTENCE.md` — some or all of
these may belong to peer sessions (`file-spec` was working `questions.yml` and
`docs/plans/*.md`). Verify ownership with `ListAgents` before touching.

## Next step

Get John's go-ahead on the general `N`+nonzero fix in `wdr-openisd-round-trip.test.ts`, apply
it, confirm 247/247, then commit. `packages/design/AGENTS.md`'s approval gate applies to every
change in that package — nothing here should be committed without an explicit go.
