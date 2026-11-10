#!/usr/bin/env bash
# T767 (QO528): every pull request records why. Scratch repo, real git, the live gate scripts:
# pr-task.sh + check-task-contract.sh --pr refuse a PR with no task, a task without a good why, a deleted or renamed
# task file; they pass a hash-only edit and an abandon-style status edit of an old task.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/pr-why-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/pr-why.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

cd "$SCRATCH" && git init -q r && cd r || exit 2
mkdir -p scripts tasks src
cp -r "$REPO/scripts/land" scripts/; cp "$REPO/scripts/paths.sh" scripts/
printf 'GATE_FILES="eslint.config.js"\n' > land.conf
GOOD='John asked for this change (John, 10 Nov 2026)'
# an old task with no why, one with a locked file
printf 'id: T90\nowner: t\nstatus: open\ngoal: old\ndone_test: true\nlocked:\n  - path: src/l.ts\n    sha256: 0000\nfiles:\n  - src/**\n' > tasks/T90.yml
printf 'id: T91\nowner: t\nstatus: open\ngoal: old two\ndone_test: true\nfiles:\n  - src/**\n' > tasks/T91.yml
echo 1 > src/a.ts; echo l > src/l.ts; git add -A; git commit -qm base

# task <id> <why-line-or-empty> [goal]
task() { { printf 'id: %s\nowner: t\nstatus: open\ngoal: %s\n' "$1" "${3:-a goal}"; [ -z "$2" ] || printf 'why: %s\n' "$2"; printf 'done_test: true\nfiles:\n  - src/**\n'; } > "tasks/$1.yml"; }
fresh() { git switch -q main; git switch -q -c "$1"; }
commit() { git add -A; git commit -qm "(auto) x: $1"; }
# verdict: runs both scripts for the ids pr-task names; prints pass or the first refusal text
verdict() {
  local ids out id others o
  ids="$(bash scripts/land/pr-task.sh main HEAD 2>&1)" || { echo "refuse: $ids"; return; }
  for id in $ids; do
    others=(); for o in $ids; do [ "$o" = "$id" ] || others+=("$o"); done
    out="$(bash scripts/land/check-task-contract.sh "$id" main HEAD --pr "${others[@]}")" || { echo "refuse: $out"; return; }
  done
  echo pass
}
expect() { # <name> <pass|refuse> [grep pattern]
  local v; v="$(verdict)"
  case "$2:$v" in
    pass:pass) ok "$1" ;;
    refuse:refuse*) if [ -z "${3:-}" ] || grep -q -- "$3" <<< "$v"; then ok "$1"; else bad "$1 (refused for another reason: $v)"; fi ;;
    *) bad "$1 ($v)" ;;
  esac
}

fresh c1; echo 2 > src/a.ts; commit nothing;               expect "no task file is refused" refuse "no tasks"
fresh c2; task T1 "$GOOD"; echo 2 > src/a.ts; commit ok;   expect "task with a good why passes" pass
fresh c3; task T1 ""; echo 2 > src/a.ts; commit nowhy;     expect "task without why is refused" refuse "lacks: why"
fresh c4; task T1 "                    "; echo 2 > src/a.ts; commit blank; expect "blank why is refused" refuse "lacks: why"
fresh c5; task T1 "short (QO1)"; echo 2 > src/a.ts; commit short; expect "why under 20 characters is refused" refuse "under 20"
fresh c6; task T1 "same words as the goal here (John, 1 Nov 2026)" "same words as the goal here (John, 1 Nov 2026)"; echo 2 > src/a.ts; commit same
expect "why equal to goal is refused" refuse "repeats the goal"
fresh c7; task T1 "because it seemed like a sensible thing to do"; echo 2 > src/a.ts; commit noperson; expect "why with no person+date or id is refused" refuse "names no person"
fresh c8; task T1 "the bug file records the failure, see QO528 for the choice"; echo 2 > src/a.ts; commit qo; expect "why citing a QO id passes" pass
fresh c9; sed -i 's/sha256: 0000/sha256: 1111/' tasks/T90.yml; task T1 "$GOOD"; echo 2 > src/l.ts; commit hash
printf 'id: T90\nowner: t\nstatus: open\ngoal: old\ndone_test: true\nlocked:\n  - path: src/l.ts\n    sha256: %s\nfiles:\n  - src/**\n' "$(sha256sum src/l.ts | cut -d' ' -f1)" > tasks/T90.yml; commit hash2
[ "$(bash scripts/land/pr-task.sh main HEAD)" = T1 ] && ok "hash-only edit of an old task with no why is not counted and passes" || bad "hash-only edit counted"
fresh c10; sed -i 's/^status: open/status: abandoned/' tasks/T91.yml; task T1 "$GOOD"; echo 2 > src/a.ts; commit abandon
v="$(bash scripts/land/check-task-contract.sh T91 main HEAD --pr T1)"; grep -q 'lacks: why' <<< "$v" && bad "abandon edit of an old task wanted a why" || ok "abandon (status-only) edit of an old task needs no why"
fresh c11; task T1 "$GOOD"; git rm -q tasks/T91.yml; commit del;   expect "a deleted task file is refused" refuse "never deleted"
fresh c12; task T1 "$GOOD"; git mv tasks/T91.yml tasks/T92.yml; commit rename; expect "a renamed task file is refused" refuse "never deleted"
fresh c13; task T1 "$GOOD"; task T2 ""; echo 2 > src/a.ts; commit two; expect "two tasks, one lacking why, is refused" refuse "lacks: why"
fresh c14; task T1 "$GOOD"; task T2 "$GOOD, second"; echo 2 > src/a.ts; commit two; expect "two tasks both with why pass" pass

echo "pr-why: $([ "$fails" = 0 ] && echo 'all passed' || echo "$fails failed")"
[ "$fails" = 0 ]
