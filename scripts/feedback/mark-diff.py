#!/usr/bin/env python3
"""Draw a red box around what changed between a before and an after picture, on both.

    python3 scripts/feedback/mark-diff.py before.png after.png            # marks both files in place
    python3 scripts/feedback/mark-diff.py pic.png --box X,Y,W,H [--box …]  # marks one picture by hand

John, 20 Oct 2026: every picture shown to him marks what to look at, done in code, not by a model;
full-window pictures with every shifted row boxed were "chaotic and unhelpful".

How the change is found: the pixel rows of the two pictures are aligned (difflib on row hashes), so
rows that only moved up or down match and are not marked. What is left are bands of rows that were
changed, added or removed. Inside a band, only the columns that differ are boxed (runs closer than
GAP_X are one box). Each picture gets the boxes in its own coordinates. A box over MAX_SHARE of the
picture is not drawn (it marks nothing): mark by hand with --box. Exit 1 when the pictures are the
same, 2 when every box was too big to draw.
"""
from __future__ import annotations

import argparse
import difflib
import sys

import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin

THRESH = 2         # mean per-column colour difference that counts, for bands of different height
GAP_X = 32         # column runs closer than this are one box
PAD = 6            # margin around each box
MARKER_KEY, MARKER_VALUE = "marked", "1"  # PNG text chunk: this picture was marked by this tool
RED = (230, 0, 0)
WIDTH = 3
MAX_SHARE = 0.4    # a box bigger than this share of the picture is not drawn

Box = tuple[int, int, int, int]  # x0, y0, x1, y1


def _row_hashes(a: np.ndarray) -> list[bytes]:
    return [row.tobytes() for row in a]


def _runs(cols: np.ndarray) -> list[tuple[int, int]]:
    """[x0, x1) runs of True columns, joining gaps under GAP_X."""
    xs = np.nonzero(cols)[0]
    if xs.size == 0:
        return []
    runs, start, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > GAP_X:
            runs.append((int(start), int(prev) + 1))
            start = x
        prev = x
    runs.append((int(start), int(prev) + 1))
    return runs


def _content_cols(band: np.ndarray) -> np.ndarray:
    """Columns holding anything other than the band's background (its most common colour)."""
    flat = band.reshape(-1, band.shape[2])
    colours, counts = np.unique(flat, axis=0, return_counts=True)
    bg = colours[counts.argmax()].astype(np.int16)
    return (np.abs(band.astype(np.int16) - bg).max(axis=2) > 24).any(axis=0)


def _diff_cols(ba: np.ndarray, bb: np.ndarray) -> np.ndarray:
    w = max(ba.shape[1], bb.shape[1])
    cols = np.zeros(w, dtype=bool)
    cw = min(ba.shape[1], bb.shape[1])
    cols[cw:] = True
    if ba.shape[0] == bb.shape[0]:
        cols[:cw] = (np.abs(ba[:, :cw].astype(np.int16) - bb[:, :cw].astype(np.int16)).max(axis=2) > 24).any(axis=0)
    else:
        ma, mb = ba[:, :cw].mean(axis=0), bb[:, :cw].mean(axis=0)
        cols[:cw] = np.abs(ma - mb).max(axis=1) > THRESH
        cols[:cw] |= _content_cols(ba)[:cw] ^ _content_cols(bb)[:cw]
    return cols


def changed_boxes(a: np.ndarray, b: np.ndarray) -> tuple[list[Box], list[Box]]:
    """Boxes on a and on b around what changed, ignoring rows that only moved."""
    if a.shape[1] != b.shape[1]:
        w = max(a.shape[1], b.shape[1])
        a = np.pad(a, ((0, 0), (0, w - a.shape[1]), (0, 0)), constant_values=255)
        b = np.pad(b, ((0, 0), (0, w - b.shape[1]), (0, 0)), constant_values=255)
    sm = difflib.SequenceMatcher(None, _row_hashes(a), _row_hashes(b), autojunk=False)
    boxes_a: list[Box] = []
    boxes_b: list[Box] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        ba, bb = a[i1:i2], b[j1:j2]
        if tag == "replace":
            cols = _diff_cols(ba, bb)
        else:
            cols = _content_cols(ba if tag == "delete" else bb)
        for x0, x1 in _runs(cols):
            if i2 > i1:
                boxes_a.append((x0, i1, x1, i2))
            if j2 > j1:
                boxes_b.append((x0, j1, x1, j2))
    return _merge(boxes_a), _merge(boxes_b)


