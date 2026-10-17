#!/usr/bin/env bash
# run.sh on a RED run: the fixes task is committed on top of the tested sha, never on top of an older
# origin/main. When the sha is not on origin yet (main is ahead of origin), the push is a fast-forward
# that carries the sha's own history plus the F commit. Not one of the locked specs.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
export POST_LAND_QUIET_S=0   # the quiet period is tested in post-land-queue.test.sh
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/post-land-redbase.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
export POST_LAND_KEEP_DIR="$SCRATCH/keep"
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes; touch tasks/fixes/.keep
    cp -r "$REPO/scripts/land" "$REPO/scripts/lib" scripts/
    printf '#!/usr/bin/env bash\n[ -f FAIL ] && { echo "browser (3): TEST START a/ok.browser.spec.ts > ok works"; echo "browser (3): TEST END a/ok.browser.spec.ts > ok works status=passed"; printf "browser (3):   \\342\\234\\230  4 a/bad.browser.spec.ts:9:5 \\342\\200\\272 bad breaks (2.5s)TEST END a/bad.browser.spec.ts > bad breaks status=failed\\n"; printf "unit (1): \\033[41m FAIL \\033[49m test/x.test.ts > x\\n"; echo "unit (2): ^[[41m^[[1m FAIL ^[[22m^[[49m test/y.test.ts > y"; echo "spec broken.spec.ts failed"; exit 1; }\nexit 0\n' > suite.sh
    printf 'FULL_SUITE_CMD="bash suite.sh"\nPOST_LAND_LOCK="%s/post.lock"\nPOST_LAND_DIR="%s/copies"\n' "$SCRATCH" "$SCRATCH" > land.conf
    git add -A; git commit -qm base; git push -q origin main
}
local_commit() { echo "$1" >> f.txt; [ -n "${2:-}" ] && touch "$2"; git add -A; git commit -qm "$1"; git rev-parse HEAD; }
origin_main() { git -C "$SCRATCH/w/origin.git" rev-parse main; }

# 1. main is ahead of origin (two unpushed commits, the second one red): the F commit lands on
#    top of the red sha, origin/main moves by fast-forward and now holds both commits
setup; base=$(origin_main); local_commit one > /dev/null; s=$(local_commit two FAIL)
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
om=$(origin_main)
if [ $r = 1 ] && [ "$(git -C "$SCRATCH/w/origin.git" rev-parse "$om^")" = "$s" ] \
   && git -C "$SCRATCH/w/origin.git" merge-base --is-ancestor "$base" "$s" \
   && [ "$(git -C "$SCRATCH/w/origin.git" rev-list --count "$base..$om")" = 3 ]; then
    ok "unpushed red sha: origin/main = the sha's history + the F commit on top (fast-forward)"
else fail "unpushed red (r=$r om=$om): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

# 2. the sha is already on origin/main: the F commit lands on top of origin/main as before
setup; s=$(local_commit three FAIL); git push -q origin main
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
om=$(origin_main)
if [ $r = 1 ] && [ "$(git -C "$SCRATCH/w/origin.git" rev-parse "$om^")" = "$s" ]; then
    ok "pushed red sha: the F commit sits on top of it"; else fail "pushed red (r=$r)"; fi

# 3. origin/main moved on without the sha (a diverged main): no F commit, loud failure, origin untouched
setup; s=$(local_commit four FAIL)
git clone -q "$SCRATCH/w/origin.git" "$SCRATCH/w/other" 2>/dev/null
( cd "$SCRATCH/w/other" && git config user.email t@t && git config user.name t && echo x > other.txt && git add -A && git commit -qm other && git push -q origin main )
before=$(origin_main)
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
if [ $r != 0 ] && [ "$(origin_main)" = "$before" ] && grep -qi "diverged\|not a fast-forward\|cannot" "$SCRATCH/out"; then
    ok "diverged origin: nothing pushed, the cause is named"; else fail "diverged (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-200)"; fi

