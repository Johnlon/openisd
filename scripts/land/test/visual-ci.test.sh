#!/usr/bin/env bash
# T799: baseline pictures are drawn only by CI's test machine (visual-retake.yml), and nothing else can commit them.
# Real git, a bare origin and a gh stand-in. Proves: can-draw, the stamp tool, the provenance gate of check-task.sh
# (offline and with the run verified through the GitHub API), update.sh and retake-ci.sh on a machine that cannot draw,
# the refusal of --update-snapshots in scripts/test.sh, and that both workflows name one test-machine image.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/visual-ci.XXXXXX")"; trap 'rm -rf "$SCRATCH"' EXIT
GITCFG="$SCRATCH/gitconfig"; printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
unset OPENISD_VISUAL_DRAWER GITHUB_ACTIONS VISUAL_VERIFY_RUN
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
SNAP=packages/ui/test/visual/visual.browser.spec.ts-snapshots

# --- can-draw: only the visual-retake workflow's machine
bash "$REPO/scripts/visual/can-draw.sh" && fail "an ordinary machine can draw" || ok "an ordinary machine cannot draw"
OPENISD_VISUAL_DRAWER=ci-runner bash "$REPO/scripts/visual/can-draw.sh" && fail "the env var alone lets a machine draw" || ok "the drawer env var alone does not let a machine draw"
GITHUB_ACTIONS=true OPENISD_VISUAL_DRAWER=ci-runner bash "$REPO/scripts/visual/can-draw.sh" && ok "the workflow's machine can draw" || fail "the workflow's machine cannot draw"
bash "$REPO/scripts/visual/ci-draw.sh" "$SCRATCH/o" > "$SCRATCH/out" 2>&1 && fail "ci-draw ran on an ordinary machine" || { grep -q "not the visual-retake" "$SCRATCH/out" && ok "ci-draw refuses off the test machine" || fail "ci-draw refusal text: $(cat "$SCRATCH/out")"; }

# --- the stamp tool: the pixels (IDAT) stay, the mark is read back, a second stamp replaces the first
node -e "
const z=require('zlib');const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t.push(c>>>0)}
const crc=b=>{let c=~0;for(const x of b)c=t[(c^x)&255]^(c>>>8);return(~c)>>>0};
const ch=(ty,d)=>{const h=Buffer.alloc(8);h.writeUInt32BE(d.length,0);h.write(ty,4);const tl=Buffer.alloc(4);tl.writeUInt32BE(crc(Buffer.concat([h.subarray(4),d])),0);return Buffer.concat([h,d,tl])};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=2;
require('fs').writeFileSync('$SCRATCH/real.png',Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ch('IHDR',ihdr),ch('IDAT',z.deflateSync(Buffer.from([0,1,2,3]))),ch('IEND',Buffer.alloc(0))]))"
node "$REPO/scripts/visual/png-stamp.mjs" read "$SCRATCH/real.png" > "$SCRATCH/out"; [ ! -s "$SCRATCH/out" ] && ok "an unstamped picture reads as no run" || fail "unstamped read: $(cat "$SCRATCH/out")"
node "$REPO/scripts/visual/png-stamp.mjs" stamp 4242 "$SCRATCH/real.png" && node "$REPO/scripts/visual/png-stamp.mjs" stamp 4343 "$SCRATCH/real.png"
[ "$(node "$REPO/scripts/visual/png-stamp.mjs" read "$SCRATCH/real.png")" = 4343 ] && [ "$(LC_ALL=C grep -a -c 'openisd-visual-run' "$SCRATCH/real.png")" = 1 ] && ok "a stamp reads back and a second stamp replaces the first" || fail "stamp read back"
node -e "
const z=require('zlib'),b=require('fs').readFileSync('$SCRATCH/real.png');let at=8,ok=false;
while(at<b.length){const n=b.readUInt32BE(at),t=b.toString('latin1',at+4,at+8);if(t==='IDAT'){const d=z.inflateSync(b.subarray(at+8,at+8+n));ok=d.equals(Buffer.from([0,1,2,3]))}at+=12+n}
process.exit(ok?0:1)" && ok "a stamped picture keeps its pixel data" || fail "stamped picture lost its pixels"

