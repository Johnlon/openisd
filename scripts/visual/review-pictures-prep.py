#!/usr/bin/env python3
"""Prepares the baseline pictures a pull request changes for an unattended reviewer (T818, John 15 Nov 2026).

    python3 scripts/visual/review-pictures-prep.py <base-commit> <head-ref> <out-dir>

Writes <out-dir>/REPORT.md and contact sheets <out-dir>/sheet-NN.png. The mechanical pass (code does it better than
eyes) is done here; the reviewing model reads the report, then the sheets, then opens single pictures at full size.

Mechanical findings, for every added or changed picture:
  * exact duplicate: byte-identical pixels to another baseline under a different name;
  * near duplicate: same size and under NEAR_DUP_PCT of the pixels differ from another baseline (an opener that
    opened nothing, or a view named twice);
  * for a changed picture, how much of it differs from the one on the base commit.
Needs Pillow and numpy (the workflow installs them at the versions pr.yml's `shell` job uses).
"""
import hashlib
import io
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DIR = "packages/ui/test/visual/visual.browser.spec.ts-snapshots"
HINT_FILES = ["packages/ui/test/visual/screens.ts", "packages/ui/test/fixtures/desktopSurfaceManifest.ts",
              "docs/design/MOBILE_SURFACE_MANIFEST.md"]
NEAR_DUP_PCT = 0.4          # percent of pixels; below this two pictures of the same size count as the same view
MAX_SHEETS = 8
SHEET_W = 1800


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], check=True, capture_output=True).stdout


def load(data: bytes) -> np.ndarray:
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))


def diff_pct(a: np.ndarray, b: np.ndarray) -> float:
    return 100.0 * float(np.count_nonzero(np.any(a != b, axis=2))) / (a.shape[0] * a.shape[1])


def hint(name: str) -> str:
    """The lines of the screen list and surface manifests that name this picture, or a pointer to the generator."""
    stem = name.split("-", 1)[1] if "-" in name else name
    out = []
    for f in HINT_FILES:
        p = Path(f)
        if not p.exists():
            continue
        for n, line in enumerate(p.read_text(errors="replace").splitlines(), 1):
            if stem in line:
                out.append(f"{f}:{n}: {line.strip()[:160]}")
            if len(out) >= 3:
                return " | ".join(out)
    return " | ".join(out) if out else "no literal match: the name is built from parts, read the generator in screens.ts"


def caption_font(size: int):
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def tile(entry: dict, th: int) -> Image.Image:
    """One tile: the picture (changed ones: before | after), scaled to height th, with a caption strip."""
    parts = [entry["after_img"]] if entry["before_img"] is None else [entry["before_img"], entry["after_img"]]
    scaled = []
    for im in parts:
        w = max(1, round(im.width * th / im.height))
        scaled.append(im.resize((w, th)))
    width = sum(s.width for s in scaled) + 4 * (len(scaled) - 1)
    cap_h = 34
    t = Image.new("RGB", (width, th + cap_h), (255, 255, 255))
    x = 0
    for s in scaled:
        t.paste(s, (x, cap_h))
        x += s.width + 4
    label = f"{entry['status']} {entry['name']}"
    if entry["before_img"] is not None:
        label += f"  before | after, {entry['vs_base']:.2f}% differs"
    ImageDraw.Draw(t).text((3, 3), label, fill=(0, 0, 0), font=caption_font(14))
    ImageDraw.Draw(t).rectangle((0, cap_h, width - 1, th + cap_h - 1), outline=(200, 0, 0))
    return t


def sheets(entries: list, out: Path) -> list:
    made = []
    for skin, th in (("mobile", 540), ("desktop", 420)):
        rows, row, x = [], [], 0
        for t in (tile(e, th) for e in entries if e["name"].startswith(skin + "-")):
            if x + t.width > SHEET_W and row:
                rows.append(row)
                row, x = [], 0
            row.append(t)
            x += t.width + 8
        if row:
            rows.append(row)
        page, page_h = [], 0
        for r in rows + [None]:
            rh = max(t.height for t in r) + 8 if r else 0
            if page and (r is None or page_h + rh > 1900):
                if len(made) >= MAX_SHEETS:
                    return made
                s = Image.new("RGB", (SHEET_W, page_h), (235, 235, 235))
                y, count = 0, 0
                for pr in page:
                    x = 0
                    for t in pr:
                        s.paste(t, (x, y))
                        x += t.width + 8
                        count += 1
                    y += max(t.height for t in pr) + 8
                name = f"sheet-{len(made) + 1:02d}.png"
                s.save(out / name)
                made.append((name, skin, count))
                page, page_h = [], 0
            if r:
                page.append(r)
                page_h += rh
    return made


