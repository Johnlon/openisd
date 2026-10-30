# BUG_20261017_choosing-a-stored-row-opens-a-second-copy

**Status:** FIXED (T271)

## Symptom
A project opened from a file, once stored, is open and in the list. Choosing its row (or Duplicate on it,
which chooses the row first) opened a second copy of it from the store, so the list and the charts held
the project twice.

## Cause
Choosing a stored row looked for an open project by the identity recorded at open time. A file project is
recorded by its file name and text, not by its stored id, so it was not found and was loaded again.

## Fix
`openStoredProject` (`packages/ui/src/logic/storedProjectOpen.ts`) also looks for an open project that holds
the stored id, and focuses it. Specs: `storedProjectOpen.test.ts`, `project-stored-when-made.browser.spec.ts`.
