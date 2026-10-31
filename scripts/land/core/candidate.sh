#!/usr/bin/env bash
# The candidate gate, shared by scripts/land.sh and scripts/integrate.sh: main moves only after the full suite
# is green on GitHub Actions for the exact commit about to be pushed. Sourced, after gate.sh.
#
#   candidate_gate <candidate-branch> [after-push-function]
#
# Pushes HEAD to <candidate-branch> on origin (the push starts the Actions suite), calls the optional function
# once the push is done, then runs CANDIDATE_CMD under CANDIDATE_DEADLINE_S (it waits for the run on HEAD and
# exits 0 only on green; scripts/land/post-land/actions.sh). An unset CANDIDATE_CMD, a failed push or a red or
# missing run refuses with gate `candidate`. The caller's task label never bypasses it.
# The caller provides: refuse, run_gate (or CANDIDATE_RUN_GATE naming its wrapper), net, WORK, GATE_OUT, ID,
# and a cleanup that deletes $CANDIDATE_BRANCH from origin (set here, so the cleanup knows what to remove).
candidate_gate() {
  local branch="$1" after_push="${2:-}" runner="${CANDIDATE_RUN_GATE:-run_gate}"
  [ -n "${CANDIDATE_CMD:-}" ] || { GATE_OUT=/dev/null; refuse candidate "CANDIDATE_CMD is not set in land.conf; main moves only after the full suite is green on the candidate"; }
  CANDIDATE_BRANCH="$branch"
  GATE_OUT="$WORK/candidate.out"
  net "git push of the candidate" git push -q -f origin "HEAD:refs/heads/$CANDIDATE_BRANCH" > "$GATE_OUT" 2>&1 \
    || refuse candidate "origin rejected, or did not answer, the push of the candidate to $CANDIDATE_BRANCH"
  echo "${CANDIDATE_LOG_PREFIX:-land}: candidate $(git rev-parse --short=10 HEAD) is on $CANDIDATE_BRANCH; waiting for GitHub Actions (about 4 min)"
  [ -z "$after_push" ] || "$after_push"
  GATE_DEADLINE_S="${CANDIDATE_DEADLINE_S:-$GATE_DEADLINE_S}" "$runner" candidate /dev/null "$CANDIDATE_CMD"
  grep -m1 'actions: run ' "$GATE_OUT" | sed "s/^.*actions: /${CANDIDATE_LOG_PREFIX:-land}: candidate green: /" || true  # no run line (a stub CANDIDATE_CMD) is not a failure; the caller may run under set -e
}
