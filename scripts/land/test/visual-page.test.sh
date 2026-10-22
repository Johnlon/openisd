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
[{"name":"mobile-tab-box","before":"$SCRATCH/a.png","after":"$SCRATCH/b.png","diff":null},
 {"name":"mobile-tab-graph","before":"$SCRATCH/a.png","after":"$SCRATCH/same.png","diff":null},
 {"name":"mobile-menu","before":null,"after":"$SCRATCH/b.png","diff":null}]
JSON
out="$SCRATCH/page"
node "$REPO/scripts/visual/diff-page.mjs" "$out" "What changed on screen" "$SCRATCH/entries.json" "The box got bigger." > "$SCRATCH/log.txt" 2>&1 \
  && ok "page written" || fail "diff-page failed: $(cat "$SCRATCH/log.txt")"
[ -s "$out/index.html" ] && grep -q "What to do" "$out/index.html" && ok "index.html is the shared feedback page with a What to do line" || fail "no feedback page"
rows=$(grep -c '^| Phone, ' "$out/index.md" 2>/dev/null || true)
[ "$rows" = 3 ] && ok "index.md has one row per screen" || fail "index.md rows: $rows"
for f in mobile-tab-box.before mobile-tab-box.after mobile-tab-graph.before mobile-tab-graph.after mobile-menu.after; do
  python3 -c "import sys; from PIL import Image; sys.exit(0 if Image.open(sys.argv[1]).text.get('marked') == '1' else 1)" "$out/$f.png" \
    && ok "$f.png is marked" || fail "$f.png is not marked"
done
[ ! -e "$out/mobile-menu.before.png" ] && ok "a new screen has no before picture" || fail "new screen has a before"
grep -q "Look at" "$out/index.md" || grep -qi "look" "$out/index.md" && ok "rows carry a Look at statement" || fail "no Look at"

# Grouping: pairs whose changed box is at the same place and size are one group (leader + "Same as" followers);
# a different box, or a pair with no box, is its own group. Folded pictures keep their own comment box.
python3 - "$SCRATCH" <<'PY'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
for name, box in (("g1", (40, 100, 200, 140)), ("g2", (42, 102, 202, 142)), ("g3", (40, 300, 200, 340))):
    a = Image.new("RGB", (300, 400), "white"); b = a.copy()
    ImageDraw.Draw(b).rectangle(box, fill="black")
    a.save(f"{d}/{name}.a.png"); b.save(f"{d}/{name}.b.png")
PY
cat > "$SCRATCH/groups.json" <<JSON
[{"name":"mobile-tab-driver","before":"$SCRATCH/g1.a.png","after":"$SCRATCH/g1.b.png","diff":null},
 {"name":"mobile-tab-signal","before":"$SCRATCH/g2.a.png","after":"$SCRATCH/g2.b.png","diff":null},
 {"name":"mobile-tab-filters","before":"$SCRATCH/g3.a.png","after":"$SCRATCH/g3.b.png","diff":null},
 {"name":"mobile-empty","before":null,"after":"$SCRATCH/g1.b.png","diff":null}]
JSON
gout="$SCRATCH/groups"
node "$REPO/scripts/visual/diff-page.mjs" "$gout" "What changed on screen" "$SCRATCH/groups.json" "The box moved." > "$SCRATCH/glog.txt" 2>&1 \
  && ok "grouped page written" || fail "grouped diff-page failed: $(cat "$SCRATCH/glog.txt")"
