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

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import (
    run_scraper, parse_number, parse_html_li_ts, extract_li_specs, match_ts_fields,
    extract_h1, extract_measurement_links, woocommerce_url_filter,
)

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

# Non-T/S specs extracted from HTML li items — same format as _HTML_FIELD_MAP so
# match_ts_fields can process them; factor=1.0 (values are in mm already).
_EXTRA_SPEC_MAP = {
    "voice coil diameter": ("voice_coil_dia_mm", 1.0),
    "air gap height":      ("Hg_mm", 1.0),
}


def parse_product(html: str, url: str) -> dict | None:
    name = extract_h1(html, fallback=url.rstrip("/").split("/")[-1])

    li_specs = extract_li_specs(html)
    fields: dict[str, float] = match_ts_fields(li_specs, _HTML_FIELD_MAP)
    extra_specs: dict[str, float] = match_ts_fields(li_specs, _EXTRA_SPEC_MAP)

    if not fields.get("Fs"):
        return None

    # Extract model from URL slug: 8in-sb23nrxs45-8-norex → SB23NRXS45-8
    slug = url.rstrip("/").split("/")[-1]
    model_m = re.search(r"(sb\d+[a-z0-9]+-\d+)", slug, re.I)
    model = model_m.group(1).upper() if model_m else name

    pdf_matches = re.findall(
        r'"(https://sbacoustics\.com/wp-content/uploads/[^"]+\.pdf)"', html, re.I)
    pdf_url = pdf_matches[-1] if pdf_matches else None

    extra_links = extract_measurement_links(
        html,
        url_filter=lambda u: "sbacoustics.com/wp-content/uploads/" in u,
    )

    return {
        "brand":        "SB Acoustics",
        "model":        model,
        "manufacturer": "SB Acoustics",
        "provided_by":  "SB Acoustics website",
        "fields":       fields,
        "extra_specs":  extra_specs or None,
        "datasheet_url":  pdf_url,
        "extra_links":  extra_links,
    }


if __name__ == "__main__":
    run_scraper(
        VENDOR, SITEMAP_URL, parse_product, OUT_DIR,
        url_filter=woocommerce_url_filter,
    )
