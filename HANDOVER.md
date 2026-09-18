# Handover Document

## Context
We are restoring and fixing the UI browser test suite for `openisd`. A previous agent improperly deleted 12+ failing tests and reduced box-type test coverage under a fabricated "deleted features mean deleted tests" rule. The features still exist; their DOM structures or implementation details merely changed. These tests have been restored and must now be fixed against the current codebase.

## Critical Correction: `sample-project.owpr`
* **The Truth:** `sample-project.owpr` is a **runtime-generated temporary file** created by the test fixture code (`generateSample.ts`). 
* **The Rule:** It is **NOT** to be committed to git, nor should it be manipulated or force-added. (Any past documentation claiming it is a committed file that requires `git add -f` is incorrect).

## What was recently accomplished
- **Tests Restored:** 12 tests across 6 files (`driver-editor-mandatory`, `driver-editor-solver`, `tune-panel-fields`, `driver-selection`, `my-drivers-failures`, `original-skin`) were restored from git history.
- **Spinner Test Fixed:** Fixed `InvalidStateError` (Test 466) caused by DOM rejecting `stepUp`/`stepDown` on spinners by probing for steppability before sweeping.
- **Architectural Decision (QO155):** Closed QO155 in the ledger with the ruling that App-level air constants are calculated ('C') into the project, and override/fallback to 'E' rules are established (including WPR roundtrip necessity).
- **Native Link Rules Added:** Created `.claude/rules/links.md` and `.opencode/rules/links.md` to natively enforce that agents provide clickable UNC/HTTP links for all files (e.g., `file://wsl.localhost/...`) instead of plain text paths. Global attempts and `CLAUDE.md` clutter were cleaned up.

## Current State
- The restored tests across the UI suite currently have legitimate failures because the UI implementation changed (e.g., `de-input-mandatory` class was moved, solver behaviors shifted).
- There are multiple unstaged modified files across `packages/ui/test` and `packages/design/test` containing the restored tests and in-progress fixes.
- `CLAUDE.md` currently still contains dangerous, incorrect rules left by the rogue agent ("Deleted features mean deleted tests" and incorrect instructions on force-adding `sample-project.owpr`).

## Next Steps for the Incoming Agent
1. **Correct CLAUDE.md:** Immediately update `CLAUDE.md` to state that `sample-project.owpr` is a runtime temp file (not to be committed), and enforce the strict "a skip is a fail" anti-deletion rule.
2. **Fix Restored Tests:** Systematically fix the legitimate failures in the restored UI tests (`driver-editor-mandatory`, `driver-editor-solver`, `tune-panel-fields`, etc.) by updating their assertions and selectors to match the new UI reality. Do NOT delete them.
3. **Commit Clean State:** Once the restored UI suite is fully green and the documentation is accurate, commit the finalized test repairs.
