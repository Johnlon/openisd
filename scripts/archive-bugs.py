#!/usr/bin/env python3
import os
import re
import shutil
import subprocess

# Resolve directories relative to the script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
BUGS_DIR = os.path.join(REPO_ROOT, "bugs")
ARCHIVE_DIR = os.path.join(BUGS_DIR, "archive")

if not os.path.exists(ARCHIVE_DIR):
    os.makedirs(ARCHIVE_DIR)

def get_status_block(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as file:
        lines = file.read().splitlines()
    
    status_lines = []
    in_status = False
    has_direct_status = None
    
    for line in lines[:30]:
        stripped = line.strip()
        # Direct Status: ... line check
        match_direct = re.match(r"^status:\s*(.*)", stripped, re.IGNORECASE)
        if match_direct:
            has_direct_status = match_direct.group(1).strip()
            
        if re.match(r"^#+\s*status", stripped, re.IGNORECASE):
            in_status = True
            continue
        if in_status:
            # Stop if another header starts
            if re.match(r"^#+", stripped):
                break
            status_lines.append(stripped)
            
    status_text = " ".join([l for l in status_lines if l]).strip()
    return has_direct_status, status_text, status_lines

def is_closed_bug(filename):
    path = os.path.join(BUGS_DIR, filename)
    direct, text, status_lines = get_status_block(path)
    
    # 1. Check direct status line
    if direct:
        direct_upper = direct.upper()
        if any(kw in direct_upper for kw in ["RESOLVED", "FIXED", "WONTFIX", "CLOSED"]):
            if "NOT FIXED" not in direct_upper and "STILL OPEN" not in direct_upper and "OPEN" not in direct_upper:
                return True
    
    # 2. Check the first line under Status header (if list, check first bullet point)
    first_line = ""
    for l in status_lines:
        if l.strip():
            first_line = l.strip()
            break
            
    if first_line:
        # Strip list markers like - or *
        clean_first_line = re.sub(r"^[\s\-*+0-9.)]+", "", first_line).strip()
        clean_upper = clean_first_line.upper()
        
        # Check if it starts with/contains closed keywords
        if any(clean_upper.startswith(kw) or clean_upper.endswith(kw) or f": {kw}" in clean_upper or f" {kw}" in clean_upper for kw in ["RESOLVED", "FIXED", "WONTFIX", "CLOSED"]):
            # Make sure it's not overridden by OPEN/NOT FIXED/BLOCKED/DEFERRED indicators
            if "NOT FIXED" not in clean_upper and "STILL OPEN" not in clean_upper and not re.search(r"\bOPEN\b", clean_upper) and "DEFERRED" not in clean_upper and "BLOCKED" not in clean_upper:
                return True
                
    # 3. Fallback check on the entire status text block if it is short or simple
    text_upper = text.upper()
    if text_upper in ["FIXED", "RESOLVED", "WONTFIX", "CLOSED"]:
        return True
        
    # Manual overrides based on verification of historical files
    if filename == "BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md":
        return True
    if filename == "BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md":
        return True
    if filename == "BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md":
        return True
    if filename == "BUG_20260814_useDesignIO-duplicates-the-truncated-air-constants-now-stale-after-constants-ts-fix.md":
        return True
    if filename == "BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md":
        return False
        
    return False

def main():
    files = os.listdir(BUGS_DIR)
    md_files = [f for f in files if f.endswith(".md") and f.startswith("BUG_")]
    
    moved_count = 0
    for f in sorted(md_files):
        if is_closed_bug(f):
            src_path = os.path.join(BUGS_DIR, f)
            dest_path = os.path.join(ARCHIVE_DIR, f)
            print(f"Moving closed bug md: {f} -> archive/")
            shutil.move(src_path, dest_path)
            moved_count += 1
            
            # Also move any associated files sharing the same base name prefix
            base_name = os.path.splitext(f)[0]
            for other_file in files:
                if other_file != f and other_file.startswith(base_name):
                    src_other = os.path.join(BUGS_DIR, other_file)
                    dest_other = os.path.join(ARCHIVE_DIR, other_file)
                    print(f"  Moving associated asset: {other_file} -> archive/")
                    shutil.move(src_other, dest_other)
                    moved_count += 1

    if moved_count > 0:
        print(f"\nMoved {moved_count} files to archive folder.")
        # Attempt to run git add on bugs/ directory
        try:
            subprocess.run(["git", "add", "-A", BUGS_DIR], check=True, cwd=REPO_ROOT)
            print("Successfully staged the moves in Git.")
        except Exception as e:
            print(f"Failed to automatically stage files in Git: {e}")
    else:
        print("No closed bugs found to archive.")

if __name__ == "__main__":
    main()
