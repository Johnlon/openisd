# BUG_20261017_post-land-killed-by-worktree-removal

**Status:** CLOSED: not a separate fault (T283)

## Symptom
The laptop post-land run on 788a5c4ea3 ended "killed by signal at 788a5c4ea3, not superseded" while it
waited for the browser lock, and was recorded red (F49). Its log shows it ran from
`openisd-t264/scripts/land/post-land/run.sh`, and "suite-run.lock.waiting: No such file or directory".

## Suspected cause (to confirm)
The landing worktree openisd-t264 was removed (`git worktree remove`) right after its land.sh, while the
post-land run it started was still waiting. Confirm from housekeeping.log and the run's own log, then fix
it at the cause: a post-land run must not depend on the landing worktree, or land.sh must say when that
worktree is safe to remove.

## Finding (T283)
Not the worktree removal. watchdog.log, 02:22:31Z: "post-land run 3904718 (788a5c4ea3) hung: no log growth
and under 1 s of CPU in 1380s; killing group". The run had gone silent after its test server died (its last
visual specs took 26-39 s, then failed in about 7 ms). The watchdog's kill was correct; the fault is the
server death, BUG_20261017_laptop-suite-server-dies-mid-run.
