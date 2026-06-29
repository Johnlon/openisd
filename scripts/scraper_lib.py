"""
scraper_lib.py — shared infrastructure for Resonate vendor scrapers.

Each vendor scraper imports this module and provides:
  - SITEMAP_URL (str or list of strs)
  - parse_product(html: str, url: str) -> dict | None
    Returns {
      "brand": str,         # canonical brand name
      "model": str,         # manufacturer part number
      "manufacturer": str,  # full legal name (can equal brand)
      "provided_by": str,   # data source description
      "fields": {wdr_key: float},  # SI values, see drivers/README.md schema
      "pdf_url": str | None,
      "extra_links": [str], # FRD, ZMA, TXT, ZIP, etc.
    }
    or None if the page is not a driver product page.
    Field names must be canonical: Znom not Z, BL not Bl. See drivers/README.md.

The manifest (manifest.json in the output dir) tracks every scraped URL so
subsequent runs only fetch new pages. Use --refresh to force re-scrape all.
"""

import json
import yaml
import re
import sys
import time
import argparse
import threading
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from dq_check import check_fields
from wdr_meta_schema import validate_driver

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; resonate-scraper/1.0)"}
DEFAULT_DELAY_S = 1.0

# Force UTF-8 stdout/stderr so Unicode product names don't crash on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _safe_url(url: str) -> str:
    """Percent-encode any non-ASCII characters in a URL (keeps already-encoded parts intact)."""
    return urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%-")


