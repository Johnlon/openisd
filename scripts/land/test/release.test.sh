#!/usr/bin/env bash
# Acceptance test for scripts/snap.sh, scripts/snap-prune.sh, scripts/release.sh and
# scripts/hosting/assemble-site.sh. Nothing real is touched: `gh` is a shim on PATH that keeps its
# releases in a JSON file, and the git remote is a bare repository in the scratch directory.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
S="$(mktemp -d "${TMPDIR:-/tmp}/release-test.XXXXXX")"
trap 'rm -rf "$S"' EXIT
fails=0
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { # check <label> <command...>: ok when the command succeeds
  local label="$1"; shift
  if "$@" > /dev/null 2>&1; then ok "$label"; else fail "$label"; fi
}

# ---- the shim: just the gh surface the scripts use ----------------------------------------------
export GH_STATE="$S/gh"; mkdir -p "$GH_STATE/assets" "$S/bin"
echo '[]' > "$GH_STATE/releases.json"
export GH_REMOTE="$S/remote.git"
cat > "$S/bin/gh" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
R="$GH_STATE/releases.json"; echo "gh $*" >> "$GH_STATE/calls.log"
now="${FAKE_GH_NOW:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
save() { jq "$1" "$R" > "$R.new" && mv "$R.new" "$R"; }
sub="$1 $2"; shift 2
case "$sub" in
  "release list")
    pre_only=0; jqx=''; fields=''
    while [ $# -gt 0 ]; do case "$1" in
      --exclude-pre-releases) pre_only=1 ;; --jq) jqx="$2"; shift ;; --json) fields="$2"; shift ;; --limit) shift ;; esac; shift; done
    list="$(jq '[.[] | {tagName: .tag_name, name: .name, isPrerelease: .prerelease, createdAt: .created_at}]' "$R")"
    [ "$pre_only" = 0 ] || list="$(jq '[.[] | select(.isPrerelease | not)]' <<< "$list")"
    if [ -n "$jqx" ]; then jq -r "$jqx" <<< "$list"; else echo "$list"; fi ;;
  "release view")
    # No tag: the release marked Latest.
    tag=''; case "${1:-}" in --*) ;; *) tag="$1"; shift ;; esac; jqx=''
    while [ $# -gt 0 ]; do case "$1" in --jq) jqx="$2"; shift ;; esac; shift; done
    jq -e --arg t "$tag" '.[] | select(if $t == "" then .latest else .tag_name == $t end) | {tagName: .tag_name, isPrerelease: .prerelease, body: .body}' "$R" > "$GH_STATE/view.json" || exit 1
    jq -r "$jqx" "$GH_STATE/view.json" ;;
  "release create")
    tag="$1"; shift; title=''; notes=''; pre=false; zip=''
    while [ $# -gt 0 ]; do case "$1" in
      --prerelease) pre=true ;; --verify-tag) ;; --title) title="$2"; shift ;; --notes-file) notes="$(cat "$2")"; shift ;;
      *) zip="$1" ;; esac; shift; done
    git --git-dir="$GH_REMOTE" rev-parse -q --verify "refs/tags/$tag" > /dev/null || { echo "tag $tag missing on remote" >&2; exit 1; }
    mkdir -p "$GH_STATE/assets/$tag"; cp "$zip" "$GH_STATE/assets/$tag/"
    save ". + [{tag_name: \"$tag\", name: \"$title\", prerelease: $pre, draft: false, html_url: \"https://example.test/r/$tag\", published_at: \"$now\", created_at: \"$now\", latest: false, body: $(jq -Rs . <<< "$notes")}]" ;;
  "release edit")
    tag="$1"; shift; newtag="$tag"; edit='.'
    while [ $# -gt 0 ]; do case "$1" in
      --tag) newtag="$2"; shift ;; --title) edit="$edit | (if .tag_name == \"$tag\" then .name = \"$2\" else . end)"; shift ;;
      --prerelease=false) edit="$edit | (if .tag_name == \"$tag\" then .prerelease = false else . end)" ;;
      --latest) edit="$edit | (.latest = (.tag_name == \"$tag\"))" ;;
      --notes-file) edit="$edit | (if .tag_name == \"$tag\" then .body = $(jq -Rs . < "$2") else . end)"; shift ;; esac; shift; done
    save "map($edit)"
    if [ "$newtag" != "$tag" ]; then
      save "map(if .tag_name == \"$tag\" then .tag_name = \"$newtag\" | .html_url = \"https://example.test/r/$newtag\" else . end)"
      mv "$GH_STATE/assets/$tag" "$GH_STATE/assets/$newtag"
    fi ;;
  "release delete")
    tag="$1"; shift
    save "map(select(.tag_name != \"$tag\"))"; rm -rf "$GH_STATE/assets/$tag"
    git --git-dir="$GH_REMOTE" tag -d "$tag" > /dev/null ;;
  "release download")
    tag="$1"; shift; pat=''; dir=''
    while [ $# -gt 0 ]; do case "$1" in --pattern) pat="$2"; shift ;; --dir) dir="$2"; shift ;; esac; shift; done
    cp "$GH_STATE/assets/$tag/"$pat "$dir/" ;;
  "api repos/{owner}/{repo}/releases")
    jq -c '.[]' "$R" ;;
  "api repos/{owner}/{repo}/releases/latest")
    t="$(jq -r '[.[] | select(.latest)] | first | .tag_name // empty' "$R")"
    # gh prints the 404 body and exits non-zero when no release is Latest
    [ -n "$t" ] || { echo '{"message":"Not Found","status":"404"}'; exit 1; }
    echo "$t" ;;
  *) echo "gh shim: unsupported: $sub $*" >&2; exit 99 ;;
