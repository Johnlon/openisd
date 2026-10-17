#!/usr/bin/env bash
# The GitHub record of a landing: a pull request from its candidate branch land/<task> to main (T331, John 17 Oct
# 2026: "of course it should be pr"). land.sh opens it when it pushes the candidate, and main still moves only by
# land.sh's fast-forward push of the tested commit, so main's sha is the one the run passed; GitHub then shows the
# pull request as merged. A refused landing closes it, saying why.
#
#   pr.sh open <task-id> <branch> <title> <body-file>   prints the pull request's number
#   pr.sh close <number> <reason>                       comments the reason, closes it
#   pr.sh state <number>                                prints OPEN, CLOSED or MERGED
#
# Env: ACTIONS_REPO (owner/name, from land.conf), LAND_GH (default gh; the tests put a stand-in here).
set -uo pipefail
GH="${LAND_GH:-gh}"
REPO="${ACTIONS_REPO:?pr.sh: ACTIONS_REPO is not set}"
die() { echo "pr.sh: $*" >&2; exit 1; }

case "${1:-}" in
  open)
    [ $# = 5 ] || die "usage: pr.sh open <task-id> <branch> <title> <body-file>"
    url="$("$GH" pr create --repo "$REPO" --base main --head "$3" --title "$4" --body-file "$5" 2>&1)" \
      || die "gh refused to open a pull request for $2: $(tail -2 <<< "$url" | tr '\n' ' ')"
    num="$(grep -oE '/pull/[0-9]+' <<< "$url" | tail -n 1)"
    [ -n "$num" ] || die "gh opened no pull request for $2: $url"
    echo "${num#/pull/}"
    ;;
  close)
    [ $# = 3 ] || die "usage: pr.sh close <number> <reason>"
    "$GH" pr close "$2" --repo "$REPO" --comment "$3" > /dev/null 2>&1 || die "gh could not close pull request #$2"
    ;;
  state)
    [ $# = 2 ] || die "usage: pr.sh state <number>"
    "$GH" pr view "$2" --repo "$REPO" --json state --jq .state 2> /dev/null || die "gh could not read pull request #$2"
    ;;
  *) die "usage: pr.sh open|close|state ..." ;;
esac
