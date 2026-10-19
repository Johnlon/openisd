#!/usr/bin/env bash
# T476: gates.py refuses Edit/Write/sed -i inside the main folder, and nowhere else.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$(mktemp -d "${TMPDIR:-/tmp}/edit-guard.XXXXXX")"; trap 'rm -rf "$S"' EXIT
GITCFG="$S/gitconfig"; printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
git init -q "$S/main"; git -C "$S/main" commit -q --allow-empty -m base
git -C "$S/main" config openisd.mainFolder "$S/main"
git -C "$S/main" worktree add -q "$S/wt" -b t 2> /dev/null
cp "$REPO/gates.py" "$S/main/gates.py"; cp "$REPO/gates.py" "$S/wt/gates.py"
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
# run <repo> <tool> <json tool_input> <cwd>: exit code of that repo's gate
run() { printf '{"cwd":"%s","tool_input":%s}' "$4" "$3" | GATES_REPO="$1" python3 "$1/gates.py" PreToolUse "$2" 2> "$S/err"; }
run "$S/main" Edit "{\"file_path\":\"$S/main/a.ts\"}" "$S/main"; r=$?
[ $r != 0 ] && grep -q "Edit in a worktree (scripts/new-task.sh), never in the main folder." "$S/err" && ok "Edit in the main folder is refused with the message" || fail "Edit main (r=$r)"
run "$S/main" Write "{\"file_path\":\"a.ts\"}" "$S/main"; r=$?
[ $r != 0 ] && ok "Write with a relative path in the main folder is refused" || fail "Write relative (r=$r)"
run "$S/main" Bash "{\"command\":\"sed -i s/a/b/ a.ts\"}" "$S/main"; r=$?
[ $r != 0 ] && ok "sed -i run from the main folder is refused" || fail "sed -i (r=$r)"
run "$S/main" Bash "{\"command\":\"sed -n 1p a.ts && bash scripts/land/sync-main-folder.sh\"}" "$S/main"; r=$?
[ $r = 0 ] && ok "reading and the sync script are not refused" || fail "sed -n / sync (r=$r)"
run "$S/main" Write "{\"file_path\":\"$S/main/build/x.log\"}" "$S/main"; r=$?
[ $r = 0 ] && ok "ignored output (build/) is allowed" || fail "build (r=$r)"
run "$S/main" Edit "{\"file_path\":\"$S/wt/a.ts\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "Edit in a worktree through the main folder's gate is allowed" || fail "Edit wt via main (r=$r)"
run "$S/wt" Edit "{\"file_path\":\"$S/wt/a.ts\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "a worktree's own gate allows its edits" || fail "wt (r=$r)"
run "$S/wt" Bash "{\"command\":\"sed -i s/a/b/ a.ts\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "sed -i in a worktree is allowed" || fail "sed -i wt (r=$r)"
[ $fails = 0 ] && { echo "main-folder-edit-guard: all passed"; exit 0; }
echo "main-folder-edit-guard: $fails failed"; exit 1