esac
SHIM
chmod +x "$S/bin/gh"; export PATH="$S/bin:$PATH"

# ---- git: an isolated config and a bare remote ----------------------------------------------------
printf '[user]\n\tname = Test\n\temail = test@example.test\n[init]\n\tdefaultBranch = main\n' > "$S/gitconfig"
export GIT_CONFIG_GLOBAL="$S/gitconfig" GIT_CONFIG_SYSTEM=/dev/null
git init -q --bare "$GH_REMOTE"
W="$S/work"; git init -q "$W"; cd "$W" || exit 1
mkdir -p scripts tasks/fixes
cp "$REPO/scripts/snap.sh" "$REPO/scripts/snap-prune.sh" "$REPO/scripts/release.sh" "$REPO/scripts/version-info.mjs" scripts/
mkdir -p scripts/hosting; cp "$REPO/scripts/hosting/releaseNotes.mjs" scripts/hosting/
# The two browser runs release.sh starts are stand-ins that record how they were called.
mkdir -p scripts/hosting/test scripts/ui-gallery
for f in scripts/hosting/test/hosted-copies.e2e.mjs scripts/ui-gallery/capture.mjs; do
  cat > "$f" <<STUB
import fs from 'node:fs';
fs.appendFileSync(process.env.GH_STATE + '/calls.log', ['node', '$f', ...process.argv.slice(2)].join(' ') + '\\n');
STUB
done
printf 'id: F1\nstatus: closed\n' > tasks/fixes/F1.yml
git remote add origin "$GH_REMOTE"
git add -A; git commit -q -m "first change"; git push -q origin main
printf 'id: T001\nstatus: done\nrelease_note: "Users can do the second thing."\n' > tasks/T001.yml
printf 'id: T002\nstatus: done\nrelease_note: "Fixed T012 in abc1234def."\n' > tasks/T002.yml
echo more > more.txt; git add more.txt tasks/T001.yml tasks/T002.yml; git commit -q -m "(auto) T001: second change"; git push -q origin main
HEAD_SHA="$(git rev-parse HEAD)"

