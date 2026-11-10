#!/usr/bin/env bash
# T749: the gate scripts the pull request check shares with land.sh, in a scratch repo with real git:
# pr-task.sh (exactly one task file), attribution-range.sh (AI trailer refused), check-task-contract.sh --pr
# (files allowlist, bad status).
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/pr-gates-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/pr-gates.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" && git init -q r && cd r || exit 2
mkdir -p scripts tasks src docs
cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/hooks-local" scripts/
cp "$REPO/scripts/paths.sh" scripts/
printf 'GATE_FILES="eslint.config.js"\n' > land.conf
echo 1 > src/a.ts; git add -A; git commit -qm base
task() { printf 'id: %s\nowner: t\nstatus: %s\ngoal: g\ndone_test: true\nfiles:\n  - src/**\n' "$1" "${2:-open}" > "tasks/$1.yml"; }

git switch -q -c one; task T1; echo 2 > src/a.ts; git add -A; git commit -qm "(auto) T1: x"
[ "$(bash scripts/land/pr-task.sh main HEAD)" = T1 ] && ok "pr-task names the one task" || bad "pr-task names the one task"
bash scripts/land/check-task-contract.sh T1 main HEAD --pr > /dev/null && ok "contract passes a clean change" || bad "contract passes a clean change"
bash scripts/land/attribution-range.sh main HEAD > /dev/null && ok "attribution passes a clean message" || bad "attribution passes a clean message"

echo 3 > docs/x.md; git add -A; git commit -qm "(auto) T1: docs"
out="$(bash scripts/land/check-task-contract.sh T1 main HEAD --pr)"; rc=$?
{ [ "$rc" = 1 ] && grep -q $'REFUSE\tfiles\t.*docs/x.md' <<< "$out"; } && ok "a file outside files: is refused" || bad "a file outside files: is refused ($out)"
bash scripts/land/check-task-contract.sh T1 main HEAD > /dev/null && ok "without --pr the allowlist is not asked" || bad "without --pr the allowlist is not asked"

task T1 weird; git add -A; git commit -qm "(auto) T1: status"
out="$(bash scripts/land/check-task-contract.sh T1 main HEAD --pr)"
grep -q $'REFUSE\ttask-file' <<< "$out" && ok "a bad status is refused" || bad "a bad status is refused ($out)"

task T2; git add -A; git commit -qm "(auto) T2: second"
bash scripts/land/pr-task.sh main HEAD > /dev/null 2>&1 && bad "two task files are refused" || ok "two task files are refused"

printf 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n' > "$SCRATCH/m"; git commit -q --allow-empty -F "$SCRATCH/m"
bash scripts/land/attribution-range.sh main HEAD > /dev/null && bad "an AI trailer is refused" || ok "an AI trailer is refused"

git switch -q main; git switch -q -c none; echo 4 > src/a.ts; git add -A; git commit -qm "(auto) none"
bash scripts/land/pr-task.sh main HEAD > /dev/null 2>&1 && bad "no task file is refused" || ok "no task file is refused"

echo "pr-gates: $([ "$fails" = 0 ] && echo 'all passed' || echo "$fails failed")"
[ "$fails" = 0 ]
