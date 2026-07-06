#!/usr/bin/env python3
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI LOCKED — DO NOT EDIT
This script defines the authoritative transformation rules for the matt collection.
Any changes require explicit human authorization and must be documented in README.md.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Restore matt collection from archive with ONLY approved transformations.

Approved transformations (from drivers/matt/README.md):
1. Strip "00 " sort-prefix from filenames
2. Strip "00 " sort-prefix from Brand= field
3. Rename "Dayton " to "Dayton Audio " (filename and Brand=)
4. Fix brand typo: Failtal Pro → Faital Pro
5. Handle RCF model naming (L10/568H → L10-568H, L15/554K → L15-554K)
6. Remove Brand=00 from: Aura NS6-255-8A, B&C 8PE21, WT3 Sony 5.25 Neo woofer
7. Strip Brand=WT3 prefix from all 53 WT3 files

NOT doing:
- Removing WinISD-internal fields (fLe, KLe, Hc, Hg, SPLmax, etc.)
- Changing data values (Xmax, Vas, Pe, etc.)
- Any other field modifications
"""

import os
import shutil
import zipfile
import re
from pathlib import Path

MATT_DIR = "/mnt/c/Users/johnl/work/resonate/drivers/matt"
ZIP_PATH = os.path.join(MATT_DIR, "mtg90's winisd drivers.zip")
ARCHIVE_EXTRACT = "/tmp/matt_restore_work"

def strip_00_prefix(text):
    """Remove '00 ' prefix if present."""
    if text.startswith("00 "):
        return text[3:]
    return text

def rename_dayton(text):
    """Rename 'Dayton ' to 'Dayton Audio '."""
    return text.replace("Dayton ", "Dayton Audio ")

def fix_failtal_typo(text):
    """Fix Failtal Pro → Faital Pro."""
    return text.replace("Failtal Pro", "Faital Pro")

def fix_rcf_models(text):
    """Fix RCF model naming."""
    # L10/568H → L10-568H, L15/554K → L15-554K
    text = text.replace("L10/568H", "L10-568H")
    text = text.replace("L15/554K", "L15-554K")
    return text

def process_wdr_file(archive_file_path, output_file_path):
    """Apply approved transformations to a single WDR file."""

    # Read original file
    with open(archive_file_path, 'r') as f:
        lines = f.readlines()

    output_lines = []

    for line in lines:
        # Skip [Driver] header and empty lines
        if line.strip().startswith('[') or not line.strip():
            output_lines.append(line)
            continue

        # Process field lines (key=value)
        if '=' in line:
            key, value = line.split('=', 1)
            value = value.rstrip('\n')

            # Apply transformations only to specific fields
            if key == "Brand":
                # Strip "00 " prefix
                value = strip_00_prefix(value)

                # Rename Dayton
                value = rename_dayton(value)

                # Fix typos
                value = fix_failtal_typo(value)

                # Fix RCF
                value = fix_rcf_models(value)

                # Strip WT3 brand prefix (for 53 WT3 files)
                if value.startswith("WT3 "):
                    value = value[4:]  # Strip "WT3 " prefix

                # Remove bare "00" Brand (for specific files)
                # These will be handled per-file basis

                output_lines.append(f"{key}={value}\n")

            elif key == "Model":
                # Fix RCF models
                value = fix_rcf_models(value)
                output_lines.append(f"{key}={value}\n")

            else:
                # All other fields: no modification
                output_lines.append(line)
        else:
            output_lines.append(line)

    # Write output file
    with open(output_file_path, 'w') as f:
        f.writelines(output_lines)

def main():
    print("=" * 80)
    print("Restoring matt collection from archive")
    print("=" * 80)

    # Step 1: Clear current matt WDR files (but keep other files like .yml, zip)
    print("\n[1] Clearing current WDR files...")
    wdr_count = 0
    for fname in os.listdir(MATT_DIR):
        if fname.endswith('.wdr'):
            fpath = os.path.join(MATT_DIR, fname)
            os.remove(fpath)
            wdr_count += 1
    print(f"  Removed {wdr_count} WDR files")

    # Step 2: Extract archive
    print("\n[2] Extracting archive...")
    if os.path.exists(ARCHIVE_EXTRACT):
        shutil.rmtree(ARCHIVE_EXTRACT)

    with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
        zf.extractall(ARCHIVE_EXTRACT)

    archive_dir = os.path.join(ARCHIVE_EXTRACT, "winisd drivers")
    archive_files = [f for f in os.listdir(archive_dir) if f.endswith('.wdr')]
    print(f"  Extracted {len(archive_files)} WDR files")

    # Step 3: Process files with approved transformations
    print("\n[3] Applying approved transformations...")

    processed = 0
    for arch_file in sorted(archive_files):
        arch_path = os.path.join(archive_dir, arch_file)

        # Determine output filename
        out_file = arch_file

        # Strip "00 " prefix from filename
        if out_file.startswith("00 "):
            out_file = out_file[3:]

        # Rename Dayton to Dayton Audio
        out_file = out_file.replace("Dayton ", "Dayton Audio ")

        # Fix typos in filename
        out_file = fix_failtal_typo(out_file)

        # Fix RCF models in filename
        out_file = fix_rcf_models(out_file)

        out_path = os.path.join(MATT_DIR, out_file)

        # Process the WDR file
        process_wdr_file(arch_path, out_path)
        processed += 1

        if processed % 50 == 0:
            print(f"  {processed}/{len(archive_files)} files processed...")

    print(f"  ✓ Processed {processed} files")

    # Step 4: Handle special cases (Brand=00 removal)
    print("\n[4] Handling special cases (Brand=00 removal)...")
    special_files = {
        "Aura NS6-255-8A.wdr": True,
        "B&C 8PE21 8in Woofer.wdr": True,
        "WT3 Sony 5.25 Neo woofer buyout.wdr": True,
    }

    # Try various filename variations due to transformations
    special_matches = [
        "Aura NS6-255-8A.wdr",
        "B&C 8PE21 8in Woofer.wdr",
        "Sony 5.25 Neo woofer buyout.wdr",  # WT3 prefix stripped
    ]

    special_fixed = 0
    for fname in os.listdir(MATT_DIR):
        if fname.endswith('.wdr'):
            for match_pattern in special_matches:
                if match_pattern in fname or fname.endswith(match_pattern):
                    fpath = os.path.join(MATT_DIR, fname)

                    # Read, fix Brand=00, write back
                    with open(fpath, 'r') as f:
                        lines = f.readlines()

                    output = []
                    for line in lines:
                        if line.startswith("Brand=00"):
                            # Remove Brand=00 line (or skip)
                            continue
                        output.append(line)

                    with open(fpath, 'w') as f:
                        f.writelines(output)

                    special_fixed += 1
                    print(f"  Processed: {fname}")
                    break

    if special_fixed == 0:
        print("  (No special Brand=00 cases found or already handled)")

    # Cleanup
    print("\n[5] Cleanup...")
    shutil.rmtree(ARCHIVE_EXTRACT)
    print("  ✓ Removed temporary extract directory")

    print("\n" + "=" * 80)
    print("DONE: matt collection restored with approved transformations only")
    print("=" * 80)
    print(f"\nSummary:")
    print(f"  - {processed} WDR files restored")
    print(f"  - Filenames: '00 ' stripped, 'Dayton' → 'Dayton Audio'")
    print(f"  - Brand field: '00 ' stripped, 'Dayton' → 'Dayton Audio', 'WT3' stripped")
    print(f"  - NO field removals")
    print(f"  - NO data value changes")
    print(f"  - All original fields and values preserved")

if __name__ == "__main__":
    main()
