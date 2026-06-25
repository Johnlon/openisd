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
# WDR output — must match schema documented in drivers/README.md
# ---------------------------------------------------------------------------


def to_wdr(brand: str, model: str, fields: dict,
           provided_by: str = "", comment: str = "",
           manufacturer: str = "", date_added: str = "",
           date_modified: str = "",
           datasheet_url: str = "", vendor_page_url: str = "",
           source_url: str = "", frd_url: str = "",
           impedance_url: str = "") -> str:
    """
    Produce a WDR file string matching the Resonate WDR schema.
    fields must use canonical SI key names: Znom, BL, Le(H), Mms(kg),
    Cms(m/N), Sd(m²), Vas(m³), Xmax(m one-way). See drivers/README.md.

    CRITICAL: only write a T/S field if the source document contained a value.
    NEVER write 0 for any T/S field — real datasheets never publish 0 for Sd,
    Re, BL, Mms, Pe, Xmax, Qts, Qms, Vas, or Fs. A zero means the scraper
    found a blank cell and defaulted to 0; the field should be omitted instead.
    Extended WinISD compatibility fields (fLe, KLe, etc.) must always be present,
    set to 0. See drivers/README.md § Extended WinISD fields.
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

    # Derive computed fields only when source data exists
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
        "portingle=Y",
    ]
    if datasheet_url:
        lines.append(f"boxbench_datasheet={datasheet_url}")
    if frd_url:
        lines.append(f"boxbench_frd={frd_url}")
    if impedance_url:
        lines.append(f"boxbench_impedance={impedance_url}")
    if vendor_page_url:
        lines.append(f"boxbench_vendor_page={vendor_page_url}")
    if source_url:
        lines.append(f"boxbench_source={source_url}")

    # T/S fields — only emit if value was sourced and non-zero
    _TS_KEYS = ["Fs", "Qts", "Qes", "Qms", "Znom", "Re", "Le", "BL",
                "Mms", "Cms", "Rms", "Sd", "Vas", "Xmax", "Pe", "SPL"]
    for key in _TS_KEYS:
        if key in f:
            lines.append(f"{key}={f[key]}")

    # Derived fields — only emit when computable
    if vd is not None:
        lines.append(f"Vd={vd}")
    if dd is not None:
        lines.append(f"Dd={dd}")
    if ebp is not None:
        lines.append(f"EBP={ebp}")

    # Extended WinISD compatibility fields — always present, 0 unless known.
    # These are required for WinISD compatibility; omitting them causes silent failures.
    lines += [
        f"fLe=0",
        f"KLe=0",
        f"Dia=0",
        f"no=0",
        f"numVC=1",
        f"Hc=0",
        f"Hg=0",
        f"SPLmax=0",
        f"SPLmaxLF=0",
        f"USPL=0",
        f"alfaVC=0",
        f"Rt=0",
        f"Ct=0",
        f"gamma=0",
        f"Rme=0",
        f"Mpow=0",
        f"Mcost=0",
        f"Gloss=0",
        f"VCCon=2",
        f"c=343.68275625794",
        f"roo=1.20096171470853",
        f"Thick=0",
        f"Depth=0",
        f"MagDepth=0",
        f"Magnet=0",
        f"Basket=0",
        f"Outer=0",
        f"Vcd=0",
        f"DVol=0",
        f"ParState=EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC",
    ]

    return "\n".join(lines) + "\n"


def safe_filename(name: str) -> str:
    return re.sub(r"[^\w\-.]", "_", name).strip("_") + ".wdr"


def validate_ts_fields(fields: dict, label: str = "") -> list[str]:
    """
    Check T/S field values for physically impossible or highly suspicious values.
    Returns a list of human-readable warning strings (empty = all OK).
    Mirrors the rules in scripts/dq-check.mjs — keep both in sync.
    Called by the scraper before writing a WDR so bad values are caught at
    source, not discovered later by the DQ check.
    """
    warnings = []
    tag = f"[{label}] " if label else ""

    def v(key):
        val = fields.get(key)
        try:
            return float(val) if val is not None else None
        except (TypeError, ValueError):
            return None

    # Zero fields — scraper artifact
    for key in ("Fs","Qts","Qes","Qms","Re","BL","Mms","Sd","Vas","Xmax","Pe"):
        if key in fields and v(key) == 0:
            warnings.append(f"{tag}{key}=0 — scraper artifact (blank cell → 0); field will be omitted")

    # Fs
    fs = v("Fs")
    if fs is not None:
        if 0 < fs < 5:
            warnings.append(f"{tag}Fs={fs} < 5 Hz — dot-thousands scraper bug? e.g. '1.600 Hz' → 1.6; should be {fs*1000:.0f} Hz")
        if fs > 5000:
            warnings.append(f"{tag}Fs={fs} > 5000 Hz — implausible for a cone driver")

    # Pe
    pe = v("Pe")
    if pe == 1:
        warnings.append(f"{tag}Pe=1 W — dot/comma-thousands scraper bug; e.g. '1.000 W' → 1")

    # Qts vs Qes
    qts, qes = v("Qts"), v("Qes")
    if qts and qes and qts >= qes:
        warnings.append(f"{tag}Qts={qts} >= Qes={qes} — thermodynamically impossible")

    # Xmax
    xmax = v("Xmax")
    if xmax and xmax * 1000 > 100:
        warnings.append(f"{tag}Xmax={xmax*1000:.0f} mm — mm stored as m? divide by 1000")

    # Sd
    sd = v("Sd")
    if sd and sd * 1e4 < 0.5:
        warnings.append(f"{tag}Sd={sd*1e4:.3f} cm² — near-zero scraper artifact")
    if sd and sd * 1e4 > 3000:
        warnings.append(f"{tag}Sd={sd*1e4:.0f} cm² > 3000 — larger than any real driver")

    # Fs with no Q values → crossover/range frequency captured as Fs.
    # Compression drivers (HF, CD horn types) and AMT tweeters don't publish T/S Fs.
    # The scraper typically captures the minimum crossover frequency or usable range
    # lower bound ("1.300 kHz" → Fs=1300) into the Fs field instead.
    if fs is not None and fs > 500:
        has_q = "Qts" in fields or "Qes" in fields
        if not has_q:
            warnings.append(
                f"{tag}Fs={fs:.0f} Hz but no Qts or Qes — likely crossover/range frequency "
                f"captured as Fs; compression drivers and AMT tweeters do not publish T/S Fs. "
                f"Delete Fs and add a boxbench_corrections note explaining the absence."
            )

    # AMT driver: T/S Fs is undefined for Air Motion Transformer drivers (not pistonic).
    if label and re.search(r'\bAMT\b', label, re.IGNORECASE):
        if "Fs" in fields:
            warnings.append(
                f"{tag}Model label contains 'AMT' — Air Motion Transformer drivers are not "
                f"pistonic; T/S Fs is not a defined parameter. Do not write Fs."
            )

    # Vas vs Sd cross-check (ft³-as-liters bug)
    vas = v("Vas")
    if sd and vas and sd * 1e4 > 150 and vas * 1000 < sd * 1e4 / 60:
        warnings.append(
            f"{tag}Vas={vas*1000:.2f} L implausibly small for Sd={sd*1e4:.0f} cm² — "
            f"ft³-as-liters scraper bug? (SI page may show ft³; divide raw value by 28.317, not 1000)"
        )

    return warnings


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
                delay_s: float = DEFAULT_DELAY_S):
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
    args = parser.parse_args()

    out = Path(args.out_dir)
    pdf_dir = out / "datasheets"
    out.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(exist_ok=True)

    manifest = load_manifest(out)

    if callable(sitemap_url):
        # Vendor supplies its own URL collector (e.g. category-page crawl instead of sitemap)
        print(f"[{vendor_name}] Collecting product URLs ...")
        all_urls = sitemap_url()
    else:
        print(f"[{vendor_name}] Fetching sitemap(s) ...")
        all_urls = fetch_product_urls(sitemap_url, url_filter=url_filter, delay_s=delay_s)
    print(f"[{vendor_name}] {len(all_urls)} product URLs")

    if args.refresh:
        to_scrape = all_urls
    else:
        to_scrape = [u for u in all_urls if is_new_url(u, manifest)]
        print(f"[{vendor_name}] {len(to_scrape)} new (not yet scraped)")

    if args.limit:
        to_scrape = to_scrape[:args.limit]

    ok = skipped = failed = 0
    counters_lock = threading.Lock()
    html_dir = out / "_html"
    html_dir.mkdir(exist_ok=True)
    total = len(to_scrape)

    def process_one(idx_url):
        nonlocal ok, skipped, failed
        i, url = idx_url
        slug = url.rstrip("/").split("/")[-1]

        try:
            html = fetch(url)
            html_path = html_dir / (re.sub(r"[^\w\-.]", "_", slug) + ".html")
            html_path.write_text(html, encoding="utf-8")
            product = parse_product(html, url)
        except Exception as e:
            print(f"  [{i}/{total}] {slug} ERROR: {e}", flush=True)
            with counters_lock:
                mark_scraped(url, manifest, None, status=f"error: {e}")
                failed += 1
                if (ok + skipped + failed) % 50 == 0:
                    save_manifest(out, manifest)
            time.sleep(delay_s)
            return

        is_skip = product is None or (isinstance(product, dict) and product.get("skip"))
        if is_skip:
            cat = (product or {}).get("category", "") if isinstance(product, dict) else ""
            title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
            page_title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip() if title_m else ""
            label = f"(skipped — {cat})" if cat else "(skipped — no T/S data)"
            print(f"  [{i}/{total}] {slug} {label}", flush=True)
            with counters_lock:
                mark_scraped(url, manifest, None, status="skipped",
                             title=page_title, category=cat)
                skipped += 1
                if (ok + skipped + failed) % 50 == 0:
                    save_manifest(out, manifest)
            time.sleep(delay_s)
            return

        comment_parts = [f"Source: {url}"]
        if product.get("pdf_url"):
            comment_parts.append(f"Datasheet: {product['pdf_url']}")

        brand = product.get("brand", "")
        model = product.get("model", "")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Validate fields before writing — warn on suspicious values so the
        # DQ check doesn't need to catch what the scraper could have caught.
        for warning in validate_ts_fields(product["fields"], f"{brand} {model}"):
            print(f"  [{i}/{total}] {slug} DQ WARNING: {warning}", flush=True)

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

        # Write WDR after downloads so frd_ok / impedance_ok are resolved.
        wdr_text = to_wdr(
            brand=brand, model=model, fields=product["fields"],
            provided_by=product.get("provided_by", vendor_name),
            comment=" | ".join(comment_parts),
            manufacturer=product.get("manufacturer", ""),
            date_added=today, date_modified=today,
            datasheet_url=product.get("pdf_url") or "",
            frd_url=frd_ok,
            impedance_url=impedance_ok,
            vendor_page_url=url,
            source_url=url,
        )
        wdr_name = safe_filename(f"{brand} {model}".strip())
        (out / wdr_name).write_text(wdr_text, encoding="utf-8")

        meta = {
            "file": wdr_name, "quality": "M",
            "issue": "scraped_not_human_verified",
            "detail": (f"Automatically scraped from {product.get('provided_by', vendor_name)}. "
                       "T/S parameters have not been verified by a human against the datasheet."),
            "datasheet": product.get("pdf_url") or url,
            "reviewedBy": None,
        }
        (out / wdr_name.replace(".wdr", "_meta.json")).write_text(
            json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        suffix = " ".join(extras)
        print(f"  [{i}/{total}] {slug} OK {suffix}".rstrip(), flush=True)
        with counters_lock:
            mark_scraped(url, manifest, wdr_name, status="ok")
            ok += 1
            if (ok + skipped + failed) % 50 == 0:
                save_manifest(out, manifest)
        time.sleep(delay_s)

    workers = args.workers
    if workers > 1:
        print(f"[{vendor_name}] Running with {workers} parallel workers")
    with ThreadPoolExecutor(max_workers=workers) as executor:
        list(executor.map(process_one, enumerate(to_scrape, 1)))

    save_manifest(out, manifest)
    print(f"\n[{vendor_name}] Done: {ok} new WDRs, {skipped} skipped, {failed} errors")
    print(f"  Output: {out.resolve()}")
    print(f"  Manifest: {len(manifest['scraped'])} total URLs recorded")
