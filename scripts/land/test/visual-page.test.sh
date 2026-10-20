#!/usr/bin/env bash
# The before/after page of a landed visual change is made by scripts/feedback/feedback-page.py: one item per
# picture with its own comment box, every picture marked by mark-diff.py, a "What to do" first line.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d)"; trap 'rm -rf "$SCRATCH"' EXIT
GALLERY_BIN="${VISUAL_GALLERY_BIN:-$REPO/scripts/feedback}"
fails=0
ok() { echo "ok   $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }

python3 - "$SCRATCH" <<'PY'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
a = Image.new("RGB", (300, 400), "white"); b = a.copy()
ImageDraw.Draw(b).rectangle((40, 100, 200, 140), fill="black")
a.save(f"{d}/a.png"); b.save(f"{d}/b.png"); a.save(f"{d}/same.png")
PY
cat > "$SCRATCH/entries.json" <<JSON
[{"name":"mobile-a","before":"$SCRATCH/a.png","after":"$SCRATCH/b.png","diff":null},
 {"name":"mobile-same","before":"$SCRATCH/a.png","after":"$SCRATCH/same.png","diff":null},
 {"name":"mobile-new","before":null,"after":"$SCRATCH/b.png","diff":null}]
JSON
out="$SCRATCH/page"
node "$REPO/scripts/visual/diff-page.mjs" "$out" "T9: screens whose baseline changed" "$SCRATCH/entries.json" T9 > "$SCRATCH/log.txt" 2>&1 \
  && ok "page written" || fail "diff-page failed: $(cat "$SCRATCH/log.txt")"
[ -s "$out/index.html" ] && grep -q "What to do" "$out/index.html" && ok "index.html is the shared feedback page with a What to do line" || fail "no feedback page"
rows=$(grep -c '^| mobile-' "$out/index.md" 2>/dev/null || true)
[ "$rows" = 3 ] && ok "index.md has one row per screen" || fail "index.md rows: $rows"
for f in mobile-a.before mobile-a.after mobile-same.before mobile-same.after mobile-new.after; do
  python3 -c "import sys; from PIL import Image; sys.exit(0 if Image.open(sys.argv[1]).text.get('marked') == '1' else 1)" "$out/$f.png" \
    && ok "$f.png is marked" || fail "$f.png is not marked"
done
[ ! -e "$out/mobile-new.before.png" ] && ok "a new screen has no before picture" || fail "new screen has a before"
grep -q "Look at" "$out/index.md" || grep -qi "look" "$out/index.md" && ok "rows carry a Look at statement" || fail "no Look at"
exit "$fails"