# the fake build: a dist with an index.html, and a record of what the build was told
export SNAP_DIST="$W/dist" SNAP_BUILD_CMD='mkdir -p dist && echo built > dist/index.html && echo "$GITHUB_REF $OPENISD_RELATIVE_BASE" > dist/build-env.txt'
export GITHUB_OUTPUT="$S/output"; : > "$GITHUB_OUTPUT"
remote_has() { [ -n "$(git ls-remote --tags origin "refs/tags/$1")" ]; }
release_json() { jq -c --arg t "$1" '.[] | select(.tag_name == $t)' "$GH_STATE/releases.json"; }

# ---- 1. snap.sh builds, tags, publishes ------------------------------------------------------------
export OPENISD_NOW=2026-01-01T01:02:59Z FAKE_GH_NOW=2026-01-01T01:02:59Z
out=$(bash scripts/snap.sh 2>&1); r=$?
[ $r = 0 ] && ok "snap.sh exits 0" || fail "snap.sh exit $r: $out"
remote_has snap-20260101T0102Z && ok "tag snap-<stamp> pushed (minute stamp, seconds dropped)" || fail "snap tag missing"
[ "$(git ls-remote origin refs/tags/snap-20260101T0102Z | cut -f1)" = "$HEAD_SHA" ] && ok "snap tag is on HEAD" || fail "snap tag not on HEAD"
rel="$(release_json snap-20260101T0102Z)"
[ "$(jq -r .prerelease <<< "$rel")" = true ] && ok "published as a pre-release" || fail "not a pre-release: $rel"
[ "$(jq -r .name <<< "$rel")" = "Snapshot 20260101T0102Z" ] && ok "titled Snapshot <stamp>" || fail "title: $rel"
body="$(jq -r .body <<< "$rel")"
grep -q '^- Users can do the second thing\.$' <<< "$body" && ok "notes carry the task's release_note sentence" || fail "notes: $body"
grep -q '^and 1 internal change\.$' <<< "$body" && ok "notes count internal changes" || fail "internal count: $body"
! grep -qE '[0-9a-f]{7,}|T0[0-9]{2}|first change|second change|[Mm]erge' <<< "$body" && ok "notes hold no hash, task id, subject or merge line (a note that names an id is dropped)" || fail "leak in notes: $body"
zip="$GH_STATE/assets/snap-20260101T0102Z/openisd-20260101T0102Z.zip"
[ -f "$zip" ] && unzip -l "$zip" | grep -q ' index.html$' && ok "zip openisd-<stamp>.zip holds the dist" || fail "zip missing or without index.html"
unzip -p "$zip" build-env.txt 2> /dev/null | grep -q '^refs/tags/snap-20260101T0102Z 1$' && ok "built with the tag's ref and the relative base switch" || fail "build env: $(unzip -p "$zip" build-env.txt 2>&1)"
grep -q '^built=true$' "$GITHUB_OUTPUT" && ok "built=true for the workflow" || fail "no built=true"

# ---- 2. refusals, and a build on every push -------------------------------------------------------
out=$(bash scripts/snap.sh 2>&1); r=$?
[ $r != 0 ] && grep -q 'already exists' <<< "$out" && ok "same minute twice refused" || fail "same-minute: $r $out"
: > "$GITHUB_OUTPUT"
export OPENISD_NOW=2026-01-01T03:10:00Z FAKE_GH_NOW=2026-01-01T03:10:00Z
out=$(bash scripts/snap.sh 2>&1); r=$?
[ $r = 0 ] && remote_has snap-20260101T0310Z && grep -q '^built=true$' "$GITHUB_OUTPUT" && ok "every push builds: no wait since the last snapshot" || fail "push build: $r $out"
echo dirty >> more.txt
out=$(bash scripts/snap.sh 2>&1); r=$?
[ $r != 0 ] && grep -q 'uncommitted' <<< "$out" && ok "dirty tree refused" || fail "dirty: $r $out"
git show HEAD:more.txt > more.txt   # the scratch repo's tree back to its commit
bash scripts/snap.sh --bogus > /dev/null 2>&1; [ $? = 2 ] && ok "unknown flag is a usage error" || fail "usage exit"

