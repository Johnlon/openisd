# BUG_20261019_owpr-save-as-says-stays-unsaved-when-saved

**Status:** FIXED in T445 — test: applicationIO.test.ts: 'Save As download says the project stays unsaved only when it has unsaved changes'

Recorded 19 Oct 2026 by fable, from bob's sweep of test.openisd.app at 374x705.

## Symptom
.owpr Save As shows "Project downloaded as X.owpr. It stays marked unsaved." even when the
project had no unsaved changes. The message should say that only when there are unsaved changes.

## Evidence
- packages/ui/src/logic/applicationIO.ts:265-266 (`saveProjectAs`): when `result.written` is false (download, no file handle), flashes the fixed text with "It stays marked unsaved." and returns without checking the project's modified state.
- packages/ui/test/logic/applicationIO.test.ts:457 pins the fixed text.
- The project's modified state is `isModified()` (appState.ts:543, 704).

## Cause
`saveProjectAs` always appends the sentence in the download branch; it never reads whether the project has unsaved changes.

## Fix
Append "It stays marked unsaved." only when the focused project is modified; otherwise "Project downloaded as X.owpr". Update the test at line 457 and add the clean-project case.

## Verification
Unit test in applicationIO.test.ts: modified project gives the long message, clean project the short one.
