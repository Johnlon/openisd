#!/usr/bin/env bash
# A clean copy of the repo for one slow run, outside the shared tree.
#
# Several agent sessions edit the openisd tree at once. A slow run that tests the live tree tests
# their half-made edits too, and fails for reasons that are not in the change being committed or
# pushed. So a slow run tests a copy holding exactly what it is meant to test:
#
#   clean_copy_from_index  <repo> <dest>         the staged index (pre-commit: no commit exists yet)
#   clean_copy_from_commit <repo> <sha> <dest>   one commit, as a detached git worktree
#   clean_copy_remove      <repo> <dest>
#
# Copies live under <repo>/../.slowrun/<id>, a sibling of the repo, because tests reach the
# sibling winisd_drivers checkout as <repo root>/../winisd_drivers: the .slowrun folder gets a
# symlink to it, so that path still resolves from inside a copy.
#
# node_modules is a HARDLINK copy of the main checkout's (about 1 s for 26k files), not a symlink:
#   - the workspace packages are relative links (node_modules/@openisd/design ->
#     ../../packages/design). Under a symlinked node_modules they would resolve to the LIVE tree's
#     packages; in a hardlink copy they resolve to the copy's own.
#   - vite serves only files under the copy's root; a symlink would put every dependency's real
#     path in the main checkout, outside it.
#   - the tool caches (.vite, .vite-temp, .vue-global-types) are left out, so a run never writes
#     into a cache the main checkout's dev server uses.
# Nothing in a test run edits a package file in place, so the shared inodes are only read.

clean_copy_root() {
  echo "$(cd "$1/.." && pwd)/.slowrun"
}

clean_copy_new_dest() {
  local root
  root="$(clean_copy_root "$1")"
  mkdir -p "$root"
  # Sibling checkouts the tests read by relative path, reachable from inside a copy.
  local sib
  for sib in ${SLOW_RUN_SIBLINGS:-winisd_drivers}; do
    [ -e "$1/../$sib" ] && [ ! -e "$root/$sib" ] && ln -s "$(cd "$1/../$sib" && pwd)" "$root/$sib"
  done
  echo "$root/$(date +%Y%m%d-%H%M%S)-$$"
}

# Hardlink copy of every node_modules the main checkout has (root and per package), minus caches.
clean_copy_link_node_modules() {
  local src="$1" dest="$2" nm rel entry name
  for nm in "$src/node_modules" "$src"/packages/*/node_modules; do
    [ -d "$nm" ] || continue
    rel="${nm#"$src"/}"
    mkdir -p "$dest/$rel"
    for entry in "$nm"/* "$nm"/.[!.]*; do
      [ -e "$entry" ] || [ -L "$entry" ] || continue
      name="$(basename "$entry")"
      case "$name" in .vite|.vite-temp|.vue-global-types|.cache) continue ;; esac
      cp -al "$entry" "$dest/$rel/$name"
    done
  done
}

# Logs and node reports go to the main checkout, so they outlive the copy.
clean_copy_link_logs() {
  local src="$1" dest="$2" d
  mkdir -p "$dest/build"
  for d in test-logs test-reports; do
    mkdir -p "$src/build/$d"
    ln -s "$src/build/$d" "$dest/build/$d"
  done
}

clean_copy_from_index() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  # Honours GIT_INDEX_FILE, so `git commit <paths>` (which commits a temporary index) exports
  # the index actually being committed.
  git -C "$src" checkout-index -a --prefix="$dest/"
  clean_copy_link_node_modules "$src" "$dest"
  clean_copy_link_logs "$src" "$dest"
}

clean_copy_from_commit() {
  local src="$1" sha="$2" dest="$3"
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
    git -C "$src" worktree add --quiet --detach "$dest" "$sha"
  clean_copy_link_node_modules "$src" "$dest"
  clean_copy_link_logs "$src" "$dest"
}

clean_copy_remove() {
  local src="$1" dest="$2"
  [ -n "$dest" ] && [ -d "$dest" ] || return 0
  if [ -e "$dest/.git" ]; then
    env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
      git -C "$src" worktree remove --force "$dest" 2>/dev/null || true
  fi
  rm -rf "$dest"
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$src" worktree prune 2>/dev/null || true
}
