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
task() { printf 'id: %s\nowner: t\nstatus: %s\ngoal: g\nwhy: John asked for this change (John, 10 Nov 2026)\ndone_test: true\nfiles:\n  - src/**\n' "$1" "${2:-open}" > "tasks/$1.yml"; }

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
bash scripts/land/pr-task.sh main HEAD > /dev/null 2>&1 && bad "two task files with a file in neither allowlist are refused" || ok "two task files with a file in neither allowlist are refused"

# T757: another task's file counts for nothing when its ONLY diff is the sha256 of a locked file this change edits
git switch -q main; git switch -q -c lockedhash; mkdir -p tasks
printf 'id: T9\nowner: t\nstatus: done\ngoal: g\ndone_test: true\nlocked:\n  - path: src/b.ts\n    sha256: 0000\nfiles:\n  - src/**\n' > tasks/T9.yml
echo b > src/b.ts; git add -A; git commit -qm "(auto) T9: base"; git switch -q main; git merge -q lockedhash; git switch -q -c hashfix; mkdir -p tasks
task T1; echo b2 > src/b.ts; sed -i 's/sha256: .*/sha256: 1111/' tasks/T9.yml; git add -A; git commit -qm "(auto) T1: edit locked file"
[ "$(bash scripts/land/pr-task.sh main HEAD 2>&1)" = T1 ] && ok "a sha-only change to another task for a changed locked file is not counted" || bad "a sha-only change to another task for a changed locked file is not counted"
sed -i 's/^goal: g/goal: changed/' tasks/T9.yml; git add -A; git commit -qm "(auto) T1: more T9"
[ "$(bash scripts/land/pr-task.sh main HEAD 2>&1)" = "T1 T9" ] && ok "another task with a non-sha change is a carried task" || bad "another task with a non-sha change is a carried task"
git switch -q main; git switch -q -c hashfix2; mkdir -p tasks; task T1; sed -i 's/sha256: .*/sha256: 2222/' tasks/T9.yml; git add -A; git commit -qm "(auto) T1: sha for unchanged file"
[ "$(bash scripts/land/pr-task.sh main HEAD 2>&1)" = "T1 T9" ] && grep -q $'REFUSE\tlocked' <<< "$(bash scripts/land/check-task-contract.sh T9 main HEAD --pr T1)" \
  && ok "a sha change for a file the change does not edit counts as a task and its contract refuses it" || bad "a sha change for a file the change does not edit counts as a task and its contract refuses it"

# T762: a pull request may carry several tasks when every changed file is in at least one allowlist
multi() { printf 'id: %s\nowner: t\nstatus: open\ngoal: g\nwhy: John asked for this change (John, 10 Nov 2026)\ndone_test: true\nfiles:\n  - %s\n' "$1" "$2" > "tasks/$1.yml"; }
git switch -q main; git switch -q -c multi; mkdir -p tasks src docs
multi T3 'src/a.ts'; printf '  - land.conf\n' >> tasks/T3.yml; multi T4 'docs/**'; echo 5 > src/a.ts; echo 6 > docs/y.md; git add -A; git commit -qm "(auto) T3: x"
[ "$(bash scripts/land/pr-task.sh main HEAD 2>&1)" = "T3 T4" ] && ok "two tasks whose allowlists cover every file are both named" || bad "two tasks covering every file are named ($(bash scripts/land/pr-task.sh main HEAD 2>&1))"
bash scripts/land/check-task-contract.sh T3 main HEAD --pr T4 > /dev/null && bash scripts/land/check-task-contract.sh T4 main HEAD --pr T3 > /dev/null \
  && ok "the contract of each carried task passes when the other is named" || bad "the contract passes with the other task named"
out="$(bash scripts/land/check-task-contract.sh T3 main HEAD --pr)"; grep -q $'REFUSE\tfiles\t.*docs/y.md' <<< "$out" \
  && ok "without naming the other task its file is refused" || bad "without the other task its file is refused ($out)"
