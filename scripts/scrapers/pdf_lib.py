"""
pdf_lib.py — PyMuPDF-based PDF extraction for OpenISD scrapers.

Primary path: fitz native text (deterministic, offline, no Ghostscript needed).
Fallback for scanned/image-only pages: Tesseract OCR via pytesseract (optional).
If OCR deps are absent the page silently returns empty text — callers should
record this in the problem log and continue.

Public API
----------
  extract_text(pdf_path)                        -> list[str]
  extract_images(pdf_path, out_dir)             -> list[Path]
  render_page(pdf_path, page_num, dpi)          -> bytes  (PNG)
  ocr_page(png_bytes)                           -> str
  full_text(pdf_path, ocr_fallback, min_chars)  -> str
  find_ts_fields(text, brand, problems)         -> dict[str, float]  (SI units)
  find_freq_range(text)                         -> tuple[float|None, float|None]
  ocr_available()                               -> bool
"""

from __future__ import annotations

import io as _io
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Optional deps ──────────────────────────────────────────────────────────────

try:
    import fitz  # PyMuPDF
    _FITZ_OK = True
except ImportError:
    _FITZ_OK = False
    fitz = None  # type: ignore[assignment]

try:
    import pytesseract
    from PIL import Image as _PilImage
    _OCR_OK = True
except ImportError:
    _OCR_OK = False

# ── Tesseract location ─────────────────────────────────────────────────────────
# fitz's get_textpage_ocr() calls the Tesseract binary directly.
# On Windows it may not be in PATH even after install — find it explicitly.

import os as _os
import shutil as _shutil

def _find_tesseract() -> Optional[str]:
    """Return path to tesseract.exe, or None if not found."""
    in_path = _shutil.which("tesseract")
    if in_path:
        return in_path
    candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        _os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    ]
    for c in candidates:
        if _os.path.exists(c):
            return c
    return None

_TESSERACT_PATH: Optional[str] = _find_tesseract()

# If found but not in PATH, add its directory so fitz can locate it
if _TESSERACT_PATH and not _shutil.which("tesseract"):
    _tess_dir = str(Path(_TESSERACT_PATH).parent)
    if _tess_dir not in _os.environ.get("PATH", ""):
        _os.environ["PATH"] = _tess_dir + _os.pathsep + _os.environ.get("PATH", "")

# OCR is now done by calling tesseract.exe directly as a subprocess (_ocr_via_subprocess).
# No fitz OCR bridge — no shared TessBaseAPI state, no Leptonica mutex, no import-time
# tesseract probe. _TESSERACT_PATH being set is the only gate.
_FITZ_OCR_OK: bool = False  # kept for compat; not used for OCR decisions


def ocr_available() -> bool:
    """Return True when any OCR path is usable (direct tesseract subprocess or pytesseract+PIL)."""
    return bool(_TESSERACT_PATH) or _OCR_OK


def _printable_ratio(text: str) -> float:
    """Fraction of characters that are normal printable ASCII (space–tilde + newline/tab)."""
    if not text:
        return 0.0
    printable = sum(1 for c in text if 0x20 <= ord(c) <= 0x7E or c in "\n\t\r")
    return printable / len(text)


def _garbage_ratio(text: str) -> float:
    """
    Fraction of characters that are control codes (0x01–0x1F) excluding
    normal whitespace (tab/LF/CR). Type3 font glyph indices appear in this
    range. A genuine spec page should have < 5% garbage; a Type3 garbled
    page typically has 20–50%.
    """
    if not text:
        return 0.0
    garbage = sum(1 for c in text if 0x01 <= ord(c) <= 0x1F and c not in "\t\n\r")
    return garbage / len(text)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


# ── Text extraction ────────────────────────────────────────────────────────────

def extract_text(pdf_path: Path) -> list[str]:
    """
    Extract native text from each page using fitz. Returns one string per page.
    Raises ImportError if PyMuPDF is not installed.
    """
    if not _FITZ_OK:
        raise ImportError("PyMuPDF required: pip install pymupdf")
    doc = fitz.open(str(pdf_path))
    try:
        return [page.get_text("text") or "" for page in doc]
    finally:
        doc.close()


