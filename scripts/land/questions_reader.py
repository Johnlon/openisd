"""Read the split decision record as data. This module is also pinned by the child gates."""
from contextlib import contextmanager
from dataclasses import dataclass
import fcntl
import json
import os
import re

import yaml


LIVE = "questions.yml"
ARCHIVED = "questions-archived.yml"
SOURCES = (LIVE, ARCHIVED)
ITEM_ID = re.compile(r"^(QO|QT|QP|QD)(\d+)([a-z]?)$")
LOADER = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
ORDER = "ORDER.json"
COMMENT_PAGES = "COMMENT-PAGES.json"
LAYOUT = "LAYOUT"
LAYOUT_VERSION = b"split-v1\n"
MAX_FILE_BYTES = 30_000
PAGE_KINDS = {"thread": "comments", "notes": "notes"}


@dataclass
class Entry:
    source: str
    position: int
    data: dict
    raw: bytes

    @property
    def id(self):
        return self.data["id"]


def parse(raw):
    return yaml.load(raw, Loader=LOADER)


def read_folder(folder):
    """Read every item once in source order, preserving the legacy source label."""
    entries, _ = read_layout(folder, True, SOURCES)
    return entries


def read_layout(folder, enforce_cap, sources):
    with layout_lock(folder, fcntl.LOCK_SH):
        active_layout(folder)
        return read_revision(folder, enforce_cap, sources)


def read_revision(folder, enforce_cap, sources):
    if folder.is_symlink():
        raise ValueError(f"{folder}: expected a decision directory, found a symlink")
    order = read_order(folder)
    ids = set()
    for source, names in order.items():
        if not isinstance(names, list):
            raise ValueError(f"{folder}/{ORDER}: expected a list of IDs for {source}")
        for pos, qid in enumerate(names, 1):
            if not isinstance(qid, str) or not ITEM_ID.fullmatch(qid) or qid in ids:
                raise ValueError(f"{folder}/{ORDER}: invalid or duplicate item {qid} at {source}#{pos}")
            ids.add(qid)
    manifest = read_page_manifest(folder)
    if manifest.keys() - ids:
        raise ValueError(f"{folder}/{COMMENT_PAGES}: pages listed for unknown IDs")
    if sources == SOURCES:
        files = {p.stem for p in folder.glob("*.yml")}
        if ids != files:
            raise ValueError(f"{folder}: missing files {sorted(ids - files)}, unindexed files {sorted(files - ids)}")
        pages = page_files(folder)
        expected = manifest_files(manifest)
        if expected != pages:
            raise ValueError(f"{folder}: missing pages {sorted(expected - pages)}, unindexed pages {sorted(pages - expected)}")
    entries = []
    for source in sources:
        for pos, qid in enumerate(order.get(source, []), 1):
            path = folder / f"{qid}.yml"
            raw = read_part(path, enforce_cap)
            fragments = {}
            for field, count in manifest.get(qid, {}).items():
                fragments[field] = b"".join(
                    read_part(folder / page_name(qid, field, n), enforce_cap)
                    for n in range(1, count + 1)
                )
            try:
                raw = splice_pages(raw, fragments)
            except ValueError as exc:
                raise ValueError(f"{path}: {exc}") from exc
            data = parse(raw)
            if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict) or data[0].get("id") != qid:
                raise ValueError(f"{path}: expected one sequence item with id {qid}")
            entries.append(Entry(source, pos, data[0], raw))
    return entries, manifest


def read_order(folder):
    order = json.loads(read_part(folder / ORDER, True))
    if not isinstance(order, dict) or LIVE not in order or order.keys() - set(SOURCES):
        raise ValueError(f"{folder}/{ORDER}: expected {LIVE} and any archive list")
    return order


def page_name(qid, field, number):
    return f"{qid}-{PAGE_KINDS[field]}-{number:02d}.txt"


def marker(field):
    return f"# questions-split: {PAGE_KINDS[field]} pages".encode()


def marker_pattern(field):
    return re.compile(rb"(?m)^(?: *-)? *(" + re.escape(marker(field)) + rb"\r?\n)")


def read_page_manifest(folder):
    path = folder / COMMENT_PAGES
    if not path.exists():
        return {}
    manifest = json.loads(read_part(path, True))
    if not isinstance(manifest, dict):
        raise ValueError(f"{path}: expected an object keyed by decision ID")
    for qid, counts in manifest.items():
        if (not ITEM_ID.fullmatch(qid) or not isinstance(counts, dict) or not counts
                or counts.keys() - PAGE_KINDS.keys()
                or any(type(n) is not int or n < 1 for n in counts.values())):
            raise ValueError(f"{path}: invalid page counts for {qid}")
    return manifest


def manifest_files(manifest):
    return {page_name(qid, field, n) for qid, counts in manifest.items()
            for field, count in counts.items() for n in range(1, count + 1)}


def page_files(folder):
    return {p.name for kind in PAGE_KINDS.values() for p in folder.glob(f"*-{kind}-*.txt")}


def read_part(path, enforce_cap):
    if path.is_symlink():
        raise ValueError(f"{path}: decision data cannot be a symlink")
    raw = path.read_bytes()
    if enforce_cap and len(raw) > MAX_FILE_BYTES:
        raise ValueError(f"{path}: exceeds {MAX_FILE_BYTES:,} bytes")
    return raw


def splice_pages(head, fragments):
    replacements = []
    for field in PAGE_KINDS:
        matches = list(marker_pattern(field).finditer(head))
        if len(matches) != (field in fragments):
            raise ValueError(f"expected one marker per paged {PAGE_KINDS[field]} field")
        if matches:
            start, end = matches[0].span(1)
            replacements.append((start, end, fragments[field]))
    for start, end, fragment in sorted(replacements, reverse=True):
        head = head[:start] + fragment + head[end:]
    return head


@contextmanager
def layout_lock(folder, mode):
    # The parent inode survives a directory exchange and needs no tracked lock file.
    fd = os.open(folder.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        fcntl.flock(fd, mode)
        yield fd
    finally:
        os.close(fd)


def active_layout(folder):
    marker_path = folder / LAYOUT
    if not os.path.lexists(marker_path):
        return False
    if marker_path.is_symlink() or marker_path.read_bytes() != LAYOUT_VERSION:
        raise ValueError(f"{marker_path}: unknown decision layout")
    if any(os.path.lexists(folder.parent / name) for name in SOURCES):
        raise ValueError(f"{folder.parent}: mixed decision layouts (active folder and legacy ledger)")
    return True


def read_gate_record(path, scope, qid):
    """Read untrusted record data for a gate whose copy of this module is pinned."""
    if path.is_dir():
        return lookup_items(path, scope, qid, True)
    with layout_lock(path, fcntl.LOCK_SH):
        active_layout(path.parent / "questions")
        doc = parse(read_part(path, False))
    items = doc.get("questions", []) if isinstance(doc, dict) else doc
    return [item for item in items or [] if isinstance(item, dict) and (qid == "*" or item.get("id") == qid)]


def lookup_items(folder, scope, qid, require_active):
    sources = SOURCES if scope == "all" else (LIVE,)
    with layout_lock(folder, fcntl.LOCK_SH):
        if not active_layout(folder) and require_active:
            raise ValueError(f"{folder}: the decision folder is not active")
        if scope == "all" and ARCHIVED not in read_order(folder):
            raise ValueError(f"{folder}/{ORDER}: missing {ARCHIVED} list")
        entries, _ = read_revision(folder, True, sources)
    return [entry.data for entry in entries if qid == "*" or entry.id == qid]
