#!/usr/bin/env bash
# The pull request check's task contract, run from the BASE revision's own scripts (T934 review 3, Codex 19 Nov 2026: the
# check ran the proposed checker, so a change could edit the checker that polices it).
#
#   git show <base>:scripts/ci/contract-from-base.sh > runner.sh; bash runner.sh <base> <scripts commit>     from the checkout root, HEAD = the change
#
# pr.yml's gate-approval job takes this file from the base commit, never from the change, and passes the base as <scripts
# commit>; only the one reviewed bootstrap (pr.yml's BOOTSTRAP_BASE) passes the change's own commit. It extracts <scripts commit>'s scripts/land/ into a
# temporary directory and runs that copy's pr-task.sh (which tasks the change carries) and check-task-contract.sh (locked
# hashes, files allowlist, task id and owner, status, gate files approved) once per task, the other carried tasks named after
# --pr. The change's land.conf, task files and file list are read by those scripts as data (git show, sed, the YAML
# parser); nothing of the change is run. GATE_FILES and QUESTIONS_FILE are unset, so the checker reads them from land.conf.
# Exit 0 clean, 1 refused (GitHub annotations plus the checker's REFUSE lines on stdout), 2 cannot run.
set -uo pipefail
base="${1:?usage: contract-from-base.sh <base commit> <scripts commit>}"; scripts="${2:?usage: contract-from-base.sh <base commit> <scripts commit>}"
git cat-file -e "$base^{commit}" 2> /dev/null || git fetch -q origin "$base" || { echo "contract-from-base: no commit $base" >&2; exit 2; }
trusted="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/contract-from-base.XXXXXX")" || exit 2
trap 'rm -rf "$trusted"' EXIT
git archive "$scripts" scripts/land | tar -x -C "$trusted" || { echo "contract-from-base: cannot extract scripts/land from $scripts" >&2; exit 2; }
unset GATE_FILES QUESTIONS_FILE
tasks="$(bash "$trusted/scripts/land/pr-task.sh" "$base" HEAD)" || exit 1
rc=0
for t in $tasks; do
  others=(); for o in $tasks; do [ "$o" = "$t" ] || others+=("$o"); done
  out="$(bash "$trusted/scripts/land/check-task-contract.sh" "$t" "$base" HEAD --pr "${others[@]}")" \
    && { printf '%s\n' "$out" | awk -F'\t' '$1 == "WARN" { printf "::warning title=task contract (%s)::%s\n", $2, $3 }'; continue; }
  printf '%s\n' "$out" | awk -F'\t' '$1 == "REFUSE" { printf "::error title=task contract (%s)::%s\n", $2, $3 }'; printf '%s\n' "$out"; rc=1
done
exit "$rc"
