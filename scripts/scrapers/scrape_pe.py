#!/usr/bin/env python3
"""
Scrape Parts Express driver catalog → WDR + _meta.yml sidecar pairs.

Fetches T/S data from the Parts Express internal JSON API and writes
WDR + _meta.yml sidecar pairs to drivers/parts-express/.

API: GET https://www.parts-express.com/api/items
     ?q={brand}&fieldset=details&offset={N}&limit=50
     NetSuite SuiteCommerce Advanced REST API — no auth required.

Usage (from repo root or scripts/scrapers/):
    python scripts/scrapers/scrape_pe.py             # add new, skip existing
    python scripts/scrapers/scrape_pe.py --refresh   # re-scrape all brands
    python scripts/scrapers/scrape_pe.py --limit 20  # first N new items only
    python scripts/scrapers/scrape_pe.py --workers 4 # parallel brand fetches
"""

import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.parse
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from functools import partial
from pathlib import Path

import yaml

# ── Import new scraper_lib from this directory ────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import (
    to_wdr, safe_filename, load_manifest, save_manifest,
    validate_driver, ProblemLog, check_fields,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

VENDOR          = "Parts Express"
OUT_DIR         = Path(__file__).resolve().parent.parent.parent / "drivers" / "parts-express"
API_URL         = "https://www.parts-express.com/api/items"
DEFAULT_DELAY_S = 0.1

BRANDS = [
    "Aurum Cantus", "B&C Speakers", "Beston", "Beyma", "Celestion",
    "Ciare", "Coast Buyouts", "CSS", "Dayton Audio", "Eminence Speaker",
    "EPIQUE by Dayton Audio", "Factory Buyouts", "FaitalPRO", "Fountek",
    "Goldwood", "GRS", "HiVi", "JBL Professional", "Lavoce", "Morel",
    "Peerless by Tymphany", "PRV Audio", "Pyramid", "Quam", "Selenium",
    "Tang Band", "Tectonic", "Timpano Audio", "Visaton", "Wavecor",
]

INCLUDE_CATS = {
    "Woofers", "Subwoofer Drivers", "Tweeters",
    "Midrange / Midbass Drivers & Full-Range Speakers",
    "Planar / Ribbon Transducers", "Passive Radiators",
    "Car Audio Tweeters", "Car Audio Midbass Speakers",
    "Car Subwoofer Speakers",
    "Pro Woofers, Subwoofers & Midrange Speakers",
    "Horn Loaded Tweeters & Midranges", "Horn Drivers",
    "Pro Coaxial Full-Range Speakers",
}