def fetch(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(_safe_url(url), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def fetch_binary(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(_safe_url(url), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------

def _sitemap_urls_from_xml(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [e.text.strip() for e in root.findall(".//sm:loc", ns) if e.text]
    return locs


def fetch_product_urls(sitemap_url: str | list[str],
                       url_filter=None,
                       delay_s: float = DEFAULT_DELAY_S) -> list[str]:
    """
    Fetch one or more sitemaps (handles sitemap index → sub-sitemaps).
    url_filter: optional callable(url) -> bool to keep only matching URLs.
    Returns deduplicated list of product page URLs.
    """
    if isinstance(sitemap_url, str):
        sitemap_url = [sitemap_url]

    to_fetch = list(sitemap_url)
    product_urls: list[str] = []
    seen_sitemaps: set[str] = set()

    while to_fetch:
        url = to_fetch.pop(0)
        if url in seen_sitemaps:
            continue
        seen_sitemaps.add(url)
        try:
            xml = fetch(url)
        except Exception as e:
            print(f"  [sitemap] WARN: could not fetch {url}: {e}", file=sys.stderr)
            continue
        locs = _sitemap_urls_from_xml(xml)
        for loc in locs:
            if loc.endswith(".xml"):          # sub-sitemap index
                to_fetch.append(loc)
            elif url_filter is None or url_filter(loc):
                product_urls.append(loc)
        time.sleep(delay_s * 0.5)             # lighter delay for sitemaps

    # deduplicate, preserve order
    seen: set[str] = set()
    result = []
    for u in product_urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def load_manifest(out_dir: Path) -> dict:
    path = out_dir / "manifest.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"scraped": {}}


def save_manifest(out_dir: Path, manifest: dict) -> None:
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False),
                    encoding="utf-8")


def is_new_url(url: str, manifest: dict) -> bool:
    return url not in manifest.get("scraped", {})


def mark_scraped(url: str, manifest: dict, wdr_filename: str | None,
                 status: str = "ok", title: str = "", category: str = "") -> None:
    entry = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "wdr": wdr_filename,
        "status": status,
    }
    if title:
        entry["title"] = title
    if category:
        entry["category"] = category
    manifest.setdefault("scraped", {})[url] = entry


# ---------------------------------------------------------------------------
# ParState builder — dynamically reflects which fields are present
# ---------------------------------------------------------------------------

# T/S field → ParState position (0-indexed, confirmed via single-param probe files
# in drivers/sample/; see README.md there for the full confirmed map).
#
# WinISD's internal order differs significantly from WDR write order.
# Most notably: Qts is at position 14 (WDR writes it first).
#
# Positions not in this dict are either always-fixed (handled below in _parstate)
# or not relevant to the modern WDR format (fLe, KLe, Xlim, Hc, Hg etc.).
_PARSTATE_TS_POSITIONS: dict[str, int] = {
    "Znom": 0, "Fs": 1, "Pe": 2,
    # 3 = SPL (handled separately — C if computed, E if supplied in fields)
    "Re": 4, "Le": 5,
    # 6=fLe, 7=KLe — always N (not in modern format)
    "BL": 8, "Xmax": 9,
    # 10=Xlim — always N (not in modern format)
    "Cms": 11, "Qms": 12, "Qes": 13, "Qts": 14,
    "Rms": 15, "Mms": 16, "Sd": 17,
    # 18=Vd — C when Sd+Xmax available (handled below)
    "Vas": 19,
}

# Full confirmed position map (47/49 confirmed; see drivers/sample/README.md):
#  20=??? (always N; no UI entry — possibly obsolete Dia placeholder)
#  21=Dd  22=no  23=numVC  24=Hc  25=Hg
#  26=SPLmax  27=SPLmaxLF  28=USPL
#  29=alfaVC  30=Rt  31=Ct
#  32=gamma  33=EBP  34=Rme  35=Mpow  36=Mcost  37=Gloss
#  38=Thick  39=Depth  40=MagDepth  41=Magnet
#  42=Basket  43=Outer  44=Vcd  45=DVol
#  46=??? (always N; no UI entry)
#  47=c  48=roo
#  VCCon: NOT in ParState — confirmed pure WDR metadata field


def _parstate(fields: dict) -> str:
    """
    Build a 49-char WinISD ParState string for a driver with the given fields.

    E = user entered / scraper sourced from datasheet
    C = WinISD computes from other E fields
    N = not in play (field absent or not active)
    """
    base = list("N" * 49)

    # Always-fixed positions
    base[23] = "E"   # numVC — always E (WinISD defaults to 1)
    base[32] = "C"   # gamma (probe s-gamma confirms pos 32)
    base[33] = "C"   # EBP   (probe s-ebp confirms pos 33 — NOT Rme as WDR write order implies)
    base[34] = "C"   # Rme   (probe s-rme confirms pos 34)
    base[35] = "C"   # Mpow  (probe s-mpow confirms pos 35)
    base[36] = "C"   # Mcost (probe s-mcost confirms pos 36 — NOT VCCon)
    base[37] = "C"   # Gloss (probe s-gloss confirms pos 37)
    base[47] = "C"   # c — speed of sound, always computed
    base[48] = "C"   # roo — air density, always computed

    # SPL (pos 3): E if user-supplied, C if WinISD computes it
    spl = fields.get("SPL")
    base[3] = "E" if (spl and spl != 0) else "C"

    # T/S fields: E when present in the fields dict
    for key, pos in _PARSTATE_TS_POSITIONS.items():
        if fields.get(key):
            base[pos] = "E"

    # Computed fields: C when source fields are available
    if fields.get("Sd") and fields.get("Xmax"):
        base[18] = "C"   # Vd
    if fields.get("Sd"):
        base[21] = "C"   # Dd

    # η₀ (no, pos 22): C when WinISD can compute it — needs Fs, Vas, Qes at minimum
    if fields.get("Fs") and fields.get("Vas") and fields.get("Qes"):
        base[22] = "C"

    # SPLmax (26) and SPLmaxLF (27): C when SPL is computable
    if fields.get("Sd") and fields.get("Re") and fields.get("Pe"):
        base[26] = "C"
        base[27] = "C"

    # USPL (28): C when SPL and Pe are available
    if fields.get("Pe"):
        base[28] = "C"

    return "".join(base)


# ---------------------------------------------------------------------------
# WDR output — must match schema documented in drivers/README.md
# ---------------------------------------------------------------------------


def to_wdr(brand: str, model: str, fields: dict,
           provided_by: str = "", comment: str = "",
           manufacturer: str = "", date_added: str = "",
           date_modified: str = "") -> str:
    """
    Produce a WDR file string matching the WinISD native WDR schema exactly.
    fields must use canonical SI key names: Znom, BL, Le(H), Mms(kg),
    Cms(m/N), Sd(m²), Vas(m³), Xmax(m one-way). See drivers/README.md.

    Provenance (datasheet URLs, FRD, impedance, source) must NOT go here —
    they belong in the _meta.json sidecar. The WDR must stay schema-identical
    to native WinISD exports (see drivers/sample/ for the authoritative format).

    Only write a field if the source document contained a value or it can be
    calculated from available values. Never write 0 for a field whose datasheet
    value is genuinely absent — omit it instead. A zero in fields like Sd, Re,
    BL, Mms, Xmax, Fs is always a scraper artifact (blank cell → 0).
    """
    import math

    # Strip zeros from T/S fields before writing — a zero is always a scraper
    # artifact (blank cell → 0), never a valid datasheet value.
    _ZERO_NEVER_VALID = {"Fs","Qts","Qes","Qms","Znom","Re","BL","Mms","Cms",
                         "Rms","Sd","Vas","Xmax","Pe"}
    f = {k: v for k, v in fields.items()
         if not (k in _ZERO_NEVER_VALID and v == 0)}

    # Warn about dropped zeros so the caller knows data was suppressed
    dropped = [k for k in fields if k in _ZERO_NEVER_VALID and fields[k] == 0]
    if dropped:
        print(f"  [to_wdr] WARNING: dropped zero-value T/S fields (scraper artifact): "
              f"{', '.join(dropped)} — omit rather than write 0", file=sys.stderr)

    # Derive computed fields only when source data exists.
    # Vd, Dd, EBP are always written; if dependencies are missing, write 0.
    # Real WinISD files (drivers/matt/ collection: 411 files) confirm this pattern:
    # - Vd (Sd × Xmax): 402/411 computed, 9 zeros (when Xmax missing)
    # - Dd (√(4Sd/π)): 411/411 computed, 0 zeros (always derivable from Sd)
    # - EBP (Fs/Qes): 410/411 computed, 1 zero (when Qes missing)
    # WinISD recomputes these on load, so 0 is safe and expected for missing deps.
    vd = round(f["Sd"] * f["Xmax"], 9) if f.get("Sd") and f.get("Xmax") else None
    dd = round(math.sqrt(4 * f["Sd"] / math.pi), 9) if f.get("Sd") else None
    ebp = round(f["Fs"] / f["Qes"], 2) if f.get("Fs") and f.get("Qes") else None

    # Provenance header — always present
    lines = [
        "[Driver]",
        f"Brand={brand}",
        f"Model={model}",
        f"Manufacturer={manufacturer}",
        f"ProvidedBy={provided_by}",
        f"Comment={comment}",
        f"DateAdded={date_added}",
        f"DateModified={date_modified}",
    ]

    # Write fields in WinISD canonical order; only emit if sourced and non-zero.
    for key in ("Qts", "Znom", "Fs", "Pe", "SPL", "Re", "Le", "fLe", "KLe"):
        if key in f:
            lines.append(f"{key}={f[key]}")
    for key in ("BL", "Xmax", "Cms", "Qms", "Qes", "Rms", "Mms", "Sd", "Vas", "Dia"):
        if key in f:
            lines.append(f"{key}={f[key]}")

    # Calculatable fields — computed when dependencies available, otherwise 0.
    lines.append(f"Vd={vd}" if vd is not None else "Vd=0")
    lines += ["no=0"]
    lines.append(f"Dd={dd}" if dd is not None else "Dd=0")
    lines.append(f"EBP={ebp}" if ebp is not None else "EBP=0")

    lines += [
        "numVC=1",
        "Hc=0",
        "Hg=0",
        "SPLmax=0",
        "SPLmaxLF=0",
        "USPL=0",
    ]

    lines += [
        "alfaVC=0",
        "Rt=0",
        "Ct=0",
        "gamma=0",
        "Rme=0",
        "Mpow=0",
        "Mcost=0",
        "Gloss=0",
    ]

    # Connection + air properties (standard WinISD values for 20°C)
    lines += [
        "VCCon=1",
        "c=343.684120962152",
        "roo=1.20095217714682",
    ]

    # Physical dimensions — 0 (not scraped)
    lines += [
        "Thick=0",
        "Depth=0",
        "MagDepth=0",
        "Magnet=0",
        "Basket=0",
        "Outer=0",
        "Vcd=0",
        "DVol=0",
    ]

    lines.append(f"ParState={_parstate(f)}")

    return "\n".join(lines) + "\n"


def safe_filename(name: str) -> str:
    return re.sub(r"[^\w\-.]", "_", name).strip("_") + ".wdr"


def parse_number(text: str) -> float | None:
    """Extract first number from a string, handling mixed US/European notation.

    Rules:
    - If both comma and period present (e.g. '1,241.1'): period=decimal, comma=thousand sep → strip commas
    - If comma but no period AND digit,exactly-3-digits (e.g. '1,000'): thousand sep → strip comma
    - Otherwise (e.g. '10,9' or '0,044'): European decimal comma → replace with period
    """
    if "," in text and "." in text:
        # Period is decimal, comma is thousand sep: "1,241.1" → "1241.1"
        cleaned = re.sub(r"(\d),(\d)", r"\1\2", text)
    elif re.search(r"[1-9]\d*,\d{3}(?!\d)", text):
        # Thousand sep only when integer part ≥ 1: "1,000" yes, "0,044" no
        cleaned = re.sub(r"(\d),(\d)", r"\1\2", text)
    else:
        # European decimal comma: "10,9" → "10.9", "0,044" → "0.044"
        cleaned = text.replace(",", ".")
    m = re.search(r"[-+]?\d+(?:\.\d+)?", cleaned)
    return float(m.group()) if m else None


# ---------------------------------------------------------------------------
# Main runner — called by each vendor script
# ---------------------------------------------------------------------------

def run_scraper(vendor_name: str,
                sitemap_url: str | list[str],
                parse_product,
                out_dir_default: str,
                url_filter=None,
                delay_s: float = DEFAULT_DELAY_S,
                is_manufacturer_site: bool = True):
    """
    Generic scrape loop. Call from vendor __main__.

    parse_product(html, url) -> dict | None
      dict keys: name, fields, pdf_url, extra_links
    """
    parser = argparse.ArgumentParser(description=f"Scrape {vendor_name} → WDR files")
    parser.add_argument("--out-dir", default=out_dir_default)
    parser.add_argument("--limit", type=int, default=0,
                        help="Max new products to scrape (0 = all new)")
    parser.add_argument("--refresh", action="store_true",
                        help="Re-scrape all URLs, not just new ones")
    parser.add_argument("--workers", type=int, default=1,
                        help="Parallel fetch workers (default 1; try 5-10 for speed)")
    parser.add_argument("--cache-html-dir", default=None,
                        help="Read cached HTML from this directory instead of fetching live")
    args = parser.parse_args()

    out = Path(args.out_dir)
    pdf_dir = out / "datasheets"
    out.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(exist_ok=True)

    manifest = load_manifest(out)

    _ts0 = datetime.now().strftime("%H:%M:%S")
    if callable(sitemap_url):
        print(f"[{_ts0}] [{vendor_name}] Collecting product URLs ...")
        all_urls = sitemap_url()
    else:
        print(f"[{_ts0}] [{vendor_name}] Fetching sitemap(s) ...")
        all_urls = fetch_product_urls(sitemap_url, url_filter=url_filter, delay_s=delay_s)
    _ts1 = datetime.now().strftime("%H:%M:%S")
    print(f"[{_ts1}] [{vendor_name}] {len(all_urls)} product URLs")

    if args.refresh:
        to_scrape = all_urls
    else:
        to_scrape = [u for u in all_urls if is_new_url(u, manifest)]
        print(f"[{_ts1}] [{vendor_name}] {len(to_scrape)} new (not yet scraped)")

    if args.limit:
        to_scrape = to_scrape[:args.limit]

    ok = skipped = failed = 0
    counters_lock = threading.Lock()
    html_dir = out / "_html"
    html_dir.mkdir(exist_ok=True)
    cache_html_dir = Path(args.cache_html_dir) if args.cache_html_dir else None
    total = len(to_scrape)
    start_time = datetime.now()

    def ts():
        return datetime.now().strftime("%H:%M:%S")

    def progress_line():
        done = ok + skipped + failed
        pct = 100 * done // total if total else 0
        elapsed = (datetime.now() - start_time).seconds
        return (f"[{ts()}] [{vendor_name}] {done}/{total} ({pct}%) — "
                f"{ok} WDRs, {skipped} skipped, {failed} errors — {elapsed}s elapsed")

    def process_one(idx_url):
        nonlocal ok, skipped, failed
        i, url = idx_url
        slug = url.rstrip("/").split("/")[-1]
        html_filename = re.sub(r"[^\w\-.]", "_", slug) + ".html"

        try:
            cached = cache_html_dir / html_filename if cache_html_dir else None
            if cached and cached.exists():
                html = cached.read_text(encoding="utf-8", errors="replace")
            else:
                html = fetch(url)
                (html_dir / html_filename).write_text(html, encoding="utf-8")
            product = parse_product(html, url)
        except Exception as e:
            print(f"[{ts()}]   [{i}/{total}] {slug} ERROR: {e}", flush=True)
            with counters_lock:
                mark_scraped(url, manifest, None, status=f"error: {e}")
                failed += 1
                done = ok + skipped + failed
                if done % 50 == 0:
                    save_manifest(out, manifest)
                if done % 100 == 0:
                    print(progress_line(), flush=True)
            time.sleep(delay_s)
            return

        is_skip = product is None or (isinstance(product, dict) and product.get("skip"))
        if is_skip:
            cat = (product or {}).get("category", "") if isinstance(product, dict) else ""
            title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
            page_title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip() if title_m else ""
            with counters_lock:
                mark_scraped(url, manifest, None, status="skipped",
                             title=page_title, category=cat)
                skipped += 1
                done = ok + skipped + failed
                if done % 50 == 0:
                    save_manifest(out, manifest)
                if done % 100 == 0:
                    print(progress_line(), flush=True)
            time.sleep(delay_s)
            return

        comment_parts = [f"Source: {url}"]
        if product.get("pdf_url"):
            comment_parts.append(f"Datasheet: {product['pdf_url']}")

        brand = product.get("brand", "")
        model = product.get("model", "")
        today = datetime.now(timezone.utc).strftime("%Y%m%d")

        # DQ check — log every issue; always write the driver (data with DQ flags
        # is better than no data; UI can highlight suspect values via dq_issue field).
        # TODO: Resonate UI should show suspect values in a different colour.
        dq_issues: list[str] = []
        for rule_id, desc, detail in check_fields(product["fields"]):
            print(f"[{ts()}]   [{i}/{total}] {slug} DQ {rule_id}: {detail}", flush=True)
            dq_issues.append(rule_id)
            if rule_id in ("Qts_impossible", "Qts_impossible2"):
                for fld in ("Qts", "Qes", "Qms"):
                    tag = f"suspect:{fld}"
                    if tag not in dq_issues:
                        dq_issues.append(tag)

        # Download FRD/impedance files first so the WDR can reference them.
        extras = []
        frd_ok = ""
        impedance_ok = ""

        if product.get("pdf_url"):
            pdf_name = urllib.parse.unquote(product["pdf_url"].split("/")[-1])
            pdf_path = pdf_dir / pdf_name
            if not pdf_path.exists():
                try:
                    pdf_path.write_bytes(fetch_binary(product["pdf_url"]))
                    extras.append("+PDF")
                except Exception as e:
                    extras.append(f"(PDF err: {e})")

        if product.get("frd_url"):
            fname = urllib.parse.unquote(product["frd_url"].split("/")[-1])
            fpath = out / fname
            if not fpath.exists():
                try:
                    fpath.write_bytes(fetch_binary(product["frd_url"]))
                    extras.append(f"+FRD")
                except Exception as e:
                    extras.append(f"(FRD err: {e})")
            if fpath.exists():
                frd_ok = product["frd_url"]

        if product.get("impedance_url"):
            fname = urllib.parse.unquote(product["impedance_url"].split("/")[-1])
            fpath = out / fname
            if not fpath.exists():
                try:
                    fpath.write_bytes(fetch_binary(product["impedance_url"]))
                    extras.append(f"+IMP")
                except Exception as e:
                    extras.append(f"(IMP err: {e})")
            if fpath.exists():
                impedance_ok = product["impedance_url"]

        for link in product.get("extra_links", []):
            fname = urllib.parse.unquote(link.split("/")[-1])
            fpath = out / fname
            if not fpath.exists():
                try:
                    fpath.write_bytes(fetch_binary(link))
                    extras.append(f"+{fname}")
                except Exception as e:
                    extras.append(f"({fname} err: {e})")

        # Write WDR — pure WinISD schema, no boxbench_ fields.
        wdr_text = to_wdr(
            brand=brand, model=model, fields=product["fields"],
            provided_by=product.get("provided_by", vendor_name),
            comment=" | ".join(comment_parts),
            manufacturer=product.get("manufacturer", ""),
            date_added=today, date_modified=today,
        )
        wdr_name = safe_filename(f"{brand} {model}".strip())
        (out / wdr_name).write_text(wdr_text, encoding="utf-8")

        # Write sidecar — all provenance/quality metadata lives here, not in WDR.
        meta = {
            "quality": "M",
            "issue": "scraped_not_human_verified",
            "detail": (f"Automatically scraped from {product.get('provided_by', vendor_name)}. "
                       "T/S parameters have not been verified by a human against the datasheet."),
            "corrections": None,
            "reviewed_by": None,
            "driver_type": product.get("driver_type") or None,
            "datasheet": product.get("pdf_url") or None,
            "manu_page": url if is_manufacturer_site else None,
            "vendor_page": None if is_manufacturer_site else url,
            "source": url,
            "frd": frd_ok or None,
            "impedance": impedance_ok or None,
            "obsolete": None,
            "dq_issue": "; ".join(dq_issues) if dq_issues else None,
            "community": None,
            "fetched_sku": None,
            "specs": product.get("specs") or None,
        }
        (out / wdr_name.replace(".wdr", "_meta.yml")).write_text(
            yaml.dump(meta, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

        # Cross-check field consistency (Qts from Qes+Qms, Vas from Sd+Cms, etc.).
        # INFO: level items go into corrections; hard errors are logged but driver is
        # still written — some data is always better than none.
        wdr_path  = out / wdr_name
        meta_path = out / wdr_name.replace(".wdr", "_meta.yml")
        all_issues = validate_driver(wdr_path, meta_path)
        hard_errors = [e for e in all_issues if ": INFO:" not in e and not e.startswith("INFO:")]
        infos       = [e for e in all_issues if ": INFO:" in e or e.startswith("INFO:")]
        if infos or hard_errors:
            # Re-read and update meta with corrections/schema issues
            import yaml as _yaml
            _m = _yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}
            if infos:
                _m["corrections"] = "; ".join(e.split(": INFO: ", 1)[-1] for e in infos)
            if hard_errors:
                existing_dq = _m.get("dq_issue") or ""
                schema_tags = [f"schema:{e[:60]}" for e in hard_errors]
                _m["dq_issue"] = (existing_dq + "; " if existing_dq else "") + "; ".join(schema_tags)
            meta_path.write_text(_yaml.dump(_m, allow_unicode=True, sort_keys=False), encoding="utf-8")

        suffix = " ".join(extras)
        if hard_errors:
            print(f"[{ts()}]   [{i}/{total}] {slug} SCHEMA FAIL ({len(hard_errors)}) {suffix}".rstrip(), flush=True)
        else:
            print(f"[{ts()}]   [{i}/{total}] {slug} OK {suffix}".rstrip(), flush=True)
        with counters_lock:
            mark_scraped(url, manifest, wdr_name, status="ok" if not hard_errors else "schema_fail")
            ok += 1
            done = ok + skipped + failed
            if done % 50 == 0:
                save_manifest(out, manifest)
            if done % 100 == 0:
                print(progress_line(), flush=True)
        time.sleep(delay_s)

    workers = args.workers
    if workers > 1:
        print(f"[{ts()}] [{vendor_name}] Running with {workers} parallel workers", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        list(executor.map(process_one, enumerate(to_scrape, 1)))

    elapsed = (datetime.now() - start_time).seconds
    save_manifest(out, manifest)
    print(f"\n[{ts()}] [{vendor_name}] Done: {ok} new WDRs, {skipped} skipped, {failed} errors — {elapsed}s")
    print(f"  Output: {out.resolve()}")
    print(f"  Manifest: {len(manifest['scraped'])} total URLs recorded")
