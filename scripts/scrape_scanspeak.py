#!/usr/bin/env python3
"""
Scrape Scan-Speak product pages → WDR files + PDF datasheets.

Usage:
    python scrape_scanspeak.py [--out-dir drivers/scan-speak] [--limit N] [--refresh]

Sitemap: https://www.scan-speak.dk/sitemap.xml (WooCommerce, 7 sub-sitemaps)
Product URL pattern: https://www.scan-speak.dk/product/{slug}/

NOTE: HTML structure not yet verified. Run with --limit 3 first, inspect
      drivers/scan-speak/_html/ to confirm field labels, then update FIELD_MAP.
"""

import re
from pathlib import Path
from scraper_lib import run_scraper, parse_number

VENDOR      = "Scan-Speak"
SITEMAP_URL = "https://www.scan-speak.dk/sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent / "drivers" / "scan-speak")

# Labels verified from actual scan-speak.dk HTML (2026-06-25).
# Pages show summary T/S only: Fs, Re, Qts, Vas, Sd, Bl, SPL.
# Labels have &nbsp; prefix in the raw cell and a trailing colon.
# Fragment matching on label.lower() (which retains &nbsp; as literal text)
# still works because e.g. "fs:" IS a substring of "&nbsp;&nbsp;fs:".
FIELD_MAP = {
    "fs:":           ("Fs",   1.0),
    "re:":           ("Re",   1.0),
    "qt:":           ("Qts",  1.0),
    "sensitivity:":  ("SPL",  1.0),
    "vas:":          ("Vas",  1e-3),   # ltr → m³
    "sd:":           ("Sd",   1e-4),   # cm² → m²  (site omits the ² glyph but unit is cm²)
    "bl:":           ("BL",   1.0),
}


def parse_product(html: str, url: str) -> dict | None:
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    name = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else url.rstrip("/").split("/")[-1]

    # Scan-Speak uses a two-column <tr><td> table.
    # Labels retain &nbsp; HTML entities (not stripped) and end with ":".
    fields: dict[str, float] = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        if len(cells) < 2:
            continue
        label = re.sub(r"<[^>]+>", "", cells[0]).strip().lower()
        value_text = re.sub(r"<[^>]+>", "", cells[1]).strip()
        for fragment, (key, factor) in FIELD_MAP.items():
            if fragment in label and key not in fields:
                val = parse_number(value_text)
                if val is not None:
                    fields[key] = round(val * factor, 9)
                break

    if not fields.get("Fs"):
        return None

    pdf_matches = re.findall(r'"(https://[^"]+\.pdf)"', html, re.I)
    pdf_url = next((p for p in pdf_matches if "scan-speak" in p.lower()), None)

    extra = re.findall(r'"(https://[^"]+\.(frd|zma|zip|txt))"', html, re.I)

    # Scan-Speak model numbers look like "18W/4531G00" — extract from name or URL slug
    slug = url.rstrip("/").split("/")[-1]
    model = name if name else slug

    return {
        "brand":        "Scan-Speak",
        "model":        model,
        "manufacturer": "Scan-Speak",
        "provided_by":  f"Scan-Speak website (scraped {__import__('datetime').date.today()})",
        "fields":       fields,
        "pdf_url":      pdf_url,
        "extra_links":  [l[0] for l in extra],
    }


def url_filter(url: str) -> bool:
    return "/product/" in url and "/product-category/" not in url


if __name__ == "__main__":
    run_scraper(VENDOR, SITEMAP_URL, parse_product, OUT_DIR,
                url_filter=url_filter)
