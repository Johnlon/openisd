#!/usr/bin/env bash
# The land gate for baselines: a task changes exactly the screens it lists under `visual:` in its task
# file. A baseline picture that changed without being listed, or a listed screen whose picture did not
# change, refuses the landing.
#   bash scripts/visual/check-task.sh <task.yml>... <base> <head>
# A pull request carrying several tasks (T762) names every task file: the screens they list are pooled.
set -euo pipefail
[ "$#" -ge 3 ] || { echo "usage: check-task.sh <task.yml>... <base> <head>" >&2; exit 2; }
tasks=("${@:1:$#-2}"); base="${*: -2:1}"; head="${*: -1}"
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
listed="$(for task in "${tasks[@]}"; do visual_screen_ids "$task"; done | sort -u)"; changed="$(visual_changed_ids "$base" "$head")"
unlisted="$(comm -13 <(printf '%s\n' "$listed") <(printf '%s\n' "$changed") | sed '/^$/d')"
unchanged="$(comm -23 <(printf '%s\n' "$listed") <(printf '%s\n' "$changed") | sed '/^$/d')"
status=0
if [ -n "$changed" ] && [ -z "$(for task in "${tasks[@]}"; do visual_note "$task"; done)" ]; then
  echo "visual: warning: ${tasks[*]} has no visual_note: (one or two plain sentences on what the user sees change); the change page cannot say what to look at"
fi
if [ -n "$unlisted" ]; then
  printf 'visual: baselines changed that the task does not list under visual: in its task file:\n%s\n' "$(printf '%s\n' "$unlisted" | sed 's/^/  /')"; status=1
fi
if [ -n "$unchanged" ]; then
  printf 'visual: the task lists screens whose baseline did not change:\n%s\n' "$(printf '%s\n' "$unchanged" | sed 's/^/  /')"; status=1
fi

# Provenance (T799): every baseline picture this change adds or alters was drawn by CI's test machine, so it carries the
# stamp of a visual-retake run (scripts/visual/png-stamp.mjs). A picture drawn anywhere else is what turned main red after T791.
# Always: the stamp must be there. With VISUAL_VERIFY_RUN=1 (the pull request check, which has a GitHub token) each run
# named must be a successful visual-retake run, and the picture's hash must be in that run's manifest.
GH="${VISUAL_GH:-gh}"; REPO="${VISUAL_REPO:-${GITHUB_REPOSITORY:-portingle/openisd}}"
unstamped=(); wrong=(); declare -A runs=()
while IFS= read -r f; do
  [ -n "$f" ] || continue
  run="$(git show "$head:$f" | { LC_ALL=C grep -a -o 'openisd-visual-run.run=[0-9]*' || true; } | head -n 1 | sed 's/.*run=//')"
  id="$(basename "$f" .png)"
  if [ -z "$run" ]; then unstamped+=("$id"); continue; fi
  runs[$run]+="$f "
done < <(git diff --no-renames --name-only --diff-filter=AM "$base" "$head" -- "$VISUAL_SNAPSHOT_DIR" | grep '\.png$' || true)
if [ "${#unstamped[@]}" -gt 0 ]; then
  printf 'visual: these baselines were not drawn by CI'"'"'s test machine (no visual-retake stamp), so the suite would not match them:\n%s\n' "$(printf '%s\n' "${unstamped[@]}" | sed 's/^/  /')"
  echo 'Do not draw baselines on a developer machine. Commit the work, then run: bash scripts/visual/update.sh   (docs/design/VISUAL_BASELINES.md)'
  status=1
fi
if [ "${VISUAL_VERIFY_RUN:-}" = 1 ]; then
  vdir="$(mktemp -d)"; trap 'rm -rf "$vdir"' EXIT
  for run in "${!runs[@]}"; do
    info="$("$GH" api "repos/$REPO/actions/runs/$run" --jq '[.path, .conclusion] | @tsv' 2> /dev/null || true)"
    if [ "$info" != "$(printf '.github/workflows/visual-retake.yml\tsuccess')" ]; then
      printf 'visual: the stamp names run %s, which is not a successful visual-retake run of %s (%s):\n%s\n' "$run" "$REPO" "${info:-not found}" "$(printf '%s\n' ${runs[$run]} | sed 's#.*/#  #;s/\.png$//')"; status=1; continue
    fi
    "$GH" run download "$run" -R "$REPO" -n visual-baselines -D "$vdir/$run" > /dev/null 2>&1 || { echo "visual: cannot download run $run's manifest (expired?); re-take with update.sh"; status=1; continue; }
    for f in ${runs[$run]}; do
      h="$(git show "$head:$f" | sha256sum | cut -d' ' -f1)"
      grep -q "^$h  $(basename "$f")$" "$vdir/$run/MANIFEST.sha256" || { echo "visual: $(basename "$f" .png) is not the picture run $run drew (its hash is not in the run's manifest)"; status=1; }
    done
  done
fi
exit "$status"
