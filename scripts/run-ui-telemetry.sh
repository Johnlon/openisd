#!/usr/bin/env bash
# run-ui-telemetry.sh — the WHOLE browser suite, one test at a time, with telemetry.
#
#   setsid nohup bash scripts/run-ui-telemetry.sh > build/ui-telemetry/nohup.log 2>&1 &
#
# Launch it detached like that. This run takes tens of minutes and must outlive the agent
# session that started it: an agent shell being killed (harness memory pressure, session going
# idle) took down three measurement runs on 2026-09-15, each time producing nothing.
#
# Sequential ON PURPOSE (--workers=1): the point is per-test timing and memory attributable to
# ONE test at a time, which parallel workers make impossible to read.
#
# --retries=0: a retry would double-count a failing test in the telemetry and hide how long the
# first honest attempt took. Every test runs exactly once.
#
# NOTHING is filtered: no path arguments, no --grep, no --last-failed. The suite's own config
# already fails the run on a skip (scripts/test-reporters/no-skips-playwright.js), and the
# reporters come from playwright.config.js rather than --reporter so that gate, the json report
# and this telemetry all stay on. Per-test timeout is the config's 60 s.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT_DIR="build/ui-telemetry"
PORT="${OPENISD_TEST_PORT:-4100}"

# Survive the launching shell being hung up or killed.
trap '' HUP

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SUBJECT="$(git log -1 --pretty=%s)"
STARTED_AT="$(date -Is)"
STARTED_EPOCH="$(date +%s)"

# Anything already holding the test port would be reused by playwright's webServer and serve
# who-knows-what; the suite's own webServer command frees it too, but do it before the sampler
# starts so the samples describe this run only.
bash scripts/kill-http.sh "$PORT" >/dev/null 2>&1 || true

node scripts/telemetry-sampler.mjs "$OUT_DIR/memory.jsonl" 5 &
SAMPLER_PID=$!
echo "$SAMPLER_PID" > "$OUT_DIR/sampler.pid"

write_run_json() {
  local status="$1" exit_code="$2" ended_at="$3" elapsed="$4"
  cat > "$OUT_DIR/run.json" <<JSON
{
  "status": "$status",
  "exitCode": $exit_code,
  "head": "$HEAD_SHA",
  "headSubject": $(printf '%s' "$HEAD_SUBJECT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
  "workers": 1,
  "retries": 0,
  "port": "$PORT",
  "startedAt": "$STARTED_AT",
  "endedAt": ${ended_at:+\"$ended_at\"}${ended_at:-null},
  "elapsedSeconds": ${elapsed:-null},
  "runLog": "$OUT_DIR/run.log",
  "events": "$OUT_DIR/events.jsonl",
  "memory": "$OUT_DIR/memory.jsonl"
}
JSON
}

stop_sampler() {
  if kill -0 "$SAMPLER_PID" 2>/dev/null; then
    kill -TERM "$SAMPLER_PID" 2>/dev/null || true
    wait "$SAMPLER_PID" 2>/dev/null || true
  fi
  rm -f "$OUT_DIR/sampler.pid"
}
trap 'stop_sampler' EXIT

write_run_json running 0 "" ""

OPENISD_TEST_WORKERS=1 OPENISD_TEST_PORT="$PORT" \
  npx playwright test --workers=1 --retries=0 2>&1 | tee "$OUT_DIR/run.log"
EXIT_CODE="${PIPESTATUS[0]}"

ENDED_AT="$(date -Is)"
ELAPSED=$(( $(date +%s) - STARTED_EPOCH ))
stop_sampler
write_run_json finished "$EXIT_CODE" "$ENDED_AT" "$ELAPSED"

echo "run-ui-telemetry: exit $EXIT_CODE after ${ELAPSED}s — $OUT_DIR/run.json"
exit "$EXIT_CODE"
