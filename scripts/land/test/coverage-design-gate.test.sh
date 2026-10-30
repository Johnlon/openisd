#!/usr/bin/env bash
# The 100 % coverage gate on packages/design engine/ and domain/ stays in place (T619, John 30 Oct 2026):
# suite.yml runs scripts/coverage-design.sh, the thresholds stay 100 % per file over both folders with no excludes,
# and no source file in them carries a coverage-ignore comment.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
python3 - "$REPO" <<'PY'
import re, subprocess, sys, yaml

repo = sys.argv[1]
fails = []

wf = yaml.safe_load(open(f"{repo}/.github/workflows/suite.yml"))
runs = [s.get("run", "") for s in wf["jobs"].get("coverage", {}).get("steps", [])]
if "bash scripts/coverage-design.sh" not in runs:
    fails.append("suite.yml: job coverage does not run bash scripts/coverage-design.sh")
if any(s.get("continue-on-error") for s in wf["jobs"].get("coverage", {}).get("steps", [])):
    fails.append("suite.yml: a coverage step carries continue-on-error")

cfg = open(f"{repo}/packages/design/vitest.coverage.config.ts").read()
if "thresholds: {perFile: true, statements: 100, branches: 100, functions: 100, lines: 100}" not in cfg:
    fails.append("vitest.coverage.config.ts: thresholds are not 100 % per file")
if "include: ['engine/**/*.ts', 'domain/**/*.ts']" not in cfg:
    fails.append("vitest.coverage.config.ts: coverage.include is not engine/ and domain/")
if re.search(r"\bexclude\s*:", cfg.split("coverage:", 1)[1]):
    fails.append("vitest.coverage.config.ts: coverage has an exclude")

script = open(f"{repo}/scripts/coverage-design.sh").read()
if "AGENTS — DO NOT IGNORE THIS FAILURE" not in script:
    fails.append("coverage-design.sh: the warning to agents is gone")

pragmas = subprocess.run(
    ["git", "-C", repo, "grep", "-nE", r"(v8|c8|istanbul) ignore", "--", "packages/design/engine", "packages/design/domain"],
    capture_output=True, text=True).stdout.strip()
if pragmas:
    fails.append("coverage-ignore comments in engine/domain:\n" + pragmas)

for f in fails:
    print("FAIL", f)
print(f"coverage-design-gate: {len(fails)} problems")
sys.exit(1 if fails else 0)
PY
