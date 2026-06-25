"""
fix-vas-from-pdf.py — read cached datasheets and fix Vas_tiny_for_driver WDRs.

For each flagged file:
  1. Finds the cached PDF in drivers/<collection>/datasheets/
  2. Extracts Vas from the PDF text using pypdf
  3. Converts units (L, dm³, m³, ft³) to m³
  4. If the PDF value differs from the WDR, writes the correction

Run: python scripts/fix-vas-from-pdf.py [--collection <name>] [--dry-run]
"""

import math
import re
import sys
import pathlib
import argparse
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from dq_check import parse_fields, check_fields

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import pypdf
except ImportError:
    sys.exit("pypdf not installed — run: pip install pypdf")

DRIVERS_DIR = pathlib.Path(__file__).parent.parent / "drivers"

# Patterns to find Vas in PDF text, ordered most-specific first.
# Each: (regex, unit, multiplier_to_m3, use_dotall)
# use_dotall=True for multiline table formats where value is far from label.
VAS_PATTERNS = [
    # "Vas = 42.5 liters" / "Vas: 42.5 l"  (with separator)
    (re.compile(r'Vas\s*[=:]\s*([\d.,]+)\s*(liters?|litres?|L\b|dm[³3])', re.I), "L",   1e-3,  False),
    # "Vas 23.7 liters"  (no separator — Dayton Apollo/MX style)
    (re.compile(r'\bVas\s+([\d.,]+)\s+(liters?|litres?)\b',               re.I), "L",   1e-3,  False),
    # "Vas = 0.042 m³" / "Vas 0.042 m3"
    (re.compile(r'Vas\s*[=:]?\s*([\d.,]+)\s*(m[³3])',                     re.I), "m³",  1.0,   False),
    # "Vas = 1.50 ft³" / "Vas 1.50 ft3" / "Vas: 1.50 cu ft"
    (re.compile(r'Vas\s*[=:]\s*([\d.,]+)\s*(ft[³3]|cu\.?\s*ft)',          re.I), "ft³", 0.028317, False),
    # "Vas (L) 42.5" — column header table style
    (re.compile(r'Vas\s*\(L\)\s+([\d.,]+)',                                re.I), "L",   1e-3,  False),
    # "Vas (ft³) 1.50"
    (re.compile(r'Vas\s*\(ft[³3]\)\s+([\d.,]+)',                          re.I), "ft³", 0.028317, False),
    # "Equivalent volume [Vas] 49.4 l"  — Scan-Speak bracket style
    (re.compile(r'Equivalent volume\s*\[Vas\]\s*([\d.,]+)\s*(l\b|liters?|litres?)', re.I), "L", 1e-3, False),
    # "Equivalent volume, Vas ... 54 liters"  — SB Acoustics multiline label-then-value table
    # Labels column printed first, values column follows; find first liters value after the label.
    (re.compile(r'Equivalent volume[,\s]+Vas[\s\S]{1,600}?([\d.,]+)\s+(liters?|litres?)', re.I), "L", 1e-3, True),
    # "Equivalent Air Volume (L) Vas 36.9"  — HiVi / some datasheets
    (re.compile(r'Equivalent Air Volume\s*\(L\)\s*(?:Vas\s+)?([\d.,]+)', re.I), "L", 1e-3, False),
    # "Eq. Cas Air Load (liters) VAS 70 Lt" / "VAS 170 Lit" / "Vas 6.32 Litr"  — Morel/Tang Band style
    (re.compile(r'\bVAS\s+([\d.,]+)\s*(Lit[rs]?\b|Lt\b|liters?|litres?|L\b)',  re.I), "L", 1e-3, False),
    (re.compile(r'\bVas\s+([\d.,]+)\s+(Litr?s?\b)',                             re.I), "L", 1e-3, False),
    # "Equivalent Air Volume (Vas)(L) : 211.2"  — HiVi D10 style
    (re.compile(r'Equivalent Air Volume\s*\(Vas\)\s*\(L\)\s*[:\s]\s*([\d.,]+)', re.I), "L", 1e-3, False),
]

# Convert European number format (1.234,5 or 1,234.5) to float
def to_float(s: str) -> float | None:
    s = s.strip()
    # If both . and , present: whichever comes last is decimal separator
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    elif ',' in s:
        # Comma only — could be decimal (European) or thousands
        parts = s.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            s = s.replace(',', '.')  # treat as decimal
        else:
            s = s.replace(',', '')   # treat as thousands sep
    try:
        return float(s)
    except ValueError:
        return None


