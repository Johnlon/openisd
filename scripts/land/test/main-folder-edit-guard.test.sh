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
[ $r != 0 ] && grep -q "The main folder only mirrors main; work in a task worktree: bash scripts/new-task.sh" "$S/err" && ok "Edit in the main folder is refused with the message" || fail "Edit main (r=$r)"
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
# T478: a session whose cwd is the main folder edits in a sibling worktree named like it (openisd-t450).
git -C "$S/main" worktree add -q "$S/main-t1" -b t1 2> /dev/null
run "$S/main" Bash "{\"command\":\"cd $S/main-t1 && sed -i s/a/b/ a.ts\"}" "$S/main"; r=$?
[ $r = 0 ] && ok "cd into a sibling worktree then sed -i is allowed" || fail "cd sibling sed -i (r=$r)"
run "$S/main" Bash "{\"command\":\"sed -i s/a/b/ $S/main-t1/a.ts 2> /dev/null\"}" "$S/main"; r=$?
[ $r = 0 ] && ok "sed -i on a sibling worktree's absolute path is allowed" || fail "abs sibling sed -i (r=$r)"
run "$S/main" Bash "{\"command\":\"sed -i s/a/b/ $S/main/a.ts\"}" "$S/wt"; r=$?
[ $r != 0 ] && ok "sed -i on the main folder's absolute path from a worktree is refused" || fail "abs main from wt (r=$r)"
run "$S/main" Bash "{\"command\":\"cd $S/main-t1 && sed -i s/a/b/ $S/main/a.ts\"}" "$S/main"; r=$?
[ $r != 0 ] && ok "a cd elsewhere does not excuse an absolute main-folder path" || fail "cd + abs main (r=$r)"
# T661: the gate protects the main folder and synced copies from any checkout, not other worktrees
git -C "$S/main" worktree add -q --detach "$S/preview" 2> /dev/null; git -C "$S/main" config --add openisd.syncedCopy "$S/preview"
run "$S/wt" Edit "{\"file_path\":\"$S/main/a.ts\"}" "$S/wt"; r=$?
[ $r != 0 ] && grep -q "task worktree" "$S/err" && ok "a worktree's gate refuses an Edit inside the main folder" || fail "wt gate -> main (r=$r)"
run "$S/wt" Write "{\"file_path\":\"$S/preview/a.ts\"}" "$S/wt"; r=$?
[ $r != 0 ] && ok "a synced copy is refused too" || fail "synced copy (r=$r)"
run "$S/wt" Edit "{\"file_path\":\"$S/main-t1/a.ts\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "another worktree is allowed" || fail "other wt (r=$r)"
# T664: decided per command segment; heredoc bodies and quoted text are not edits
run "$S/main" Bash "{\"command\":\"sed -i s/a/b/ $S/wt/a.ts && cat $S/main/a.ts\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "edit in a worktree, then cat of a main-folder path, is allowed" || fail "seg wt + cat main (r=$r)"
run "$S/main" Bash "{\"command\":\"cat > $S/wt/h.md <<'EOF'\\nrun sed -i on $S/main/a.ts\\nEOF\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "a heredoc body naming sed -i and the main folder is allowed" || fail "heredoc (r=$r)"
run "$S/main" Bash "{\"command\":\"echo \\\"sed -i s/a/b/ $S/main/a.ts\\\"\"}" "$S/wt"; r=$?
[ $r = 0 ] && ok "a quoted string naming sed -i and the main folder is allowed" || fail "quoted (r=$r)"
run "$S/main" Bash "{\"command\":\"cat $S/wt/a.ts; sed -i s/a/b/ $S/main/a.ts\"}" "$S/wt"; r=$?
[ $r != 0 ] && ok "a later segment editing the main folder is refused" || fail "later seg main (r=$r)"
run "$S/main" Bash "{\"command\":\"cd $S/main && sed -i s/a/b/ a.ts\"}" "$S/wt"; r=$?
[ $r != 0 ] && ok "cd into the main folder then relative sed -i is refused" || fail "cd main + rel (r=$r)"
run "$S/main" Bash "{\"command\":\"cat > $S/wt/h.md <<'EOF'\\nx\\nEOF\\nsed -i s/a/b/ $S/main/a.ts\"}" "$S/wt"; r=$?
[ $r != 0 ] && ok "an edit after a heredoc is still refused" || fail "after heredoc (r=$r)"
run "$S/main" Bash "{\"command\":\"x=\$(sed -i s/a/b/ $S/main/a.ts)\"}" "$S/wt"; r=$?
[ $r != 0 ] && ok "an edit inside a command substitution is still refused" || fail "subst (r=$r)"
[ $fails = 0 ] && { echo "main-folder-edit-guard: all passed"; exit 0; }
echo "main-folder-edit-guard: $fails failed"; exit 1
