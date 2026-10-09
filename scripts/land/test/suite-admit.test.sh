#!/usr/bin/env bash
# The post-land suite is a heavy job: scripts/land/post-land/suite.sh runs under scripts/admit.sh
# (one admission slot) in a scratch copy, with fake npx and browser step. Not a locked spec.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/suite-admit.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0; ok() { echo "ok   $1"; }; fail() { echo "FAIL $1"; fails=$((fails + 1)); }

export ADMIT_DIR="$SCRATCH/admit"
SRC="$SCRATCH/clone"; COPY="$SCRATCH/copies/c1"
mkdir -p "$SRC/node_modules" "$COPY/scripts/land/post-land" "$SCRATCH/bin"
cp -r "$REPO/scripts/admit" "$REPO/scripts/lib" "$COPY/scripts/"
cp "$REPO/scripts/admit.sh" "$COPY/scripts/"
cp "$REPO/scripts/land/post-land/suite.sh" "$COPY/scripts/land/post-land/"
# fake steps record what they saw while they ran
printf '#!/usr/bin/env bash\nls "$ADMIT_DIR/q" | wc -l > "$SEEN/%s"\necho "token=${ADMIT_TOKEN:-none}" >> "$SEEN/token"\n' unit > "$SCRATCH/bin/npx"
printf '#!/usr/bin/env bash\nls "$ADMIT_DIR/q" | wc -l > "$SEEN/browser"\n' > "$COPY/scripts/test-browser.sh"
chmod +x "$SCRATCH/bin/npx"
export SEEN="$SCRATCH/seen"; mkdir -p "$SEEN"; export PATH="$SCRATCH/bin:$PATH"

( cd "$COPY" && POST_LAND_SRC="$SRC" timeout 60 bash scripts/land/post-land/suite.sh ) > "$SCRATCH/out" 2>&1; r=$?
[ $r = 0 ] && ok "suite exits 0" || fail "suite exit $r: $(tr '\n' ' ' < "$SCRATCH/out")"
[ "$(cat "$SEEN/unit" 2>/dev/null)" = 1 ] && [ "$(cat "$SEEN/browser" 2>/dev/null)" = 1 ] \
    && ok "both steps ran while holding the one slot" || fail "slot records seen: unit=$(cat "$SEEN/unit" 2>/dev/null) browser=$(cat "$SEEN/browser" 2>/dev/null)"
grep -q 'token=/' "$SEEN/token" && ok "the suite had an ADMIT_TOKEN" || fail "no token"
[ "$(ls "$ADMIT_DIR/q" | wc -l)" = 0 ] && ok "slot freed afterwards" || fail "slot left behind"

[ $fails = 0 ] && { echo "suite-admit: all passed"; exit 0; }
echo "suite-admit: $fails failed"; exit 1
