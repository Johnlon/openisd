#!/usr/bin/env bash
# The pr-gate `hold` job (T815, lead, 15 Nov 2026): red while the pull request carries the label `hold`.
#
#   env: EVENT (pull_request | merge_group), REPO, GH_TOKEN, PR_NUMBER (pull_request), HEAD_REF (merge_group: the queue's
#        branch gh-readonly-queue/main/pr-<n>-<sha>), GH_BIN (default gh; the test's stand-in)
#
# A lead or reviewer holds a pull request by adding the label `hold`; nothing an author does (ship.sh, a push, gh pr merge --auto)
# can then merge it, because the required check pr-gate needs this job. Labels are read live from the API, not from the event
# payload, so a rerun sees the label as it is now; the workflow also runs on labeled and unlabeled, so lifting the hold
# re-runs the gate. A label list that cannot be read fails the job: a hold must never be lost to a network error.
set -uo pipefail
GH="${GH_BIN:-gh}"
case "${EVENT:?EVENT not set}" in
  pull_request) n="${PR_NUMBER:?PR_NUMBER not set}" ;;
  merge_group) n="$(sed -n 's|^.*/pr-\([0-9][0-9]*\)-.*$|\1|p' <<< "${HEAD_REF:-}")"
    [ -n "$n" ] || { echo "::error title=hold::cannot find the pull request number in the merge group branch '${HEAD_REF:-}'"; exit 1; } ;;
  *) echo "::error title=hold::event '$EVENT' is not pull_request or merge_group"; exit 1 ;;
esac
labels="$("$GH" api "repos/${REPO:?REPO not set}/issues/$n/labels" --jq '.[].name')" \
  || { echo "::error title=hold::cannot read the labels of pull request #$n; failing rather than guessing it is not held"; exit 1; }
if grep -qx hold <<< "$labels"; then
  echo "::error title=hold::pull request #$n is HELD (label hold). It cannot merge until the label is removed, whatever else is green."
  exit 1
fi
echo "hold: pull request #$n has no hold label"