# --- the provenance gate in check-task.sh
stamped() { printf '\211PNG\r\n\032\n%s\0openisd-visual-run\0run=%s' "$1" "${3:-7}" > "$2"; }
unstamped() { printf '\211PNG\r\n\032\n%s' "$1" > "$2"; }
W="$SCRATCH/w"; mkdir -p "$W" && cd "$W" || exit 2
git init -q -b main . && mkdir -p scripts tasks "$SNAP" && cp -r "$REPO/scripts/visual" scripts/
printf 'id: T1\nvisual:\n  - mobile-a\nvisual_note: a changed\n' > tasks/T1.yml
stamped one "$SNAP/mobile-a.png"; git add -A; git commit -qm base; base=$(git rev-parse HEAD)
unstamped two "$SNAP/mobile-a.png"; git commit -qam machine-drawn; bad=$(git rev-parse HEAD)
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$bad" > "$SCRATCH/out" 2>&1 \
  && fail "a baseline with no CI stamp passed" || { grep -q "mobile-a" "$SCRATCH/out" && grep -q "update.sh" "$SCRATCH/out" && ok "a baseline not drawn by CI is refused, naming the screen and the fix" || fail "refusal text: $(cat "$SCRATCH/out")"; }
stamped two "$SNAP/mobile-a.png" 9; git commit -qam ci-drawn; good=$(git rev-parse HEAD)
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$good" > "$SCRATCH/out" 2>&1 && ok "a baseline stamped by a visual-retake run passes" || fail "stamped refused: $(cat "$SCRATCH/out")"
git rm -q "$SNAP/mobile-a.png"; git commit -qm removed; gone=$(git rev-parse HEAD)
bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$gone" > "$SCRATCH/out" 2>&1 && ok "removing a baseline needs no stamp" || fail "removal refused: $(cat "$SCRATCH/out")"

# with the run verified through the GitHub API (the pull request check): a gh stand-in answers for run 9
cat > "$SCRATCH/gh" <<'EOF2'
#!/usr/bin/env bash
echo "$*" >> "$GH_CALLS"
case "$1 $2" in
  "api repos/o/r/actions/runs/9") printf '%s\t%s\n' "${RUN_PATH:-.github/workflows/visual-retake.yml}" "${RUN_CONCLUSION:-success}" ;;
  "run download") d="${@: -1}"; mkdir -p "$d"; printf '%s\n' "$MANIFEST" > "$d/MANIFEST.sha256" ;;
  *) echo "gh stub: unexpected $*" >&2; exit 1 ;;
esac
EOF2
chmod +x "$SCRATCH/gh"; export GH_CALLS="$SCRATCH/calls" VISUAL_GH="$SCRATCH/gh" VISUAL_REPO=o/r
sha="$(git show "$good:$SNAP/mobile-a.png" | sha256sum | cut -d' ' -f1)"
export MANIFEST="$sha  mobile-a.png"
VISUAL_VERIFY_RUN=1 bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$good" > "$SCRATCH/out" 2>&1 && ok "a picture in its run's manifest passes the API check" || fail "verified run refused: $(cat "$SCRATCH/out")"
MANIFEST="0000  mobile-a.png" VISUAL_VERIFY_RUN=1 bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$good" > "$SCRATCH/out" 2>&1 \
  && fail "a picture not in the run's manifest passed" || { grep -q "mobile-a" "$SCRATCH/out" && ok "a picture that is not what the run drew is refused" || fail "text: $(cat "$SCRATCH/out")"; }
RUN_PATH=.github/workflows/other.yml VISUAL_VERIFY_RUN=1 bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$good" > "$SCRATCH/out" 2>&1 \
  && fail "a stamp naming another workflow's run passed" || ok "a run of another workflow is refused"
