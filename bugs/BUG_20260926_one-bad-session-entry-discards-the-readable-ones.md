# BUG_20260926_one-bad-session-entry-discards-the-readable-ones

**Status:** OPEN

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

Restore every entry that reads, report the ones that do not, and say which. The stored record
is already preserved on failure
(`BUG_20260926_unreadable-session-overwritten-with-an-empty-one`), so the refused entries stay
recoverable.

## Verification

A session record with one bad entry and two good ones restores the two and reports the one.
