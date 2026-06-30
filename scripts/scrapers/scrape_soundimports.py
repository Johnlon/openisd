#!/usr/bin/env python3
"""
Scrape SoundImports (soundimports.eu) product pages → WDR files.

SoundImports is a Lightspeed eCom (Webshopapp) store. Product specs are
rendered server-side in <dt>Label</dt><dd>Value</dd> pairs — no JS needed.
NOTE: SI's HTML is malformed — many <dt> tags have no </dt> closing tag;
the regex below handles both forms with an optional (?:</dt>)?.

Usage (from repo root or scripts/scrapers/):
    python scripts/scrapers/scrape_soundimports.py             # all new products
    python scripts/scrapers/scrape_soundimports.py --limit 5   # test run
    python scripts/scrapers/scrape_soundimports.py --refresh   # re-scrape all

The manifest (drivers/soundimports/manifest.json) tracks scraped URLs so
subsequent runs only fetch pages not yet seen.

Sitemap: https://www.soundimports.eu/en/sitemap.xml — 8000+ URLs covering
woofers, tweeters, midrange, passive radiators, and accessories. Only pages
with a speaker driver article number and Fs are written to WDR.
"""

import html as html_module
import json
from pathlib import Path
import re
import sys
import time

# ── Import new scraper_lib from this directory ────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import run_scraper, parse_number, fetch, match_ts_fields, extract_h1, extract_measurement_links, parse_freq_range_str

VENDOR      = "SoundImports"
SITEMAP_URL = "https://www.soundimports.eu/en/sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent.parent / "drivers" / "soundimports")
BASE        = "https://www.soundimports.eu"

# Driver category pages (verified from /en/audio-components/ on 2026-06-24).
# Each URL is the "View all" parent page that includes all subcategories.
# Excluded: Exciters, Bass shakers, Plate amplifiers, Amplifier modules,
#           Single board computers — these have no T/S parameters.
DRIVER_CATEGORIES = [
    f"{BASE}/en/audio-components/woofers/",   # full-range, sub, bass-mid, mid, coaxial, PR
    f"{BASE}/en/audio-components/tweeters/",  # dome, ring-rad, AMT, horn, planar, ribbon, etc.
]
DELAY_S = 0.1

# <dt> label substring (lowercase) → (wdr_key, SI conversion factor)
# Verified against: SB Acoustics SB20FRPC30-8, Purifi PTT5.25X08-NFA-01,
#                   SEAS W18NX003 (2026-06-24).
# Vas: SI publishes in litres → ÷1000 → m³.
# Xmax: SI publishes one-way mm → ÷1000 → m.
# Rms: SI publishes in kg/s — already SI, factor 1.0.
FIELD_MAP = {
    "resonant frequency":             ("Fs",   1.0),    # Hz
    "total q":                        ("Qts",  1.0),
    "electromagnetic q":              ("Qes",  1.0),
    "mechanical q":                   ("Qms",  1.0),
    "dc resistance":                  ("Re",   1.0),    # Ω
    "voice coil inductance":          ("Le",   1e-3),   # mH → H
    "bl product":                     ("BL",   1.0),    # T·m
    "diaphragm mass":                 ("Mms",  1e-3),   # g → kg
    "mechanical compliance":          ("Cms",  1e-3),   # mm/N → m/N
    "surface area of cone":           ("Sd",   1e-4),   # cm² → m²
    "compliance equivalent volume":   ("Vas",  1e-3),   # litres → m³
    "maximum linear excursion":       ("Xmax", 1e-3),   # mm one-way → m
    "mechanical losses":              ("Rms",  1.0),    # kg/s (already SI)
    "power handling":                 ("Pe",   1.0),    # W
    "impedance":                      ("Znom", 1.0),    # Ω — matches "Impedance (Z)"
}


def _collect_urls() -> list[str]:
    """
    Paginate through each driver category listing page and return all product URLs.
    SI pagination: page 1 = /en/audio-components/woofers/
                   page N = /en/audio-components/woofers/pageN.html
    Product links are absolute: href="https://www.soundimports.eu/en/brand-model.html"
    """
    seen: set[str] = set()
    urls: list[str] = []

    for cat_url in DRIVER_CATEGORIES:
        page = 1
        while True:
            url = cat_url if page == 1 else f"{cat_url.rstrip('/')}page{page}.html"
            try:
                html = fetch(url)
            except Exception as e:
                print(f"  [SI] WARN: could not fetch {url}: {e}")
                break

            skip = ("/audio-components/", "/brands/", "/blogs/", "/service/",
                    "/collections/", "/page", "/cart", "/checkout")
            for m in re.finditer(
                r'href="(https://www\.soundimports\.eu/en/[a-z0-9][a-z0-9._\-]+\.html)"',
                html, re.I
            ):
                link = m.group(1)
                if not any(s in link for s in skip) and link not in seen:
                    seen.add(link)
                    urls.append(link)

            page_nums = [int(m) for m in re.findall(
                r'soundimports\.eu/en/audio-components/[^"]+?page(\d+)\.html', html
            )]
            last_page = max(page_nums) if page_nums else 1

            print(f"  [SI] {cat_url.split('/')[-2]}: page {page}/{last_page} "
                  f"({len(urls)} total so far)")
            if page >= last_page:
                break
            page += 1
            time.sleep(DELAY_S * 0.5)

    return urls