def extract_images(pdf_path: Path, out_dir: Path) -> list[Path]:
    """
    Extract all embedded images from a PDF as individual files.
    Returns paths of the saved images (empty list if no images found).
    """
    if not _FITZ_OK:
        raise ImportError("PyMuPDF required: pip install pymupdf")
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    saved: list[Path] = []
    try:
        for page_num, page in enumerate(doc):
            for img_idx, img_ref in enumerate(page.get_images(full=True)):
                xref = img_ref[0]
                base = doc.extract_image(xref)
                name = f"page{page_num + 1}_img{img_idx + 1}.{base['ext']}"
                path = out_dir / name
                path.write_bytes(base["image"])
                saved.append(path)
    finally:
        doc.close()
    return saved


def render_page(pdf_path: Path, page_num: int = 0, dpi: int = 300) -> bytes:
    """
    Rasterize one PDF page to PNG bytes at the given DPI.
    fitz handles this natively — no Ghostscript or pdf2image dependency.
    """
    if not _FITZ_OK:
        raise ImportError("PyMuPDF required: pip install pymupdf")
    doc = fitz.open(str(pdf_path))
    try:
        page = doc[page_num]
        # fitz native DPI is 72; scale accordingly
        mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        pix = page.get_pixmap(matrix=mat)
        return pix.tobytes("png")
    finally:
        doc.close()


def ocr_page(png_bytes: bytes) -> str:
    """
    Run Tesseract OCR on PNG bytes. Returns '' when pytesseract / PIL are absent.
    Callers should record a problem log entry when this returns empty on a
    page that had no native text either.
    """
    if not _OCR_OK:
        return ""
    img = _PilImage.open(_io.BytesIO(png_bytes))
    return pytesseract.image_to_string(img)


def extract_text_spatial(pdf_path: Path, y_tol: float = 4.0) -> str:
    """
    Column-aware text extraction using bounding boxes.

    Most loudspeaker datasheets use a two-column spec table where labels sit
    in the left column and values in the right. fitz default extraction reads
    column-by-column, separating labels from values. This function groups
    spans by Y coordinate (within y_tol points) and sorts each row by X,
    producing correct reading-order text like:
        "Resonance frequency, Fs  27.4 Hz  Mechanical Q-factor, Qms  5.59"

    Use this when find_ts_fields() returns empty results from full_text().
    """
    if not _FITZ_OK:
        raise ImportError("PyMuPDF required: pip install pymupdf")

    doc = fitz.open(str(pdf_path))
    page_texts: list[str] = []

    try:
        for page in doc:
            raw: list[tuple[float, float, str]] = []  # (y_center, x0, text)
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        t = span["text"]
                        if not t or not t.strip():
                            continue
                        x0, y0, x1, y1 = span["bbox"]
                        raw.append(((y0 + y1) / 2, x0, t))

            raw.sort()  # by (y_center, x0)

            # Greedy row clustering: each new span joins the nearest open row
            # if within y_tol, otherwise starts a new one
            rows: list[tuple[float, list[tuple[float, str]]]] = []
            for y, x, t in raw:
                placed = False
                for i in range(len(rows) - 1, max(len(rows) - 6, -1), -1):
                    if abs(rows[i][0] - y) <= y_tol:
                        rows[i][1].append((x, t))
                        placed = True
                        break
                if not placed:
                    rows.append((y, [(x, t)]))

            # Sort rows by Y, sort spans within each row by X, join
            rows.sort(key=lambda r: r[0])
            lines: list[str] = []
            for _, row_spans in rows:
                row_spans.sort(key=lambda s: s[0])
                line = " ".join(t for _, t in row_spans).strip()
                if line:
                    lines.append(line)

            page_texts.append("\n".join(lines))
    finally:
        doc.close()

    return "\f".join(page_texts)


_GARBAGE_THRESHOLD = 0.10  # >10% control-code chars → suspect Type3 encoding

def _page_needs_ocr(text: str) -> bool:
    """
    Return True when native fitz text is garbled (Type3 custom-encoded fonts
    produce glyph indices — lots of chars but mostly control codes in 0x01–0x1F).

    Uses garbage_ratio (fraction of control codes excluding whitespace) rather
    than total char count, because Type3 pages have many bytes — all garbage.
    A genuine text page has < 5% control codes; a Type3 page typically 20–50%.
    """
    if not text.strip():
        return True
    return _garbage_ratio(text) > _GARBAGE_THRESHOLD


