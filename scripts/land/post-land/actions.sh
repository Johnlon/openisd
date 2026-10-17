#!/usr/bin/env bash
# The full suite of the post-land run on GitHub Actions (FULL_SUITE_CMD in land.conf, John 17 Oct 2026:
# "Switch to Actions"). run.sh starts it in the clean copy of the landed sha; this script waits for the
# Actions run on that commit (.github/workflows/suite.yml: the candidate run on land/<task>) and reports it:
#   green: exit 0;
#   red:   prints the failed jobs' logs (vitest's " FAIL " and Playwright's "✘" lines, which run.sh lists in
#          the F) and puts the failing screens' pictures in test-results/ (run.sh's visual page reads them);
#          exit 1;
#   no run, or GitHub cannot be read: exit 2, which run.sh records as a red. Never a green.
# Config in land.conf (the copy's own, or the environment): ACTIONS_REPO (owner/name), ACTIONS_WORKFLOW (default suite.yml), ACTIONS_FIND_S (how
# long the run may take to appear after the push, default 600), ACTIONS_POLL_S (default 10).
set -uo pipefail
# The working directory is the clean copy of the commit under test: run.sh starts this there.
# The settings of the commit under test, read from its own land.conf (run.sh does not export them).
# shellcheck source=/dev/null
[ -f land.conf ] && . ./land.conf
repo="${ACTIONS_REPO:?ACTIONS_REPO not set (land.conf)}"
workflow="${ACTIONS_WORKFLOW:-suite.yml}"
find_s="${ACTIONS_FIND_S:-600}"
poll_s="${ACTIONS_POLL_S:-10}"
sha="$(git rev-parse HEAD)" || exit 2
# Main has no Actions trigger of its own (T322): every code change reaches main as the commit a candidate run on
# land/<task> passed, and that run is the one found below. A commit that changes only task bookkeeping
# (tasks/, questions.yml; the post-land F commits, a task file fixed by hand) has no run; the suite reads none
# of those files, so its result is the run of its nearest ancestor that changes anything else.
bookkeeping_only() { [ -z "$(git diff --name-only "$1^" "$1" -- . ':!tasks/**' ':!questions.yml')" ]; }
tested="$sha"
while git rev-parse -q --verify "$tested^" > /dev/null && bookkeeping_only "$tested"; do tested="$(git rev-parse "$tested^")"; done
if [ "$tested" != "$sha" ]; then
  echo "actions: ${sha:0:10} changes only task files; its suite result is the run on ${tested:0:10}"
  sha="$tested"
fi

# The owner is run.sh (this script is exec'ed by its suite job). Every wait checks it is still the same
# live process, by pid and start time (processes.md rule 5).
owner="$PPID"
starttime() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }
owner_start="$(starttime "$owner")"
owner_alive() { [ -n "$owner_start" ] && [ "$(starttime "$owner")" = "$owner_start" ]; }

stamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }
echo "actions: start $(stamp) ${sha:0:10} ($repo $workflow)"

# The run is registered a few seconds after the push. GitHub has no call that waits for it, so ask again
# every poll_s, up to find_s.
id=""; started=$SECONDS
while :; do
  id="$(gh run list --repo "$repo" --workflow "$workflow" --event push --commit "$sha" --limit 1 \
        --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null)" || id=""
  [ -z "$id" ] || break
  owner_alive || { echo "actions: owner $owner is gone; stopping"; exit 2; }
  if [ $((SECONDS - started)) -ge "$find_s" ]; then
    echo "actions: no $workflow run on ${sha:0:10} after ${find_s}s (or GitHub cannot be read); red"
    exit 2
  fi
  sleep "$poll_s"
done
echo "actions: run https://github.com/$repo/actions/runs/$id"

gh run watch "$id" --repo "$repo" --interval 30 > /dev/null 2>&1
conclusion="$(gh run view "$id" --repo "$repo" --json conclusion --jq .conclusion 2>/dev/null)" \
  || conclusion=""
# Empty: the watch ended before the run did (network, auth). Not a result.
[ -n "$conclusion" ] || { echo "actions: cannot read the result of run $id; red"; exit 2; }
echo "actions: end $(stamp) ${sha:0:10} run $id $conclusion"
[ "$conclusion" = success ] && exit 0

# Red. The failed jobs' logs, without colour codes, so run.sh's failing-spec lines read cleanly.
# GitHub prefixes each line with "<job>\t<step>\t<timestamp> "; the job is kept: "browser (4): ✘ …".
gh run view "$id" --repo "$repo" --log-failed 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g; s/^([^\t]*)\t[^\t]*\t[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z ?/\1: /'
# The failing screens' pictures: each browser shard uploads its test-results/ as failures-<n>.
dl="$(mktemp -d "${TMPDIR:-/tmp}/actions-failures.XXXXXX")"
if gh run download "$id" --repo "$repo" -p 'failures-*' -D "$dl" > /dev/null 2>&1; then
  mkdir -p test-results
  for shard in "$dl"/*/; do [ -d "$shard" ] && cp -r "$shard". test-results/; done
fi
rm -rf "$dl"
echo "actions: red at ${sha:0:10}: https://github.com/$repo/actions/runs/$id"
exit 1
