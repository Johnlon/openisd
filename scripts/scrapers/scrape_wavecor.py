#!/usr/bin/env python3
"""
Scrape Wavecor product pages → WDR files + PDF datasheets + SPL/impedance TXT files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STANDALONE OPERATION — no AI interaction required or expected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This scraper is designed to run unattended on a server (cron, CI, etc.).
All parsing rules, field maps, split configs, and DQ checks are encoded
here and in scraper_lib.py. A human should only need to edit this file
when:
  1. Wavecor changes their HTML table layout — update FIELD_MAP or
     the cell-selection logic in _parse_html_fields().
  2. A dual-model page needs per-variant WDRs — add an entry to
     SPLIT_PAGES (see section below and the WF259 example).
  3. A new DQ rule is needed — update scripts/dq_check.py.

Normal full scrape:
    python scripts/scrapers/scrape_wavecor.py --refresh

Re-parse cached HTML only (no network — use after FIELD_MAP changes):
    python scripts/scrapers/scrape_wavecor.py --refresh --cache-html-dir drivers/wavecor/_html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DUAL-MODEL PAGES — automated split workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wavecor publishes two impedance variants (e.g. 4 Ω / 8 Ω) on one page.
The main parser always takes the FIRST value column and creates one WDR.

For pages where both variants need separate WDRs (different Re, BL, etc.):
  1. Add an entry to SPLIT_PAGES below — this is the only human step.
  2. Re-run the scraper. _process_splits() generates the per-variant WDRs
     and meta files automatically. No manual file creation.

Column index (col_idx) meanings:
  col_idx=0 → first  data column in the HTML table (cells[2])
  col_idx=1 → second data column (cells[3] for 5-col rows,
                                   cells[4] for 7-col before/after rows)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL patterns (verified 2026-06-24):
  HTML:  http://www.wavecor.com/html/{model}.html
  PDF:   https://www.wavecor.com/{MODEL}_specifications.pdf  (root; template fallback)
  SPL:   https://www.wavecor.com/{MODEL}_SPL_response.txt   (root; template fallback)
  Imp:   https://www.wavecor.com/{MODEL}_impedance_response.txt  (root; template fallback)
  Assets resolved from HTML links first; templates used when no link found in page.
  SPL:   https://www.wavecor.com/Driver%20measurements%20TXT/SPL%20response/{MODEL}_SPL_response.txt
  Imp:   https://www.wavecor.com/Driver%20measurements%20TXT/Impedance%20response/{MODEL}_impedance_response.txt

Note: sitemap TXT entries use %20 in filenames — incorrect. Working URLs use underscores.
"""

import html as _html_mod
import re
import sys
import urllib.parse
from datetime import date, datetime
from pathlib import Path

# ── Import new scraper_lib from this directory ────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import (
    run_scraper, parse_number, fetch, to_wdr, safe_filename,
    write_driver, match_ts_fields,
)

VENDOR      = "Wavecor"
SITEMAP_URL = "http://www.wavecor.com/sitemap.xml"
OUT_DIR     = str(Path(__file__).resolve().parent.parent.parent / "drivers" / "wavecor")

# HTML table label fragments (lowercase) → (wdr_key, SI factor).
# Verified against actual wavecor.com HTML (2026-06-25).
# Wavecor uses three table layouts:
#   3-col (old pages):   [label, value, unit]
#   4-col (single val):  [notes, label, value, unit]
#   5-col (2 variants):  [notes, label, v0, v1, unit]
#   7-col (2 variants with before/after burn-in):
#                        [notes, label, v0_before, v0_after, v1_before, v1_after, unit]
# _parse_html_fields() selects the correct column via col_idx.
FIELD_MAP = {
    "resonance frequency":    ("Fs",   1.0),    # Hz
    "total q":                ("Qts",  1.0),
    "electrical q":           ("Qes",  1.0),
    "mechanical q":           ("Qms",  1.0),
    "voice coil resistance":  ("Re",   1.0),    # "Voice coil resistance, RDC"
    "voice coil inductance":  ("Le",   1e-3),   # mH → H
    "force factor":           ("BL",   1.0),    # "Force factor, Bxl" — T·m
    "moving mass":            ("Mms",  1e-3),   # g → kg
    "suspension compliance":  ("Cms",  1e-3),   # mm/N → m/N
    "effective radiating":    ("Sd",   1e-4),   # cm² → m²
    "equivalent air volume":  ("Vas",  1e-3),   # lit. → m³
    "linear motor stroke":    ("Xmax", 1e-3),   # mm one-way → m  (active drivers)
    "maximum cone travel":    ("Xmax", 1e-3),   # mm one-way → m  (PR pages)
    "mechanical resistance":  ("Rms",  1.0),    # Ns/m  (PA/pro models)
    "power handling":         ("Pe",   1.0),    # W (first match = continuous)
    "nominal impedance":      ("Znom", 1.0),    # Ω
    "sensitivity":            ("SPL",  1.0),    # dB (2.83V/1m)
}

