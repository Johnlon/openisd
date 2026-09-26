# BUG_20260926_one-bad-session-entry-discards-the-readable-ones

**Status:** RESOLVED

## Symptom

If one entry in the stored open-project session cannot be read, none of the others are
restored either — the user comes back to no projects open, though every other entry was fine.

## Evidence

`packages/persistence/src/repos/projectRepo.ts:271-276` — the loop over `payload.entries`
returns the error array on the first entry `readProjectText` refuses, so the entries already
read are dropped with it.

## Cause

The session load is all-or-nothing: one refusal ends the loop and the whole record is reported
as unloadable.

## Fix

`loadOpenProjects()` restores every entry that reads and returns the refusals in the session's
own `refused` list; only a record that is not a session at all (bad JSON, wrong shape) is still
reported as unusable. The focused entry is tracked by id, so focus follows the project the
record named rather than an index into a list that lost members.

`ProjectRepo.quarantineOpenSession()` copies the record to `openisd_quarantine_session` before
the boot arms saving, so the refused entries survive the next write. The boot
(`packages/ui/src/logic/boot.ts`) calls it whenever anything was refused.

## Verification

`packages/persistence/test/openSessionPartialRestore.test.ts` — two good entries and one bad
one restore the two, name the one, and keep focus on the entry the record named; an unusable
record is still reported as a whole; the quarantine copy is byte-identical.
`packages/ui/test/persistence/unreadable-session-is-not-destroyed.browser.spec.ts` — the
quarantine holds the record after a boot that could read none of it.
