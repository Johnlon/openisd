#!/usr/bin/env python3
"""
Scrape Scan-Speak product pages → WDR files + PDF datasheets.

PDF-primary strategy: T/S parameters are extracted from the manufacturer's
datasheet PDF using fitz. HTML extraction fills any gaps (Scan-Speak HTML
carries only a subset of parameters: Fs, Re, Qts, Vas, Sd, BL, SPL).

Usage:
    python scrape_scanspeak.py [--out-dir drivers/scan-speak] [--limit N]
                               [--refresh] [--workers N] [--no-pdf]

Xmax convention: Scan-Speak labels excursion as "Linear excursion ±X mm"
(one-way). Factor: × 0.001 (no halving needed). Source: SCRAPING_RULES.md.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import run_scraper, parse_number, parse_html_table_ts, extract_h1, extract_measurement_links, woocommerce_url_filter

VENDOR      = "Scan-Speak"
SITEMAP_URL = "https://www.scan-speak.dk/sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent.parent / "drivers" / "scan-speak")

# Explicit map from Scan-Speak "Product Categories" labels (lowercased) to canonical
# driver_type values. Using raw value_text.lower() would silently produce unrecognised
# strings (e.g. "midwoofer, automotive") that classifyTypes() cannot handle.
_SS_CATEGORY_MAP: dict[str, str] = {
    "tweeter":    "tweeter",
    "midrange":   "midrange",
    "woofer":     "woofer",
    "subwoofer":  "subwoofer",
    "midwoofer":  "midwoofer",   # Scan-Speak term for mid-bass cone drivers
    "fullrange":  "fullrange",
    "full-range": "fullrange",
    "full range": "fullrange",
    "passive radiator": "pr",
    "coaxial":    "coaxial",
    "coax":       "coaxial",
}

# HTML field map — Scan-Speak product pages carry a summary T/S table.
# Labels use &nbsp; prefix and a trailing colon; match on lower-cased fragment.
# Units and SI conversion factors for HTML-sourced values:
_HTML_FIELD_MAP = {
    "fs:":          ("Fs",   1.0),
    "re:":          ("Re",   1.0),
    "qt:":          ("Qts",  1.0),     # "Qt:" is how Scan-Speak labels Qts in HTML
    "sensitivity:": ("SPL",  1.0),
    "vas:":         ("Vas",  1e-3),    # litres → m³
    "sd:":          ("Sd",   1e-4),    # cm² → m²  (site omits ² glyph)
    "bl:":          ("BL",   1.0),
}


def parse_product(html: str, url: str) -> dict | None:
    """
    Extract product data from a Scan-Speak product page.
    Returns None for non-product pages (categories, etc.).
    Returns a dict with HTML-extracted fields; the runner supplements with PDF.
    """
    name = extract_h1(html, fallback=url.rstrip("/").split("/")[-1])

    # Scan-Speak uses a two-column <tr><td> spec table for T/S data and metadata.
    # T/S extraction via shared helper; metadata rows extracted separately.
    fields: dict[str, float] = parse_html_table_ts(html, _HTML_FIELD_MAP)
    driver_type    = ""   # from "Product Categories" row
    series         = ""   # from "Product Families" row
    nominal_size_cm: float | None = None  # from "Size:" row

    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        if len(cells) < 2:
            continue
        label = re.sub(r"<[^>]+>", "", cells[0]).replace("&nbsp;", "").strip().lower()
        value_text = re.sub(r"<[^>]+>", "", cells[1]).replace("&nbsp;", "").strip()
        if "product categories" in label:
            # Use explicit map — raw value_text.lower() can produce compound strings like
            # "midwoofer, automotive" that classifyTypes() cannot handle.
            raw = value_text.split(",")[0].strip().lower()
            driver_type = _SS_CATEGORY_MAP.get(raw, raw)
        elif "product families" in label:
            series = value_text
        elif label.startswith("size"):
            val = parse_number(value_text)
            if val is not None:
                nominal_size_cm = val

    # Require at minimum Fs from HTML (confirms this is a driver page)
    if not fields.get("Fs"):
        return None

    # PDF datasheet URL — priority: /datasheet/pdf/ > /datasheet/adv/ > /datasheet/DIY/ > /datasheet/reviews/
    # Reviews (Voice Coil, Car HiFi) and DIY docs appear first in the HTML but contain no T/S table.
    pdf_matches = re.findall(r'"(https://[^"]+\.pdf)"', html, re.I)
    ss_pdfs = [p for p in pdf_matches if "scan-speak" in p.lower()]
    pdf_url = (
        next((p for p in ss_pdfs if "/datasheet/pdf/" in p.lower()), None)
        or next((p for p in ss_pdfs if "/datasheet/adv/" in p.lower()), None)
        or next((p for p in ss_pdfs if "/datasheet/diy/" in p.lower()), None)
        or next((p for p in ss_pdfs), None)
    )

    # Advanced parameters PDF (/datasheet/adv/) — extended motor model params
    # (Le, Re, Leb, Ke, Rss, Bl, Mms, Cms, Ams, Rms). Collected for completeness;
    # extraction of Leb/Ke/Rss/Ams requires WDR schema additions before use.
    adv_datasheet_url = next((p for p in ss_pdfs if "/datasheet/adv/" in p.lower()), None)

    # Dimensional drawing PNG (/datasheet/drw/) — mechanical outline with physical dimensions.
    all_links = re.findall(r'"(https://[^"]+)"', html, re.I)
    drawing_url = next(
        (u for u in all_links if "/datasheet/drw/" in u.lower() and u.lower().endswith(".png")),
        None
    )

    # CAD zip (/datasheet/3d/) — STEP/IGS inside, minable for physical dimensions.
    cad_url = next(
        (u for u in all_links if "/datasheet/3d/" in u.lower()
         and u.lower().endswith((".zip", ".step", ".stp", ".igs"))),
        None
    )

    # FRD, ZMA, ZIP measurement files — exclude /datasheet/3d/ (handled above as cad_url)
    # and /wp-content/ (product photos, button icons).
    extra_links = extract_measurement_links(
        html,
        url_filter=lambda u: "/datasheet/3d/" not in u.lower() and "/wp-content/" not in u.lower(),
    )

    return {
        "brand":            "Scan-Speak",
        "model":            name,
        "manufacturer":     "Scan-Speak",
        "provided_by":      "Scan-Speak website",
        "fields":           fields,
        "driver_type":      driver_type,       # "tweeter" / "midrange" / "woofer" / ""
        "series":           series,            # "Discovery" / "Revelator" / "Ellipticor" / ""
        "nominal_size_cm":  nominal_size_cm,   # cone diameter in cm per manufacturer label
        "datasheet_url":      pdf_url,
        "adv_datasheet_url":  adv_datasheet_url,
        "drawing_url":      drawing_url,
        "cad_url":          cad_url,
        "extra_links":      extra_links,
        # Model name comes from the <h1> on scan-speak.dk, which already uses "/" correctly
        # (e.g. "18WE/4542T00"). No PDF override needed — the HTML title is authoritative.
    }


if __name__ == "__main__":
    run_scraper(
        VENDOR, SITEMAP_URL, parse_product, OUT_DIR,
        url_filter=woocommerce_url_filter,
        html_wins=True,   # scan-speak.dk HTML is authoritative; OCR drops decimal points on some values (6.1→61, 16.1→161)
    )