# Pages that require per-variant WDR files instead of a single combined WDR.
# The main parser returns None for these URLs; _process_splits() handles them.
# To add a split: add the URL + variants config here and re-run --refresh.
#
# variants list: each entry produces one WDR file.
#   model       — WDR model name (used in filename and [Driver] section)
#   col_idx     — which data column to read (0 = first/left, 1 = second/right)
#   note        — brief human-readable description of this variant
#   discontinued— set True if the product is end-of-life
#   corrections — provenance note written into the _meta.yml corrections field
#   dq_issue    — known DQ flag with explanation (or None)
SPLIT_PAGES = {
    "http://www.wavecor.com/html/wf259pa01_02.html": {
        "datasheet_url": "https://www.wavecor.com/WF259PA01_02_specifications.pdf",
        "reason": "significantly different Re/BL/sensitivity per impedance variant; discontinued",
        "variants": [
            {
                "model":        "WF259PA02",
                "col_idx":      0,
                "note":         "4 ohm variant",
                "discontinued": True,
                "corrections": (
                    "Split from combined WF259PA01_02 page (col_idx=0). PA02 = 4 ohm. "
                    "Before-burn-in values used throughout. Rms=1.32 Ns/m from datasheet. "
                    "Qts=0.29 and Qes=0.29 both published at 2 d.p. by Wavecor; computed "
                    "Qts = 0.29×14.0/(0.29+14.0) = 0.284. Rounding makes Qts appear equal "
                    "to Qes — datasheet precision limitation, not a scraper artifact. DISCONTINUED."
                ),
                "dq_issue": "Qts_impossible: Wavecor publishes both at 2 d.p.; true Qts ≈ 0.284",
            },
            {
                "model":        "WF259PA01",
                "col_idx":      1,
                "note":         "8 ohm variant",
                "discontinued": True,
                "corrections": (
                    "Split from combined WF259PA01_02 page (col_idx=1). PA01 = 8 ohm. "
                    "Before-burn-in values used throughout. Rms=1.32 Ns/m from datasheet. DISCONTINUED."
                ),
                "dq_issue": None,
            },
        ],
    },
}


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _parse_html_fields(html: str, col_idx: int = 0) -> dict[str, float]:
    """
    Extract T/S parameter dict from a Wavecor HTML page.

    col_idx selects which data column to read on multi-variant pages:
      0 → first  data column (cells[2] for 4/5-col, cells[2] for 7-col before-burn-in)
      1 → second data column (cells[3] for 5-col,   cells[4] for 7-col before-burn-in)

    All Wavecor page layouts are handled:
      3-col [label, value, unit]                    — old pages, no notes column
      4-col [notes, label, value, unit]             — single-value rows
      5-col [notes, label, v0, v1, unit]            — two-variant rows
      7-col [notes, label, v0b, v0a, v1b, v1a, unit]— two variants + before/after burn-in
    """
    html_rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)
    specs: dict[str, str] = {}

    for row in html_rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S | re.I)
        if len(cells) < 2:
            continue

        if len(cells) >= 4:
            label_cell = cells[1]
            n_val = len(cells) - 3   # number of value columns (excl. notes, label, unit)
            if n_val >= 3:
                # 7-col layout: [notes, label, v0_before, v0_after, v1_before, v1_after, unit]
                # Take "before burn-in" value for the requested variant.
                col_offset = col_idx * 2
            else:
                # 4-col (1 value) or 5-col (2 values): direct column selection.
                col_offset = min(col_idx, max(0, n_val - 1))
            # Guard against malformed rows
            value_idx = min(2 + col_offset, len(cells) - 2)
            value_cell = cells[value_idx]
            unit_cell  = cells[-1]
        else:
            # 3-col old-page layout: no notes column
            label_cell = cells[0]
            value_cell = cells[1]
            unit_cell  = cells[-1] if len(cells) > 2 else ""

        label = re.sub(r"<[^>]+>", "", label_cell).strip()

        # Replace <br> with space before stripping HTML so multi-value cells
        # (Wavecor PR pages list Fs at multiple added-mass steps via <br>) don't
        # concatenate into a single unparseable number.
        value_text = re.sub(r"<br\s*/?>", " ", value_cell, flags=re.I)
        value_text = re.sub(r"<[^>]+>", "", value_text).strip()
        unit_text  = _html_mod.unescape(re.sub(r"<[^>]+>", "", unit_cell)).strip()
        # Normalise to "value unit" string — same shape as all other scrapers.
        if label:
            specs[label] = f"{value_text} {unit_text}".strip()

    return match_ts_fields(specs, FIELD_MAP)