def _ocr_via_subprocess(pdf_path: Path, page_num: int) -> str:
    """
    OCR one page by calling tesseract.exe directly as a subprocess.

    Each call is fully independent — no shared TessBaseAPI, no shared Leptonica.
    Tesseract threading is left at its default; each tesseract.exe subprocess manages
    its own thread pool. Parallelism across drivers comes from the multiprocessing pool
    in scraper_lib.py, not from pinning individual tesseract instances to one thread.

    Flow: fitz renders page → PNG bytes → tempfile → tesseract stdout → text.

    Ref: appliedmachinelearning.wordpress.com/2018/06/30/
         performing-ocr-by-running-parallel-instances-of-tesseract-4-0-python/

    OCR tuning decisions (each decision tested empirically on Scan-Speak Type3 PDFs):

    DPI=300 (not 150, not 450):
      150 DPI: Ω glyph → "2" or "9" (digit) → wrong numeric value, e.g. Znom=42 for 4Ω.
      300 DPI: Ω glyph → "Q" (non-digit) → number parser extracts "4", Znom=4.0 ✓.
      450 DPI: Ω glyph → "9" (digit again!) → Znom=49, fails ≤32Ω range gate.
      600 DPI: Ω glyph → "Q" again (correct) but 2× slower than 300 DPI.
      Source: tesseract-ocr/tessdoc ImproveQuality.md §Rescaling — "at least 300 dpi".

    --oem 1 (LSTM only, not legacy):
      LSTM engine is the modern neural model; legacy engine struggles with unusual glyphs.

    -c load_system_dawg=0 -c load_freq_dawg=0 (dictionaries disabled):
      T/S parameter tables are technical notation, not prose. Dictionary pressure causes
      tesseract to "correct" extracted tokens toward English words, corrupting field values.
      Source: tesseract-ocr/tessdoc ImproveQuality.md §Dictionaries.

    No binarization pre-processing:
      Adding PIL Otsu binarization (threshold=127) caused tesseract to split the two-column
      T/S table into separate blocks — labels on one side, values on the other — losing all
      label-value associations. Raw 300 DPI PNG passed directly works correctly.
      Source: tesseract-ocr/tessdoc ImproveQuality.md §Tables — "tesseract has a problem
      to recognize text/data from tables" when preprocessing alters layout.
    """
    if not _TESSERACT_PATH:
        print(f"WARNING pdf_lib: tesseract not found — OCR skipped for page {page_num} of {pdf_path.name}",
              file=sys.stderr, flush=True)
        return ""
    import subprocess
    import tempfile

    try:
        png_bytes = render_page(pdf_path, page_num, dpi=300)
    except Exception as e:
        print(f"WARNING pdf_lib: render_page failed page {page_num} of {pdf_path.name}: {e}",
              file=sys.stderr, flush=True)
        return ""

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(png_bytes)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [_TESSERACT_PATH, tmp_path, "stdout",
             "-l", "eng", "--oem", "1", "--psm", "3",
             "-c", "load_system_dawg=0", "-c", "load_freq_dawg=0"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=60,
        )
        return result.stdout
    except Exception as e:
        print(f"WARNING pdf_lib: tesseract subprocess failed page {page_num} of {pdf_path.name}: {e}",
              file=sys.stderr, flush=True)
        return ""
    finally:
        try:
            _os.unlink(tmp_path)
        except Exception:
            pass


def full_text(pdf_path: Path, ocr_fallback: bool = True,
              min_native_chars: int = 50) -> str:
    """
    Extract complete document text with automatic garbled-page detection.

    OCR results are cached in a .txt sidecar next to the PDF so that
    repeated shallow scans skip Tesseract entirely.

    For each page:
      1. Extract native fitz text.
      2. If the page has too few printable characters (Type3 glyph-index encoding
         OR truly scanned/image page), attempt OCR:
         a. Direct tesseract subprocess — render page to PNG, call tesseract.exe.
         b. pytesseract fallback — if tesseract binary not found.
      3. Use whichever produces more printable text.

    Pages are joined with form-feed characters ('\\f').
    Requires Tesseract to be installed for OCR to work.
    """
    # Return cached OCR text if available (avoids re-running Tesseract)
    ocr_dir = pdf_path.parent.parent / "_ocr"
    cache_path = ocr_dir / (pdf_path.stem + ".txt")
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8", errors="replace")

    pages = extract_text(pdf_path)
    parts: list[str] = []
    ran_ocr = False
    for page_num, text in enumerate(pages):
        if not ocr_fallback or not _page_needs_ocr(text):
            parts.append(text)
            continue

        ran_ocr = True
        # Path A: direct tesseract subprocess — fully independent per worker process
        ocr_text = _ocr_via_subprocess(pdf_path, page_num)

        # Path B: pytesseract on rasterised PNG (if tesseract not found)
        if not ocr_text.strip() and _OCR_OK:
            png = render_page(pdf_path, page_num)
            ocr_text = ocr_page(png)

        parts.append(ocr_text if ocr_text.strip() else text)

    result = "\f".join(parts)
    # Cache the result so future runs skip Tesseract
    if ran_ocr and result.strip():
        ocr_dir.mkdir(exist_ok=True)
        cache_path.write_text(result, encoding="utf-8")
    return result