printf 'GATE_FILES="eslint.config.js src/a.ts"\n' > land.conf; git add -A; git commit -qm "(auto) T3: gate file list"
out="$(bash scripts/land/check-task-contract.sh T4 main HEAD --pr T3)"
grep -q $'REFUSE\tgates' <<< "$out" && ok "a gate file still needs gates_approved on one carried task" || bad "gate file without approval refused ($out)"
printf 'gates_approved: QO1\n' >> tasks/T3.yml; git add -A; git commit -qm "(auto) T3: approved"
bash scripts/land/check-task-contract.sh T4 main HEAD --pr T3 > /dev/null && ok "gates_approved on the other carried task is enough" || bad "gates_approved on a co-task is enough"
echo 7 > src/stray.ts; git add -A; git commit -qm "(auto) T3: stray"
out="$(bash scripts/land/pr-task.sh main HEAD 2>&1)"; rc=$?
{ [ $rc = 1 ] && grep -q 'src/stray.ts' <<< "$out"; } && ok "a file in none of the carried allowlists is refused and named" || bad "stray file refused and named ($out)"

printf 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n' > "$SCRATCH/m"; git commit -q --allow-empty -F "$SCRATCH/m"
bash scripts/land/attribution-range.sh main HEAD > /dev/null && bad "an AI trailer is refused" || ok "an AI trailer is refused"

git switch -q main; git switch -q -c none; echo 4 > src/a.ts; git add -A; git commit -qm "(auto) none"
bash scripts/land/pr-task.sh main HEAD > /dev/null 2>&1 && bad "no task file is refused" || ok "no task file is refused"

# T785: a done_test that selects ONE test inside a test file the change touched is refused (T765 passed that way).
git switch -q main; git switch -q -c narrow; mkdir -p t; printf 'x\n' > t/foo_test.py
printf 'id: T7\nowner: t\nstatus: open\ngoal: g\nwhy: John, 10 Nov 2026, scratch test fixture\ndone_test: python3 -m unittest foo_test.Cls.test_one\nfiles:\n  - t/**\n' > tasks/T7.yml
git add -A; git commit -qm "(auto) T7: x"
out="$(bash scripts/land/check-task-contract.sh T7 main HEAD --pr)"
grep -q $'REFUSE\tdone_test\t.*foo_test.py' <<< "$out" && ok "a done_test narrowed to one test of a touched test file is refused" || bad "narrowed done_test refused ($out)"
git switch -q main; git switch -q -c whole; mkdir -p t; printf 'x\n' > t/foo_test.py
printf 'id: T8\nowner: t\nstatus: open\ngoal: g\nwhy: John, 10 Nov 2026, scratch test fixture\ndone_test: python3 -m unittest foo_test\nfiles:\n  - t/**\n' > tasks/T8.yml
git add -A; git commit -qm "(auto) T8: x"
bash scripts/land/check-task-contract.sh T8 main HEAD --pr > /dev/null && ok "a done_test running the whole test file passes" || bad "whole-file done_test passes"

# T785 review: one refusal per selector kind, a dotted whole-module path and an untouched file pass.
sel() { git switch -q main; git switch -q -c "s$1"; mkdir -p t; printf 'x\n' > t/foo_test.py
  printf 'id: T%s\nowner: t\nstatus: open\ngoal: g\nwhy: John, 10 Nov 2026, scratch test fixture\ndone_test: %s\nfiles:\n  - t/**\n' "$1" "$2" > "tasks/T$1.yml"
  git add -A; git commit -qm "(auto) T$1: x"; bash scripts/land/check-task-contract.sh "T$1" main HEAD --pr; }
n=20
for d in "pytest t/foo_test.py::test_a" "pytest t/foo_test.py -k a" "npx vitest run t/foo_test.py -t a" "node t/foo_test.py --test-name-pattern a" "npx playwright test t/foo_test.py --grep a" "python3 -m unittest foo_test.Cls"; do
  n=$((n+1)); out="$(sel $n "$d")"; grep -q $'REFUSE\tdone_test' <<< "$out" && ok "refused: $d" || bad "refused: $d ($out)"
done
n=$((n+1)); sel $n "python3 -m unittest t.foo_test" > /dev/null && ok "a dotted whole-module path passes" || bad "dotted whole-module path passes"
n=$((n+1)); sel $n "pytest other_test.py -k a" > /dev/null && ok "a selector on an untouched file passes" || bad "untouched file passes"

echo "pr-gates: $([ "$fails" = 0 ] && echo 'all passed' || echo "$fails failed")"
[ "$fails" = 0 ]
