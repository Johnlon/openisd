#!/usr/bin/env bash
# One slow run: wait for the machine-wide queue, test a clean copy, rerun a few failing specs once.
#
#   bash scripts/slow-run/slow-run.sh pre-commit [--doc-only]      the staged index
#   bash scripts/slow-run/slow-run.sh pre-push <sha> [--doc-only]  that commit
#   bash scripts/slow-run/slow-run.sh health-check [<sha>]         that commit (default HEAD)
#
# Called by scripts/hooks-local/pre-commit, scripts/hooks-local/pre-push and
# scripts/health-check.sh. John, 2026-10-07:
#   1. Slow runs never overlap on this machine: queue.sh holds one machine-wide FIFO queue.
#   2. A slow run tests a clean copy, never the live shared tree that other sessions are editing:
#      clean-copy.sh exports the staged index (pre-commit) or checks the commit out as a worktree
#      (pre-push, health-check) under ../.slowrun/, and removes it afterwards.
#   3. A few failing spec files are rerun once (rerun.mjs); pass on rerun = pass + FLAKY line in
#      build/test-logs/flaky.log; more than 10 failing files = fail at once.
# Lint and typecheck are not rerun: their failures do not come and go.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/../.." && pwd)"

MODE="${1:-}"; shift || true
SHA=""
DOC_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --doc-only) DOC_ONLY=1 ;;
    *) SHA="$arg" ;;
  esac
done
case "$MODE" in
  pre-commit) ;;
  pre-push) [ -n "$SHA" ] || { echo "slow-run: pre-push needs a commit" >&2; exit 2; } ;;
  health-check) SHA="${SHA:-HEAD}" ;;
  *) echo "usage: slow-run.sh pre-commit [--doc-only] | pre-push <sha> [--doc-only] | health-check [<sha>]" >&2; exit 2 ;;
esac
if [ -n "$SHA" ]; then
  SHA="$(env -u GIT_INDEX_FILE git -C "$SRC" rev-parse --verify "$SHA^{commit}")" || exit 2
fi

LABEL="$MODE${SHA:+ ${SHA:0:10}}$([ "$DOC_ONLY" = 1 ] && echo ' (doc-only)')"
export SLOW_RUN_LABEL="$LABEL"

# shellcheck source=./queue.sh
. "$HERE/queue.sh"
# shellcheck source=./clean-copy.sh
. "$HERE/clean-copy.sh"

slow_queue_enter "$LABEL"
DEST=""
cleanup() {
  local status=$?
  cd "$SRC" || true
  [ -n "$DEST" ] && clean_copy_remove "$SRC" "$DEST"
  type release_heavy_gate_slot >/dev/null 2>&1 && release_heavy_gate_slot
  slow_queue_leave
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Worker tuning for the one run that now holds the queue (see heavy-gate-concurrency.sh).
. "$SRC/scripts/hooks-local/heavy-gate-concurrency.sh"
reserve_heavy_gate_slot

DEST="$(clean_copy_new_dest "$SRC")"
if [ "$MODE" = "pre-commit" ]; then
  clean_copy_from_index "$SRC" "$DEST" || exit 1
else
  clean_copy_from_commit "$SRC" "$SHA" "$DEST" || exit 1
fi
echo "[slow-run] $LABEL: testing a clean copy at $DEST"
cd "$DEST" || exit 1
# A hook's git variables point at the main checkout; nothing in the copy may follow them.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

# heavy.sh runs a command inside heavy.slice (systemd, MemoryMax'd, CPU-weighted), so memory
# pressure is reclaimed inside that slice instead of the box's OOM killer picking a victim.
# Falls back to running directly if heavy.sh isn't installed.
HEAVY="$HOME/.claude/bin/heavy.sh"
[ -x "$HEAVY" ] || HEAVY=""
export HEAVY
RERUN=(node "$HERE/rerun.mjs")

case "$MODE" in
  pre-commit|pre-push)
    set -e
    if [ "$DOC_ONLY" = 1 ]; then
      echo "[$MODE] doc-only (*.md) — skipping unit/browser; typecheck + lint still run to block a red branch…"
      $HEAVY npm run typecheck
      npm run lint
      echo "[$MODE] doc-only + typecheck/lint green ✓"
      exit 0
    fi
    npm run lint
    $HEAVY npm run typecheck
    if [ "$MODE" = "pre-commit" ]; then
      # PRECOMMIT=1: the born-red checklist gates self-skip (see the checklistDescribe guards in
      # packages/ui/test/architecture/); every behavioural test still blocks.
      PRECOMMIT=1 "${RERUN[@]}" vitest packages/design packages/persistence packages/ui
    else
      "${RERUN[@]}" vitest
      "${RERUN[@]}" playwright
    fi
    echo "[$MODE] all green ✓"
    ;;
  health-check)
    PASS=0; FAIL=0; ERRORS=()
    step() {
      local label="$1"; shift
      echo ""
      echo "── $label ──────────────────────────────────"
      if "$@"; then
        echo "  PASS: $label"; PASS=$((PASS + 1))
      else
        echo "  FAIL: $label"; FAIL=$((FAIL + 1)); ERRORS+=("$label")
      fi
    }
    echo "========================================"
    echo "  OpenISD health check — $LABEL"
    echo "  $(date '+%H:%M:%S')"
    echo "========================================"
    step "ESLint"         npm run lint
    step "Type check"     npm run typecheck
    step "Unit tests"     "${RERUN[@]}" vitest
    step "Browser tests"  "${RERUN[@]}" playwright
    step "Verify Preview" bash scripts/verify-preview-own-port.sh
    echo ""
    echo "========================================"
    if [ "$FAIL" -eq 0 ]; then
      echo "  ALL $PASS checks passed"
    else
      echo "  $PASS passed, $FAIL FAILED:"
      for e in "${ERRORS[@]}"; do echo "    - $e"; done
    fi
    echo "  $(date '+%H:%M:%S')"
    echo "========================================"
    [ "$FAIL" -eq 0 ]
    ;;
esac
