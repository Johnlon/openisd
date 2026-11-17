#!/usr/bin/env bash
# The main checkout of the repository, whichever worktree a script runs in and however the repository was cloned (T854).
#
# A plain clone keeps its git data in <checkout>/.git, so the main checkout is the parent of git-common-dir. A clone
# of the workspace monorepo checks openisd out as a submodule: <checkout>/.git is a file, the git data is
# <superproject>/.git/modules/openisd, and its core.worktree names the checkout (relative to the git data). There the
# parent of git-common-dir is <superproject>/.git/modules, and `git worktree list` names the git data, not the
# checkout, as the main worktree. Scripts use these two functions instead.
# Test: scripts/land/test/main-checkout.e2e.test.sh builds both layouts with real git.

# main_checkout <dir>: prints the absolute path of the main checkout of the repository holding <dir>; returns 1 when
# <dir> is not in a git checkout.
main_checkout() {
  local common wt
  common="$(cd "$1" && cd "$(git rev-parse --git-common-dir)" && pwd)" || return 1
  wt="$(git config --file "$common/config.worktree" --get core.worktree 2> /dev/null \
    || git config --file "$common/config" --get core.worktree)"
  if [ -z "$wt" ]; then dirname "$common"; return 0; fi
  (cd "$common" && cd "$wt" && pwd)
}

# main_worktree_list <dir>: `git worktree list --porcelain` for the repository holding <dir>, with the main checkout's
# path on the first (main) entry where git names the git data instead.
main_worktree_list() {
  local main
  main="$(main_checkout "$1")" || return 1
  git -C "$1" worktree list --porcelain | MAIN="$main" awk 'NR == 1 && /^worktree / { print "worktree " ENVIRON["MAIN"]; next } { print }'
}
