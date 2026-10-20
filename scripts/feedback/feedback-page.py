#!/usr/bin/env python3
"""Make a folder's index.html answerable: every picture gets a Look-at line and its own comment box.

    feedback-page.py <folder> --item QO<n> --todo "<What to do line>"

Copies the one shared template (feedback-page.template.html) into <folder>/index.html. The page reads
<folder>/index.md and posts each comment to /board/api/inbox as "[picture: <folder>/<file>] <text>".
Never hand-edit a generated index.html; change the template and regenerate.
"""
from __future__ import annotations

import argparse
import html
import pathlib

TEMPLATE = pathlib.Path(__file__).resolve().parent / "feedback-page.template.html"


def title_of(folder: pathlib.Path) -> str:
    md = folder / "index.md"
    if md.is_file():
        for line in md.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    return folder.name


def write_page(folder: pathlib.Path, item: str, todo: str) -> pathlib.Path:
    page = TEMPLATE.read_text(encoding="utf-8")
    for key, value in (("__TITLE__", html.escape(title_of(folder))), ("__TODO__", html.escape(todo)),
                       ("__ITEM__", item), ("__FOLDER__", folder.name)):
        page = page.replace(key, value)
    out = folder / "index.html"
    out.write_text(page, encoding="utf-8")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("folder", type=pathlib.Path)
    ap.add_argument("--item", required=True, help="board item the comments go to, e.g. QO284")
    ap.add_argument("--todo", required=True, help="the 'What to do' line John reads first")
    a = ap.parse_args()
    print(write_page(a.folder.resolve(), a.item, a.todo))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
