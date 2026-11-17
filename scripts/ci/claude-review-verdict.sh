#!/usr/bin/env bash
# Turns Claude's written verdict into this check's colour (T818, John 15 Nov 2026: "non-blocking alerts get ignored").
#
#   bash scripts/ci/claude-review-verdict.sh <repo> <pr-number> <kind> <run-id>
#
# The review skills end by posting one pull request comment whose first line is
#     <!-- claude-review:<kind> run=<run-id> head=<sha> -->
# and whose next line is `Verdict: CLEAR`, `Verdict: CONCERNS` or `Verdict: SKIPPED`. This script reads that comment
# (the one the workflow's own token posted, for this run) and exits 0 for CLEAR and SKIPPED, 1 for CONCERNS and for no
# verdict at all: a review that produced nothing must not look like a pass. The check is red, in the pull request's list
# of checks, but it is not part of the required `pr-gate`: an AI never blocks the merge, and a red mark cannot be missed.
# GH (default `gh`) is the command that reads the comments; the shell test replaces it.
set -uo pipefail
repo="${1:?usage}"; pr="${2:?usage}"; kind="${3:?usage}"; run="${4:?usage}"
GH="${GH:-gh}"
marker="<!-- claude-review:$kind run=$run "
raw="$("$GH" api --paginate "repos/$repo/issues/$pr/comments" --jq '.[] | {u: .user.login, b: .body} | tojson')" \
  || { echo "::error title=claude-review ($kind)::could not read the pull request's comments"; exit 1; }
verdict="$(printf '%s\n' "$raw" | MARKER="$marker" python3 -I -c '
import json, os, re, sys
marker, found = os.environ["MARKER"], "NONE"
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    c = json.loads(line)
    if c["u"] != "github-actions[bot]" or not c["b"].startswith(marker):
        continue
    m = re.search(r"^Verdict: (CLEAR|CONCERNS|SKIPPED)\s*$", c["b"], re.M)
    found = m.group(1) if m else "UNREADABLE"
print(found)
')"
case "$verdict" in
  CLEAR|SKIPPED) echo "claude-review ($kind): $verdict"; exit 0 ;;
  CONCERNS) echo "::error title=claude-review ($kind)::Claude has concerns: read its comments on the pull request, then fix them or answer each on the pull request. This check is advisory (not in pr-gate)."; exit 1 ;;
  NONE) echo "::error title=claude-review ($kind)::Claude posted no verdict for this run (turn limit, tool error or no credential): the review did not happen. Read the run log; re-run the job."; exit 1 ;;
  *) echo "::error title=claude-review ($kind)::Claude's comment has no readable 'Verdict:' line"; exit 1 ;;
esac