grep -q "3 group(s)" "$SCRATCH/glog.txt" && ok "four screens make 3 groups" || fail "group count: $(cat "$SCRATCH/glog.txt")"
grep -q '^| Phone, Driver tab .*1 more picture, folded below. |  |$' "$gout/index.md" && ok "same box: the first picture leads and says '1 more'" || fail "leader row: $(grep 'Driver tab' "$gout/index.md")"
grep -q '^| Phone, Signal tab .*| Phone, Driver tab |$' "$gout/index.md" && ok "same box: the second picture is folded under the first" || fail "follower row: $(grep 'Signal tab' "$gout/index.md")"
grep -q '^| Phone, Filters tab .*|  |$' "$gout/index.md" && ! grep '^| Phone, Filters tab' "$gout/index.md" | grep -q "more picture" && ok "different box: its own group" || fail "g3 row: $(grep 'Filters tab' "$gout/index.md")"
grep -q '^| Phone, no project open .*|  |$' "$gout/index.md" && ok "no box (new screen): its own group" || fail "gnew row: $(grep 'no project' "$gout/index.md")"
# Plain words: no task id, file name or jargon in the page; the title and the note say what changed; the leader's
# Look at line names the screen and the change; a follower points at the first picture.
for bad in 'T9' 'baseline' 'landed' '\.png' 'mobile-'; do
  sed -e 's/\[[a-z]*\]([^)]*\.png)//g' "$gout/index.md" | grep -qE "$bad" && fail "page text holds '$bad'" || ok "page text has no '$bad'"
done
head -1 "$gout/index.md" | grep -qx '# What changed on screen' && ok "title says what changed" || fail "title: $(head -1 "$gout/index.md")"
grep -q 'The box moved' "$gout/index.html" && ok "the note shows under the title" || fail "no note on the page"
grep -q '^| Phone, Driver tab .*| Phone, Driver tab, the red boxes: The box moved' "$gout/index.md" && ok "leader Look at: screen in words, the red boxes, the note" || fail "leader look: $(grep 'Driver tab' "$gout/index.md")"
grep -q '| Phone, Signal tab, the same change as the first picture of this group\. |' "$gout/index.md" && ok "follower Look at points at the first picture" || fail "follower look"
grep -q '^| Phone, Driver tab |  |  |' "$gout/index.md" && ok "Task and State columns are empty" || fail "task/state not empty"
# Union-box grouping and leader: a second small box inside the same area keeps the pair in the group, and a pair with
# fewer boxes leads even though its name sorts later.
python3 - "$SCRATCH" <<'PY'
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
for name, boxes in (("u1", [(40, 100, 100, 140), (140, 100, 200, 140)]), ("u2", [(42, 102, 202, 142)])):
    a = Image.new("RGB", (300, 400), "white"); b = a.copy()
    for box in boxes: ImageDraw.Draw(b).rectangle(box, fill="black")
    a.save(f"{d}/{name}.a.png"); b.save(f"{d}/{name}.b.png")
PY
cat > "$SCRATCH/union.json" <<JSON
[{"name":"desktop-empty","before":"$SCRATCH/u1.a.png","after":"$SCRATCH/u1.b.png","diff":null},
 {"name":"desktop-tab-box","before":"$SCRATCH/u2.a.png","after":"$SCRATCH/u2.b.png","diff":null}]
JSON
node "$REPO/scripts/visual/diff-page.mjs" "$SCRATCH/union" "What changed on screen" "$SCRATCH/union.json" "x" > "$SCRATCH/ulog.txt" 2>&1
grep -q "1 group(s)" "$SCRATCH/ulog.txt" && ok "union box: two pairs with different small boxes are one group" || fail "union group: $(cat "$SCRATCH/ulog.txt")"
grep -q '^| Desktop, Box tab .*the red boxes: x' "$SCRATCH/union/index.md" && ok "leader is the pair with the fewest boxes, not the first by name" || fail "leader: $(cat "$SCRATCH/union/index.md")"
node "$REPO/scripts/visual/screen-names.test.mjs" > "$SCRATCH/names.txt" 2>&1 && ok "plain screen names cover every baseline" || fail "screen names: $(cat "$SCRATCH/names.txt")"
mkdir -p "$SCRATCH/F" && python3 "$REPO/scripts/feedback/feedback-page.py" "$SCRATCH/F" --item QO0 --todo t > /dev/null
(cd /tmp && node "$REPO/scripts/feedback/feedback_page_group_test.mjs" "$SCRATCH/F/index.html" > "$SCRATCH/fold.txt" 2>&1) \
  && ok "folded pictures keep their own comment box" || fail "fold page: $(cat "$SCRATCH/fold.txt")"
exit "$fails"
