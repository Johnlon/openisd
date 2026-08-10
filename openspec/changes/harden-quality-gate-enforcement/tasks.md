## 1. Dangling spec→test reference check

- [ ] 1.1 Write `scripts/test_validate_openspec.py` (stdlib `unittest`, no new dependency): a
      test asserting that a spec requirement citing a non-existent test path produces an error
      from `validate()` (or its refactored equivalent), using a temp `openspec/specs/` fixture.
      Run it (`python3 scripts/test_validate_openspec.py`) and watch it fail — the current
      script collects `all_referenced_tests` but never checks it.
- [ ] 1.2 In `scripts/validate-openspec.py`, after the requirement-parsing loop that builds
      `all_referenced_tests`, add the existence check: for each referenced path not present on
      disk, append an error/warning per `feature-has-test-reference`'s configured severity,
      naming the requirement, spec file, and missing path (per design.md - Decision 1).
- [ ] 1.3 Re-run `scripts/test_validate_openspec.py` and watch the dangling-reference test pass.
- [ ] 1.4 Run `python3 scripts/validate-openspec.py` against the live repo tree and confirm it
      reports zero dangling references today (or fix any it finds, since the script must be
      green before this change lands per the calculation-logic-adjacent "no red" gate posture).

## 2. Capability-scoped test→spec matching

- [ ] 2.1 Add a failing case to `scripts/test_validate_openspec.py`: a test file mapped to
      capability A in `MAPPING` that only cites capability B's `spec.md` must produce a
      capability-mismatch error. Watch it fail against the current any-link behavior.
- [ ] 2.2 In `scripts/validate-openspec.py`'s test→spec loop, replace the "any
      `openspec/specs/*/spec.md` reference" check with: if the test file's path is a value in
      some capability's `MAPPING` entry, require a reference to that capability's own
      `spec.md`; otherwise keep the existing any-capability-link check (per design.md -
      Decision 2).
- [ ] 2.3 Re-run `scripts/test_validate_openspec.py` and watch the new case pass, and confirm
      the existing dangling-reference tests from Section 1 still pass.
- [ ] 2.4 Run `python3 scripts/validate-openspec.py` against the live repo tree; fix any test
      file it flags as citing the wrong capability (update its spec-link comment) so the script
      is green before this change lands.

## 3. Wire coverage into the gated commands

- [ ] 3.1 Add `"test:coverage": "vitest run --coverage"` to `package.json`'s `scripts` block.
- [ ] 3.2 Update `scripts/hooks-local/pre-commit` to invoke `npm run test:coverage` in place of
      `npm run test:unit` (design.md - Decision 3).
- [ ] 3.3 Update `scripts/health-check.sh`'s "Unit tests" step to invoke `npm run test:coverage`
      in place of `npm run test:unit`.
- [ ] 3.4 Leave `test`, `check`, and `ci` npm scripts on `test:unit` unchanged (design.md -
      Decision 3 — those are not the enforcement points).
- [ ] 3.5 Run `npm run test:coverage` locally and confirm it fails closed if a threshold is
      deliberately violated (e.g. temporarily lower one threshold value below current coverage,
      confirm non-zero exit, then restore it) — this is the "watch it fail" step for the gate
      itself, since there is no pre-existing failing-coverage fixture to reuse.

## 4. Coverage ratchet

- [ ] 4.1 Set `coverage.thresholds.autoUpdate: true` in `vitest.config.ts` (design.md -
      Decision 4).
- [ ] 4.2 Run `npm run test:coverage` and confirm `vitest.config.ts`'s threshold numbers update
      upward to match actual current coverage (or stay unchanged if already at the ceiling);
      review the diff (`git diff vitest.config.ts`) before staging it — the rewritten numbers
      are the new committed floor.
- [ ] 4.3 Stage the resulting `vitest.config.ts` change alongside this change's other files, per
      design.md - Risks ("re-stage if the coverage step modifies it").

## 5. Spec-traceability comments

- [ ] 5.1 Add a top-level comment to `scripts/test_validate_openspec.py` linking
      `openspec/specs/quality-gates/spec.md` (the two spec→test / test→spec requirements) —
      note this file lives outside `packages/` so it is not auto-scanned by
      `validate-openspec.py` itself, but the link keeps the convention consistent.
- [ ] 5.2 Confirm no `packages/**/*.test.ts` or `*.spec.ts` file needs a new/changed
      spec-traceability comment for this change (verify: no test files under `packages/` were
      added or had their capability changed by this change — the new tests are Python, outside
      `packages/`).

## 6. Full gate

- [ ] 6.1 Run `bash scripts/health-check.sh` (lint + typecheck + unit-with-coverage + browser)
      and confirm 100% green, including the now-enforced coverage step.
- [ ] 6.2 Run `python3 scripts/validate-openspec.py` standalone and confirm a clean pass (both
      new checks report zero errors against the final tree).
- [ ] 6.3 Note the known limitation from design.md - Risks in the change's final summary: the
      capability-match check (Section 2) only covers test files already listed in `MAPPING`; a
      test file absent from `MAPPING` entirely is unaffected by this change.
