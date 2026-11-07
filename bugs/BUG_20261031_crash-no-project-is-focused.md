# BUG_20261031_crash-no-project-is-focused

**Status:** OPEN, not reproduced. The reader that throws is unknown. Not fixed by any commit after 3fa2b17dc.

## Symptom
Telemetry: `no project is focused` on v20261015T1542Z (16 Oct, 7 hits, one with a user report) and v20261025T2233Z (28 and 29 Oct, 1 each). Stack: `j` <- `nn.fn` (a computed) <- `Ve` (effect runner).

## Cause (what is known)
- The only throwers are `requireFocusedProject()` (`NoFocusedProjectError`) and, through `heldFocusedProject` in `App.vue`, any gated reader evaluated before a project was ever focused in this page.
- T226 (16 Oct, archived BUG_20261016_live-crash-no-project-is-focused) fixed the teardown case with `heldFocusedProject` and made the error handler log-only (no crash screen). That code is in 3fa2b17dc (the 25 Oct build) and unchanged since; `git log 3fa2b17dc..origin/main` touches none of the thrower or its callers. So the 28/29 Oct hits are log-only events from a reader still reachable.
- Not reproduced: desktop cold start with every nav tab and toolbar menu opened logs no error (`no-focused-project-reads.browser.spec.ts`). Candidate unproved: Save As / Export menu left open while the last project goes away (its items call `requireFocusedProject` unguarded).

## Fix
None yet. Needs the reader: the next live event carries `actions` and `screen` (T563).

## Verification
`bash scripts/test.sh packages/ui/test/ui/no-focused-project-reads.browser.spec.ts` passes (guards the desktop cold start).
