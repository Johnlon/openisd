#!/usr/bin/env bash
# T301, processes.md rule 7: land.sh runs the full suite on GitHub Actions on the candidate branch
# land/<task> and pushes main only on green. End to end in a scratch repo: the real land.sh and the real
# scripts/land/post-land/actions.sh (CANDIDATE_CMD), real git and processes, two concurrent landings, and a
# fake `gh` on PATH that answers from files (no network).
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-candidate.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt"; mkdir -p "$OPENISD_RUNTIME_DIR"  # never the machine's own runtime state
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# The fake gh. The candidate's sha is made by land.sh (rebase and squash), so the answer is set for any
# sha: $FAKE_GH/conclusion (success|failure; missing = no run appears), $FAKE_GH/log (--log-failed),
# $FAKE_GH/watch (seconds a watch takes). The run id is the sha. "run watch" records origin's main and
# its candidate branches at that moment: what main is while the candidate's run is going.
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/gh" <<'GH'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_GH/calls"
[ "$1 $2" = "run list" ] && { shift 2; while [ $# -gt 0 ]; do [ "$1" = --commit ] && sha="$2"; shift; done
  [ -f "$FAKE_GH/conclusion" ] && echo "$sha"; exit 0; }
id="$3"
case "$1 $2" in
  "run watch") echo "$id main=$(git -C "$ORIGIN" rev-parse main) $(git -C "$ORIGIN" for-each-ref --format='%(refname:short)=%(objectname)' refs/heads/land | tr '\n' ' ')" >> "$FAKE_GH/watched"
    sleep "$(cat "$FAKE_GH/watch" 2>/dev/null || echo 0)"; exit 0 ;;
  "run view") case " $* " in
      *" --log-failed "*) cat "$FAKE_GH/log" 2>/dev/null; exit 0 ;;
      *) cat "$FAKE_GH/conclusion"; exit 0 ;; esac ;;
  "run download") exit 1 ;;
esac
exit 1
GH
chmod +x "$SCRATCH/bin/gh"
export PATH="$SCRATCH/bin:$PATH" FAKE_GH="$SCRATCH/gh" ORIGIN="$SCRATCH/w/origin.git"

setup() {
    rm -rf "$SCRATCH/w" "$FAKE_GH"; mkdir -p "$SCRATCH/w" "$FAKE_GH"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git seed 2>/dev/null; cd seed || exit 2
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/
    cp -r "$REPO/scripts/land" "$REPO/scripts/visual" "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
    printf '#!/usr/bin/env bash\n! grep -qi "^co-authored-by:.*claude"\n' > gates/attribution.sh
    cat > land.conf <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/attribution.sh"
CANDIDATE_CMD="bash scripts/land/post-land/actions.sh"
ACTIONS_REPO=owner/name
ACTIONS_FIND_S=3
ACTIONS_POLL_S=1
GATE_DEADLINE_S=60
LAND_LOCK="$SCRATCH/land.lock"
EOF
    touch tasks/.keep tasks/fixes/.keep
    echo base > a.txt; echo base > b.txt
    git add -A; git commit -qm base; git push -q origin main
    cd ..
    for w in w1 w2; do git clone -q origin.git $w; git -C $w config user.email t@t; git -C $w config user.name t; done
}
# task <clone> <id> <file>: a task that edits one file, committed in the clone
task() {
    cat > "$SCRATCH/w/$1/tasks/$2.yml" <<EOF
id: $2
owner: test
status: claimed
goal: change $3
done_test: true
files:
  - $3
EOF
    echo "$2" >> "$SCRATCH/w/$1/$3"
    git -C "$SCRATCH/w/$1" add -A; git -C "$SCRATCH/w/$1" commit -qm "work $2"
}
land() { (cd "$SCRATCH/w/$1" && timeout 120 bash scripts/land.sh "$2" > "$SCRATCH/out.$1" 2>&1); }
origin_main() { git -C "$ORIGIN" rev-parse main; }
origin_branches() { git -C "$ORIGIN" for-each-ref --format='%(refname:short)' refs/heads/land; }

# 1. green candidate: the run is found on the candidate's sha while main has not moved; then main is the
#    candidate, and the candidate branch is gone
setup; task w1 T1 a.txt; echo success > "$FAKE_GH/conclusion"; before=$(origin_main)
land w1 T1; r=$?; cand=$(awk '{print $1}' "$FAKE_GH/watched" 2>/dev/null)
if [ $r = 0 ] && [ -n "$cand" ] && [ "$(origin_main)" = "$cand" ] && grep -q "main=$before land/T1=$cand" "$FAKE_GH/watched" \
   && grep -q -- "--commit $cand" "$FAKE_GH/calls" && [ -z "$(origin_branches)" ]; then
    ok "green candidate: main moves to it only after its run, branch removed"