RUN_CONCLUSION=failure VISUAL_VERIFY_RUN=1 bash scripts/visual/check-task.sh tasks/T1.yml "$base" "$good" > "$SCRATCH/out" 2>&1 \
  && fail "a failed run passed" || ok "a failed run is refused"
unset VISUAL_GH VISUAL_REPO MANIFEST

# --- update.sh on a machine that cannot draw asks CI (retake-ci.sh): no local browser, no local pictures
cd "$SCRATCH" && rm -rf w2 && mkdir w2 && git init -q --bare -b main origin.git && git clone -q origin.git w2 2> /dev/null && cd w2 || exit 2
mkdir -p scripts tasks "$SNAP" packages/ui/src && cp -r "$REPO/scripts/visual" scripts/
printf '#!/usr/bin/env bash\necho "LOCAL BROWSER RUN $*" >> "$SCRATCH_CALLS"\n' > scripts/test.sh
printf 'SHIP_REMOTE=origin\nSHIP_REPO=o/r\n' > ship.conf
printf '<template>a</template>' > packages/ui/src/A.vue; stamped one "$SNAP/mobile-a.png" 3
git add -A; git commit -qm base; git push -q origin main
git checkout -q -b t1; printf '<template>b</template>' > packages/ui/src/A.vue; git commit -qam "change a source"
# the fixture CI result: a new mobile-a picture, its manifest, and the sources hash CI computed
FIX="$SCRATCH/fix"; mkdir -p "$FIX/pictures"; stamped newer "$FIX/pictures/mobile-a.png" 55
( cd "$FIX/pictures" && sha256sum mobile-a.png ) > "$FIX/MANIFEST.sha256"
( . scripts/visual/lib.sh; visual_sources_hash > "$FIX/SOURCES.sha256" )
cat > "$SCRATCH/gh2" <<'EOF2'
#!/usr/bin/env bash
echo "$*" >> "$GH_CALLS"
case "$1 $2" in
  "run list") echo 55 ;;
  "run watch") exit 0 ;;
  "run download") d="${@: -1}"; mkdir -p "$d"; cp -r "$FIX/." "$d/" ;;
  *) echo "gh stub: unexpected $*" >&2; exit 1 ;;
esac
EOF2
chmod +x "$SCRATCH/gh2"; : > "$GH_CALLS"; export SCRATCH_CALLS="$SCRATCH/test-calls" FIX VISUAL_GH="$SCRATCH/gh2"; : > "$SCRATCH_CALLS"
echo dirty > scratch.txt
bash scripts/visual/update.sh > "$SCRATCH/out" 2>&1 && fail "retake ran with uncommitted work" || { grep -q "commit" "$SCRATCH/out" && ok "a re-take asks for the work to be committed first" || fail "dirty text: $(cat "$SCRATCH/out")"; }
rm scratch.txt
bash scripts/visual/update.sh > "$SCRATCH/out" 2>&1 && ok "update.sh on a machine that cannot draw gets the pictures from CI" || fail "update.sh: $(cat "$SCRATCH/out")"
[ ! -s "$SCRATCH_CALLS" ] && ok "no browser ran on this machine" || fail "a local browser run: $(cat "$SCRATCH_CALLS")"
[ "$(LC_ALL=C grep -a -o 'openisd-visual-run.run=[0-9]*' "$SNAP/mobile-a.png" | sed 's/.*run=//')" = 55 ] && ok "the picture is the one CI drew (stamped with its run)" || fail "picture not from CI"
[ "$(cat packages/ui/test/visual/SOURCES.sha256)" = "$(cat "$FIX/SOURCES.sha256")" ] && ok "SOURCES.sha256 is the hash CI computed for these sources" || fail "sources hash"
grep -q "^run list .*--branch visual-retake/t1" "$GH_CALLS" && ok "CI is asked for this branch's commit" || fail "calls: $(cat "$GH_CALLS")"
[ -z "$(git ls-remote origin 'refs/heads/visual-retake/*')" ] && ok "the temporary retake branch is deleted afterwards" || fail "retake branch left on the remote"
# a GitHub API failure while waiting is not reported as a failed run, and --run takes a finished run without pushing
git add -A; git commit -qm "re-taken"
cat > "$SCRATCH/gh3" <<'EOF2'
#!/usr/bin/env bash
echo "$*" >> "$GH_CALLS"
case "$1 $2" in
  "run list") echo 55 ;;
  "run watch") echo "HTTP 403: API rate limit exceeded"; exit 1 ;;
  "run view") exit 1 ;;
  "run download") d="${@: -1}"; mkdir -p "$d"; cp -r "$FIX/." "$d/" ;;