def main() -> int:
    base, head, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    changes = []
    for line in git("diff", "--name-status", "--no-renames", base, head, "--", DIR).decode().splitlines():
        status, path = line.split("\t", 1)
        if path.endswith(".png") and status in ("A", "M"):
            changes.append((status, path))
    changes.sort(key=lambda c: c[1])
    # Every baseline at head, for the duplicate search.
    # Pixels are not kept (245 desktop pictures would be over a gigabyte): a hash and a small thumbnail per picture
    # find the candidates, and only a candidate is decoded again for the exact comparison.
    everything = {}
    blobs = {}
    for path in git("ls-tree", "-r", "--name-only", head, "--", DIR).decode().splitlines():
        if path.endswith(".png"):
            data = git("show", f"{head}:{path}")
            arr = load(data)
            thumb = np.asarray(Image.fromarray(arr).resize((32, 32), Image.BOX), dtype=np.float32)
            everything[Path(path).stem] = (hashlib.sha256(arr.tobytes()).hexdigest(), arr.shape, thumb)
            blobs[Path(path).stem] = data
    entries = []
    for status, path in changes:
        name = Path(path).stem
        after = git("show", f"{head}:{path}")
        before = git("show", f"{base}:{path}") if status == "M" else None
        e = {"status": status, "name": name, "path": path, "after_img": Image.open(io.BytesIO(after)).convert("RGB"),
             "before_img": Image.open(io.BytesIO(before)).convert("RGB") if before else None, "vs_base": 0.0}
        arr = load(blobs[name])
        if before:
            b = load(before)
            e["vs_base"] = 100.0 if b.shape != arr.shape else diff_pct(b, arr)
        h0, shape0, thumb0 = everything[name]
        e["exact"] = sorted(n for n, (h, _, _) in everything.items() if n != name and h == h0)
        e["near"] = []
        for n, (h, shape, thumb) in everything.items():
            if n == name or n in e["exact"] or shape != shape0 or float(np.abs(thumb - thumb0).mean()) > 3.0:
                continue
            pct = diff_pct(arr, load(blobs[n]))
            if pct < NEAR_DUP_PCT:
                e["near"].append((round(pct, 3), n))
        e["near"].sort()
        e["hint"] = hint(name)
        entries.append(e)
    lines = ["# Baseline pictures changed by this pull request", "",
             f"{len(entries)} picture(s): {sum(e['status'] == 'A' for e in entries)} added, "
             f"{sum(e['status'] == 'M' for e in entries)} changed. {len(everything)} baselines exist at head.", ""]
    suspects = [e for e in entries if e["exact"] or e["near"]]
    lines += ["## Mechanical findings", ""]
    if not suspects:
        lines.append("No changed picture is byte-identical or near-identical to another baseline.")
    for e in suspects:
        if e["exact"]:
            lines.append(f"- EXACT DUPLICATE: {e['name']} has the same pixels as {', '.join(e['exact'])}")
        for pct, n in e["near"]:
            lines.append(f"- NEAR DUPLICATE: {e['name']} differs from {n} in {pct}% of its pixels")
    lines += ["", "## Pictures (name, status, size, share of pixels that differ from the base commit, where the screen is defined)", ""]
    for e in entries:
        w, h = e["after_img"].size
        diff = f", {e['vs_base']:.2f}% differs from base" if e["status"] == "M" else ""
        lines.append(f"- {e['name']} [{e['status']}] {w}x{h}{diff}. Defined at: {e['hint']}")
    made = sheets(entries, out)
    lines += ["", "## Contact sheets (read these first; open a single picture only when a tile looks odd)", ""]
    lines += [f"- {out.name}/{n}: {skin}, {k} picture(s)" for n, skin, k in made] or ["- none"]
    shown = sum(k for _, _, k in made)
    if shown < len(entries):
        lines.append(f"- {len(entries) - shown} picture(s) are on no sheet (sheet limit {MAX_SHEETS}); they have the mechanical pass only. Say so.")
    lines.append("")
    (out / "REPORT.md").write_text("\n".join(lines))
    print(f"review-pictures-prep: {len(entries)} picture(s), {len(suspects)} suspect(s), {len(made)} sheet(s) in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