def _driver_type_from_url(url: str) -> str | None:
    """Infer driver_type from the Wavecor URL slug prefix."""
    slug = url.rstrip("/").split("/")[-1].lower()
    if slug.startswith("tw"):   return "tweeter"
    if slug.startswith("wf"):   return "woofer"
    if slug.startswith("sw"):   return "subwoofer"
    if slug.startswith("fr"):   return "fullrange"
    if slug.startswith("mr"):   return "midrange"
    if slug.startswith("pr"):   return "pr"
    return None


def _parse_freq_range_html(html: str) -> tuple[float | None, float | None]:
    """
    Extract operating frequency range from a Wavecor HTML spec table.

    Returns (freq_low_hz, freq_high_hz) in Hz.

    Wavecor uses two row labels:
      "Recommended frequency range"         — tweeters; value is "N1 - N2" in kHz
      "Recommended max. upper frequency limit" — woofers/subs; value is a single number
    Unit cell is "[kHz]" or "[Hz]".
    Value "full range" means the driver is a fullrange with no numeric limit — returns None.
    """
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)
    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S | re.I)
        if len(cells) < 3:
            continue
        label = re.sub(r"<[^>]+>", "", cells[1]).strip().lower()
        if "recommended" not in label and "frequency range" not in label:
            continue

        # Unit cell is always the last cell.
        unit_text = _html_mod.unescape(re.sub(r"<[^>]+>", "", cells[-1])).strip().lower()
        factor = 1000.0 if "khz" in unit_text else 1.0

        # Value cell: take first non-empty data cell (cells[2] or similar).
        val_text = re.sub(r"<[^>]+>", "", cells[2]).strip().lower()
        if not val_text or val_text in ("&nbsp;", "full range", "full\xa0range"):
            return None, None

        # "N1 - N2" → low and high; bare "N" → high only.
        m = re.match(r"([\d,\.]+)\s*[-–]\s*([\d,\.]+)", val_text)
        if m:
            lo = parse_number(m.group(1))
            hi = parse_number(m.group(2))
            if lo and hi:
                return lo * factor, hi * factor

        single = parse_number(val_text)
        if single:
            return None, single * factor

    return None, None


def _parse_asset_urls(html: str, page_url: str, model: str) -> dict[str, str | None]:
    """
    Extract PDF, SPL, and impedance URLs from the HTML page links.
    Falls back to root-level template URLs if a link is not found in the HTML.
    """
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.I)
    pdf = spl = imp = None
    for h in hrefs:
        hl = h.lower()
        if hl.endswith("_specifications.pdf"):
            pdf = urllib.parse.urljoin(page_url, h)
        elif "_spl_response.txt" in hl:
            spl = urllib.parse.urljoin(page_url, h)
        elif "_impedance_response.txt" in hl:
            imp = urllib.parse.urljoin(page_url, h)
    return {
        "datasheet_url": pdf or f"https://www.wavecor.com/{model}_specifications.pdf",
        "spl_url":       spl or f"https://www.wavecor.com/{model}_SPL_response.txt",
        "imp_url":       imp or f"https://www.wavecor.com/{model}_impedance_response.txt",
    }


def _model_from_url(url: str) -> str:
    slug = url.rstrip("/").split("/")[-1]
    slug = re.sub(r"\.html$", "", slug, flags=re.I)
    return slug.upper()


