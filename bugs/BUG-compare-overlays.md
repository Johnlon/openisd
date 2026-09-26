# Bug: Compare Overlays Not Rendering

## Status
RESOLVED (re-verified 2026-09-26) — every visible open project is swept and overlaid (`overlays` in `packages/ui/src/hooks/OriginalShell-hooks.ts`).

Multiple traces should be shown simultaneously for all selected projects, but currently they are not. The overlay pipeline is returning `[]` (known as BUG_20260823_compare_overlays). Needs fix and tests.