def extract_vas_from_pdf(pdf_path: pathlib.Path) -> list[tuple[float, str, str]]:
    """Returns list of (vas_m3, unit, matched_text) — may be empty or multiple."""
    try:
        reader = pypdf.PdfReader(str(pdf_path))
        text = " ".join(p.extract_text() or "" for p in reader.pages)
    except Exception:
        return []

    # Normalize non-breaking spaces so \s patterns match across all PDF encodings
    text = text.replace('\xa0', ' ')

    results = []
    for pattern, unit, mult, dotall in VAS_PATTERNS:
        flags = re.I | (re.DOTALL if dotall else 0)
        for m in re.finditer(pattern.pattern, text, flags):
            val = to_float(m.group(1))
            if val is not None and val > 0:
                results.append((val * mult, unit, m.group(0)[:80].strip()))

    # GRS / Parts Express format: values column precedes labels column in extracted text.
    # Pattern: "X.X liters" appears some chars before "Vas" label appears.
    # Find all liters values, then check if "Vas" appears within next 500 chars.
    if not results:
        for m in re.finditer(r'([\d.,]+)\s+(liters?|litres?)', text, re.I):
            remainder = text[m.end():m.end()+500]
            # Use plain "Vas" search — some PDFs concatenate labels without spaces (BLVasXmax)
            if re.search(r'Vas', remainder, re.I):
                val = to_float(m.group(1))
                if val is not None and val > 0:
                    results.append((val * 1e-3, "L", m.group(0).strip() + " [GRS-style]"))

    return results


def find_cached_pdf(fields: dict, coll_path: pathlib.Path) -> pathlib.Path | None:
    ds_url = fields.get("boxbench_datasheet", "")
    if not ds_url:
        return None
    name = urllib.parse.unquote(ds_url.rstrip("/").split("/")[-1])
    p = coll_path / "datasheets" / name
    return p if p.exists() else None


def update_wdr(wdr_path: pathlib.Path, new_vas_m3: float, note: str, dry_run: bool):
    lines = wdr_path.read_text(encoding="utf-8", errors="replace").splitlines()
    out, found_vas, found_corr = [], False, False
    for line in lines:
        if line.startswith("Vas="):
            out.append(f"Vas={new_vas_m3:.6g}")
            found_vas = True
        elif line.startswith("boxbench_corrections="):
            out.append(line + "; " + note)
            found_corr = True
        else:
            out.append(line)
    if not found_vas:
        out2 = []
        for line in out:
            if line.startswith("ParState="):
                out2.append(f"Vas={new_vas_m3:.6g}")
            out2.append(line)
        out = out2
    if not found_corr:
        out2 = []
        for line in out:
            if line.startswith("ParState="):
                out2.append(f"boxbench_corrections={note}")
            out2.append(line)
        out = out2
    if not dry_run:
        wdr_path.write_text("\n".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--collection")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    fixed = skipped = no_pdf = no_vas = 0

    for coll_path in sorted(DRIVERS_DIR.iterdir()):
        if not coll_path.is_dir():
            continue
        if args.collection and coll_path.name != args.collection:
            continue
        for wdr_path in sorted(coll_path.glob("*.wdr")):
            text = wdr_path.read_text(encoding="utf-8", errors="replace")
            fields = parse_fields(text)
            hits = [h for h in check_fields(fields) if h[0] == "Vas_tiny_for_driver"]
            if not hits:
                continue

            detail = hits[0][2]
            vas_wdr = float(fields.get("Vas", 0))
            label = f"{coll_path.name}/{wdr_path.name}"

            pdf = find_cached_pdf(fields, coll_path)
            if not pdf:
                print(f"NO PDF  {label}  [{detail}]")
                print(f"        ds={fields.get('boxbench_datasheet','(none)')}")
                no_pdf += 1
                continue

            results = extract_vas_from_pdf(pdf)
            if not results:
                print(f"NO VAS  {label}  [{detail}]  pdf={pdf.name}")
                no_vas += 1
                continue

            # Use the first hit; flag if multiple different values found
            vas_m3, unit, matched = results[0]
            ambiguous = len({r[0] for r in results}) > 1

            if ambiguous:
                all_hits = ", ".join(f"{r[2]!r}" for r in results)
                print(f"AMBIG   {label}  pdf={pdf.name}")
                print(f"        hits: {all_hits}")
                skipped += 1
                continue

            vas_L = vas_m3 * 1000
            wdr_L = vas_wdr * 1000

            # If the PDF value matches WDR within 5% → already correct
            if abs(vas_m3 - vas_wdr) / max(vas_m3, 1e-9) < 0.05:
                print(f"OK      {label}  Vas={vas_L:.1f}L matches WDR — no change")
                skipped += 1
                continue

            note = (f"Vas corrected {vas_wdr:.6g}->{vas_m3:.6g} m³ "
                    f"({vas_L:.1f}L); read from {pdf.name}: {matched!r}")
            tag = "[DRY]" if args.dry_run else "FIXED"
            print(f"{tag}   {label}")
            print(f"        {wdr_L:.2f}L → {vas_L:.1f}L  (from {unit}: {matched!r})")
            update_wdr(wdr_path, vas_m3, note, args.dry_run)
            fixed += 1

            if not args.dry_run:
                # Verify fix resolved the DQ flag
                new_fields = parse_fields(wdr_path.read_text(encoding="utf-8", errors="replace"))
                remaining = [h for h in check_fields(new_fields) if h[0] == "Vas_tiny_for_driver"]
                if remaining:
                    print(f"  WARN: Vas_tiny_for_driver still flagged after fix: {remaining[0][2]}")
                else:
                    print(f"  DQ OK: flag cleared")

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Fixed {fixed}, skipped {skipped}, no PDF {no_pdf}, no Vas in PDF {no_vas}")


if __name__ == "__main__":
    main()
