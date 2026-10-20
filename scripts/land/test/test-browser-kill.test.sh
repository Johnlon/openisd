#!/usr/bin/env bash
# Killing test-browser.sh (TERM, INT, HUP) takes the whole run with it: the process it started and
# every descendant, including ones that ignore TERM. Fake npx in a scratch copy of scripts/; no browser.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/tb-kill.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }
mkdir -p "$SCRATCH/repo" "$SCRATCH/bin" "$SCRATCH/rt"
cp -r "$REPO/scripts" "$SCRATCH/repo/scripts"
printf '#!/usr/bin/env bash\nexit 0\n' > "$SCRATCH/repo/scripts/kill-http.sh"   # never touch a real port
printf '#!/usr/bin/env bash\nexit 0\n' > "$SCRATCH/repo/scripts/build-test-app.sh"   # no real vite build (T489)
# fake npx: --list reports one test; the run starts a TERM-ignoring grandchild and a plain one, and records their pids
cat > "$SCRATCH/bin/npx" <<'NPX'
#!/usr/bin/env bash
if [ "$2 $3" = "test --list" ]; then echo "Total: 1 test in 1 file"; exit 0; fi
bash -c 'trap "" TERM; sleep 300 & echo $! >> "$FAKE_PIDS"; wait' &
echo $! >> "$FAKE_PIDS"
sleep 300 & echo $! >> "$FAKE_PIDS"
wait
NPX
chmod +x "$SCRATCH/bin/npx"
export PATH="$SCRATCH/bin:$PATH" OPENISD_RUNTIME_DIR="$SCRATCH/rt" FAKE_PIDS="$SCRATCH/pids"
alive() { local n=0 p; for p in $(cat "$FAKE_PIDS" 2> /dev/null); do kill -0 "$p" 2> /dev/null && n=$((n + 1)); done; echo "$n"; }

# INT is not tested: a non-interactive shell starts background jobs with INT ignored; a tty sends it to the group.
for sig in TERM HUP; do
  : > "$FAKE_PIDS"
  bash "$SCRATCH/repo/scripts/test-browser.sh" x.spec.ts > "$SCRATCH/out.$sig" 2>&1 & w=$!
  sleep 3
  before=$(alive)
  [ "$before" -ge 3 ] && ok "$sig: run has $before live processes" || fail "$sig: only $before live processes before the kill"
  kill -"$sig" "$w"
  wait "$w" 2> /dev/null
  sleep 0.5
  left=$(alive)
  [ "$left" = 0 ] && ok "$sig to the wrapper: whole run gone" || fail "$sig to the wrapper: $left run processes still alive"
  for p in $(cat "$FAKE_PIDS"); do kill -KILL "$p" 2> /dev/null; done
done
[ "$fails" = 0 ] && { echo "test-browser-kill: all passed"; exit 0; }
exit 1