else fail "green (r=$r cand=$cand main=$(origin_main)): $(cat "$FAKE_GH/watched" 2>/dev/null) | $(tail -5 "$SCRATCH/out.w1")"; fi

# 2. red candidate: refused by gate candidate with the failing specs and the run link; main untouched;
#    branch removed
setup; task w1 T1 a.txt; echo failure > "$FAKE_GH/conclusion"
printf 'browser (3)\tbrowser tests\t2026-10-17T01:00:00Z   ✘  12 packages/ui/test/ui/broken.browser.spec.ts:5:3 › breaks (1.0s)\n' > "$FAKE_GH/log"
before=$(origin_main); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_main)" = "$before" ] && grep -q 'REFUSED by gate candidate' "$SCRATCH/out.w1" \
   && grep -q 'broken.browser.spec.ts:5:3' "$SCRATCH/out.w1" && grep -q 'actions/runs/' "$SCRATCH/out.w1" && [ -z "$(origin_branches)" ]; then
    ok "red candidate: refused, failing spec and run named, main untouched, branch removed"
else fail "red (r=$r main moved: $([ "$(origin_main)" = "$before" ] || echo yes)): $(tail -8 "$SCRATCH/out.w1")"; fi

# 3. no Actions run appears: refused, never a green; main untouched
setup; task w1 T1 a.txt; before=$(origin_main); land w1 T1; r=$?
if [ $r = 1 ] && [ "$(origin_main)" = "$before" ] && grep -q 'REFUSED by gate candidate' "$SCRATCH/out.w1" && [ -z "$(origin_branches)" ]; then
    ok "no run: refused, main untouched"; else fail "no run (r=$r): $(tail -5 "$SCRATCH/out.w1")"; fi

# 4. two concurrent landings: the second candidate's run starts only after the first is on main (the
#    landing lock), and is the first plus the second change
setup; task w1 T1 a.txt; task w2 T2 b.txt; echo success > "$FAKE_GH/conclusion"; echo 2 > "$FAKE_GH/watch"
land w1 T1 & p1=$!; sleep 0.5; land w2 T2 & p2=$!; wait $p1; r1=$?; wait $p2; r2=$?
c1=$(sed -n 1p "$FAKE_GH/watched" | awk '{print $1}'); c2=$(sed -n 2p "$FAKE_GH/watched" | awk '{print $1}')
if [ $r1 = 0 ] && [ $r2 = 0 ] && [ "$(origin_main)" = "$c2" ] && grep -q "^$c2 main=$c1 " "$FAKE_GH/watched" \
   && [ "$(git -C "$ORIGIN" rev-parse "$c2^")" = "$c1" ]; then
    ok "two landings: the second candidate is tested on top of the first, after it reached main"
else fail "concurrent (r1=$r1 r2=$r2): $(cat "$FAKE_GH/watched")"; fi

# 5. land.sh stopped while it waits for the run: main untouched, branch removed, no process left
setup; task w1 T1 a.txt; echo success > "$FAKE_GH/conclusion"; echo 30 > "$FAKE_GH/watch"; before=$(origin_main)
( cd "$SCRATCH/w/w1" && exec setsid bash scripts/land.sh T1 > "$SCRATCH/out.w1" 2>&1 ) & lp=$!
for _ in $(seq 1 40); do [ -s "$FAKE_GH/watched" ] && break; sleep 0.25; done
# ts-log.sh gives a stopped command a 1 s grace timer (a sleep child it reaps itself); under load the wrapper is
# still inside that window 1 s after the TERM, so the group is read once the window and its reaping are over.
kill -TERM -- "-$lp" 2> /dev/null; wait $lp 2> /dev/null; sleep 4
left=$(ps -o pid= -g "$lp" 2> /dev/null | wc -l)
if [ -s "$FAKE_GH/watched" ] && [ "$(origin_main)" = "$before" ] && [ -z "$(origin_branches)" ] && [ "$left" = 0 ]; then
    ok "stopped while waiting: main untouched, branch removed, nothing left running"
else fail "stopped (left=$left branches=$(origin_branches) main moved: $([ "$(origin_main)" = "$before" ] || echo yes))"; fi

[ $fails = 0 ] && { echo "land-candidate: all passed"; exit 0; }
echo "land-candidate: $fails failed"; exit 1
