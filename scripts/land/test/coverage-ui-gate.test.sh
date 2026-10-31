#!/usr/bin/env bash
# The ui coverage ratchet stays in place and behaves (T620, John 30 Oct 2026). Part A: the gate's shape (suite.yml
# job, config include/exclude, banner, refused args, the dead root block gone). Part B: scripts/coverage-ratchet.mjs
# rules 1-5 on fixture reports in a scratch git repo with an origin/main baseline (processes.md rule 7).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
python3 - "$REPO" <<'PY'
import sys, yaml

repo = sys.argv[1]
fails = []

wf = yaml.safe_load(open(f"{repo}/.github/workflows/suite.yml"))
# QO316 (John, 31 Oct 2026): coverage gate off for now, jobs removed from suite.yml. T631 flips this assertion back to present when it restores them.
if "coverage-ui" in wf["jobs"]:
    fails.append("suite.yml: job coverage-ui is present while QO316 has the gate off")

cfg = open(f"{repo}/packages/ui/vitest.coverage.config.ts").read()
if "include: ['src/**/*.ts']," not in cfg:
    fails.append("ui vitest.coverage.config.ts: coverage.include is not src/**/*.ts")
if "'src/main.ts'," not in cfg or "'src/types.ts'," not in cfg or cfg.count("'src/") != 3:
    fails.append("ui vitest.coverage.config.ts: coverage.exclude is not exactly src/main.ts and src/types.ts")
if "thresholds" in cfg:
    fails.append("ui vitest.coverage.config.ts: has thresholds; the ratchet is the threshold")

sh = open(f"{repo}/scripts/coverage-ui.sh").read()
if "AGENTS — DO NOT IGNORE THIS FAILURE" not in sh:
    fails.append("coverage-ui.sh: the warning to agents is gone")
if "--coverage*)" not in sh or "exit 2" not in sh:
    fails.append("coverage-ui.sh: does not refuse --coverage args")
if "--init" in sh:
    fails.append("coverage-ui.sh: passes --init")

root = open(f"{repo}/vitest.config.ts").read()
if "coverage:" in root:
    fails.append("root vitest.config.ts: the dead coverage block is back")

for f in fails:
    print("FAIL", f)
print(f"coverage-ui-gate shape: {len(fails)} problems")
sys.exit(1 if fails else 0)
PY
shape=$?

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
RAT="$REPO/scripts/coverage-ratchet.mjs"
bad=0
git init -q "$T/origin" && git -C "$T/origin" config user.email t@t && git -C "$T/origin" config user.name t
mkdir -p "$T/origin/packages/ui"
BL="packages/ui/coverage-baseline.json"
summary() { # summary <file> then name:pct pairs; all four measures get the pct
  local out="$1"; shift; python3 - "$out" "$T/origin" "$@" <<'PY'
import json, sys
out, root, *pairs = sys.argv[1:]
d = {"total": {}}
for p in pairs:
    n, v = p.split(":"); v = float(v)
    d[f"{root}/packages/ui/src/{n}.ts"] = {m: {"pct": v} for m in ("lines", "branches", "functions", "statements")}
json.dump(d, open(out, "w"))
PY
}
base() { # base <path> name:int ...
  local out="$1"; shift; python3 - "$out" "$@" <<'PY'
import json, sys
out, *pairs = sys.argv[1:]
json.dump({f"packages/ui/src/{p.split(':')[0]}.ts": {m: int(p.split(':')[1]) for m in ("lines", "branches", "functions", "statements")} for p in pairs}, open(out, "w"))
PY
}
# origin/main baseline: a=50, b=100. A bare clone supplies the origin/main ref.
base "$T/origin/$BL" a:50 b:100
git -C "$T/origin" add -A && git -C "$T/origin" commit -qm base && git -C "$T/origin" branch -M main
git clone -q "$T/origin" "$T/work" && git -C "$T/work" config user.email t@t && git -C "$T/work" config user.name t
W="$T/work"
run() { # run <name> <expect rc> <summary pairs...>: baseline is whatever $W/$BL holds
  local name="$1" want="$2"; shift 2
  summary "$T/s.json" "$@" ; sed -i "s#$T/origin#$W#g" "$T/s.json"
  out="$(node "$RAT" "$T/s.json" "$W/$BL" 2>&1)"; rc=$?
  if [ "$rc" != "$want" ]; then echo "FAIL $name: rc $rc, wanted $want"; echo "$out"; bad=$((bad+1)); return 1; fi
  RUN_OUT="$out"; return 0
}
has() { case "$RUN_OUT" in *"$1"*) ;; *) echo "FAIL $2: output lacks '$1'"; echo "$RUN_OUT"; bad=$((bad+1));; esac; }
reset() { cp "$W/../origin/$BL" "$W/$BL"; }

reset
run "rule1 new file under 100" 1 a:50 b:100 c:99.9 && has "c.ts: new file" rule1
reset
run "rule1 new file at 100" 0 a:50 b:100 c:100 && has "moved up for 1 files" rule1-green
reset
run "rule2 drop below baseline" 1 a:49.5 b:100 && has "a.ts: lines 49 < baseline 50" rule2
reset
run "rule2 at baseline" 0 a:50.9 b:100 && has "green, baseline unchanged" rule2-green
reset
run "rule3 baseline without file" 1 a:50 && has "b.ts: baseline entry without a file" rule3
reset
base "$W/$BL" a:40 b:100   # committed baseline lowered below origin/main
run "rule4 lowered baseline" 1 a:50 b:100 && has "committed baseline lines 40 < origin/main 50" rule4
reset
run "rule5 upward rewrite" 0 a:60.2 b:100 && has "baseline moved up for 1 files" rule5
if ! grep -q '"lines": 60' "$W/$BL"; then echo "FAIL rule5: baseline not rewritten to 60"; bad=$((bad+1)); fi
# rule 4 skipped only when origin/main exists and has no baseline file
git -C "$T/origin" rm -q "$BL" && git -C "$T/origin" commit -qm "no baseline" && git -C "$W" fetch -q origin
base "$W/$BL" a:40 b:100
run "rule4 skipped when origin/main has no baseline" 0 a:40 b:100 && has "green" rule4-skip
# a missing origin/main ref (a shallow CI checkout that did not fetch main) is red, never a silent skip
git -C "$W" update-ref -d refs/remotes/origin/main
run "rule4 red without origin/main" 1 a:40 b:100 && has "origin/main is not available" rule4-noref

echo "coverage-ui-gate ratchet: $bad problems"
[ "$shape" = 0 ] && [ "$bad" = 0 ]
