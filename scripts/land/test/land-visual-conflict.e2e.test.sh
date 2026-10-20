#!/usr/bin/env bash
# T313, processes.md rule 7: a rebase that conflicts only on generated visual files (baseline pictures,
# SOURCES.sha256) is never a real conflict. land.sh takes main's side, re-takes the baselines on the rebased
# sources (VISUAL_RETAKE_CMD) and lands; a conflict on any other file still blocks. End to end in a scratch
# repo: the real land.sh and scripts/visual, real git, and a fake re-take that draws each picture from the
# sources, so a picture is right only when it was taken on both branches' changes.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-visual-conflict.XXXXXX")"
export OPENISD_RUNTIME_DIR="$SCRATCH/rt" OPENISD_STATE_DIR="$SCRATCH/state"; mkdir -p "$OPENISD_RUNTIME_DIR"  # never the machine's own runtime state
export VISUAL_PAGES_DIR="$SCRATCH/pages" VISUAL_PAGES_URL="http://example.test/pages"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

SNAP=packages/ui/test/visual/visual.browser.spec.ts-snapshots
HASH=packages/ui/test/visual/SOURCES.sha256
ORIGIN="$SCRATCH/w/origin.git"

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git seed 2>/dev/null; cd seed || exit 2
    mkdir -p scripts tasks/fixes gates packages/ui/src "$SNAP"
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/
    cp -r "$REPO/scripts/land" "$REPO/scripts/visual" "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh
    printf '#!/usr/bin/env bash\n! grep -qi "^co-authored-by:.*claude"\n' > gates/attribution.sh
    # The fake re-take: screen-a is every source file, in order; then the sources hash, as update.sh writes it.
    cat > gates/retake.sh <<'SH'
#!/usr/bin/env bash
[ -f gates/retake-fails ] && { echo "retake: browser failed"; exit 1; }
. scripts/visual/lib.sh
cat packages/ui/src/*.txt > "$VISUAL_SNAPSHOT_DIR/screen-a.png"
visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE"
SH
    cat > land.conf <<EOF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
ATTRIBUTION_CMD="bash gates/attribution.sh"
CANDIDATE_CMD="true"
VISUAL_RETAKE_CMD="bash gates/retake.sh"
GATE_DEADLINE_S=60
LAND_LOCK="$SCRATCH/land.lock"
EOF
    touch tasks/.keep tasks/fixes/.keep
    echo base > packages/ui/src/0-base.txt; echo base > notes.txt
    bash gates/retake.sh
    git add -A; git commit -qm base; git push -q origin main
    cd ..
    for w in w1 w2; do git clone -q origin.git $w; git -C $w config user.email t@t; git -C $w config user.name t; done
}
# task <clone> <id> <source file> [other file]: a task that changes one source, re-takes the baselines, and
# optionally also changes another file; committed in the clone
task() {
    local dir="$SCRATCH/w/$1"
    cat > "$dir/tasks/$2.yml" <<EOF
id: $2
owner: test
status: claimed
goal: change $3
done_test: true
files:
  - $3
visual:
  - screen-a
EOF
    echo "$2" > "$dir/packages/ui/src/$3"
    [ -n "${4:-}" ] && echo "$2" > "$dir/$4"
    (cd "$dir" && bash gates/retake.sh)
    git -C "$dir" add -A; git -C "$dir" commit -qm "work $2"
}
land() { (cd "$SCRATCH/w/$1" && timeout 120 bash scripts/land.sh "$2" > "$SCRATCH/out.$1" 2>&1); }
on_main() { git -C "$ORIGIN" show "main:$1" 2> /dev/null; }

# 1. both branches re-took the same picture: the second lands, with the picture taken on both changes and a
#    sources hash that matches main's sources
setup; task w2 T2 2-two.txt; land w2 T2 || fail "the first landing failed: $(tail -5 "$SCRATCH/out.w2")"
task w1 T1 1-one.txt; land w1 T1; r=$?
pic="$(on_main "$SNAP/screen-a.png" | tr '\n' ' ')"
git clone -q "$ORIGIN" "$SCRATCH/w/check"; want="$(cd "$SCRATCH/w/check" && . scripts/visual/lib.sh && visual_sources_hash)"
if [ $r = 0 ] && [ "$pic" = "base T1 T2 " ] && [ "$(on_main "$HASH")" = "$want" ] && grep -q 're-taking the visual baselines' "$SCRATCH/out.w1"; then
    ok "a conflict on baselines only: main's taken, re-taken on both changes, landed"
else fail "baselines only (r=$r pic='$pic'): $(tail -8 "$SCRATCH/out.w1")"; fi

# 2. a conflict on a file that is not generated still blocks, even beside a baseline conflict
setup; task w2 T2 2-two.txt notes.txt; land w2 T2 || fail "the first landing failed: $(tail -5 "$SCRATCH/out.w2")"
task w1 T1 1-one.txt notes.txt; before=$(git -C "$ORIGIN" rev-parse main); land w1 T1; r=$?
if [ $r = 3 ] && grep -q 'BLOCKED T1: rebase conflicts in .*notes.txt' "$SCRATCH/out.w1" && [ "$(git -C "$ORIGIN" rev-parse main)" = "$before" ] \
   && [ -z "$(git -C "$SCRATCH/w/w1" status --porcelain)" ] && ! [ -d "$SCRATCH/w/w1/.git/rebase-merge" ]; then
    ok "a conflict on another file blocks, main untouched, no rebase left half done"
else fail "real conflict (r=$r): $(tail -5 "$SCRATCH/out.w1")"; fi

# 3. the re-take fails: refused by gate visual-retake, main untouched
setup; task w2 T2 2-two.txt; land w2 T2 || fail "the first landing failed: $(tail -5 "$SCRATCH/out.w2")"
task w1 T1 1-one.txt; touch "$SCRATCH/w/w1/gates/retake-fails"; before=$(git -C "$ORIGIN" rev-parse main); land w1 T1; r=$?
if [ $r = 1 ] && grep -q 'REFUSED by gate visual-retake' "$SCRATCH/out.w1" && grep -q 'browser failed' "$SCRATCH/out.w1" \
   && [ "$(git -C "$ORIGIN" rev-parse main)" = "$before" ]; then
    ok "a failed re-take refuses the landing and says why; main untouched"
else fail "failed re-take (r=$r): $(tail -6 "$SCRATCH/out.w1")"; fi

[ $fails = 0 ] && { echo "land-visual-conflict: all passed"; exit 0; }
echo "land-visual-conflict: $fails failed"; exit 1
