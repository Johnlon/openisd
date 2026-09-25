# Bug: `npm run test:visual` and `.claude/rules/openisd-ui-tests.md` reference nonexistent `visual.browser.spec.ts`

**Date:** 2026-09-09  
**Status:** RESOLVED (Deleted `test:visual` script from `package.json` and deleted section from `.claude/rules/openisd-ui-tests.md` per John's ruling)

## Summary
`npm run test:visual` pointed to `packages/ui/test/ui/visual.browser.spec.ts`, which did not exist on disk. `.claude/rules/openisd-ui-tests.md` documented this spec as live coverage.

## Ruling & Fix
John ruled: Delete both the `package.json` script and the `openisd-ui-tests.md` documentation section. Do not recreate the spec or snapshot baselines.
