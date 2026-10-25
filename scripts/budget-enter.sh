# Sourced by a script that runs a heavy job, right after it has changed to the repo root:
#   BUDGET_SELF="${BASH_SOURCE[0]}" . scripts/budget-enter.sh "$@"
# Looks up the job's measured cost (scripts/budget-cost.sh) and re-runs the calling script inside
# scripts/budget.sh, which starts it when the memory and cores fit and otherwise waits, announced.
# BUDGET_HELD marks the re-run, so a script that calls another heavy script is admitted once.
if [ -z "${BUDGET_HELD:-}" ]; then
  read -r _budget_pool _budget_mb _budget_cpu < <(bash scripts/budget-cost.sh "$BUDGET_SELF" "$@")
  if [ "$_budget_pool" != none ]; then
    bash scripts/lib/ts-log.sh run_start "budget-enter-$_budget_pool" 2>/dev/null || true
    exec env BUDGET_HELD=1 bash scripts/budget.sh "$_budget_pool" "$_budget_mb" --cpu "$_budget_cpu" -- bash "$BUDGET_SELF" "$@"
  fi
fi
