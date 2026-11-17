#!/usr/bin/env bash
# T815 item 9 (lead, 15 Nov 2026): a pull request carrying the label `hold` cannot be queued by anything an author does.
# Two halves: pr.sh queue (so ship.sh and pr-queue.sh) refuses to enable auto-merge on a held PR, and scripts/ci/check-hold.sh
# (the pr-gate `hold` job) fails while the label is on, on the pull request and on the merge group's run. Stand-in gh.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$(mktemp -d "${TMPDIR:-/tmp}/hold.XXXXXX")"; trap 'rm -rf "$S"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }
CALLS="$S/calls"; LABELS="$S/labels"
cat > "$S/gh" <<EOF2
#!/usr/bin/env bash
( IFS='|'; echo "\$*" ) >> "$CALLS"
case "\$1 \$2" in
  "api repos/o/r/issues/7/labels") [ -e "$S/labels.broken" ] && exit 1; cat "$LABELS" ;;
  "pr merge") : > "$S/auto"; echo enabled ;;
  "pr view") if [ -e "$S/auto" ]; then echo "OPEN auto"; else echo "OPEN none"; fi ;;
esac
exit 0
EOF2
chmod +x "$S/gh"; export LAND_GH="$S/gh" ACTIONS_REPO=o/r GH_BIN="$S/gh"

: > "$LABELS"; : > "$CALLS"; rm -f "$S/auto" "$S/labels.broken"
bash "$REPO/scripts/land/pr.sh" queue 7 > "$S/out" 2>&1; r=$?
[ $r = 0 ] && grep -q '^pr|merge|7' "$CALLS" && ok "no hold label: queue enables auto-merge" || fail "unheld queue (r=$r): $(cat "$S/out")"
printf 'fixes\nhold\n' > "$LABELS"; : > "$CALLS"; rm -f "$S/auto"
bash "$REPO/scripts/land/pr.sh" queue 7 > "$S/out" 2>&1; r=$?
[ $r = 4 ] && ! grep -q '^pr|merge' "$CALLS" && grep -q 'HELD' "$S/out" \
  && ok "label hold: queue exits 4, HELD, and never calls gh pr merge" || fail "held queue (r=$r): $(cat "$S/out"); $(cat "$CALLS")"
touch "$S/labels.broken"; : > "$CALLS"
bash "$REPO/scripts/land/pr.sh" queue 7 > "$S/out" 2>&1; r=$?
[ $r = 1 ] && ! grep -q '^pr|merge' "$CALLS" && grep -qi 'labels' "$S/out" \
  && ok "labels unreadable: queue refuses (exit 1), never guesses" || fail "unreadable labels (r=$r): $(cat "$S/out")"
rm -f "$S/labels.broken"

chk() { GH_TOKEN=x REPO=o/r EVENT="$1" PR_NUMBER="${2:-}" HEAD_REF="${3:-}" bash "$REPO/scripts/ci/check-hold.sh" > "$S/out" 2>&1; }
: > "$LABELS"; chk pull_request 7; r=$?
[ $r = 0 ] && ok "check-hold: no label passes" || fail "check-hold clean (r=$r): $(cat "$S/out")"
printf 'hold\n' > "$LABELS"; chk pull_request 7; r=$?
[ $r = 1 ] && grep -q '::error title=hold::' "$S/out" && ok "check-hold: label hold fails the check with a visible message" || fail "check-hold held (r=$r): $(cat "$S/out")"
chk merge_group "" "gh-readonly-queue/main/pr-7-0123abcd"; r=$?
[ $r = 1 ] && ok "check-hold: a held pull request fails in the merge queue too (found from the group's branch name)" || fail "check-hold merge_group (r=$r): $(cat "$S/out")"
: > "$LABELS"; chk merge_group "" "gh-readonly-queue/main/pr-7-0123abcd"; r=$?
[ $r = 0 ] && ok "check-hold: lifted in the queue passes" || fail "check-hold lifted (r=$r)"
touch "$S/labels.broken"; chk pull_request 7; r=$?
[ $r = 1 ] && grep -q 'cannot read' "$S/out" && ok "check-hold: unreadable labels fail the check, never pass" || fail "check-hold unreadable (r=$r): $(cat "$S/out")"
chk merge_group "" "gh-readonly-queue/main/odd-name"; r=$?
[ $r = 1 ] && ok "check-hold: a merge group branch with no pr number fails" || fail "check-hold odd name (r=$r)"

# the workflow runs the check on label changes and the job is required through pr-gate
grep -q 'types: \[opened, synchronize, reopened, labeled, unlabeled\]' "$REPO/.github/workflows/pr.yml" \
  && grep -q 'scripts/ci/check-hold.sh' "$REPO/.github/workflows/pr.yml" && grep -Eq 'needs: \[.*\bhold\b' "$REPO/.github/workflows/pr.yml" \
  && ok "pr.yml: runs on label changes, has the hold job, and pr-gate needs it" || fail "pr.yml does not wire the hold check"

[ $fails = 0 ] && { echo "hold: all passed"; exit 0; }
echo "hold: $fails failed"; exit 1
