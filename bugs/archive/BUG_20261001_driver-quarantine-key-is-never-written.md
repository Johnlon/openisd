# BUG_20261001_driver-quarantine-key-is-never-written

**Status:** CLOSED 2026-10-03 — invalid now: `openisd_quarantine_driver` is no longer declared or read anywhere in packages/.

## Symptom
`openisd_quarantine_driver` is read by the fault dialog's driver repair, but no code writes it,
so that repair can only ever see the legacy `openisd_state.driver` copy.

## Cause
[storageKeys.ts](http://localhost:8000/winisd/openisd/packages/persistence/src/repos/storageKeys.ts#L9)
declares it; [faultLog.ts](http://localhost:8000/winisd/openisd/packages/ui/src/diagnostics/faultLog.ts)
reads it; nothing sets it.

## Fix
Delete the key and the code that reads it; driver records are repaired at load instead.