# ---- 3. pruning keeps the newest 10 ----------------------------------------------------------------
for i in $(seq 1 22); do
  st="$(printf '202501%02dT0000Z' "$i")"
  git tag "snap-$st" HEAD; git push -q origin "refs/tags/snap-$st"
  jq ". + [{tag_name: \"snap-$st\", prerelease: true, draft: false, created_at: \"2025-01-01T00:00:00Z\", published_at: \"2025-01-01T00:00:00Z\", html_url: \"u\", body: \"x\", latest: false}]" "$GH_STATE/releases.json" > "$GH_STATE/n" && mv "$GH_STATE/n" "$GH_STATE/releases.json"
done
bash scripts/snap-prune.sh > /dev/null 2>&1
n=$(jq '[.[] | select(.prerelease)] | length' "$GH_STATE/releases.json")
[ "$n" = 10 ] && ok "10 snapshot pre-releases remain" || fail "$n remain"
! remote_has snap-20250101T0000Z && ! remote_has snap-20250102T0000Z && ok "the oldest two tags are deleted" || fail "old tags remain"
remote_has snap-20260101T0310Z && remote_has snap-20260101T0102Z && ok "the newest tags survive" || fail "newest tag pruned"

# ---- 4. release.sh refusals ------------------------------------------------------------------------
bash scripts/release.sh --public 7.0.951 banana > /dev/null 2>&1; [ $? = 2 ] && ok "bad stamp is a usage error" || fail "bad stamp exit"
out=$(bash scripts/release.sh --public 7.0.951 20990101T0000Z 2>&1); r=$?
[ $r = 1 ] && grep -q 'no snapshot' <<< "$out" && ok "refuses a stamp with no snap- tag" || fail "no snap: $r $out"
printf 'id: F2\nstatus: open\n' > tasks/fixes/F2.yml
out=$(bash scripts/release.sh --public 7.0.951 20260101T0102Z 2>&1); r=$?
[ $r = 1 ] && grep -q 'F2.yml' <<< "$out" && ok "refuses while an F is open" || fail "open F: $r $out"
! remote_has v20260101T0102Z && ok "refusal created no tag" || fail "tag created despite refusal"
rm tasks/fixes/F2.yml

# the public number: required, three numbers
out=$(bash scripts/release.sh 20260101T0102Z 2>&1); r=$?
[ $r = 2 ] && grep -q -- '--public' <<< "$out" && ok "promoting without --public is refused" || fail "no --public: $r $out"
out=$(bash scripts/release.sh --public 7.0 20260101T0102Z 2>&1); r=$?
[ $r = 2 ] && ok "a public number that is not three numbers is refused" || fail "short --public: $r $out"

# ---- 5. release.sh promotes ------------------------------------------------------------------------
: > "$GH_STATE/calls.log"
out=$(bash scripts/release.sh --public 7.0.951 20260101T0102Z 2>&1); r=$?
[ $r = 0 ] && ok "promote exits 0" || fail "promote exit $r: $out"
[ "$(git ls-remote origin refs/tags/v20260101T0102Z | cut -f1)" = "$HEAD_SHA" ] && ok "v<stamp> tag on the same commit" || fail "v tag wrong"
remote_has snap-20260101T0102Z && ok "snap- tag stays" || fail "snap tag removed"
rel="$(release_json v20260101T0102Z)"
[ "$(jq -r .prerelease <<< "$rel")" = false ] && [ "$(jq -r .latest <<< "$rel")" = true ] && ok "release is no longer a pre-release, and is Latest" || fail "release state: $rel"
[ -z "$(release_json snap-20260101T0102Z)" ] && ok "the snapshot release became the release" || fail "snapshot release remains"
[ "$(git ls-remote origin refs/heads/release | cut -f1)" = "$HEAD_SHA" ] && ok "branch release at the promoted commit" || fail "release branch"
[ "$(release_json v20260101T0102Z | jq -r .name)" = "OpenISD 7.0.951" ] && ok "the release is titled OpenISD <public number>" || fail "release title: $(release_json v20260101T0102Z)"
grep -q '^| 7.0.951 | 20260101T0102Z | 1 Jan 2026, 01:02 | `'"${HEAD_SHA:0:9}"'` | \[v/20260101T0102Z\](https://snapshots.openisd.app/v/20260101T0102Z/) | \[GitHub\](https://github.com/Johnlon/openisd/releases/tag/v20260101T0102Z) | Users can do the second thing. |$' RELEASES.md && ok "promotion appends the RELEASES.md row" || fail "RELEASES.md row: $(cat RELEASES.md 2>&1)"
! grep -qE 'release (download|create)|npm|vite' "$GH_STATE/calls.log" && ok "downloads nothing, builds nothing, creates nothing" || fail "unexpected calls: $(cat "$GH_STATE/calls.log")"
grep -q '^node scripts/hosting/test/hosted-copies.e2e.mjs' "$GH_STATE/calls.log" && ok "promotion runs the hosted copies end-to-end test" || fail "no hosted copies run: $(cat "$GH_STATE/calls.log")"
grep -q '^node scripts/ui-gallery/capture.mjs --after https://snapshots.openisd.app/snap/20260101T0102Z/ --before none$' "$GH_STATE/calls.log" && ok "the gallery shows the snapshot from snapshots.openisd.app" || fail "gallery call: $(grep capture "$GH_STATE/calls.log")"
out=$(bash scripts/release.sh --public 7.0.952 20260101T0102Z 2>&1); r=$?
[ $r = 1 ] && grep -q 'already exists' <<< "$out" && ok "promoting twice is refused" || fail "twice: $r $out"