def _extract_specs(html: str) -> dict[str, str]:
    """
    Extract <dt>Label</dt><dd>Value</dd> pairs.
    Handles SI's malformed HTML where many <dt> tags lack a closing </dt>.
    Also decodes HTML entities in both label and value.
    """
    specs: dict[str, str] = {}
    pattern = re.compile(
        r"<dt[^>]*>([\s\S]*?)(?:</dt>)?\s*<dd[^>]*>([\s\S]*?)</dd>", re.I
    )
    for m in pattern.finditer(html):
        label = html_module.unescape(
            re.sub(r"<[^>]+>", "", m.group(1))
        ).replace("\xa0", " ").strip()
        value = html_module.unescape(
            re.sub(r"<[^>]+>", "", m.group(2))
        ).replace("\xa0", " ").strip()
        if label and value:
            specs[label] = value
    return specs


def _extract_category(html: str) -> str:
    """
    Extract product category from JSON-LD BreadcrumbList (position 3).
    Example: position 3 = {"name": "Tweeters"} → "Tweeters".
    Falls back to "Show all <Category>" link text if JSON-LD is absent.
    Verified against SI tweeter page (2026-06-24): position 2 = Audio components,
    position 3 = Tweeters.
    """
    m = re.search(
        r'"position"\s*:\s*3\s*,\s*"item"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"',
        html, re.S
    )
    if m:
        return m.group(1)
    m = re.search(r"Show all ([A-Z][a-zA-Z &/\-]+)", html)
    if m:
        return m.group(1).strip()
    return ""


def parse_product(html: str, url: str) -> dict | None:
    category = _extract_category(html)
    specs_raw = _extract_specs(html)

    model = (specs_raw.get("Article number")
             or specs_raw.get("Article Number")
             or specs_raw.get("Artikelnummer")
             or "").strip()
    if not model:
        return None

    h1_text = extract_h1(html)

    if model in h1_text:
        brand = h1_text[:h1_text.index(model)].strip()
    else:
        slug = url.rstrip("/").split("/")[-1].replace(".html", "")
        model_slug = re.sub(r"[^a-z0-9]", "-", model.lower())
        brand_slug = re.sub(re.escape(model_slug) + r".*$", "", slug).strip("-")
        brand = " ".join(w.capitalize() for w in brand_slug.split("-"))

    if not brand:
        return None

    # Map labels → WDR fields with SI conversions.
    # Some brands publish Mms in kg, Cms in µm/N, or Sd in m² rather than
    # the assumed g/mm·N⁻¹/cm² — detect the unit in the value string and
    # override the default conversion factor where needed.
    fields: dict[str, float] = match_ts_fields(specs_raw, FIELD_MAP)

    if not fields.get("Fs"):
        return None

    # Non-T/S extra specs from the same dt/dd table
    extra_specs: dict = {}
    for label, value_str in specs_raw.items():
        ll = label.lower()
        v = value_str.lower()
        if "sensitivity" in ll and "db" in v:
            n = parse_number(value_str)
            if n is not None:
                extra_specs["sensitivity_db"] = n
        elif "power handling" in ll and "rms" in ll:
            n = parse_number(value_str)
            if n is not None:
                extra_specs["power_rms_W"] = n
        elif "power handling" in ll and "max" in ll:
            n = parse_number(value_str)
            if n is not None:
                extra_specs["power_peak_W"] = n
        elif "frequency response" in ll or "frequency range" in ll:
            lo, hi = parse_freq_range_str(value_str)
            if lo is not None:
                extra_specs.setdefault("freq_low_hz", lo)
            if hi is not None:
                extra_specs.setdefault("freq_high_hz", hi)
        elif "voice coil diameter" in ll:
            # May be in inches ("1\"") or mm; only capture mm values
            if "mm" in v:
                n = parse_number(value_str)
                if n is not None:
                    extra_specs["voice_coil_dia_mm"] = n
        elif "weight" in ll and "kg" in v:
            n = parse_number(value_str)
            if n is not None:
                extra_specs["weight_kg"] = n

    pdf_matches = re.findall(r'"(https?://[^"]+\.pdf)"', html, re.I)
    pdf_url = pdf_matches[0] if pdf_matches else None

    return {
        "brand":        brand,
        "model":        model,
        "manufacturer": brand,
        "provided_by":  "SoundImports (scraped via soundimports.eu)",
        "fields":       fields,
        "extra_specs":  extra_specs or None,
        "datasheet_url":  pdf_url,
        "extra_links":  extract_measurement_links(html),
    }


def url_filter(url: str) -> bool:
    """
    Fast pre-filter applied before fetching any page.
    Drops navigation/service pages (no HTTP fetch needed).
    Brand-slug exclusions (e.g. 'audyn-', 'arylic-') are maintained in
    drivers/soundimports/excluded_brands.json — generated by build_exclusions.py
    after a full scan so future runs skip known-accessory brands instantly.
    """
    if not url.endswith(".html"):
        return False
    skip_paths = ("/audio-components/", "/brands/", "/blogs/", "/service/",
                  "/collections/", "/page", "/sitemap", "/cart", "/checkout")
    if any(s in url for s in skip_paths):
        return False
    slug = url.rstrip("/").split("/")[-1]
    for prefix in _EXCLUDED_SLUG_PREFIXES:
        if slug.startswith(prefix):
            return False
    return True


_excl_path = (
    Path(__file__).parent.parent.parent / "drivers" / "soundimports" / "excluded_brands.json"
)
_EXCLUDED_SLUG_PREFIXES: list[str] = (
    json.loads(_excl_path.read_text(encoding="utf-8")) if _excl_path.exists() else []
)


if __name__ == "__main__":
    if "--categories-only" in sys.argv:
        sys.argv.remove("--categories-only")
        url_source = _collect_urls
    else:
        url_source = SITEMAP_URL
    run_scraper(VENDOR, url_source, parse_product, OUT_DIR,
                url_filter=url_filter, delay_s=DELAY_S, is_manufacturer_site=False)
