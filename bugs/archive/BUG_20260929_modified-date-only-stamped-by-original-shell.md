# BUG_20260929_modified-date-only-stamped-by-original-shell

**Status:** RESOLVED

## Symptom
Editing a project in the mobile skin never updates its Modified date. The original skin does.

## Evidence
`packages/ui/src/hooks/OriginalShell-hooks.ts` holds the only `watch(isModified, …)` that writes
`project.modified`; nothing under the mobile shell does. Reported by the mobile session
2026-09-29 while fixing the date display.

## Cause
"When does Modified change" is decided in one skin's shell hook instead of in the domain, so a
second skin gets no stamp.

## Fix
`OpenISDProject` stamps `modified` from its app context's clock on the write that takes it from
saved to modified (`#stampModified`); the OriginalShell watch is deleted.

## Verification
`packages/design/test/domain/project-modified-stamp.test.ts`: a top-level edit, a nested driver
edit, a write to `modified` itself, a later edit, and a chart-view change. Passing 2026-09-29.
