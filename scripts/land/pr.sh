#!/usr/bin/env bash
# The GitHub record of a landing: a pull request from its candidate branch land/<task> to main (T331, John 17 Oct
# 2026: "of course it should be pr"). land.sh opens it when it pushes the candidate, and main still moves only by
# land.sh's fast-forward push of the tested commit, so main's sha is the one the run passed; GitHub then shows the
# pull request as merged. A refused landing closes it, saying why.
#
#   pr.sh open <task-id> <branch> <title> <body-file>   prints the pull request's number (an open one already on the
#                                                       branch is reused, saying so on stderr)
#   pr.sh close <number> <reason>                       comments the reason, closes it
#   pr.sh state <number>                                prints OPEN, CLOSED or MERGED
#   pr.sh queued <number>                               exit 0 and prints merged | auto-merge | in-merge-queue when GitHub holds
#                                                       the pull request that way; exit 1 and prints NOT queued otherwise (T815)
#   pr.sh queue <number>                                gh pr merge --auto --squash, then `queued`: exit 1 when GitHub still has
#                                                       no request and no queue entry (the merge call can exit 0 and leave none)
#                                                       exit 4 and `HELD` when the pull request carries the label `hold` (nothing is queued)
#   pr.sh label <number> <label>                        adds a label with the REST call. `gh pr edit --add-label` fails on this
#                                                       repo (Projects classic GraphQL deprecation); never use it
#
# Env: ACTIONS_REPO (owner/name, from land.conf), LAND_GH (default gh; the tests put a stand-in here).
set -uo pipefail
GH="${LAND_GH:-gh}"
REPO="${ACTIONS_REPO:?pr.sh: ACTIONS_REPO is not set}"
die() { echo "pr.sh: $*" >&2; exit 1; }
# Every gh call is a network call: bounded (LAND_NET_TIMEOUT_S, default 120) so a stall cannot hold the landing lock.
NET_TIMEOUT_S="${LAND_NET_TIMEOUT_S:-120}"
gh_net() { timeout -k 5 "$NET_TIMEOUT_S" "$GH" "$@"; }
timed_out() { [ "$1" = 124 ] || [ "$1" = 137 ]; }

case "${1:-}" in
  open)
    [ $# = 5 ] || die "usage: pr.sh open <task-id> <branch> <title> <body-file>"
    # A run that died or was refused after opening its pull request can leave it open on the branch, and GitHub
    # opens no second one (T538). This run reuses it: the branch already carries this run's candidate, and the
    # pull request takes this run's title and body.
    open_num="$(gh_net pr list --repo "$REPO" --head "$3" --state open --json number --jq '.[].number' 2>&1)" || {
      timed_out $? && die "gh pr list timed out after ${NET_TIMEOUT_S}s for $2 (the network stalled)"
      die "gh could not list the pull requests on $3: $(tail -2 <<< "$open_num" | tr '\n' ' ')"
    }
    open_num="$(head -n 1 <<< "$open_num")"
    if [ -n "$open_num" ]; then
      [[ "$open_num" =~ ^[0-9]+$ ]] || die "gh listed no pull request number for $3: $open_num"
      # REST, not `gh pr edit`: that is a GraphQL call and fails on this repo (Projects classic deprecation), which made every re-ship refuse (T815)
      gh_net api -X PATCH "repos/$REPO/pulls/$open_num" -f "title=$4" -F "body=@$5" > /dev/null 2>&1 \
        || die "gh could not retitle pull request #$open_num on $3"
      echo "pull request #$open_num was already open on $3; this run reuses it" >&2
      echo "$open_num"
      exit 0
    fi
    url="$(gh_net pr create --repo "$REPO" --base main --head "$3" --title "$4" --body-file "$5" 2>&1)" || {
      timed_out $? && die "gh pr create timed out after ${NET_TIMEOUT_S}s for $2 (the network stalled)"
      die "gh refused to open a pull request for $2: $(tail -2 <<< "$url" | tr '\n' ' ')"
    }
    num="$(grep -oE '/pull/[0-9]+' <<< "$url" | tail -n 1)"
    [ -n "$num" ] || die "gh opened no pull request for $2: $url"
    echo "${num#/pull/}"
    ;;
  close)
    [ $# = 3 ] || die "usage: pr.sh close <number> <reason>"
    gh_net pr close "$2" --repo "$REPO" --comment "$3" > /dev/null 2>&1 || die "gh could not close pull request #$2"
    ;;
  state)
    [ $# = 2 ] || die "usage: pr.sh state <number>"
    gh_net pr view "$2" --repo "$REPO" --json state --jq .state 2> /dev/null || die "gh could not read pull request #$2"
    ;;
  queued)
    [ $# = 2 ] || die "usage: pr.sh queued <number>"
    view="$(gh_net pr view "$2" --repo "$REPO" --json state,autoMergeRequest --jq '.state + " " + (if .autoMergeRequest then "auto" else "none" end)' 2> /dev/null)" \
      || { echo "NOT queued (gh could not read pull request #$2)"; exit 1; }
    case "$view" in
      MERGED*) echo merged; exit 0 ;;
      "OPEN auto") echo auto-merge; exit 0 ;;
      "OPEN none")
        inq="$(gh_net api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){isInMergeQueue}}}' \
          -f o="${REPO%%/*}" -f r="${REPO#*/}" -F n="$2" --jq .data.repository.pullRequest.isInMergeQueue 2> /dev/null)"
        [ "$inq" = true ] && { echo in-merge-queue; exit 0; }
        echo "NOT queued (pull request #$2 is open with no auto-merge request and is not in the merge queue)"; exit 1 ;;
      *) echo "NOT queued (pull request #$2 is $view)"; exit 1 ;;
    esac
    ;;
  queue)
    [ $# = 2 ] || die "usage: pr.sh queue <number>"
    # A pull request a lead or reviewer holds (label `hold`) is never queued by an author (T815). Exit 4: HELD. Labels that cannot be read refuse (exit 1).
    labels="$(gh_net api "repos/$REPO/issues/$2/labels" --jq '.[].name' 2> /dev/null)" \
      || { echo "NOT queued: cannot read the labels of pull request #$2, so a hold cannot be ruled out" >&2; exit 1; }
    if grep -qx hold <<< "$labels"; then
      echo "HELD: pull request #$2 has the label hold; not queued. Whoever set the hold removes the label, then: bash scripts/land/pr-queue.sh $2" >&2
      exit 4
    fi
    out="$(gh_net pr merge "$2" --repo "$REPO" --auto --squash 2>&1)"; mrc=$?
    if verdict="$(bash "${BASH_SOURCE[0]}" queued "$2")"; then echo "queued: $verdict"; exit 0; fi
    printf '%s\n' "$out" | tail -3 >&2
    echo "$verdict; gh pr merge exited $mrc. Run: gh pr merge $2 -R $REPO --auto --squash" >&2
    exit 1
    ;;
  label)
    [ $# = 3 ] || die "usage: pr.sh label <number> <label>"
    gh_net api -X POST "repos/$REPO/issues/$2/labels" -f "labels[]=$3" > /dev/null 2>&1 || die "gh could not add label $3 to pull request #$2"
    ;;
  *) die "usage: pr.sh open|close|state|queued|queue|label ..." ;;
esac
