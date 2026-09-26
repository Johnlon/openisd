## 1. Wire coverage into the gated commands

- [ ] 1.1 Add `"test:coverage": "vitest run --coverage"` to `package.json`'s `scripts` block.
- [ ] 1.2 Update `scripts/hooks-local/pre-commit` to invoke `npm run test:coverage` in place of
      `npm run test:unit` (design.md - Decision 1).
- [ ] 1.3 Update `scripts/health-check.sh`'s "Unit tests" step to invoke `npm run test:coverage`
      in place of `npm run test:unit`.
- [ ] 1.4 Leave `test`, `check`, and `ci` npm scripts on `test:unit` unchanged (design.md -
      Decision 1 — those are not the enforcement points).
- [ ] 1.5 Run `npm run test:coverage` locally and confirm it fails closed if a threshold is
      deliberately violated (e.g. temporarily lower one threshold value below current coverage,
      confirm non-zero exit, then restore it) — this is the "watch it fail" step for the gate
      itself, since there is no pre-existing failing-coverage fixture to reuse.

## 2. Coverage ratchet

- [ ] 2.1 Set `coverage.thresholds.autoUpdate: true` in `vitest.config.ts` (design.md -
      Decision 2).
- [ ] 2.2 Run `npm run test:coverage` and confirm `vitest.config.ts`'s threshold numbers update
      upward to match actual current coverage (or stay unchanged if already at the ceiling);
      review the diff (`git diff vitest.config.ts`) before staging it — the rewritten numbers
      are the new committed floor.
- [ ] 2.3 Stage the resulting `vitest.config.ts` change alongside this change's other files, per
      design.md - Risks ("re-stage if the coverage step modifies it").

## 3. Full gate

- [ ] 3.1 Run `bash scripts/health-check.sh` (lint + typecheck + unit-with-coverage + browser)
      and confirm 100% green, including the now-enforced coverage step.
