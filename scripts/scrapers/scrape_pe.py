#!/usr/bin/env python3
"""
Scrape Parts Express driver catalog → WDR + _meta.yml sidecar pairs.

Strategy: API for discovery only (brand/category/itemid/urlcomponent).
T/S parameters are extracted from the manufacturer's datasheet PDF (primary)
and the PE product-page HTML Thiele-Small Parameters table (fallback).
The API's bare-float T/S fields are intentionally ignored — they carry no unit
information and have systematic errors for several brands (Beyma, JBL, Selenium).

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


# ── Import new scraper_lib from this directory ────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from scraper_lib import (
    safe_filename, load_manifest, save_manifest,
    ProblemLog, write_driver, parse_html_table_ts, ts,
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
    "Passive Radiators":                              "pr",
    "Car Audio Tweeters":                             "tweeter",
    "Car Audio Midbass Speakers":                     "midrange",
    "Car Subwoofer Speakers":                         "subwoofer",
    "Pro Woofers, Subwoofers & Midrange Speakers":    "woofer",
    "Horn Loaded Tweeters & Midranges":               "tweeter",
    "Horn Drivers":                                   "midrange",
    "Pro Coaxial Full-Range Speakers":                "fullrange",
}



# PE HTML product pages carry a "Thiele-Small Parameters" table with labeled units.
# Keys are lower-cased label fragments; values are (WDR key, nominal SI factor).
# parse_field_value() detects the actual unit in the value string and overrides
# the nominal factor where needed (e.g. ft³ overrides L→m³, µm/N overrides mm/N).
_HTML_TS_MAP = {
    "resonant frequency":           ("Fs",   1.0),    # Hz
    "dc resistance":                ("Re",   1.0),    # Ω
    "voice coil inductance":        ("Le",   1e-3),   # mH → H
    "mechanical q":                 ("Qms",  1.0),
    "electromagnetic q":            ("Qes",  1.0),
    "total q":                      ("Qts",  1.0),
    "compliance equivalent volume": ("Vas",  1e-3),   # L→m³ default; ft³ detected
    "mechanical compliance":        ("Cms",  1e-3),   # mm/N→m/N default; µm/N detected
    "bl product":                   ("BL",   1.0),    # T·m
    "diaphragm mass":               ("Mms",  1e-3),   # g→kg default; kg passthrough detected
    "maximum linear excursion":     ("Xmax", 1e-3),   # mm → m
    "surface area of cone":         ("Sd",   1e-4),   # cm²→m² default; m² passthrough detected
    "sensitivity":                  ("SPL",  1.0),    # dB
    "power handling":               ("Pe",   1.0),    # W
    "impedance":                    ("Znom", 1.0),    # Ω
}




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


# ── Per-item HTML + PDF enrichment (top-level for ProcessPoolExecutor) ────────

async def _fetch_one_async(ctx, sku: str, url: str, html_path: Path,
                           sem: "asyncio.Semaphore", counter: list) -> None:
    """Fetch one PE product page inside a semaphore-bounded asyncio task."""
    import asyncio
    from datetime import datetime as _dt
    async with sem:
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            try:
                await page.wait_for_selector(".content-area, #main", timeout=5000)
            except Exception:
                pass
            html_path.write_text(await page.content(), encoding="utf-8")
        except Exception as e:
            print(f"[{_dt.now().strftime('%H:%M:%S')}]   WARN {sku}: {e}", flush=True)
        finally:
            await page.close()
        counter[0] += 1
        print(f"[{_dt.now().strftime('%H:%M:%S')}]   browser: {counter[0]}/{counter[1]} {sku}",
              flush=True)


def _prefetch_html_playwright(items: list[dict], html_dir: Path,
                               delay_s: float, concurrency: int = 8) -> None:
    """
    Render PE product pages with async Playwright (N concurrent pages) and cache HTML.
    Skips items whose cache file already exists.
    Must run in the main process — Chromium doesn't survive spawn().
    """
    import asyncio

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise RuntimeError(
            "playwright not installed — run: "
            "pip install playwright && python -m playwright install chromium"
        )

    to_fetch = [
        it for it in items
        if not (html_dir / f"{re.sub(r'[^\w\-]', '_', it.get('itemid', ''))}_product.html").exists()
    ]
    if not to_fetch:
        print(f"[{ts()}] [Parts Express] All product HTML cached — skipping browser phase",
              flush=True)
        return

    print(f"[{ts()}] [Parts Express] Fetching {len(to_fetch)} product pages "
          f"(Playwright / Chromium, {concurrency} concurrent) ...", flush=True)

    async def _run_all() -> None:
        sem     = asyncio.Semaphore(concurrency)
        counter = [0, len(to_fetch)]   # [done, total] — list so closure can mutate

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx     = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            )
            tasks = []
            for it in to_fetch:
                sku     = it.get("itemid", "")
                urlcomp = it.get("urlcomponent", "")
                if not urlcomp:
                    continue
                url       = f"https://www.parts-express.com/{urlcomp}"
                safe      = re.sub(r"[^\w\-]", "_", sku)
                html_path = html_dir / f"{safe}_product.html"
                tasks.append(_fetch_one_async(ctx, sku, url, html_path, sem, counter))
            await asyncio.gather(*tasks)
            await browser.close()

    asyncio.run(_run_all())
    print(f"[{ts()}] [Parts Express] Browser phase done", flush=True)


def _enrich_one(args: tuple) -> tuple[str, dict]:
    """
    Parse cached product HTML, find specs PDF, fetch it, extract T/S fields.
    HTML must already be cached by _prefetch_html_playwright().
    Returns (sku, enrichment_dict).
    Top-level function (not a closure) so ProcessPoolExecutor can pickle it.
    """
    import re as _re, sys as _sys, time as _time
    import urllib.request as _req, urllib.parse as _up
    from pathlib import Path as _Path

    it, html_dir_s, datasheets_dir_s, delay_s = args
    html_dir       = _Path(html_dir_s)
    datasheets_dir = _Path(datasheets_dir_s)

    sku     = it.get("itemid", "")
    urlcomp = it.get("urlcomponent", "")
    brand   = it.get("custitem_pe_brand", "")
    url     = f"https://www.parts-express.com/{urlcomp}" if urlcomp else ""

    out = {"pdf_url": None, "pdf_fields": {}, "html_fields": {},
           "freq_low_hz": None, "freq_high_hz": None}
    if not url:
        return sku, out

    # ── Read cached product page HTML ─────────────────────────────────────────
    safe      = _re.sub(r"[^\w\-]", "_", sku)
    html_path = html_dir / f"{safe}_product.html"
    if not html_path.exists():
        return sku, out
    html = html_path.read_text(encoding="utf-8", errors="replace")

    # ── T/S fields from HTML Thiele-Small Parameters table ────────────────────
    out["html_fields"] = parse_html_table_ts(
        html, _HTML_TS_MAP, section_pattern=r"Thiele.Small Parameters.*?</table>",
    )

    # ── Freq range from HTML specs table ──────────────────────────────────────
    plain = _re.sub(r"<[^>]+>", " ", html)
    m = _re.search(
        r"[Ff]requency\s+[Rr]esponse[^0-9]{0,200}?"
        r"([\d,\.]+)\s*(kHz|Hz)?\s*[-–]\s*([\d,\.]+)\s*(kHz|Hz)",
        plain,
    )
    if m:
        def _hz(v: str, u: str | None) -> float | None:
            try:
                f = float(v.replace(",", ""))
                return f * 1000 if (u and u.lower() == "khz") else f
            except ValueError:
                return None
        lo, hi = _hz(m.group(1), m.group(2)), _hz(m.group(3), m.group(4))
        if lo and hi and lo < hi:
            out["freq_low_hz"], out["freq_high_hz"] = lo, hi

    # ── Find specs PDF link in rendered HTML ──────────────────────────────────
    pdf_url = None
    for pm in _re.finditer(r'(?:href|src)=["\']([^"\']*pedocs/specs/[^"\']+\.pdf)["\']',
                            html, _re.I):
        pdf_url = _up.urljoin(url, pm.group(1))
        break

    if not pdf_url:
        return sku, out
    out["pdf_url"] = pdf_url

    # ── Fetch / cache PDF ─────────────────────────────────────────────────────
    pdf_name = pdf_url.split("/")[-1]
    pdf_path = datasheets_dir / pdf_name
    if not pdf_path.exists():
        try:
            rq = _req.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
            with _req.urlopen(rq, timeout=30) as r:
                pdf_path.write_bytes(r.read())
            _time.sleep(delay_s)
        except Exception:
            return sku, out

    # ── Extract T/S fields from PDF ───────────────────────────────────────────
    try:
        _sys.path.insert(0, str(_Path(__file__).parent))
        from pdf_lib import find_ts_fields, full_text
        text = full_text(pdf_path)
        out["pdf_fields"] = find_ts_fields(text, brand, [])
    except Exception:
        pass

    return sku, out


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
    parser.add_argument("--browser-workers", type=int, default=8,
                        help="Concurrent Playwright pages for HTML fetch (default 8)")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY_S)
    args = parser.parse_args()

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    json_cache    = out / "_html"        # JSON API page cache
    datasheets    = out / "_datasheets"  # PDF datasheet cache
    json_cache.mkdir(exist_ok=True)
    datasheets.mkdir(exist_ok=True)

    prob = ProblemLog(out, "scrape_pe")
    manifest = load_manifest(out)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    start = datetime.now()

    # ── Collect all items from API (using JSON cache) ─────────────────────────
    print(f"[{ts()}] [{VENDOR}] Fetching {len(BRANDS)} brands from API ...", flush=True)

    all_items: list[dict] = []
    seen_ids: set[str] = set()

    fetch_fn = partial(_fetch_brand, delay_s=args.delay, cache_dir=json_cache)
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch_fn, brand): brand for brand in BRANDS}
        for future in as_completed(futures):
            brand = futures[future]
            try:
                brand_items = future.result()
                print(f"[{ts()}]   {brand}: {len(brand_items)} items", flush=True)
                for it in brand_items:
                    iid = it.get("itemid")
                    if iid and iid not in seen_ids:
                        seen_ids.add(iid)
                        all_items.append(it)
            except Exception as e:
                print(f"[{ts()}]   {brand}: ERROR {e}", flush=True)
                prob.log("brand_fetch", brand, API_URL, None, str(e))

    print(f"[{ts()}] [{VENDOR}] {len(all_items)} unique items from API", flush=True)

    # ── Filter to driver categories with T/S data ─────────────────────────────
    drivers = [
        it for it in all_items
        if it.get("custitem_itemcategoryfacet") in INCLUDE_CATS
    ]
    print(f"[{ts()}] [{VENDOR}] {len(drivers)} items in driver categories", flush=True)

    already_scraped = set(manifest.get("scraped", {}).keys())
    to_write = drivers if args.refresh else [
        it for it in drivers if it.get("itemid") not in already_scraped
    ]
    print(f"[{ts()}] [{VENDOR}] {len(to_write)} new (not yet scraped)", flush=True)

    if args.limit:
        to_write = to_write[:args.limit]

    # ── Phase 1: render product pages via Playwright (sequential, main process) ─
    # Always runs over ALL drivers so the HTML cache is complete regardless of
    # --refresh / --limit scope.  Subsequent runs skip already-cached pages.
    _prefetch_html_playwright(drivers, json_cache, args.delay, concurrency=args.browser_workers)

    # ── Phase 2: parse HTML, fetch PDFs, extract T/S fields (parallel) ────────
    print(f"[{ts()}] [{VENDOR}] Enriching {len(to_write)} drivers "
          f"(PDF extract, {args.workers} workers) ...", flush=True)

    enrich_args = [
        (it, str(json_cache), str(datasheets), args.delay) for it in to_write
    ]
    enrichment: dict[str, dict] = {}
    n_done = 0

    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        fut_map = {ex.submit(_enrich_one, a): a[0].get("itemid", "") for a in enrich_args}
        for fut in as_completed(fut_map):
            sku_done = fut_map[fut]
            try:
                sku_res, enc = fut.result()
                enrichment[sku_res] = enc
            except Exception as e:
                enrichment[sku_done] = {}
                print(f"[{ts()}]   {sku_done}: enrich ERROR {e}", flush=True)
            n_done += 1
            if n_done % 100 == 0:
                print(f"[{ts()}] [{VENDOR}]   enriched {n_done}/{len(to_write)}", flush=True)

    print(f"[{ts()}] [{VENDOR}] Enrichment done", flush=True)

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

        enc         = enrichment.get(sku, {})
        pdf_fields  = enc.get("pdf_fields", {})
        html_fields = enc.get("html_fields", {})
        freq_low    = enc.get("freq_low_hz")
        freq_high   = enc.get("freq_high_hz")
        pdf_url     = enc.get("pdf_url")

        # PDF is primary; HTML fills any gaps.
        fields = dict(pdf_fields)
        for k, v in html_fields.items():
            if v is None:
                continue
            if k not in fields or fields[k] is None:
                fields[k] = v

        # Build full T/S specs provenance — PDF primary, HTML fills gaps.
        pe_specs: dict = {}
        for _fld in set(pdf_fields) | {k for k, v in html_fields.items() if v is not None}:
            _src_vals: dict = {}
            if _fld in pdf_fields and pdf_fields[_fld] is not None:
                _src_vals["datasheet"] = pdf_fields[_fld]
            if html_fields.get(_fld) is not None:
                _src_vals["vendor_page"] = html_fields[_fld]
            if not _src_vals:
                continue
            _winner = "datasheet" if "datasheet" in _src_vals else "vendor_page"
            pe_specs[_fld] = {"value": _src_vals[_winner], "winner": _winner,
                              "sources": _src_vals}
        # Freq range (always from vendor page HTML)
        if freq_low:
            pe_specs["freq_low_hz"] = {"value": freq_low, "winner": "vendor_page",
                                       "sources": {"vendor_page": freq_low}}
        if freq_high:
            pe_specs["freq_high_hz"] = {"value": freq_high, "winner": "vendor_page",
                                        "sources": {"vendor_page": freq_high}}

        wr = write_driver(
            out,
            brand=brand,
            model=model,
            manufacturer=brand,
            fields=fields,
            provided_by=f"Parts Express (fetched {today})",
            url=url,
            today=today,
            comment=f"Source: {url}",
            is_manufacturer_site=False,
            datasheet_url=pdf_url or None,
            driver_type=CATEGORY_TYPE.get(it.get("custitem_itemcategoryfacet", "")),
            detail=("Automatically scraped from Parts Express API. "
                    "T/S parameters have not been verified by a human against the datasheet."),
            fetched_sku=sku or None,
            specs=pe_specs or None,
            sources={"vendor_page": url, "datasheet": pdf_url} if pdf_url else {"vendor_page": url},
        )

        if wr.ts_fail:
            print(f"[{ts()}]   [{i}/{total}] {brand} {model} SKIP missing T/S: "
                  f"{', '.join(sorted(wr.missing_ts))}", flush=True)
            manifest.setdefault("scraped", {})[sku or safe_filename(f"{brand} {model}")] = {
                "file": None, "status": "skipped"
            }
            continue

        for rule_id in wr.dq_issues:
            print(f"[{ts()}]   [{i}/{total}] {brand} {model} DQ {rule_id}", flush=True)
            prob.log(rule_id, sku, url, rule_id, "DQ check failure")
            dq_warned += 1

        wdr_name = wr.wdr_name
        if wr.schema_fail:
            schema_fail += 1
            print(f"[{ts()}]   [{i}/{total}] {brand} {model} SCHEMA FAIL ({len(wr.hard_errors)})",
                  flush=True)
            for e in wr.hard_errors:
                prob.log("schema", sku, url, None, e)
        else:
            ok += 1
            print(f"[{ts()}]   [{i}/{total}] {brand} {model} OK", flush=True)

        manifest.setdefault("scraped", {})[sku or wdr_name] = {
            "file": wdr_name, "status": "ok" if not wr.schema_fail else "schema_fail"
        }
        if i % 50 == 0:
            save_manifest(out, manifest)
        if i % 100 == 0:
            elapsed = (datetime.now() - start).seconds
            print(f"[{ts()}] [{VENDOR}] {i}/{total} ({100*i//total}%) — "
                  f"{ok} OK, {dq_warned} DQ, {schema_fail} schema fails — {elapsed}s",
                  flush=True)

    save_manifest(out, manifest)
    elapsed = int((datetime.now() - start).total_seconds())
    prob.finalize(total)
    print(f"\n[{ts()}] [{VENDOR}] Done: {ok} OK, {dq_warned} DQ warnings, "
          f"{schema_fail} schema fails — {elapsed}s", flush=True)
    print(f"  Output: {out.resolve()}", flush=True)


if __name__ == "__main__":
    main()
