#!/usr/bin/env bash
# T489, processes.md rule 7: a network stall must not hold the landing lock. Real land.sh and pr.sh, real git, a
# `git` wrapper on PATH that hangs on one named call, a stand-in gh that hangs; LAND_NET_TIMEOUT_S=3 bounds each call.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-network-bound.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
fails=0
trap '[ -n "${KEEP:-}" ] || rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
ORIGIN="$SCRATCH/w/origin.git"
REALGIT=/usr/bin/git  # the binary itself: a git wrapper script earlier on PATH would find this test's wrapper again

# git wrapper: HANG_ON names the call to hang on (fetch, push-candidate, push-main); everything else is real git.
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/git" <<WRAP
#!/usr/bin/env bash
case "\${HANG_ON:-}:\$*" in
  fetch:*fetch*|push-candidate:*push*refs/heads/land/*|push-main:*push*HEAD:main*) exec sleep 60 ;;
esac
exec "$REALGIT" "\$@"
WRAP
chmod +x "$SCRATCH/bin/git"
cat > "$SCRATCH/gh" <<'WRAP'
#!/usr/bin/env bash
[ -n "${GH_HANG:-}" ] && exec sleep 60
case "$1 $2" in "pr create") echo "https://github.com/o/r/pull/7" ;; esac
WRAP
chmod +x "$SCRATCH/gh"
export LAND_GH="$SCRATCH/gh" LAND_NET_TIMEOUT_S=3

setup() { # setup <pull requests on: 1/"">
  rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
  git init -q --bare -b main origin.git
  git clone -q origin.git seed 2> /dev/null; cd seed || exit 2
  mkdir -p scripts tasks/fixes gates
  cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/
  cp -r "$REPO/scripts/land" "$REPO/scripts/visual" "$REPO/scripts/lib" scripts/
  printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
  cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
GATE_DEADLINE_S=60
LAND_LOCK="$SCRATCH/land.lock"
ACTIONS_REPO=o/r
PULL_REQUESTS=$1
CONF
  touch tasks/.keep tasks/fixes/.keep; echo base > a.txt
  git add -A; git commit -qm base; git push -q origin main
  cd ..; git clone -q origin.git w1
  printf 'id: T1\nowner: maryu\nstatus: claimed\ngoal: a.txt says hello\ndone_test: true\nfiles:\n  - a.txt\n' > w1/tasks/T1.yml
  echo hello >> w1/a.txt; git -C w1 add -A; git -C w1 commit -qm "work T1"
}
land() { # sets r (exit status) and secs (seconds taken)
  local t0=$SECONDS
  (cd "$SCRATCH/w/w1" && PATH="$SCRATCH/bin:$PATH" timeout 60 bash scripts/land.sh T1 > "$SCRATCH/out" 2>&1)
  r=$?; secs=$((SECONDS - t0))
}
check() { # check <name> <pattern in output>
  if [ "$r" != 0 ] && [ "$r" != 124 ] && [ "$secs" -lt 30 ] && grep -q "$2" "$SCRATCH/out"; then ok "$1 is bounded and refused loudly"
  else fail "$1 (r=$r, ${secs}s): $(tail -4 "$SCRATCH/out")"; fi
}

setup "";  HANG_ON=fetch land;          check "git fetch" "git fetch.*timed out after 3"
setup "";  HANG_ON=push-candidate land; check "the candidate push" "git push of the candidate.*timed out after 3"
setup 1;   GH_HANG=1 land;              check "gh pr create" "gh pr create.*timed out after 3"
setup "";  HANG_ON=push-main land;      check "the main push" "git push of main.*timed out after 3"

# the lock is free again after a stalled landing (the next landing is not held)
if flock -n "$SCRATCH/land.lock" true; then ok "the landing lock is released after a stall"; else fail "lock still held"; fi

# a healthy landing is unaffected
setup 1; land
[ "$r" = 0 ] && [ "$(git -C "$ORIGIN" rev-parse main)" = "$(git -C "$SCRATCH/w/w1" rev-parse HEAD)" ] && ok "a healthy landing still lands" || fail "healthy landing (r=$r): $(tail -4 "$SCRATCH/out")"

[ $fails = 0 ] && { echo "land-network-bound.e2e: all passed"; exit 0; }
echo "land-network-bound.e2e: $fails failed"; exit 1
