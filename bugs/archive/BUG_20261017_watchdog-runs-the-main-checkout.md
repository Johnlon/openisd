# BUG_20261017_watchdog-runs-the-main-checkout

**Status:** FIXED (T291)

## Symptom
The main checkout sat 12 commits behind main on 17 Oct, held by another session's uncommitted files. The
watchdog (systemd unit, `ExecStart` on the main checkout's `scripts/land/watchdog.sh`) kept running that
old code, and started post-land runs from that checkout's old `run.sh`.

## Cause
The watchdog took everything from the main checkout:
- its own script and helpers;
- `land.conf`;
- the `run.sh` it starts;
- the open-F list (`tasks/fixes/F*.yml` as files in the checkout, aged by file time).

Its infra-F check wrote a new F file into the checkout. A file like that keeps the checkout from following
main.

## Fix
- Each tick re-starts itself from a snapshot of origin/main's `scripts/` and `land.conf` (`git archive`,
  removed when the tick ends). The main checkout is used only for git and for the logs under `build/`.
- Open Fs are read from origin/main (`git ls-tree`/`git show`); an F's age is the time of the last commit
  that touched it.
- The infra F goes to `$STATE/infra/F<n>.yml`; the alert says to land it from a task worktree.
- The post-land run it starts is copied to `$STATE`, then re-starts itself from its own origin/main snapshot (T284).
- Tests: `scripts/land/test/watchdog.test.sh`:
  - an F only in the main checkout is not alerted;
  - no infra F is written into the checkout;
  - a tick with broken checkout scripts runs origin/main's;
  - the snapshot is removed.
