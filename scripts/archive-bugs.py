#!/usr/bin/env python3
"""Move fully-closed bug records from bugs/ to bugs/archive/ and stage the moves.

A record is closed only if its ENTIRE status region agrees: one OPEN (or BLOCKED,
DEFERRED, NOT FIXED, IN PROGRESS) line anywhere in it keeps the file in bugs/,
however many other lines say FIXED. Multi-line statuses are common — one item
fixed, a residue item open — and the residue is what the release gate must see.
"""
import os
import re
import shutil
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
BUGS_DIR = os.path.join(REPO_ROOT, "bugs")
ARCHIVE_DIR = os.path.join(BUGS_DIR, "archive")

OPEN_TERMS = [r"\bOPEN\b", r"\bBLOCKED\b", r"\bDEFERRED\b", r"NOT FIXED", r"IN PROGRESS"]
CLOSED_TERMS = [r"\bRESOLVED\b", r"\bFIXED\b", r"\bWONTFIX\b", r"\bCLOSED\b"]


def status_region_lines(path):
    """Every line that states status: the direct `Status:` line plus the full
    body of a `# Status` section (up to the next header)."""
    with open(path, "r", encoding="utf-8", errors="ignore") as file:
        lines = file.read().splitlines()

    gathered = []
    in_status = False
    for line in lines:
        stripped = line.strip()
        if re.match(r"^status:", stripped, re.IGNORECASE):
            gathered.append(stripped)
            continue
        if re.match(r"^#+\s*status\b", stripped, re.IGNORECASE):
            in_status = True
            continue
        if in_status:
            if re.match(r"^#+", stripped):
                in_status = False
                continue
            if stripped:
                gathered.append(stripped)
    return gathered


def is_closed_bug(filename):
    region = status_region_lines(os.path.join(BUGS_DIR, filename))
    joined = [l.upper() for l in region]
    if any(re.search(term, l) for term in OPEN_TERMS for l in joined):
        return False
    return any(re.search(term, l) for term in CLOSED_TERMS for l in joined)


def main():
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)

    files = os.listdir(BUGS_DIR)
    md_files = [f for f in files if f.endswith(".md") and f.startswith("BUG_")]

    moved_count = 0
    for f in sorted(md_files):
        if is_closed_bug(f):
            print(f"Moving closed bug md: {f} -> archive/")
            shutil.move(os.path.join(BUGS_DIR, f), os.path.join(ARCHIVE_DIR, f))
            moved_count += 1

            base_name = os.path.splitext(f)[0]
            for other_file in files:
                if other_file != f and other_file.startswith(base_name):
                    print(f"  Moving associated asset: {other_file} -> archive/")
                    shutil.move(os.path.join(BUGS_DIR, other_file),
                                os.path.join(ARCHIVE_DIR, other_file))
                    moved_count += 1

    if moved_count > 0:
        print(f"\nMoved {moved_count} files to archive folder.")
        try:
            subprocess.run(["git", "add", "-A", BUGS_DIR], check=True, cwd=REPO_ROOT)
            print("Successfully staged the moves in Git.")
        except Exception as e:
            print(f"Failed to automatically stage files in Git: {e}")
    else:
        print("No closed bugs found to archive.")


if __name__ == "__main__":
    main()