# ── T/S parameter extraction ───────────────────────────────────────────────────

def _parse_num(s: str) -> Optional[float]:
    """Parse first number from a string; handles European comma decimal."""
    s = s.strip()
    if "," in s and "." in s:
        s = s.replace(",", "")        # 1,234.5  → 1234.5
    elif "," in s:
        s = s.replace(",", ".")       # 10,9     → 10.9
    m = re.search(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", s)
    return float(m.group()) if m else None


def _resolve_unit(bracket: Optional[str], post: Optional[str]) -> str:
    """
    Combine bracket unit (e.g., 'Hz' from '[Hz]') and post-value unit ('Hz'
    from '38 Hz') into a single normalised lowercase string for factor lookup.
    Normalises Unicode µ → u so μm/N and um/N match the same key.
    """
    raw = (bracket or post or "").strip().lower()
    return raw.replace("μ", "u").replace("µ", "u")


# Brands that publish Xmax as peak-to-peak (need ÷2 to reach one-way WDR value)
_XMAX_PP_BRANDS: frozenset[str] = frozenset({
    "sb acoustics", "sb-acoustics", "seas", "satori",
})


def _xmax_factor(brand: Optional[str]) -> float:
    """Return mm→m conversion factor for Xmax based on brand Xmax convention."""
    if brand and brand.lower().strip() in _XMAX_PP_BRANDS:
        return 0.0005   # peak-to-peak mm → one-way m
    return 0.001        # one-way mm → m  (default, most brands)


# ── Pattern structure ──────────────────────────────────────────────────────────
#
# Each pattern has THREE capturing groups:
#   group(1) — content inside [...] BEFORE the value (bracket unit), or None
#   group(2) — the numeric value (always present, required for a match)
#   group(3) — unit AFTER the value (post unit), or None
#
# This handles both common datasheet layouts:
#   "Fs [Hz] 38"    → bracket='Hz',  value='38', post=None
#   "Fs: 38 Hz"     → bracket=None,  value='38', post='Hz'
#   "Fs 38"         → bracket=None,  value='38', post=None
#
# _SPECS entry: (wdr_key, default_si_factor, unit_map, [patterns...])
#   default_si_factor — factor when no unit found (most common datasheet unit)
#   unit_map — {substring_in_unit: si_factor}; first match wins

_F = re.IGNORECASE | re.MULTILINE

# Shorthand: skip optional bracket before value
_OB = r"(?:\[([^\]]*)\])?"   # optional bracket group → group(1)
_VAL = r"([\d.,]+)"          # numeric value          → group(2)
# optional post-value unit → group(3) is caller-supplied per field


def _pat(before: str, after_unit: str = "") -> re.Pattern:
    """
    Build a 3-group pattern:
      <before> SPACE* [bracket_unit]? SPACE* <value> SPACE* <after_unit>
    """
    return re.compile(
        before + r"\s*" + _OB + r"\s*" + _VAL + r"\s*" + after_unit,
        _F,
    )


_HZ  = r"(\[?(?:kHz|Hz)\]?)?"   # bare or bracket-wrapped: kHz, [kHz], Hz, [Hz]
_OHM = r"(?:Ω|ohm)?"   # non-capturing — units here are implicit/constant
_W   = r"(kW|W)?"
_DB  = r"(?:dB)?"


_SPECS: list[tuple[str, float, dict[str, float], list[re.Pattern]]] = [

    # ── Fs: resonant/free-air frequency ──────────────────────────────────────
    ("Fs", 1.0, {"khz": 1000.0, "hz": 1.0}, [
        _pat(r"(?<![A-Za-z])Fs\b\s*(?:[=:,]\s*)?", _HZ),
        _pat(r"resonan(?:t|ce)\s+freq[a-z]*(?:\s+\w+)?\s*", _HZ),
        _pat(r"free.air\s+resonan[a-z]*\s*", _HZ),
    ]),

    # ── Re: DC resistance ─────────────────────────────────────────────────────
    ("Re", 1.0, {}, [
        _pat(r"(?<![A-Za-z])Re\b\s*(?:[=:,]\s*)?"),
        _pat(r"dc\s+resist[a-z]*\s*"),
        _pat(r"voice.coil\s+resist[a-z]*\s*"),
    ]),

    # ── Qts — total Q ─────────────────────────────────────────────────────────
    ("Qts", 1.0, {}, [
        _pat(r"(?<![A-Za-z])Qts\b\s*(?:[=:,]\s*)?"),
        _pat(r"total\s+q\s+(?:factor|value)?\s*"),
    ]),

    # ── Qes — electrical Q ───────────────────────────────────────────────────
    ("Qes", 1.0, {}, [
        _pat(r"(?<![A-Za-z])Qes\b\s*(?:[=:,]\s*)?"),
        _pat(r"electrical\s+q\s+(?:factor|value)?\s*"),
    ]),

    # ── Qms — mechanical Q ───────────────────────────────────────────────────
    ("Qms", 1.0, {}, [
        _pat(r"(?<![A-Za-z])Qms\b\s*(?:[=:,]\s*)?"),
        _pat(r"mechanical\s+q\s+(?:factor|value)?\s*"),
    ]),

    # ── BL — force factor ─────────────────────────────────────────────────────
    ("BL", 1.0, {}, [
        _pat(r"(?<![A-Za-z])BL\b\s*(?:[=:,]\s*)?"),
        _pat(r"bl\s+product\s*"),
        _pat(r"force\s+factor\s*"),
    ]),

    # ── Mms — moving mass: g→kg default; override if kg in bracket/post ──────
    ("Mms", 0.001, {"kg": 1.0, "g": 0.001}, [
        _pat(r"(?<![A-Za-z])Mms\b\s*(?:[=:,]\s*)?", r"(kg|g)?"),
        _pat(r"(?:moving|oscillating)\s+mass\s*(?:\w+\s*)?", r"(kg|g)?"),
    ]),

    # ── Cms — mechanical compliance: mm/N default; μm/N or m/N if specified ──
    # MN^-1 = MN⁻¹ = mega-newton-inverse = 10⁻⁶ m/N = µm/N.
    # Seen in SoundImports HTML ("1104 Mn-1") and datasheets ("1104 MN^-1").
    # (?:[A-Za-z_]\w*\s*)? skips an optional word between the label and value
    # (e.g. "Cms:" or "compliance Cms 0.71"); starts with [A-Za-z_] so it
    # never consumes leading digits of the numeric value.
    # Cms unit variants seen in PE datasheets (OCR of μm/N):
    #   "uMN"  = μm/N with slash dropped by OCR (Tang Band PDFs: "848.98 uMN")
    #   "uM/N" = μm/N with slash preserved   (HiVi PDFs: "1057uM/N")
    #   "MN"   = μm/N with μ dropped by OCR  (Tang Band W3-1364SA: "1296 MN")
    # "mn" key covers bare "MN" via _resolve_unit lowercasing; "umn" covers "uMN".
    ("Cms", 0.001, {"um/n": 1e-6, "um/": 1e-6, "umn": 1e-6,
                    "mm/n": 0.001, "m/n": 1.0, "mn": 1e-6}, [
        _pat(r"(?<![A-Za-z])Cms\b\s*(?:[=:,]\s*)?",
             r"([μu]m/?N|mm/N|m/N|MN(?:\^?-?1)?)?"),
        _pat(r"(?:mechanical\s+)?compliance\s*(?:[A-Za-z_]\w*\s*)?",
             r"([μu]m/?N|mm/N|m/N|MN(?:\^?-?1)?)?"),
    ]),

    # ── Rms — mechanical resistance: N·s/m = kg/s ────────────────────────────
    ("Rms", 1.0, {}, [
        _pat(r"(?<![A-Za-z])Rms\b\s*(?:[=:,]\s*)?"),
        _pat(r"(?:mechanical\s+)?resist[a-z]*\s+Rms\s*"),
    ]),

    # ── Sd — piston area: cm² default; m² if bracket/post says so ────────────
    # Ribbon datasheets use "Moving area of ribbon: 595 square millimeter" (mm²).
    ("Sd", 1e-4, {"m2": 1.0, "m²": 1.0}, [
        # cm² is the default; m² only when unit explicitly says "m2" (not "cm2")
        _pat(r"(?<![A-Za-z])Sd\b\s*(?:[=:,]\s*)?", r"(m²|m2|cm²|cm2)?"),
        _pat(r"(?:effective\s+)?(?:cone|piston|radiating)\s+(?:\w+\s+)?area\s*",
             r"(m²|m2|cm²|cm2)?"),
        _pat(r"[Mm]oving\s+area\s+of\s+(?:voice\s+coil|ribbon)\s*[:\-]?\s*",
             r"(square\s+millim[a-z]*|mm[²2]|cm[²2])?"),
    ]),

    # ── Vas — equivalent volume: L→m³ default; m³ or mL if unit says so ────────
    # ml/mlit must come before l in the map — "l" is a substring of "[ml]" and
    # would match first if ordered before "ml", giving the wrong 0.001 factor.
    # Wavecor tweeter pages publish Vas in mL ("0.84 [ml]", "7.6 [mlit.]").
    # Vas units: "Litr" seen in Tang Band PDFs ("1.23 Litr"); "L" in HiVi ("0.04L")
    ("Vas", 0.001, {"m3": 1.0, "m³": 1.0, "ml": 1e-6, "mlit": 1e-6,
                    "l": 0.001, "litr": 0.001, "ft": 0.02832}, [
        _pat(r"(?<![A-Za-z])Vas\b\s*(?:[=:,]\s*)?",
             r"(\[?(?:m³|m3|ft³|ft3|mlit\.?|ml|[Ll]itr[a-z]*|L|l)\]?)?"),
        _pat(r"equivalent\s+(?:air\s+)?volume\s*",
             r"(\[?(?:m³|m3|ft³|ft3|mlit\.?|ml|[Ll]itr[a-z]*|L|l)\]?)?"),
    ]),

    # ── Le — voice coil inductance: mH default ────────────────────────────────
    ("Le", 0.001, {"mh": 0.001, " h": 1.0, "[h]": 1.0, "h\b": 1.0}, [
        _pat(r"(?<![A-Za-z])Le\b\s*(?:[=:,]\s*)?", r"(mH|H)?"),
        _pat(r"(?:self\s+|voice.coil\s+)?inductance\s*(?:\w+\s*)?", r"(mH|H)?"),
    ]),

    # ── Xmax — linear excursion: mm default; brand-adjusted in find_ts_fields ─
    # [^0-9\n]* (not [^0-9]*) — stops at newline so the pattern cannot jump across
    # multiple text sections in column-layout PDFs (e.g. Scan-Speak Type3 fonts dump
    # all labels first then all values; [^0-9]* would skip from "Linear excursion" to
    # "520 Hz" — the Fs value — producing Xmax=520mm).
    # (?:[±+]\s*)? handles both "±5 mm" and "+ 5 mm" sign prefixes.
    ("Xmax", 0.001, {"mm": 0.001, "m": 1.0}, [
        _pat(r"(?<![A-Za-z])Xmax\b\s*(?:[=:,]\s*)?(?:[±+]\s*)?", r"(mm|m)?"),
        _pat(r"linear\s+(?:coil\s+travel|excursion)\b[^0-9\n]*(?:[±+]\s*)?",
             r"(mm|m)?"),
    ]),

    # ── Znom — nominal impedance ──────────────────────────────────────────────
    # Scan-Speak column-layout PDFs place the Znom label far from its value; the
    # label match finds Fs=520 Hz as the first number. Range gate (1–64 Ω) rejects
    # implausible values in find_ts_fields().
    ("Znom", 1.0, {}, [
        _pat(r"(?<![A-Za-z])Zn?\b\s*(?:[=:,]\s*)?"),
        _pat(r"nominal\s+imp[a-z]*\s*(?:\w+\s*)?"),
    ]),

    # ── Pe — power handling ───────────────────────────────────────────────────
    # "\*?" handles "Rated power handling* 80 W" (asterisk footnote marker)
    ("Pe", 1.0, {"kw": 1000.0, "w": 1.0}, [
        _pat(r"(?<![A-Za-z])(?:Pe|Pmax)\b\s*(?:[=:,]\s*)?", _W),
        re.compile(r"power\s+(?:handling|rating)\b\s*\*?\s*" + _OB + r"\s*" + _VAL + r"\s*" + _W, _F),
    ]),

    # ── SPL — sensitivity ─────────────────────────────────────────────────────
    # "SPL" as a label is not a T/S parameter — it appears on graph axes.
    # "High Sensitivity" in Key Features boxes produces false matches (e.g. fitz
    # renders "90 dB" as "904B" so "High Sensitivity 904B / 2,83V" → SPL=904).
    # The ^ anchor (MULTILINE) requires "Sensitivity" at line start, which it is
    # in the T/S table but not in "High Sensitivity ..." mid-line.
    ("SPL", 1.0, {}, [
        re.compile(r"^sensitivity\b\s*(?:\([^)]*\))?\s*" + _OB + r"\s*" + _VAL + r"\s*(?:dB)?", _F),
    ]),
]


# Unit map keys that indicate m² (NOT cm²) for Sd — used to un-apply default
_SD_M2_KEYS = {"m2", "m²"}


def find_ts_fields(text: str,
                   brand: Optional[str],
                   problems: list) -> dict[str, float]:
    """
    Extract T/S parameters from datasheet text (fitz native or OCR output).

    Returns {wdr_key: value_in_SI_units}. First clean match per field wins.
    Xmax is corrected for brand-specific peak-to-peak vs one-way convention.

    problems — required list; each range-gate rejection appends a dict:
    {field, extracted_si, raw_str, range_desc, context, pos} so the caller can
    log it via _prob() with the item ID and URL. Pass [] if you need to discard.
    """
    fields: dict[str, float] = {}
    xfactor = _xmax_factor(brand)

    # (field, lo, hi) — SI units; None means no bound on that side.
    _GATES: dict[str, tuple[Optional[float], Optional[float], str]] = {
        "Re":   (0.1,  64.0,  "0.1–64 Ω"),
        "Znom": (1.0,  64.0,  "1–64 Ω"),
        "Vas":  (None, 1.0,   "≤ 1000 L (1.0 m³)"),
        "Qts":  (None, 5.0,   "< 5"),
        "Qes":  (None, 5.0,   "< 5"),
        "Qms":  (None, 50.0,  "< 50"),
        "SPL":  (50.0, 120.0, "50–120 dB"),
    }

    for wdr_key, default_factor, unit_map, patterns in _SPECS:
        if wdr_key in fields:
            continue

        for pat in patterns:
            m = pat.search(text)
            if not m:
                continue

            bracket = m.group(1)  # content of [...] before value, or None
            raw_val = m.group(2)  # numeric string (always present)
            # group(3) exists only when the pattern includes a post-unit group
            try:
                post = m.group(3)
            except IndexError:
                post = None

            val = _parse_num(raw_val)
            if val is None or val <= 0:
                continue

            unit = _resolve_unit(bracket, post)

            # Sd special case: default is cm² (1e-4); override for m² or mm²
            if wdr_key == "Sd":
                unit_norm = (unit or "").replace("²", "2").replace(" ", "").lower()
                if unit_norm.endswith("m2") and not unit_norm.startswith("c"):
                    factor = 1.0      # explicit m²
                elif "mm2" in unit_norm or unit_norm.startswith("squaremilli"):
                    factor = 1e-6     # mm² → m² (ribbon datasheets)
                else:
                    factor = 1e-4     # default cm²
            elif wdr_key == "Xmax":
                # Use brand-adjusted factor when unit is mm (or absent)
                factor = xfactor if (not unit or unit == "mm") else (
                    1.0 if unit == "m" else xfactor
                )
            elif wdr_key == "Le":
                # Explicit "H" (not mH) → factor 1.0; default and mH → 0.001
                factor = 1.0 if unit in (" h", "h", "[h]") and "m" not in unit else 0.001
            else:
                factor = default_factor
                for key, f in unit_map.items():
                    if unit and key in unit:
                        factor = f
                        break

            result = round(val * factor, 9)

            # Physical sanity gates — reject implausible extractions caused by
            # column-layout PDFs or OCR artifacts: OCR drops decimal periods
            # (6.1→61, 16.1→161) and Ω glyph renders as digit 2 (4Ω→42, 8Ω→82).
            # Also catches model-number false positives (e.g. "22W/4851T00" → SPL=22).
            if wdr_key in _GATES:
                lo, hi, range_desc = _GATES[wdr_key]
                failed = (lo is not None and result < lo) or (hi is not None and result > hi)
                if failed:
                    if problems is not None:
                        ctx = text[max(0, m.start() - 30): m.end() + 40].replace("\n", "↵")
                        problems.append({
                            "field":        wdr_key,
                            "extracted_si": result,
                            "raw_str":      raw_val,
                            "range_desc":   range_desc,
                            "context":      ctx,
                            "pos":          m.start(),
                        })
                    continue  # try next pattern for this field

            fields[wdr_key] = result
            break  # first pattern match wins for this field

    return fields


# ── Frequency range extraction ─────────────────────────────────────────────────

# Anchor: a line must contain one of these labels to qualify as a freq range.
# This prevents false positives from "Buzz and Rattle Test: 20 Hz - 20 kHz".
_FREQ_RANGE_LABEL = re.compile(
    r"(?:operating\s+)?freq(?:uency)?\s*(?:range|response\s+range)"
    r"|recommended\s+freq(?:uency)?\s*range"
    r"|usable\s+freq(?:uency)?\s*range",
    re.I,
)

# One or two numbers followed by optional unit; captures (value, unit) per token.
_FREQ_TOKEN = re.compile(r"([\d][.\d,]*)\s*(kHz|khz|KHz|Hz|hz|HZ)?", re.I)
_RANGE_SEP  = re.compile(r"[-–—~]+|(?<!\w)to(?!\w)", re.I)


def _to_hz(raw: str, unit: Optional[str]) -> Optional[float]:
    """Parse a numeric string and apply kHz → Hz scaling if unit says so."""
    clean = raw.replace(",", "")
    try:
        val = float(clean)
    except ValueError:
        return None
    if unit and "k" in unit.lower():
        val *= 1000.0
    return val


def find_freq_range(text: str) -> tuple[Optional[float], Optional[float]]:
    """
    Extract operating frequency range from OCR'd or native PDF text.
    Returns (freq_low_hz, freq_high_hz) in Hz, or (None, None) if not found.

    Requires a qualifying label ("frequency range", "operating frequency range",
    "recommended frequency range") so test-condition lines like
    "Buzz and Rattle Test: 12 V (20 Hz - 20 kHz)" are not picked up.

    Handles per-value units ("3.5 kHz – 20 kHz"), trailing unit ("3500 – 20000 Hz"),
    and bracket unit ("[Hz] 3500 – 20000").

    Sanity check: lo ≥ 1 Hz, hi ≤ 100 kHz, hi > lo × 2.
    """
    lines = text.splitlines()
    # Build search candidates: each line alone, plus label-line joined with
    # the next line (handles OCR output where value wraps to the next line,
    # e.g. "Operating frequency range:\n3500-20000 Hz").
    candidates = []
    for i, line in enumerate(lines):
        candidates.append(line)
        if _FREQ_RANGE_LABEL.search(line) and i + 1 < len(lines):
            candidates.append(line + " " + lines[i + 1])

    for line in candidates:
        if not _FREQ_RANGE_LABEL.search(line):
            continue

        # Collect all (value, unit) tokens on this line
        tokens = _FREQ_TOKEN.findall(line)
        if len(tokens) < 2:
            continue

        # Find the first pair separated by a range separator
        for i in range(len(tokens) - 1):
            val_a, unit_a = tokens[i]
            val_b, unit_b = tokens[i + 1]

            # Check there is a separator between these two token positions
            pos_a = line.index(val_a)
            between = line[pos_a + len(val_a) + len(unit_a):
                           line.index(val_b, pos_a + 1)]
            if not _RANGE_SEP.search(between):
                continue

            # Unit resolution: per-value unit wins; trailing/bracket unit is
            # applied to both if neither has its own unit.
            # Scan-Speak: "[Hz] 3,500 – 20,000" → unit in bracket consumed by
            # token regex before the numbers, so both unit_a/unit_b may be "Hz"
            # from the bracket token. If not, take the trailing unit from the
            # next token after val_b.
            if not unit_a and not unit_b:
                # Look for a unit token right after val_b
                rest = line[line.index(val_b, pos_a + 1) + len(val_b):]
                m = re.match(r"\s*(kHz|khz|Hz|hz)\b", rest, re.I)
                shared_unit = m.group(1) if m else None
                unit_a = unit_b = shared_unit or ""

            lo = _to_hz(val_a, unit_a or unit_b)
            hi = _to_hz(val_b, unit_b or unit_a)

            if lo and hi and lo >= 1 and hi <= 100_000 and hi > lo * 2:
                return (lo, hi)

    return (None, None)
