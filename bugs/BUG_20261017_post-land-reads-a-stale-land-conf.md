# BUG_20261017_post-land-reads-a-stale-land-conf

**Status:** FIXED (T284)

## Symptom
After T266 made GitHub Actions the gate, the post-land run on f1a44803d3 (T283) still ran the laptop suite.

## Cause
`scripts/land/post-land/run.sh` read its settings and helper scripts from the main checkout: `land.conf`
(`FULL_SUITE_CMD` and the post-land settings), `scripts/paths.sh`, `browser-runs.sh`, `slice-events.sh` and
`scripts/visual/failures-page.sh`. The watchdog also starts run.sh from that checkout. The main checkout
sat 12 commits behind main (at 2082773a, from before T266): another session's uncommitted files
(`questions.yml`, an untracked bug file) kept it from fast-forwarding.

## Fix
- run.sh re-starts itself from a snapshot of origin/main's `scripts/` and `land.conf` (`git archive`,
  removed when the run ends). Every script and setting it reads is origin/main's; the main checkout is
  used only for git. A run started from an old run.sh (the watchdog's) picks this up once that checkout
  has this commit.
- The suite command is the tested commit's own `land.conf` (printed: "post-land: suite command (from <sha>): …").
- Tests: cases 8 and 9 of `scripts/land/test/post-land-actions.e2e.test.sh` (a lagging checkout with
  broken local files still runs origin/main's scripts and settings).

## Not covered here
The watchdog itself (`scripts/land/watchdog.sh`, started by the systemd unit from the main checkout)
still runs the main checkout's copy.
