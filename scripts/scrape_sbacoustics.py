#!/usr/bin/env python3
"""
Scrape SB Acoustics product pages → WDR files + PDF datasheets.

Usage:
    python scrape_sbacoustics.py [--out-dir drivers/sb-acoustics] [--limit N] [--refresh]

--refresh   re-scrapes all URLs, not just new ones discovered since last run.
"""

import html as html_module
import re
from pathlib import Path
from scraper_lib import run_scraper, parse_number

VENDOR      = "SB Acoustics"
SITEMAP_URL = "https://sbacoustics.com/product-sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent / "drivers" / "sb-acoustics")

# li label fragment (lowercase) → (wdr_key, SI conversion factor)
FIELD_MAP = {
    "free air resonance":    ("Fs",   1.0),    # Hz
    "total q-factor":        ("Qts",  1.0),
    "electrical q-factor":   ("Qes",  1.0),
    "mechanical q-factor":   ("Qms",  1.0),
    "dc resistance":         ("Re",   1.0),    # Ω
    "voice coil inductance": ("Le",   1e-3),   # mH → H
    "force factor":          ("BL",   1.0),    # T·m — BL not Bl
    "moving mass":           ("Mms",  1e-3),   # g → kg
    "compliance":            ("Cms",  1e-3),   # mm/N → m/N
    "effective piston area": ("Sd",   1e-4),   # cm² → m²
    "equivalent volume":     ("Vas",  1e-3),   # litres → m³
    "linear coil travel":    ("Xmax", 0.5e-3), # mm p-p → m one-way
    "rated power handling":  ("Pe",   1.0),    # W
    "nominal impedance":     ("Znom", 1.0),    # Ω — Znom not Z
}


def parse_product(html: str, url: str) -> dict | None:
    # Product name from <h1>
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    name = m.group(1).strip() if m else url.rstrip("/").split("/")[-1]

    # Detect coaxial driver from URL
    slug = url.rstrip("/").split("/")[-1]
    is_coaxial = bool(re.search(r'-coax[-_]', slug, re.I))

    # T/S params in <li> items: "Label text, Symbol value unit"
    # For coaxial: extract woofer and tweeter specs separately
    li_items = re.findall(r"<li>(.*?)</li>", html, re.S | re.I)
    woofer_fields: dict[str, float] = {}
    tweeter_fields: dict[str, float] = {}
    in_tweeter_section = False

    for li_raw in li_items:
        text = html_module.unescape(re.sub(r"<[^>]+>", "", li_raw)).strip()

        # Detect tweeter section start: second "Nominal Impedance" (after woofer)
        if is_coaxial and text.lower().startswith("nominal impedance") and woofer_fields:
            in_tweeter_section = True

        for fragment, (key, factor) in FIELD_MAP.items():
            if fragment in text.lower():
                val = parse_number(text)
                if val is not None:
                    val_si = round(val * factor, 9)
                    if in_tweeter_section:
                        tweeter_fields[key] = val_si
                    else:
                        # For coaxial: keep first occurrence (prevent tweeter overwriting woofer)
                        if not (is_coaxial and key in woofer_fields):
                            woofer_fields[key] = val_si
                break

    if not woofer_fields.get("Fs"):
        return None

    # Extract model from URL slug (reliable): 8in-sb23nrxs45-8-norex → SB23NRXS45-8
    model_m = re.search(r'(sb\d+[a-z0-9]+-\d+)', slug, re.I)
    model = model_m.group(1).upper() if model_m else name

    # Append -COAX suffix to model name for coaxial drivers
    if is_coaxial:
        model = model + "-COAX"

    # PDF: last .pdf in wp-content/uploads (avoids favicon/image matches)
    pdf_matches = re.findall(
        r'"(https://sbacoustics\.com/wp-content/uploads/[^"]+\.pdf)"', html, re.I)
    pdf_url = pdf_matches[-1] if pdf_matches else None

    # Extra downloadable files (FRD, ZMA, ZIP, TXT)
    extra = re.findall(
        r'"(https://sbacoustics\.com/wp-content/uploads/[^"]+\.(zip|frd|zma|txt))"',
        html, re.I)

    result = {
        "brand":         "SB Acoustics",
        "model":         model,
        "manufacturer":  "SB Acoustics",
        "provided_by":   f"SB Acoustics website (scraped {__import__('datetime').date.today()})",
        "fields":        woofer_fields,
        "pdf_url":       pdf_url,
        "extra_links":   [l[0] for l in extra],
    }

    # For coaxial drivers: add driver_type and tweeter specs to sidecar metadata
    if is_coaxial:
        result["driver_type"] = "coaxial"
        if tweeter_fields:
            result["specs"] = {
                "woofer": {k: v for k, v in woofer_fields.items()},
                "tweeter": tweeter_fields,
            }

    return result


def url_filter(url: str) -> bool:
    return "/product/" in url and "/product-category/" not in url


if __name__ == "__main__":
    run_scraper(VENDOR, SITEMAP_URL, parse_product, OUT_DIR,
                url_filter=url_filter)
