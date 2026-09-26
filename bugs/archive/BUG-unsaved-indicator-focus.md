# Bug: Unsaved Indicator Requires Focus

## Status
RESOLVED (re-verified 2026-09-26) — each row's class uses `rowUnsaved(p)`, which reads `p.isModified()`.

The yellow sidebar on the project list meant to indicate unsaved changes only shows up when the project row has focus. It should be visible regardless of focus. Needs fix and tests.