# ---- 6. the release branch only moves forward ------------------------------------------------------
echo third > third.txt; git add third.txt; git commit -q -m "third change"; git push -q origin main
NEW_SHA="$(git rev-parse HEAD)"
export OPENISD_NOW=2026-01-02T00:00:00Z FAKE_GH_NOW=2026-01-02T00:00:00Z
bash scripts/snap.sh > /dev/null 2>&1
printf -- '## New\n\n- Hand-written note.\n' > "$S/notes.md"
out=$(bash scripts/release.sh --public 7.0.951 --notes-file "$S/notes.md" 20260102T0000Z 2>&1); r=$?
[ $r = 1 ] && grep -q 'not greater than the last, 7.0.951' <<< "$out" && ok "a public number equal to the last is refused" || fail "equal --public: $r $out"
out=$(bash scripts/release.sh --public 7.0.950 --notes-file "$S/notes.md" 20260102T0000Z 2>&1); r=$?
[ $r = 1 ] && grep -q 'not greater than the last' <<< "$out" && ok "a lower public number is refused" || fail "lower --public: $r $out"
! remote_has v20260102T0000Z && ok "refused numbers created no tag" || fail "tag created despite refused number"
bash scripts/release.sh --public 7.0.1000 --notes-file "$S/notes.md" 20260102T0000Z > /dev/null 2>&1
[ "$(release_json v20260102T0000Z | jq -r .body)" = "$(cat "$S/notes.md")" ] && ok "--notes-file replaces the notes" || fail "--notes-file body"
grep -q 'Hand-written note\.' RELEASES.md && ok "RELEASES.md row uses the given notes" || fail "RELEASES.md notes cell"
grep -q 'capture.mjs --after https://snapshots.openisd.app/snap/20260102T0000Z/ --before https://snapshots.openisd.app/v/20260101T0102Z/$' "$GH_STATE/calls.log" && ok "the gallery's before is the Latest release on snapshots.openisd.app" || fail "gallery before: $(grep capture "$GH_STATE/calls.log")"
out=$(bash scripts/release.sh --public 7.0.1001 --notes-file "$S/missing.md" 20260101T0310Z 2>&1); [ $? = 1 ] && ok "--notes-file with no such file is refused" || fail "missing notes file"
[ "$(grep -n '^| 7\.' RELEASES.md | head -1 | grep -c 20260102T0000Z)" = 1 ] && ok "RELEASES.md is newest first" || fail "RELEASES.md order"
[ "$(git ls-remote origin refs/heads/release | cut -f1)" = "$NEW_SHA" ] && ok "branch release fast-forwarded" || fail "release branch not advanced"
[ "$(release_json v20260102T0000Z | jq -r .latest)" = true ] && [ "$(release_json v20260101T0102Z | jq -r .latest)" = false ] && ok "newest release is Latest" || fail "latest flags"
bash scripts/release.sh --public 7.0.1001 20260101T0310Z > /dev/null 2>&1
[ "$(git ls-remote origin refs/heads/release | cut -f1)" = "$NEW_SHA" ] && ok "promoting an older snapshot leaves the branch where it is" || fail "release branch moved back"

