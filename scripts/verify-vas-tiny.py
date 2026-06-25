"""
verify-vas-tiny.py — interactive Vas_tiny_for_driver verification.

For each flagged file:
  1. Shows brand/model, current Sd and Vas, cached datasheet path
  2. Opens the cached PDF (or the vendor page URL) in the default viewer
  3. Asks what the datasheet says
  4. Writes the correction to the WDR file

Run: python scripts/verify-vas-tiny.py [--collection <name>]

User responses at the prompt:
  <number>      Correct Vas in litres — script converts to m³ and writes it
  ok            Vas is confirmed correct as-is (adds a note, suppresses future DQ flag)
  skip / Enter  Skip this file for now
  q             Quit
"""

import os
import re
import sys
import pathlib
import subprocess
import argparse
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from dq_check import parse_fields, check_fields

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DRIVERS_DIR = pathlib.Path(__file__).parent.parent / "drivers"


def open_file(path: pathlib.Path):
    try:
        os.startfile(str(path))
    except AttributeError:
        subprocess.Popen(["xdg-open", str(path)])


def find_cached_pdf(fields: dict, coll_path: pathlib.Path) -> pathlib.Path | None:
    ds_url = fields.get("boxbench_datasheet", "")
    if not ds_url:
        return None
    pdf_name = urllib.parse.unquote(ds_url.rstrip("/").split("/")[-1])
    pdf_path = coll_path / "datasheets" / pdf_name
    return pdf_path if pdf_path.exists() else None


def update_wdr(wdr_path: pathlib.Path, new_vas_m3: float | None, note: str):
    lines = wdr_path.read_text(encoding="utf-8", errors="replace").splitlines()
    updated = []
    found_vas = False
    found_corr = False
    for line in lines:
        if line.startswith("Vas=") and new_vas_m3 is not None:
            updated.append(f"Vas={new_vas_m3:.6g}")
            found_vas = True
        elif line.startswith("boxbench_corrections="):
            updated.append(line + "; " + note)
            found_corr = True
        else:
            updated.append(line)

    if not found_vas and new_vas_m3 is not None:
        # Insert Vas before ParState
        out2 = []
        for line in updated:
            if line.startswith("ParState="):
                out2.append(f"Vas={new_vas_m3:.6g}")
            out2.append(line)
        updated = out2

    if not found_corr:
        out2 = []
        for line in updated:
            if line.startswith("ParState="):
                out2.append(f"boxbench_corrections={note}")
            out2.append(line)
        updated = out2

    wdr_path.write_text("\n".join(updated), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--collection", help="Only process this collection")
    args = ap.parse_args()

    flagged = []
    for coll_path in sorted(DRIVERS_DIR.iterdir()):
        if not coll_path.is_dir():
            continue
        if args.collection and coll_path.name != args.collection:
            continue
        for wdr_path in sorted(coll_path.glob("*.wdr")):
            fields = parse_fields(wdr_path.read_text(encoding="utf-8", errors="replace"))
            hits = [h for h in check_fields(fields) if h[0] == "Vas_tiny_for_driver"]
            if hits:
                flagged.append((coll_path, wdr_path, fields, hits[0]))

    print(f"\n{len(flagged)} files flagged Vas_tiny_for_driver\n")

    for i, (coll_path, wdr_path, fields, (_, _, detail)) in enumerate(flagged, 1):
        brand = fields.get("Brand", "")
        model = fields.get("Model", "")
        vas_m3 = float(fields.get("Vas", 0))
        sd_m2  = float(fields.get("Sd", 0))

        print(f"\n{'─'*70}")
        print(f"[{i}/{len(flagged)}] {coll_path.name}/{wdr_path.name}")
        print(f"  {brand} {model}")
        print(f"  {detail}")

        pdf = find_cached_pdf(fields, coll_path)
        vendor = fields.get("boxbench_vendor_page") or fields.get("boxbench_source", "")
        ds_url = fields.get("boxbench_datasheet", "")

        if pdf:
            print(f"  PDF: {pdf.name}  → opening…")
            open_file(pdf)
        elif ds_url:
            print(f"  No cached PDF. Datasheet URL: {ds_url}")
        if vendor:
            print(f"  Vendor page: {vendor}")

        while True:
            resp = input("\n  Correct Vas (L)? [number / ok = confirmed correct / skip / q]: ").strip().lower()
            if resp in ("q", "quit"):
                print("Quitting.")
                sys.exit(0)
            elif resp in ("", "skip", "s"):
                print("  Skipped.")
                break
            elif resp == "ok":
                note = (f"Vas={vas_m3*1000:.2f}L confirmed correct per datasheet — "
                        f"small Vas is by design (stiff suspension / pro driver)")
                update_wdr(wdr_path, None, note)
                print(f"  Confirmed. Note written.")
                break
            else:
                try:
                    vas_l = float(resp)
                    vas_new = vas_l / 1000
                    note = (f"Vas corrected {vas_m3:.6g}->{vas_new:.6g} m³ ({vas_l}L); "
                            f"read from datasheet — Vas_tiny_for_driver DQ flag resolved")
                    update_wdr(wdr_path, vas_new, note)
                    print(f"  Written: Vas={vas_new:.6g} m³ ({vas_l} L)")
                    break
                except ValueError:
                    print("  Enter a number in litres, 'ok', 'skip', or 'q'.")

    print(f"\nDone.")


if __name__ == "__main__":
    main()