def parse_product(html: str, url: str) -> dict | None:
    if url in SPLIT_PAGES:
        return None  # _process_splits() handles these after the main scraper loop

    fields = _parse_html_fields(html, col_idx=0)
    if not fields.get("Fs"):
        return None

    model  = _model_from_url(url)
    assets = _parse_asset_urls(html, url, model)
    freq_low, freq_high = _parse_freq_range_html(html)

    return {
        "brand":         "Wavecor",
        "model":         model,
        "manufacturer":  "Wavecor",
        "provided_by":   f"Wavecor website (scraped {date.today()})",
        "fields":        fields,
        "datasheet_url": assets["datasheet_url"],
        "frd_url":       assets["spl_url"],
        "zma_url":       assets["imp_url"],
        "driver_type":   _driver_type_from_url(url),
        "freq_low_hz":   freq_low,
        "freq_high_hz":  freq_high,
    }


def _process_splits(out_dir: Path) -> None:
    """
    Generate per-variant WDR + meta files for every entry in SPLIT_PAGES.

    Called automatically after run_scraper() completes. Idempotent — safe to
    re-run; overwrites existing files with freshly parsed values each time.

    HTML is read from the cache written by the main scraper loop
    (out_dir/_html/<slug>.html). If the cache file is missing (e.g. on a first
    run where the page returned None and was not cached), the page is fetched
    from the live site and the cache is populated for future runs.
    """
    html_dir = out_dir / "_html"
    today    = date.today().strftime("%Y%m%d")

    for url, cfg in SPLIT_PAGES.items():
        slug          = url.rstrip("/").split("/")[-1]
        html_filename = re.sub(r"[^\w\-.]", "_", slug) + ".html"
        cached_path   = html_dir / html_filename

        if cached_path.exists():
            html = cached_path.read_text(encoding="utf-8", errors="replace")
        else:
            print(f"[{_ts()}] SPLIT {slug}: not in cache — fetching live", flush=True)
            try:
                html = fetch(url)
                html_dir.mkdir(exist_ok=True)
                cached_path.write_text(html, encoding="utf-8")
            except Exception as exc:
                print(f"[{_ts()}] SPLIT {slug}: fetch failed: {exc}", flush=True)
                continue

        freq_low, freq_high = _parse_freq_range_html(html)
        driver_type = _driver_type_from_url(url)

        for variant in cfg["variants"]:
            model   = variant["model"]
            col_idx = variant["col_idx"]
            fields  = _parse_html_fields(html, col_idx=col_idx)

            if not fields:
                print(f"[{_ts()}] SPLIT {model}: no fields parsed (col_idx={col_idx})", flush=True)
                continue

            wr = write_driver(
                out_dir,
                brand="Wavecor",
                model=model,
                manufacturer="Wavecor",
                fields=fields,
                provided_by=f"Wavecor website (scraped {today})",
                url=url,
                today=today,
                comment=f"Source: {url} | Datasheet: {cfg['pdf_url']}",
                is_manufacturer_site=True,
                datasheet_url=cfg["datasheet_url"],
                driver_type=driver_type,
                detail=(f"Automatically scraped from Wavecor website. "
                        f"Split from combined page: {variant['note']}. "
                        "T/S parameters have not been verified by a human against the datasheet."),
                corrections=variant.get("corrections"),
                obsolete=True if variant.get("discontinued") else None,
                dq_issue_static=variant.get("dq_issue"),
                sources={"datasheet": cfg["datasheet_url"], "manu_page": url},
            )
            if wr.ts_fail:
                print(f"[{_ts()}] SPLIT {model}: SKIP missing T/S: "
                      f"{', '.join(sorted(wr.missing_ts))}", flush=True)
                continue
            for rule_id in wr.dq_issues:
                print(f"[{_ts()}] SPLIT {model} DQ {rule_id}", flush=True)
            if wr.schema_fail:
                print(f"[{_ts()}] SPLIT {model}: SCHEMA FAIL ({len(wr.hard_errors)} errors)",
                      flush=True)
                for e in wr.hard_errors:
                    print(f"  {e}", flush=True)
            else:
                print(
                    f"[{_ts()}] SPLIT {model}: {len(fields)} fields "
                    f"(col_idx={col_idx}, {variant['note']})",
                    flush=True,
                )


def url_filter(url: str) -> bool:
    return "/html/" in url and url.endswith(".html")


if __name__ == "__main__":
    out = Path(OUT_DIR)
    run_scraper(VENDOR, SITEMAP_URL, parse_product, out, url_filter=url_filter,
                is_manufacturer_site=True, html_wins=True)
    _process_splits(out)
