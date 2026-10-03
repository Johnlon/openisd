# BUG_20261001_fault-dialog-offers-data-wipe-for-a-code-fault

**Status:** CLOSED 2026-10-03 — fixed in e87e04e9 (bug filed and fixed in one commit, never closed). The two data wipes (reset design, clear all) are gone from the ladder. What is left: reset chart layout and reset Options, each backs up first and loses no project or driver. Still offered whenever that record is stored; John, 2026-10-03: a fault should name the object that failed, otherwise the storage strategy is at fault. Built 2026-10-03: every fault now carries an origin (stored data naming its store, dev reload, or running code); repairs are offered only for the store a fault names; dev-reload faults do not raise the dialog; the report and dialog show the origin. Only the chart-view loader names its store so far; Options, driver and project loaders still need to.

## Symptom
The "Something went wrong" dialog offered "Reset the saved design" and "Clear ALL saved state"
for four faults thrown by running code (`Cannot read properties of undefined` in `appState.ts`,
`OriginalShell-hooks.ts`, `GraphPanel.vue`, `GraphPanel-hooks.ts`), none caused by stored data
(John, 2026-10-01, localhost:4000). Applying either would delete his work and fix nothing.

## Cause
Each repair's `probe` in
[faultLog.ts](http://localhost:8000/winisd/openisd/packages/ui/src/diagnostics/faultLog.ts#L120-L185)
asks only whether something is stored: `reset-design` is `readState() != null`, `clear-all` is
"any `openisd_` key exists". Neither looks at the fault. Any fault on a machine with a saved
design therefore offers both wipes.

## Fix
A repair is offered only when the fault was caused by the stored state it repairs. A fault in
running code offers no repair, and the dialog shows its existing "No stored-state repair applies"
text.

## Notes
The four faults themselves are not recorded as a bug: every module in their stack carried a vite
hot-reload stamp (`?t=…`), so they may be a half-reloaded page. They become a bug only if they
recur after Reload.
