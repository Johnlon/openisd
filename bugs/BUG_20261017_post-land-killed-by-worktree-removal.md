# BUG_20261017_post-land-killed-by-worktree-removal

**Status:** OPEN (owner maryu; investigation starts once T266 is live)

## Symptom
The laptop post-land run on 788a5c4ea3 ended "killed by signal at 788a5c4ea3, not superseded" while it
waited for the browser lock, and was recorded red (F49). Its log shows it ran from
`openisd-t264/scripts/land/post-land/run.sh`, and "suite-run.lock.waiting: No such file or directory".

## Suspected cause (to confirm)
The landing worktree openisd-t264 was removed (`git worktree remove`) right after its land.sh, while the
post-land run it started was still waiting. Confirm from housekeeping.log and the run's own log, then fix
it at the cause: a post-land run must not depend on the landing worktree, or land.sh must say when that
worktree is safe to remove.
