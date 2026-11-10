#!/usr/bin/env bash
# .github/workflows/suite.yml (T761, QO501 A): the full suite runs on every push to main in the copy
# (portingle/openisd, where merges happen) and nowhere else on a push to main. A push to Johnlon main (the mirror's
# deploy-key push) must not start it. The report job opens the main-red issue in the repository the run is in.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
python3 - "$REPO/.github/workflows/suite.yml" <<'PY'
import sys, yaml

COPY = "portingle/openisd"
wf = yaml.safe_load(open(sys.argv[1]))
fails = []
trig = wf.get(True, wf.get("on"))
branches = trig["push"]["branches"]
if "main" not in branches:
    fails.append(f"push does not trigger on main: {branches}")
if "land/**" not in branches:
    fails.append(f"push no longer triggers on land/**: {branches}")
for need in ("workflow_call", "workflow_dispatch"):
    if need not in trig:
        fails.append(f"trigger {need} was lost")

# Every job that has no needs starts the run; each must be guarded so a main push outside the copy skips the lot
# (jobs that need a skipped job are skipped with it).
for job, body in wf["jobs"].items():
    if body.get("needs") or job == "report":
        continue
    cond = str(body.get("if", ""))
    if COPY not in cond or "refs/heads/main" not in cond:
        fails.append(f"job {job}: no guard 'a push to main runs only in {COPY}' (if: {cond!r})")

report = wf["jobs"]["report"]
if "main" not in str(report.get("if", "")) or "push" not in str(report.get("if", "")):
    fails.append("report no longer runs only on a push to main")
if COPY in str(report):
    fails.append("report hard-codes the copy; it must open the issue in the repository the run is in")
env = report["steps"][0]["env"]
if "github.repository" not in str(env.get("GH_REPO", "")):
    fails.append("report does not open the issue in github.repository")
if report.get("permissions", {}).get("issues") != "write":
    fails.append("report lacks issues: write")

if fails:
    print("FAIL suite-on-main:"); [print("  -", f) for f in fails]; sys.exit(1)
print("ok suite-on-main")
PY