CATEGORY_TYPE: dict[str, str] = {
    "Woofers":                                        "woofer",
    "Subwoofer Drivers":                              "subwoofer",
    "Tweeters":                                       "tweeter",
    "Midrange / Midbass Drivers & Full-Range Speakers": "midrange",
    "Planar / Ribbon Transducers":                    "tweeter",
    "Passive Radiators":                              "passive_radiator",
    "Car Audio Tweeters":                             "tweeter",
    "Car Audio Midbass Speakers":                     "midrange",
    "Car Subwoofer Speakers":                         "subwoofer",
    "Pro Woofers, Subwoofers & Midrange Speakers":    "woofer",
    "Horn Loaded Tweeters & Midranges":               "tweeter",
    "Horn Drivers":                                   "midrange",
    "Pro Coaxial Full-Range Speakers":                "fullrange",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _safe(v):
    """Return float or None."""
    try:
        f = float(v)
        return f if f == f else None   # NaN guard
    except (TypeError, ValueError):
        return None


def _parse_item(it: dict) -> dict[str, float]:
    """Map one PE API item dict → fields dict in SI units."""
    def g(key):
        return _safe(it.get(key))

    Fs   = g("custitem_pe_resonant_frequency_fs")
    Qts  = g("custitem_pe_total_q_qts")
    Qes  = g("custitem_pe_electromagnetic_q_qes")
    Qms  = g("custitem_pe_mechanical_q_qms")
    Re   = g("custitem_pe_dc_resistance_re")
    Znom = g("custitem_pe_impedance")
    Pe   = g("custitem_pe_power_handling_rms")
    BL   = g("custitem_pe_bl_product_bl")

    Le_raw = g("custitem_pe_voice_coil_inductance_le")
    Le = Le_raw / 1000 if Le_raw is not None else None          # mH → H

    Mms_raw = g("custitem_pe_diaphragm_mass_airload")
    Mms = Mms_raw / 1000 if Mms_raw is not None else None       # g → kg

    Sd_raw = g("custitem_pe_surface_area_of_cone_sd")
    Sd = Sd_raw / 10000 if Sd_raw is not None else None         # cm² → m²

    Vas_raw = g("custitem_pe_compliance_equiv_volume")
    Vas = Vas_raw * 0.0283168 if Vas_raw is not None else None  # ft³ → m³

    Xmax_raw = g("custitem_pe_max_linear_excursion")
    Xmax = Xmax_raw / 1000 if Xmax_raw is not None else None    # mm one-way → m

    # Cms: reject implausible values ≥ 100 mm/N (API bug — kHz parsing error)
    Cms_raw = g("custitem_pe_mech_comp_suspension")
    Cms = Cms_raw / 1000 if (Cms_raw is not None and Cms_raw < 100) else None  # mm/N → m/N

    # Rms: derived from T/S identity Qms = 2π·Fs·Mms / Rms
    Rms = (2 * 3.141592653589793 * Fs * Mms / Qms
           if (Fs and Mms and Qms) else None)

    fields: dict[str, float] = {}
    for k, v in [
        ("Fs", Fs), ("Qts", Qts), ("Qes", Qes), ("Qms", Qms),
        ("Re", Re), ("Le", Le), ("BL", BL), ("Mms", Mms), ("Cms", Cms),
        ("Rms", Rms), ("Sd", Sd), ("Vas", Vas), ("Xmax", Xmax),
        ("Znom", Znom), ("Pe", Pe),
    ]:
        if v is not None:
            fields[k] = v
    return fields


# ── API fetch (top-level so ProcessPoolExecutor can pickle it) ────────────────

def _fetch_brand(brand: str, delay_s: float = DEFAULT_DELAY_S,
                 cache_dir: Path | None = None) -> list[dict]:
    """
    Fetch all API pages for one brand; return list of item dicts.
    Caches each page as JSON under cache_dir so re-runs skip the network.
    Must remain a top-level function (not a closure) for ProcessPoolExecutor.
    """
    items: list[dict] = []
    offset = 0
    while True:
        params = urllib.parse.urlencode({
            "q": brand, "fieldset": "details",
            "offset": offset, "limit": 50,
        })
        cache_file = None
        if cache_dir is not None:
            safe_brand = re.sub(r"[^\w\-]", "_", brand)
            cache_file = cache_dir / f"{safe_brand}_{offset:04d}.json"

        if cache_file is not None and cache_file.exists():
            data = json.loads(cache_file.read_text(encoding="utf-8"))
        else:
            req = urllib.request.Request(
                f"{API_URL}?{params}",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode("utf-8")
            data = json.loads(raw)
            if cache_file is not None:
                cache_file.write_text(raw, encoding="utf-8")
            time.sleep(delay_s)

        page = data.get("items", [])
        items.extend(page)
        if len(items) >= (data.get("total") or 0) or not page:
            break
        offset += 50
    return items


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Parts Express → WDR files")
    parser.add_argument("--out-dir", default=str(OUT_DIR))
    parser.add_argument("--limit", type=int, default=0,
                        help="Max new items to write (0 = all)")
    parser.add_argument("--refresh", action="store_true",
                        help="Re-scrape all items, not just new ones")
    parser.add_argument("--workers", type=int, default=4,
                        help="Parallel brand fetch workers (default 4)")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_S)
    args = parser.parse_args()

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    json_cache = out / "_html"   # named _html for consistency with other scrapers
    json_cache.mkdir(exist_ok=True)

    prob = ProblemLog(out, "scrape_pe")
    manifest = load_manifest(out)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    start = datetime.now()

    # ── Collect all items from API (using JSON cache) ─────────────────────────
    print(f"[{_ts()}] [{VENDOR}] Fetching {len(BRANDS)} brands from API ...", flush=True)

    all_items: list[dict] = []
    seen_ids: set[str] = set()

    fetch_fn = partial(_fetch_brand, delay_s=args.delay, cache_dir=json_cache)
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch_fn, brand): brand for brand in BRANDS}
        for future in as_completed(futures):
            brand = futures[future]
            try:
                brand_items = future.result()
                print(f"[{_ts()}]   {brand}: {len(brand_items)} items", flush=True)
                for it in brand_items:
                    iid = it.get("itemid")
                    if iid and iid not in seen_ids:
                        seen_ids.add(iid)
                        all_items.append(it)
            except Exception as e:
                print(f"[{_ts()}]   {brand}: ERROR {e}", flush=True)
                prob.log("brand_fetch", brand, API_URL, None, str(e))

    print(f"[{_ts()}] [{VENDOR}] {len(all_items)} unique items from API", flush=True)

    # ── Filter to driver categories with T/S data ─────────────────────────────
    drivers = [
        it for it in all_items
        if it.get("custitem_itemcategoryfacet") in INCLUDE_CATS
        and it.get("custitem_pe_resonant_frequency_fs")
    ]
    print(f"[{_ts()}] [{VENDOR}] {len(drivers)} with T/S data in driver categories", flush=True)

    already_scraped = set(manifest.get("scraped", {}).keys())
    to_write = drivers if args.refresh else [
        it for it in drivers if it.get("itemid") not in already_scraped
    ]
    print(f"[{_ts()}] [{VENDOR}] {len(to_write)} new (not yet scraped)", flush=True)

    if args.limit:
        to_write = to_write[:args.limit]

    # ── Write WDRs ────────────────────────────────────────────────────────────
    ok = dq_warned = schema_fail = 0
    total = len(to_write)

    for i, it in enumerate(to_write, 1):
        brand   = it.get("custitem_pe_brand", "")
        sku     = it.get("itemid", "")
        urlcomp = it.get("urlcomponent", "")
        url     = f"https://www.parts-express.com/{urlcomp}" if urlcomp else ""

        # Model: prefer MPN (manufacturer part number) as the clean model
        # identifier. Fall back to display name minus brand prefix.
        mpn = (it.get("mpn") or "").strip()
        if mpn:
            model = mpn
        else:
            display = it.get("storedisplayname2") or sku
            model = display[len(brand) + 1:] if display.startswith(brand + " ") else display
            prob.log("model_mpn", sku, url, it.get("mpn"),
                     "mpn absent; fell back to storedisplayname2")

        fields = _parse_item(it)

        # DQ check — log problems, don't abort
        for rule_id, desc, detail in check_fields(fields):
            print(f"[{_ts()}]   [{i}/{total}] {brand} {model} DQ {rule_id}: {detail}", flush=True)
            prob.log(rule_id, sku, url, detail, desc)
            dq_warned += 1

        wdr_text = to_wdr(
            brand=brand, model=model,
            fields=fields,
            provided_by=f"Parts Express (fetched {today})",
            comment=f"Source: {url}",
            manufacturer=brand,
            date_added=today, date_modified=today,
        )
        wdr_name  = safe_filename(f"{brand} {model}".strip())
        wdr_path  = out / wdr_name
        meta_path = out / wdr_name.replace(".wdr", "_meta.yml")
        wdr_path.write_text(wdr_text, encoding="utf-8")

        meta = {
            "quality":          "M",
            "issue":            "scraped_not_human_verified",
            "detail":           ("Automatically scraped from Parts Express API. "
                                 "T/S parameters have not been verified by a human "
                                 "against the datasheet."),
            "corrections":      None,
            "reviewed_by":      None,
            "driver_type":      CATEGORY_TYPE.get(it.get("custitem_itemcategoryfacet", "")),
            "nominal_size_cm":  None,
            "datasheet":        None,
            "adv_datasheet":    None,
            "drawing":          None,
            "cad":              None,
            "manu_page":        None,
            "vendor_page":      url or None,
            "source":           url or None,
            "frd":              None,
            "impedance":        None,
            "obsolete":         None,
            "dq_issue":         None,
            "community":        None,
            "fetched_sku":      sku or None,
            "field_provenance": None,
            "freq_low_hz":      None,
            "freq_high_hz":     None,
        }
        meta_path.write_text(
            yaml.dump(meta, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

        errors = validate_driver(wdr_path, meta_path)
        if errors:
            schema_fail += 1
            print(f"[{_ts()}]   [{i}/{total}] {brand} {model} SCHEMA FAIL ({len(errors)})",
                  flush=True)
            for e in errors:
                prob.log("schema", sku, url, None, e)
        else:
            ok += 1
            print(f"[{_ts()}]   [{i}/{total}] {brand} {model} OK", flush=True)

        manifest.setdefault("scraped", {})[sku or wdr_name] = {
            "file": wdr_name, "status": "ok" if not errors else "schema_fail"
        }
        if i % 50 == 0:
            save_manifest(out, manifest)
        if i % 100 == 0:
            elapsed = (datetime.now() - start).seconds
            print(f"[{_ts()}] [{VENDOR}] {i}/{total} ({100*i//total}%) — "
                  f"{ok} OK, {dq_warned} DQ, {schema_fail} schema fails — {elapsed}s",
                  flush=True)

    save_manifest(out, manifest)
    elapsed = int((datetime.now() - start).total_seconds())
    prob.finalize(total)
    print(f"\n[{_ts()}] [{VENDOR}] Done: {ok} OK, {dq_warned} DQ warnings, "
          f"{schema_fail} schema fails — {elapsed}s", flush=True)
    print(f"  Output: {out.resolve()}", flush=True)


if __name__ == "__main__":
    main()
