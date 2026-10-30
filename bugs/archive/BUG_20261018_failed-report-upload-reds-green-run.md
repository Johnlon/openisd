# A failed report upload turns a green land run red

**Status:** RESOLVED (T405)

Run 39142054368 (T404, doc-only): every test passed, but browser shard 10's `actions/upload-artifact` step for
`report-10` failed with GitHub "server is busy". The job, and so the candidate run, went red.

Cause: in `.github/workflows/suite.yml` the uploads `unit-log-<half>`, `report-<shard>` and `failures-<shard>`
were ordinary steps, so a failed upload failed the job. The reports only feed shard timing
(`scripts/ci/shard-specs.mjs`); the gate reads none of them.

Fix (T405): those three uploads carry `continue-on-error: true` and an `id`; the next step runs on
`steps.<id>.outcome == 'failure'` and emits `::warning` plus a `$GITHUB_STEP_SUMMARY` line naming the artifact.
No test step has continue-on-error; the `test-app` upload stays gating (the browser shards download it). No retry.

Pinned by `scripts/land/test/suite-upload-verdict.test.sh` (red before the edit: 6 failures; green after).

## Re-verified
Re-verified 21 Oct 2026 on main faa577b95: `scripts/land/test/suite-upload-verdict.test.sh` passes (3 uploads checked, 0 failures).
