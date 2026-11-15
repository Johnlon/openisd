# The main-red summary counted expected failures as failures

Found 15 Nov 2026 (T800). The investigation of suite red on main (`SUITE_RED.md`, `failing.json`) read each Playwright result's `status` (`failed`). A `test.fail` test that fails as expected has result status `failed` but test outcome `expected`; only `unexpected` is a failure. Run f22977e2 had 59 real non-visual failures, not 67: layout-long-values (4) and screen-sizes (9) are expected failures with bug files.

Effect: a report that counts them sends people to fix tests that are red on purpose.

Next: find the tooling that builds the red summary (report page, the `main-red` issue body) and make it count the test's `status === 'unexpected'`, with a test over a report holding one expected failure.

Fixed (T815, 15 Nov 2026): the tooling that builds the failure lists is `scripts/extract-failing-tests.mjs`, `scripts/analyze-telemetry.mjs` and `scripts/rerun-failing-tests.mjs` (the `main-red` issue body names no count). They count through `scripts/lib/testOutcome.mjs` (telemetry event `expected`, report `outcome === 'unexpected'`). Test: `packages/ui/test/scripts/test-outcome.test.ts`.