# ---- 6b. hotfix history: release holds a commit not on main; plain ff; already contained; rejected --
rel_tip() { git ls-remote origin refs/heads/release | cut -f1; }
add_snap() { # add_snap <stamp> <sha> <iso>: a snapshot tag and pre-release on <sha>
  mkdir -p "$GH_STATE/assets/snap-$1"; git tag "snap-$1" "$2"; git push -q origin "refs/tags/snap-$1"
  jq ". + [{tag_name: \"snap-$1\", name: \"Snapshot $1\", prerelease: true, draft: false, created_at: \"$3\", published_at: \"$3\", html_url: \"u\", body: \"x\", latest: false}]" "$GH_STATE/releases.json" > "$GH_STATE/n" && mv "$GH_STATE/n" "$GH_STATE/releases.json"
}
# ff: release is an ancestor of the promoted commit
echo ff > ff.txt; git add ff.txt; git commit -q -m "ff change"; git push -q origin main
FF_SHA="$(git rev-parse HEAD)"
add_snap 20260103T0000Z "$FF_SHA" 2026-01-03T00:00:00Z
out=$(bash scripts/release.sh --public 7.0.1100 20260103T0000Z 2>&1); r=$?
[ $r = 0 ] && [ "$(rel_tip)" = "$FF_SHA" ] && ok "release an ancestor: plain fast-forward to the commit" || fail "ff case: $r $out"
# hotfix: a commit only on release (built by plumbing on the old release tip)
OLD_TIP="$(rel_tip)"
HOT_SHA="$(git commit-tree "$OLD_TIP^{tree}" -p "$OLD_TIP" -m hotfix)"
git push -q origin "$HOT_SHA:refs/heads/release"
echo four > four.txt; git add four.txt; git commit -q -m "fourth change"; git push -q origin main
MAIN_SHA="$(git rev-parse HEAD)"
add_snap 20260104T0000Z "$MAIN_SHA" 2026-01-04T00:00:00Z
out=$(bash scripts/release.sh --public 7.0.1101 20260104T0000Z 2>&1); r=$?
MERGE="$(rel_tip)"
[ $r = 0 ] && ok "promote with a hotfix only on release exits 0" || fail "hotfix promote: $r $out"
[ "$MERGE" != "$MAIN_SHA" ] && [ "$(git rev-parse "$MERGE^{tree}")" = "$(git rev-parse "$MAIN_SHA^{tree}")" ] && ok "release is a merge whose tree is the promoted build" || fail "merge tree: $MERGE"
[ "$(git rev-parse "$MERGE^1")" = "$HOT_SHA" ] && [ "$(git rev-parse "$MERGE^2")" = "$MAIN_SHA" ] && ok "merge parents: old release tip, then the promoted commit" || fail "merge parents: $(git rev-list --parents -n1 "$MERGE")"
git merge-base --is-ancestor "$HOT_SHA" "$MERGE" && ok "the hotfix commit stays in release history" || fail "hotfix lost"
[ "$(git ls-remote origin refs/tags/v20260104T0000Z | cut -f1)" = "$MAIN_SHA" ] && ok "the v<stamp> tag stays on the snapshot commit" || fail "tag moved"
# already contained: promoting an older commit release holds leaves the branch alone
add_snap 20260105T0000Z "$FF_SHA" 2026-01-05T00:00:00Z
out=$(bash scripts/release.sh --public 7.0.1102 20260105T0000Z 2>&1); r=$?
[ $r = 0 ] && [ "$(rel_tip)" = "$MERGE" ] && grep -q 'already contains' <<< "$out" && ok "release already containing the commit: left alone" || fail "contained case: $r $out"
# ---- 7. --latest rolls back --------------------------------------------------------------------------
out=$(bash scripts/release.sh --latest 20260101T0102Z 2>&1); r=$?
[ $r = 0 ] && [ "$(release_json v20260101T0102Z | jq -r .latest)" = true ] && [ "$(release_json v20260102T0000Z | jq -r .latest)" = false ] && ok "--latest makes an older release Latest" || fail "--latest: $r $out"
out=$(bash scripts/release.sh --latest 20990101T0000Z 2>&1); r=$?
[ $r = 1 ] && grep -q 'no release' <<< "$out" && ok "--latest refuses an unknown stamp" || fail "--latest unknown: $r $out"
snapstamp="$(jq -r '[.[] | select(.prerelease)] | first | .tag_name | sub("snap-"; "")' "$GH_STATE/releases.json")"
out=$(bash scripts/release.sh --latest "$snapstamp" 2>&1); r=$?
[ $r = 1 ] && ok "--latest refuses a snapshot (nothing named v<stamp> exists)" || fail "--latest snapshot: $r $out"