esac
EOF2
chmod +x "$SCRATCH/gh3"
VISUAL_GH="$SCRATCH/gh3" bash scripts/visual/update.sh > "$SCRATCH/out" 2>&1 && fail "an unreadable run was taken" || { grep -q "could not read run 55" "$SCRATCH/out" && grep -q -- "--run 55" "$SCRATCH/out" && ok "a GitHub API error is not called a failed run, and the resume command is named" || fail "api text: $(cat "$SCRATCH/out")"; }
: > "$GH_CALLS"
sed -i 's/"run watch") echo.*/"run watch") exit 0 ;;/' "$SCRATCH/gh3"
VISUAL_GH="$SCRATCH/gh3" bash scripts/visual/retake-ci.sh --run 55 > "$SCRATCH/out" 2>&1 && ok "--run takes a finished run" || fail "--run: $(cat "$SCRATCH/out")"
! grep -q "^run list" "$GH_CALLS" && [ -z "$(git ls-remote origin 'refs/heads/visual-retake/*')" ] && ok "--run pushes nothing and looks nothing up" || fail "--run pushed or searched: $(cat "$GH_CALLS")"
echo wrong > "$FIX/SOURCES.sha256"
# a CI result whose sources hash differs from this tree's (the tree moved after the push) is refused
bash scripts/visual/update.sh > "$SCRATCH/out" 2>&1 && fail "a result for other sources was taken" || { grep -q "sources" "$SCRATCH/out" && ok "a result drawn from other sources is refused" || fail "text: $(cat "$SCRATCH/out")"; }
unset VISUAL_GH

# --- scripts/test.sh refuses to update snapshots on a machine that cannot draw
cd "$REPO" || exit 2
for a in --update-snapshots --update-snapshots=changed -u; do
  bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts "$a" > "$SCRATCH/out" 2>&1 \
    && fail "test.sh $a ran" || { grep -q "update.sh" "$SCRATCH/out" && ok "test.sh refuses $a and names update.sh" || fail "text for $a: $(head -3 "$SCRATCH/out")"; }
done
npm_config_update_snapshots=true bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts > "$SCRATCH/out" 2>&1 \
  && fail "an npm-swallowed --update-snapshots ran" || { grep -q "update.sh" "$SCRATCH/out" && ok "test.sh refuses an update flag npm swallowed" || fail "npm text: $(head -3 "$SCRATCH/out")"; }

# --- one test machine for both workflows
a="$(sed -n 's/.*image: *\(ghcr.io[^ ]*\).*/\1/p' .github/workflows/suite.yml | sort -u)"; b="$(sed -n 's/.*image: *\(ghcr.io[^ ]*\).*/\1/p' .github/workflows/visual-retake.yml | sort -u)"
[ -n "$a" ] && [ "$a" = "$b" ] && ok "suite.yml and visual-retake.yml draw on the same image" || fail "image differs: suite '$a' retake '$b'"

[ "$fails" = 0 ] && { echo "visual ci: all passed"; exit 0; }
echo "visual ci: $fails failed"; exit 1