def _merge(boxes: list[Box]) -> list[Box]:
    """Join boxes that overlap or nearly touch, so one change gets one box."""
    boxes = sorted(boxes)
    merged = True
    while merged:
        merged = False
        out: list[Box] = []
        for bx in boxes:
            for k, o in enumerate(out):
                if bx[0] <= o[2] + GAP_X and o[0] <= bx[2] + GAP_X and bx[1] <= o[3] + 12 and o[1] <= bx[3] + 12:
                    out[k] = (min(o[0], bx[0]), min(o[1], bx[1]), max(o[2], bx[2]), max(o[3], bx[3]))
                    merged = True
                    break
            else:
                out.append(bx)
        boxes = out
    return boxes


def drawable(boxes: list[Box], shape: tuple[int, ...]) -> list[Box]:
    area = shape[0] * shape[1]
    return [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) <= MAX_SHARE * area]


def draw_on(img: Image.Image, boxes: list[Box]) -> None:
    d = ImageDraw.Draw(img)
    for x0, y0, x1, y1 in boxes:
        box = (max(x0 - PAD, 0), max(y0 - PAD, 0), min(x1 + PAD, img.width - 1), min(y1 + PAD, img.height - 1))
        if box[0] < box[2] and box[1] < box[3]:
            d.rectangle(box, outline=RED, width=WIDTH)


def _draw_file(path: str, boxes: list[Box]) -> None:
    img = Image.open(path).convert("RGB")
    draw_on(img, boxes)
    info = PngImagePlugin.PngInfo()
    info.add_text(MARKER_KEY, MARKER_VALUE)  # check-answerable.mjs fails any picture without this
    img.save(path, format="PNG", pnginfo=info)


def stamp(path: str) -> None:
    """Add the marker to a picture whose red marks were already drawn (before-after.sh draws them in the browser)."""
    _draw_file(path, [])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("pictures", nargs="+", help="before.png after.png, or one picture with --box")
    ap.add_argument("--stamp", action="store_true", help="only add the marked=1 chunk (marks already drawn)")
    ap.add_argument("--box", action="append", default=[], help="X,Y,W,H in px (repeatable)")
    args = ap.parse_args()

    if args.stamp:
        for p in args.pictures:
            stamp(p)
        return 0

    if args.box:
        boxes = [(x, y, x + w, y + h) for x, y, w, h in (tuple(int(v) for v in s.split(",")) for s in args.box)]
        for p in args.pictures:
            _draw_file(p, boxes)
        print(f"mark-diff: drew {len(boxes)} box(es) on {', '.join(args.pictures)}")
        return 0

    if len(args.pictures) != 2:
        ap.error("give exactly two pictures (before, after), or use --box")
    before, after = args.pictures
    a = np.asarray(Image.open(before).convert("RGB"))
    b = np.asarray(Image.open(after).convert("RGB"))
    found_a, found_b = changed_boxes(a, b)
    if not found_a and not found_b:
        print(f"mark-diff: {before} and {after} are the same; nothing marked", file=sys.stderr)
        return 1
    boxes_a, boxes_b = drawable(found_a, a.shape), drawable(found_b, b.shape)
    if not boxes_a and not boxes_b:
        print("mark-diff: every change covers most of the picture; not drawn — mark by hand with --box", file=sys.stderr)
        return 2
    _draw_file(before, boxes_a)
    _draw_file(after, boxes_b)
    fmt = lambda bs: " ".join(f"{x0},{y0},{x1 - x0},{y1 - y0}" for x0, y0, x1, y1 in bs) or "-"
    print(f"mark-diff: before {fmt(boxes_a)} | after {fmt(boxes_b)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