# 4. the first push loses a race (origin refuses it once): one plain retry line, no git noise, the F lands
#    on the second attempt; the red run's whole output is kept and the F names the file
setup; s=$(local_commit five FAIL); git push -q origin main
printf '#!/bin/sh\n[ -e "%s/raced" ] && exit 0\ntouch "%s/raced"; echo "cannot lock ref" >&2; exit 1\n' "$SCRATCH" "$SCRATCH" > "$SCRATCH/w/origin.git/hooks/pre-receive"
chmod +x "$SCRATCH/w/origin.git/hooks/pre-receive"; rm -f "$SCRATCH/raced"
timeout 120 bash scripts/land/post-land/run.sh "$s" > "$SCRATCH/out" 2>&1; r=$?
keep="$POST_LAND_KEEP_DIR/post-land-red-${s:0:10}.log"
if [ $r = 1 ] && [ "$(git -C "$SCRATCH/w/origin.git" rev-parse "$(origin_main)^")" = "$s" ] \
   && grep -q 'lost a race with another push (attempt 1 of 3); retrying' "$SCRATCH/out" \
   && ! grep -qE 'rejected|cannot lock|outside repository|^hint:' "$SCRATCH/out"; then
    ok "a lost first push: one retry line, no git noise, the F lands"; else fail "race (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
f=$(git -C "$SCRATCH/w/origin.git" show "$(origin_main)" --name-only --format= | grep 'tasks/fixes/F')
if grep -q 'spec broken.spec.ts failed' "$keep" 2> /dev/null \
   && git -C "$SCRATCH/w/origin.git" show "$(origin_main):$f" | grep -qx "full_output: $keep"; then
    ok "the whole output is kept and the F names it"; else fail "kept output: $keep / $f"; fi
fl=$(git -C "$SCRATCH/w/origin.git" show "$(origin_main):$f" | sed -n '/^failing: |/,/^[a-z_]*:/p')
if ! grep -q 'TEST \|ok.browser\|\x1b' <<< "$fl" && grep -q 'bad.browser.spec.ts:9:5 › bad breaks (2.5s)$' <<< "$fl" \
   && grep -q 'FAIL  test/x.test.ts' <<< "$fl" && grep -q 'unit (2):  FAIL  test/y.test.ts > y' <<< "$fl" && ! grep -qF '^[' <<< "$fl"; then
    ok "the F lists only the failing specs, with no markers or colour codes"; else fail "failing list: $fl"; fi

# 5. a later green closes the open F whose red commits it holds; an F with a red sha outside its history and
#    an infra F (no sha) stay open
setup; r1=$(local_commit red1 FAIL); git push -q origin main
timeout 120 bash scripts/land/post-land/run.sh "$r1" > "$SCRATCH/out" 2>&1
git pull -q --rebase origin main 2> /dev/null
f=$(grep -lx 'status: open' tasks/fixes/F*.yml | head -1)
printf 'id: F90\nstatus: open\nsha: %s\n' "$(git -C "$SCRATCH/w/origin.git" hash-object -t commit --stdin <<< 'tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904
author t <t@t> 0 +0000
committer t <t@t> 0 +0000

x' 2> /dev/null || echo 1111111111111111111111111111111111111111)" > tasks/fixes/F90.yml
printf 'id: F91\nstatus: open\nlabel: infra\ngate: lint\n' > tasks/fixes/F91.yml
git rm -q FAIL; git add tasks/fixes; git commit -qm green1; g=$(git rev-parse HEAD); git push -q origin main
timeout 120 bash scripts/land/post-land/run.sh "$g" > "$SCRATCH/out" 2>&1; r=$?
st() { git -C "$SCRATCH/w/origin.git" show "main:$1" | sed -n 's/^status: //p'; }
if [ $r = 0 ] && [ -n "$f" ] && [ "$(st "$f")" = done ] && [ "$(st tasks/fixes/F90.yml)" = open ] && [ "$(st tasks/fixes/F91.yml)" = open ] \
   && grep -q "closed $(basename "$f" .yml) on main" "$SCRATCH/out"; then
    ok "a later green closes the F it fixes; others stay open"
else fail "green close (r=$r f=$f: $(st "$f") F90 $(st tasks/fixes/F90.yml) F91 $(st tasks/fixes/F91.yml)): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

[ $fails = 0 ] && { echo "post-land-red-base: all passed"; exit 0; }
echo "post-land-red-base: $fails failed"; exit 1
