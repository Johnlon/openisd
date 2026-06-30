#!/usr/bin/env python3
"""
Scrape SB Acoustics product pages → WDR files + PDF datasheets.

PDF-primary strategy: T/S parameters are extracted from the manufacturer's
datasheet PDF using fitz (PyMuPDF). HTML extraction fills any gaps.
SB Acoustics PDFs use a two-column layout; extract_text_spatial() reconstructs
label+value rows from bounding boxes before pattern matching.

Usage:
    python scrape_sbacoustics.py [--out-dir drivers/sb-acoustics] [--limit N]
                                 [--refresh] [--workers N] [--no-pdf]

Xmax convention: SB Acoustics labels excursion as "Linear coil travel (p-p)"
in millimetres peak-to-peak. pdf_lib applies ×0.0005 (p-p → one-way metres)
when brand="SB Acoustics". HTML map applies the same factor manually.
"""

import html as html_module
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import run_scraper, parse_number, parse_html_li_ts

VENDOR      = "SB Acoustics"
SITEMAP_URL = "https://sbacoustics.com/product-sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent.parent / "drivers" / "sb-acoustics")

# li label fragment (lowercase) → (wdr_key, SI conversion factor)
# Xmax: p-p mm → one-way m  ×0.0005 (SB Acoustics convention)
_HTML_FIELD_MAP = {
    "free air resonance":    ("Fs",   1.0),
    "total q-factor":        ("Qts",  1.0),
    "electrical q-factor":   ("Qes",  1.0),
    "mechanical q-factor":   ("Qms",  1.0),
    "dc resistance":         ("Re",   1.0),
    "voice coil inductance": ("Le",   1e-3),   # mH → H
    "force factor":          ("BL",   1.0),
    "moving mass":           ("Mms",  1e-3),   # g → kg
    "compliance":            ("Cms",  1e-3),   # mm/N → m/N
    "effective piston area": ("Sd",   1e-4),   # cm² → m²
    "equivalent volume":     ("Vas",  1e-3),   # litres → m³
    "linear coil travel":    ("Xmax", 0.5e-3), # p-p mm → one-way m
    "rated power handling":  ("Pe",   1.0),
    "nominal impedance":     ("Znom", 1.0),
    "sensitivity":           ("SPL",  1.0),
}

# Non-T/S specs extracted from HTML li items → extra_specs key names
_EXTRA_SPEC_MAP = {
    "voice coil diameter": "voice_coil_dia_mm",
    "air gap height":      "Hg_mm",
}


def parse_product(html: str, url: str) -> dict | None:
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    name = m.group(1).strip() if m else url.rstrip("/").split("/")[-1]

    fields: dict[str, float] = parse_html_li_ts(html, _HTML_FIELD_MAP)
    # Non-T/S extra specs (voice coil dia, air gap) — still extracted from <li> items.
    extra_specs: dict[str, float] = {}
    for li_raw in re.findall(r"<li>(.*?)</li>", html, re.S | re.I):
        text = html_module.unescape(re.sub(r"<[^>]+>", "", li_raw)).strip()
        tl = text.lower()
        parse_text = re.sub(r"\([^)]*\)", " ", text)
        for fragment, spec_key in _EXTRA_SPEC_MAP.items():
            if fragment in tl:
                val = parse_number(parse_text)
                if val is not None:
                    extra_specs[spec_key] = val
                break

    if not fields.get("Fs"):
        return None

    # Extract model from URL slug: 8in-sb23nrxs45-8-norex → SB23NRXS45-8
    slug = url.rstrip("/").split("/")[-1]
    model_m = re.search(r"(sb\d+[a-z0-9]+-\d+)", slug, re.I)
    model = model_m.group(1).upper() if model_m else name

    pdf_matches = re.findall(
        r'"(https://sbacoustics\.com/wp-content/uploads/[^"]+\.pdf)"', html, re.I)
    pdf_url = pdf_matches[-1] if pdf_matches else None

    # FRD, ZMA, ZIP (often contains FRD/ZMA), TXT measurement files
    extra = re.findall(
        r'"(https://sbacoustics\.com/wp-content/uploads/[^"]+\.(frd|zma|zip|txt))"',
        html, re.I)

    return {
        "brand":        "SB Acoustics",
        "model":        model,
        "manufacturer": "SB Acoustics",
        "provided_by":  "SB Acoustics website",
        "fields":       fields,
        "extra_specs":  extra_specs or None,
        "datasheet_url":  pdf_url,
        "extra_links":  [lnk[0] for lnk in extra],
    }


def _url_filter(url: str) -> bool:
    return "/product/" in url and "/product-category/" not in url


if __name__ == "__main__":
    run_scraper(
        VENDOR, SITEMAP_URL, parse_product, OUT_DIR,
        url_filter=_url_filter,
    )
