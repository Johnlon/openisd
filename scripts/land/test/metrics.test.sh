#!/usr/bin/env bash
# scripts/land/test/metrics.test.sh — unit test for scripts/metrics.sh on fixture logs
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
METRICS_SH="$REPO/scripts/metrics.sh"

fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/metrics-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

FIXTURE="$TMP/fixture"
OUT="$TMP/out"
mkdir -p "$FIXTURE/test-logs" "$FIXTURE/tasks/fixes" "$FIXTURE/zoo-logs"

# 1. Create fixture test log with ts-log lines
cat > "$FIXTURE/test-logs/20261016-120000-12345.log" << 'EOF'
2026-10-16T12:00:00.000Z 12345 START land-T999
2026-10-16T12:00:01.000Z 12345 START lint
2026-10-16T12:00:03.000Z 12345 END lint status=0 duration_s=2
2026-10-16T12:00:04.000Z 12345 START typecheck
2026-10-16T12:00:07.000Z 12345 END typecheck status=0 duration_s=3
2026-10-16T12:00:10.000Z 12345 SPEC END packages/design/test/sample.test.ts status=passed duration_ms=1250
2026-10-16T12:00:12.000Z 12345 waiting for slot: 1 ahead, holder unit run, 15 s
2026-10-16T12:00:15.000Z 12345 END land-T999 status=0 duration_s=15
EOF

# 2. Create fixture old log without ts-log lines (approximate)
cat > "$FIXTURE/test-logs/old-run.log" << 'EOF'
 ✓ packages/ui/test/ui/sample.browser.spec.ts:10:1 › sample test (2.5s)
peak suite 1.25 GB exit 0 seconds 45
EOF

# 3. Create fixture watchdog.log
cat > "$FIXTURE/watchdog.log" << 'EOF'
2026-10-16T12:05:00Z watchdog: post-land run 9999 (abcdef1234) hung: no log growth and under 1 s of CPU in 1200s; killing group 9999
2026-10-16T12:05:01Z watchdog: housekeeping exit 0: housekeeping: 1 slot(s) freed, 0 live
EOF

# 4. Create fixture housekeeping.log
cat > "$FIXTURE/housekeeping.log" << 'EOF'
2026-10-16T12:06:00Z housekeeping: stopped browser run 8888 on port 4101 (owner pid 7777 is dead)
2026-10-16T12:06:01Z housekeeping: freed slot 00000001 of "sample run" (owner pid 7777 is dead)
EOF

# 5. Create fixture post-land.log
cat > "$FIXTURE/post-land.log" << 'EOF'
2026-10-16T12:10:00.000Z 5555 START post-land-suite
post-land: running the full suite on abcdef1234
post-land: green at abcdef1234
2026-10-16T12:15:00.000Z 5555 END post-land-suite status=0 duration_s=300
EOF

# 6. Create fixture DELEGATION_LOG.md
cat > "$FIXTURE/DELEGATION_LOG.md" << 'EOF'
2026-10-16 11:00:00 | openisd-test-job | agy | gemini-3.8-flash-high | 12 min | done | review rounds: - | quota hits: none
2026-10-16 11:30:00 | openisd-test-job-r2 | agy | gemini-3.8-flash-high | 8 min | done | review rounds: - | quota hits: none
2026-10-16 12:00:00 | openisd-failing-job | opencode | nemotron | 25 min | failed | review rounds: - | quota hits: none
EOF

# 7. Create fixture fixes YAML files
cat > "$FIXTURE/tasks/fixes/F98.yml" << 'EOF'
id: F98
status: done
sha: 1234567890
goal: main is red; fix it
failing: |
  FAIL packages/design/test/broken.test.ts
output: |
  AssertionError: expected false to be true
EOF

cat > "$FIXTURE/tasks/fixes/F99.yml" << 'EOF'
id: F99
status: done
sha: 0987654321
goal: main is red; fix it
failing: |
  timed out after 5400s
output: |
  TimeoutError: operation timed out
EOF

# 8. Create fixture git.log
cat > "$FIXTURE/git.log" << 'EOF'
abcdef1234|1792180000|2026-10-16T12:08:00+00:00|T999: sample landed task
1234567890|1792170000|2026-10-16T10:00:00+00:00|T998: previous task
EOF

# Run metrics.sh with fixture
bash "$METRICS_SH" --fixture-dir "$FIXTURE" --output-dir "$OUT" > /dev/null
[ -f "$OUT/metrics.json" ] && ok "metrics.json generated" || fail "metrics.json missing"
[ -f "$OUT/index.html" ] && ok "index.html generated" || fail "index.html missing"

# Check metrics.json contents
python3 -c '
import json, sys
with open("'"$OUT/metrics.json"'") as f:
    d = json.load(f)

# 1. Slowest specs
specs = {s["spec"]: s for s in d["slowest_20_specs"]}
assert "packages/design/test/sample.test.ts" in specs, "sample.test.ts missing from slowest specs"
assert specs["packages/design/test/sample.test.ts"]["max_ms"] == 1250, "sample duration incorrect"

# 2. Reds by cause
reds = d["windows"]["7d"]["reds_by_cause"]
assert reds["assertion"] >= 1, "assertion red count missing"
assert reds["timeout"] >= 1, "timeout red count missing"

# 3. Delegated jobs
jobs = d["windows"]["7d"]["delegated_jobs"]
assert len(jobs) == 3, f"expected 3 delegated jobs, got {len(jobs)}"
retries = [j for j in jobs if j["is_retry"]]
assert len(retries) == 1, "retry count mismatch"

# 4. Kills & limits
kills = d["windows"]["7d"]["kills_and_limits"]
assert any(k["mechanism"] == "watchdog_hung_post_land" for k in kills), "watchdog kill missing"
assert any(k["mechanism"] == "housekeeping_stopped_browser" for k in kills), "stopped browser missing"
assert any(k["mechanism"] == "housekeeping_freed_slot" for k in kills), "freed slot missing"

# 5. Queue waits
qw = d["windows"]["7d"]["queue_waits"]
assert any(q["type"] == "admission" for q in qw), "admission wait missing"

print("JSON structure verified successfully")
'
[ $? = 0 ] && ok "metrics.json data assertions passed" || fail "metrics.json data assertions failed"

# Check HTML content (valid mobile viewport and SVG charts)
if grep -q 'viewport' "$OUT/index.html" && grep -q '<svg' "$OUT/index.html"; then
  ok "index.html includes mobile viewport and SVG charts"
else
  fail "index.html missing required elements"
fi

[ $fails = 0 ] && { echo "metrics: all passed"; exit 0; }
echo "metrics: $fails failed"; exit 1