# ---- 8. assemble-site.sh: the whole Pages tree from the releases ---------------------------------
mkzip() { # mkzip <tag> <stamp> <marker>: an asset zip whose index.html says <marker>
  local d; d="$(mktemp -d "$S/z.XXXXXX")"; echo "$3" > "$d/index.html"; mkdir -p "$d/about"; echo about > "$d/about/index.html"
  mkdir -p "$GH_STATE/assets/$1"; (cd "$d" && python3 -m zipfile -c "$GH_STATE/assets/$1/openisd-$2.zip" index.html about)
}
for tag in $(jq -r '.[].tag_name' "$GH_STATE/releases.json"); do
  case "$tag" in snap-*) mkzip "$tag" "${tag#snap-}" "build $tag" ;; v*) mkzip "$tag" "${tag#v}" "build $tag" ;; esac
done
OUT="$S/site"
out=$(bash "$REPO/scripts/hosting/assemble-site.sh" "$OUT" 2>&1); r=$?
[ $r = 0 ] && ok "assemble exits 0" || fail "assemble exit $r: $out"
P="$OUT/prod" T="$OUT/test" N="$OUT/snapshots"
# openisd.app: the Latest release only, and pages that send the old addresses on
[ "$(cat "$P/index.html" 2> /dev/null)" = "build v20260101T0102Z" ] && ok "openisd.app root is the Latest release" || fail "root: $(cat "$P/index.html" 2>&1)"
grep -q 'https://snapshots.openisd.app/v/20260102T0000Z/' "$P/v/20260102T0000Z/index.html" 2> /dev/null && [ ! -e "$P/v/20260101T0102Z/about" ] && ok "openisd.app/v/<stamp>/ sends you to snapshots.openisd.app" || fail "prod v/ redirect: $(ls -R "$P/v" 2>&1 | head)"
grep -q 'https://snapshots.openisd.app/snap/20250115T0000Z/' "$P/snap/20250115T0000Z/index.html" 2> /dev/null && ok "openisd.app/snap/<stamp>/ sends you to snapshots.openisd.app" || fail "prod snap/ redirect"
grep -q 'https://test.openisd.app/' "$P/test/index.html" 2> /dev/null && ok "openisd.app/test/ sends you to test.openisd.app" || fail "prod test/ redirect"
grep -q 'https://snapshots.openisd.app/v/' "$P/v/index.html" 2> /dev/null && grep -q 'https://snapshots.openisd.app/snap/' "$P/snap/index.html" 2> /dev/null && ok "openisd.app's list pages send you to snapshots.openisd.app" || fail "prod list redirects"
for d in test v/20260102T0000Z snap/20250115T0000Z; do grep -q 'registration.unregister()' "$P/$d/sw.js" 2> /dev/null || fail "no kill-switch worker at openisd.app/$d/"; done
grep -q 'registration.unregister()' "$P/test/sw.js" 2> /dev/null && ok "each old copy address on openisd.app has the kill-switch worker, so its old worker goes" || true
[ "$(jq length "$P/v/index.json" 2> /dev/null)" = "$(jq length "$GH_STATE/releases.json")" ] && ok "openisd.app keeps v/index.json for released apps that read it there" || fail "prod index.json"
[ ! -e "$P/CNAME" ] && ok "openisd.app has no CNAME file (its domain is set on the repo)" || fail "prod CNAME"
# test.openisd.app: the newest snapshot at its root
[ "$(cat "$T/index.html" 2> /dev/null)" = "build snap-20250122T0000Z" ] && [ -f "$T/about/index.html" ] && ok "test.openisd.app is the newest snapshot" || fail "test site: $(cat "$T/index.html" 2>&1)"
[ "$(cat "$T/CNAME" 2> /dev/null)" = "test.openisd.app" ] && ok "test site CNAME is test.openisd.app" || fail "test CNAME"
# snapshots.openisd.app: every release and snapshot, and the lists
[ "$(cat "$N/v/20260102T0000Z/index.html" 2> /dev/null)" = "build v20260102T0000Z" ] && [ -f "$N/v/20260101T0102Z/about/index.html" ] && ok "every release under snapshots.openisd.app/v/<stamp>/" || fail "v/ copies"
[ "$(cat "$N/snap/20250115T0000Z/index.html" 2> /dev/null)" = "build snap-20250115T0000Z" ] && [ ! -e "$N/snap/20260101T0310Z" ] && ok "snapshots under snapshots.openisd.app/snap/<stamp>/" || fail "snap/ copy"
[ "$(jq length "$N/v/index.json")" = "$(jq length "$GH_STATE/releases.json")" ] && ok "v/index.json lists both trails" || fail "index.json length"
jq -e '.[0] | has("stamp") and has("kind") and has("tag") and has("url") and has("published") and has("subject")' "$N/v/index.json" > /dev/null && ok "index.json rows carry stamp, kind, tag, url, published, subject" || fail "index.json shape"
check "snap/index.html and v/index.html written" test -f "$N/snap/index.html" -a -f "$N/v/index.html"
check "dates.js bundle written" test -s "$N/dates.js"
grep -q 'Snapshot builds may upgrade your saved data' "$N/snap/index.html" && ok "snap/ page warns about saved data" || fail "snap/ warning"
grep -q './v/' "$N/index.html" 2> /dev/null && ok "snapshots.openisd.app's root sends you to the releases list" || fail "snapshots root"
[ "$(cat "$N/CNAME" 2> /dev/null)" = "snapshots.openisd.app" ] && ok "snapshots site CNAME is snapshots.openisd.app" || fail "snapshots CNAME"
! grep -q 'registration.unregister()' "$P/sw.js" 2>/dev/null && ok "with a Latest release: root sw.js is the release's own, not the kill switch" || fail "latest: root sw.js is the kill switch"
jq 'map(.latest = false)' "$GH_STATE/releases.json" > "$GH_STATE/n" && mv "$GH_STATE/n" "$GH_STATE/releases.json"
out=$(bash "$REPO/scripts/hosting/assemble-site.sh" "$S/site2" 2>&1); r=$?
[ $r = 0 ] && ! grep -q 'Not Found' <<< "$out" && grep -q 'OpenISD releases' "$S/site2/prod/index.html" && [ -f "$S/site2/snapshots/snap/20250115T0000Z/index.html" ] && ok "no Latest release: openisd.app root is the releases list, snapshots still hosted" || fail "no latest: $r $out"
grep -q 'registration.unregister()' "$S/site2/prod/sw.js" 2>/dev/null && ok "no Latest release: root sw.js is the kill-switch worker" || fail "no latest: sw.js $(head -c 80 "$S/site2/prod/sw.js" 2>&1)"

echo
if [ "$fails" = 0 ]; then echo "release.test.sh: all passed"; else echo "release.test.sh: $fails FAILED"; exit 1; fi
