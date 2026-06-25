#!/usr/bin/env python3
"""
Scrape Wavecor product pages → WDR files + PDF datasheets + SPL/impedance TXT files.

Usage:
    python scrape_wavecor.py [--out-dir drivers/wavecor] [--limit N] [--refresh]

URL patterns (verified 2026-06-24):
  HTML:  http://www.wavecor.com/html/{model}.html
  PDF:   https://www.wavecor.com/Driver%20specifications%20PDF/{MODEL}_specifications.pdf
  SPL:   https://www.wavecor.com/Driver%20measurements%20TXT/SPL%20response/{MODEL}_SPL_response.txt
  Imp:   https://www.wavecor.com/Driver%20measurements%20TXT/Impedance%20response/{MODEL}_impedance_response.txt

Note: sitemap TXT entries use %20 in filenames — incorrect. Working URLs use underscores.
"""

import re
import urllib.parse
from scraper_lib import run_scraper, parse_number, fetch_binary
from pathlib import Path

VENDOR      = "Wavecor"
SITEMAP_URL = "http://www.wavecor.com/sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent / "drivers" / "wavecor")

# HTML table label fragments (lowercase) → (wdr_key, SI factor).
# Verified against actual wavecor.com HTML (2026-06-25).
# Wavecor uses two table layouts:
#   - Single-model pages: [label, value, unit]  (3 cols)
#   - Multi-model pages:  [notes, label, v1_before, v1_after, v2_before, v2_after, unit] (7 cols)
# The parser detects which format is in use and reads label/value accordingly.
FIELD_MAP = {
    "resonance frequency":    ("Fs",   1.0),    # Hz
    "total q":                ("Qts",  1.0),
    "electrical q":           ("Qes",  1.0),
    "mechanical q":           ("Qms",  1.0),
    "voice coil resistance":  ("Re",   1.0),    # "Voice coil resistance, RDC"
    "voice coil inductance":  ("Le",   1e-3),   # mH → H
    "force factor":           ("BL",   1.0),    # "Force factor, Bxl" — T·m
    "moving mass":            ("Mms",  1e-3),   # g → kg
    "suspension compliance":  ("Cms",  1e-3),   # mm/N → m/N  "Suspension compliance, Cms"
    "effective radiating":    ("Sd",   1e-4),   # cm² → m²  "Effective radiating area, Sd"
    "equivalent air volume":  ("Vas",  1e-3),   # lit. → m³  "Equivalent air volume, Vas"
    "linear motor stroke":    ("Xmax", 1e-3),   # mm one-way → m  "+/-X mm"
    "power handling":         ("Pe",   1.0),    # W (first match = continuous)
    "nominal impedance":      ("Znom", 1.0),    # Ω
}


def _model_from_url(url: str) -> str:
    """Extract model string from URL, e.g. wf146wa01_02 → WF146WA01_02"""
    slug = url.rstrip("/").split("/")[-1]
    slug = re.sub(r"\.html$", "", slug, flags=re.I)
    return slug.upper()


def parse_product(html: str, url: str) -> dict | None:
    # Product name from <title> or <h1>
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not m:
        m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    name = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else _model_from_url(url)

    # T/S params: Wavecor uses two table layouts depending on the page.
    # Single-model: [label, value, unit] (3 cols) — label in cells[0], value in cells[1]
    # Multi-model:  [notes, label, v1_before, v1_after, v2_before, ...] (>=5 cols)
    #               — label in cells[1], value in cells[2] (first model, before burn-in)
    html_rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)
    fields: dict[str, float] = {}
    for row in html_rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S | re.I)
        if len(cells) < 2:
            continue
        if len(cells) >= 5:
            label_cell, value_cell = cells[1], cells[2]   # multi-model layout
        else:
            label_cell, value_cell = cells[0], cells[1]   # single-model layout
        label = re.sub(r"<[^>]+>", "", label_cell).strip().lower()
        value_text = re.sub(r"<[^>]+>", "", value_cell).strip()
        for fragment, (key, factor) in FIELD_MAP.items():
            if fragment in label and key not in fields:
                val = parse_number(value_text)
                if val is not None:
                    fields[key] = abs(round(val * factor, 9))  # abs() handles "+/-X" Xmax
                break

    if not fields.get("Fs"):
        return None

    model = _model_from_url(url)

    # PDF datasheet URL (HTTPS, underscores in filename)
    pdf_url = (f"https://www.wavecor.com/Driver%20specifications%20PDF/"
               f"{model}_specifications.pdf")

    # Measurement TXT files (directory uses %20, filename uses underscores)
    spl_url = (f"https://www.wavecor.com/Driver%20measurements%20TXT/"
               f"SPL%20response/{model}_SPL_response.txt")
    imp_url = (f"https://www.wavecor.com/Driver%20measurements%20TXT/"
               f"Impedance%20response/{model}_impedance_response.txt")

    return {
        "brand":          "Wavecor",
        "model":          model,
        "manufacturer":   "Wavecor",
        "provided_by":    f"Wavecor website (scraped {__import__('datetime').date.today()})",
        "fields":         fields,
        "pdf_url":        pdf_url,
        "frd_url":        spl_url,
        "impedance_url":  imp_url,
    }


def url_filter(url: str) -> bool:
    return "/html/" in url and url.endswith(".html")


if __name__ == "__main__":
    run_scraper(VENDOR, SITEMAP_URL, parse_product, OUT_DIR,
                url_filter=url_filter)
