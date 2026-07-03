"""
scraper_lib.py — shared infrastructure for OpenISD vendor scrapers.

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

import dataclasses
import json
import math
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
from wdr_meta_schema import validate_driver, reorder_meta_for_save, WDR_MANDATORY_TS

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; openisd-scraper/1.0)"}
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
    m = re.search(r"[-+]?(?:\d+\.?\d*|\.\d+)", cleaned)
    return float(m.group()) if m else None


def parse_field_value(key: str, value_text: str, nominal_factor: float,
                      unit_text: str = "") -> float | None:
    """
    Parse a T/S field value and return its SI equivalent.

    Detects the actual unit from value_text and/or unit_text (dedicated unit column,
    e.g. Wavecor three-column tables), overriding nominal_factor when a known unit
    indicator is present.  All scrapers should call this instead of rolling their own
    inline unit-detection blocks — rules live here once.

    key           : WDR field name (Fs, Mms, Cms, Le, Sd, Vas, Xmax, …)
    value_text    : raw scraped string, e.g. "0.84 ft³" or "2.5"
    nominal_factor: default SI conversion factor from the scraper's FIELD_MAP
    unit_text     : separate unit-column string if available; combined with value_text
                    for detection (pass "" when unit is embedded in value_text)
    """
    val = parse_number(value_text)
    if val is None:
        return None

    both = (value_text + " " + unit_text).lower()
    factor = nominal_factor

    if key == "Fs":
        if "khz" in both:
            factor = 1000.0                    # kHz → Hz

    elif key == "Mms":
        if "kg" in both:
            factor = 1.0                       # already kg
        elif "mg" in both:
            factor = 1e-6                      # mg → kg (ultra-light tweeter domes)
        # else: g → kg (nominal 1e-3)

    elif key == "Le":
        if "µh" in both or "uh" in both:
            factor = 1e-6                      # µH → H
        elif "mh" not in both and "h" in both:
            factor = 1.0                       # bare H (no prefix) → no conversion
        # else: mH → H (nominal 1e-3)

    elif key == "Cms":
        if any(s in both for s in ("µm", "μm", "um/n")):
            factor = 1e-6                      # µm/N → m/N
        elif re.search(r"\bmn\b|mn-1|mn⁻", both):
            factor = 1e-6                      # MN⁻¹ → m/N (same scaling: 1 MN⁻¹ = 1e-6 m/N)
        # else: mm/N → m/N (nominal 1e-3)

    elif key == "Sd":
        has_m2 = "m²" in both or "m2" in both
        has_cm = "cm" in both
        has_in = bool(re.search(r"\bin\b|in[²2]|sq.?in", both)) and "min" not in both
        if has_m2 and not has_cm:
            factor = 1.0                       # already m²
        elif has_in:
            factor = 6.4516e-4                 # in² → m²
        # else: cm² → m² (nominal 1e-4)

    elif key == "Vas":
        if "ft" in both:
            factor = 28.3168e-3                # ft³ → m³
        elif re.search(r"\bml\b|mlit|m\.?l\.", both):
            factor = 1e-6                      # mL → m³
        elif "m³" in both or "m3" in both:
            factor = 1.0                       # already m³
        # else: litres → m³ (nominal 1e-3)

    elif key == "Xmax":
        if "m" in both and "mm" not in both and not (re.search(r'(?<!\w)in(?!\w)|"', both) and "min" not in both):
            factor = 1.0                       # bare 'm' (SI metres) — no "mm" in string
        elif re.search(r'(?<!\w)in(?!\w)|"', both) and "min" not in both:
            factor = 25.4e-3                   # inch one-way → m
        # else: nominal (mm one-way = 1e-3, or p-p encoded in FIELD_MAP as 0.5e-3)

    result = val * factor
    if key == "Xmax":
        result = abs(result)                   # handles "+/-X mm" notation
    return round(result, 9)


# ── Spec YAML annotation ───────────────────────────────────────────────────────
# Inline comments added to spec field key lines in the written YAML.
# Inline comments written into the specs: YAML block by annotate_specs_yaml().

SPEC_FIELD_COMMENTS: dict[str, str] = {
    "Fs":               "free air resonance (Hz)",
    "Re":               "DC voice coil resistance (Ω)",
    "Qts":              "total Q factor",
    "Qes":              "electrical Q factor",
    "Qms":              "mechanical Q factor",
    "BL":               "force factor (T·m)",
    "Mms":              "moving mass incl. air load (kg)",
    "Cms":              "mechanical compliance (m/N)",
    "Sd":               "effective piston area (m²)",
    "Vas":              "equivalent acoustic volume (m³)",
    "Xmax":             "one-way linear excursion (m)",
    "Le":               "voice coil inductance (H)",
    "Znom":             "nominal impedance (Ω)",
    "Pe":               "rated power input (W)",
    "SPL":              "sensitivity (dB, 2.83 V/1 m)",
    "Rms":              "mechanical resistance (kg/s)",
    "voice_coil_dia_mm": "voice coil diameter (mm)",
    "Hg_mm":            "magnetic gap height (mm)",
    "freq_low_hz":      "published lower frequency limit (Hz)",
    "freq_high_hz":     "published upper frequency limit (Hz)",
    "power_peak_W":     "peak power handling (W)",
    "weight_kg":        "driver weight (kg)",
}


def annotate_specs_yaml(yaml_str: str) -> str:
    """Insert inline # comments on spec field key lines in yaml.dump() output."""
    in_specs = False
    out = []
    for line in yaml_str.splitlines():
        if line == "specs:":
            in_specs = True
        elif in_specs and line and not line.startswith(" "):
            in_specs = False
        if in_specs:
            m = re.match(r"^( {2})([A-Za-z_][A-Za-z0-9_]*):(\s*)$", line)
            if m and m.group(2) in SPEC_FIELD_COMMENTS:
                line = f"{m.group(1)}{m.group(2)}:  # {SPEC_FIELD_COMMENTS[m.group(2)]}"
        out.append(line)
    return "\n".join(out) + "\n"


# ── Single driver write function ───────────────────────────────────────────────

@dataclasses.dataclass
class WriteResult:
    """Return value from write_driver — summarises what happened during the write."""
    wdr_name: str | None = None          # filename written; None → mandatory-TS check failed
    missing_ts: frozenset = dataclasses.field(default_factory=frozenset)
    dq_issues: list = dataclasses.field(default_factory=list)   # rule_ids from check_fields
    hard_errors: list = dataclasses.field(default_factory=list) # from validate_driver
    infos: list = dataclasses.field(default_factory=list)       # INFO items from validate_driver

    @property
    def ok(self) -> bool:
        return self.wdr_name is not None and not self.hard_errors

    @property
    def schema_fail(self) -> bool:
        return self.wdr_name is not None and bool(self.hard_errors)

    @property
    def ts_fail(self) -> bool:
        return bool(self.missing_ts)


# Calculatable field definitions — mirrors _WDR_CALCULATABLE in wdr_meta_schema.py.
# Only Vd/Dd/EBP are auto-added here; Qts/Rme/Mpow/Vas/gamma are published by vendors.
_CALC_FIELDS = {
    "Vd":  (("Sd", "Xmax"),  lambda f: f["Sd"] * f["Xmax"]),
    "Dd":  (("Sd",),         lambda f: 2.0 * math.sqrt(f["Sd"] / math.pi)),
    "EBP": (("Fs", "Qes"),   lambda f: f["Fs"] / f["Qes"]),
}


def _build_specs(specs: dict | None, fields: dict) -> dict | None:
    """Merge caller-supplied specs provenance with auto-computed calculatable fields."""
    block = dict(specs) if specs else {}
    for cfld, (deps, fn) in _CALC_FIELDS.items():
        if cfld not in block and all(d in fields and fields[d] for d in deps):
            try:
                val = fn(fields)
                block[cfld] = {"value": val, "winner": "calculated",
                               "sources": {"calculated": val}}
            except Exception:
                pass
    return block or None


def write_driver(
    out_dir: Path,
    *,
    brand: str,
    model: str,
    manufacturer: str,
    fields: dict,
    provided_by: str,
    url: str,
    today: str,
    comment: str = "",
    is_manufacturer_site: bool = True,
    datasheet_url: str | None = None,
    adv_datasheet_url: str | None = None,
    drawing_url: str | None = None,
    cad_url: str | None = None,
    frd_url: str | None = None,
    zma_url: str | None = None,
    driver_type: str | None = None,
    nominal_size_cm: float | None = None,
    detail: str = "",
    corrections: str | None = None,
    obsolete: bool | None = None,
    dq_issue_static: str | None = None,
    fetched_sku: str | None = None,
    specs: dict | None = None,
    sources: dict | None = None,
) -> WriteResult:
    """
    Write WDR + _meta.yml for one scraped driver — all validation in one place.

    Enforces:
    - Mandatory T/S field check (WDR_MANDATORY_TS) — returns ts_fail if any missing, writes nothing
    - DQ check (check_fields) — issues collected and stored in dq_issue
    - Canonical field ordering (reorder_meta_for_save) and spec annotation (annotate_specs_yaml)
    - Schema validation (validate_driver) — INFO items → corrections; errors → dq_issue tags

    dq_issue_static: static known-issue string from the scraper config (e.g. wavecor variant
                     known issues); merged with live check_fields output.
    sources:         pre-built _sources index; if None, a minimal one is built from the URL args.
    specs:           provenance block built by the caller (e.g. _scrape_one); calculatable fields
                     (Vd, Dd, EBP) are auto-added here if their dependencies are present in fields.
    """
    # ── 1. Mandatory T/S check ────────────────────────────────────────────────
    missing = WDR_MANDATORY_TS - set(fields)
    if missing:
        return WriteResult(missing_ts=frozenset(missing))

    # ── 2. DQ check ───────────────────────────────────────────────────────────
    dq_issues: list[str] = []
    for rule_id, _desc, _detail in check_fields(fields):
        dq_issues.append(rule_id)
        if rule_id in ("Qts_impossible", "Qts_impossible2"):
            for fld in ("Qts", "Qes", "Qms"):
                tag = f"suspect:{fld}"
                if tag not in dq_issues:
                    dq_issues.append(tag)

    dq_parts = ["; ".join(dq_issues)] if dq_issues else []
    if dq_issue_static:
        dq_parts.append(dq_issue_static)
    dq_combined = "; ".join(dq_parts) or None

    # ── 3. Build _sources index ───────────────────────────────────────────────
    if sources is None:
        sources = {}
        if datasheet_url:
            sources["datasheet"] = datasheet_url
        if adv_datasheet_url and adv_datasheet_url != datasheet_url:
            sources["adv_datasheet"] = adv_datasheet_url
        sources["manu_page" if is_manufacturer_site else "vendor_page"] = url

    # ── 4. Write WDR ──────────────────────────────────────────────────────────
    wdr_text = to_wdr(
        brand=brand, model=model, fields=fields,
        provided_by=provided_by,
        comment=comment,
        manufacturer=manufacturer,
        date_added=today, date_modified=today,
    )
    wdr_name = safe_filename(f"{brand} {model}".strip())
    wdr_path  = out_dir / wdr_name
    meta_path = out_dir / wdr_name.replace(".wdr", "_meta.yml")
    wdr_path.write_text(wdr_text, encoding="utf-8")

    # ── 5. Write _meta.yml ────────────────────────────────────────────────────
    meta: dict = {
        "source":          url,
        "manu_page_url":   url if is_manufacturer_site else None,
        "vendor_page_url": None if is_manufacturer_site else url,
        "datasheet_url":   datasheet_url or None,
        "adv_datasheet_url": adv_datasheet_url or None,
        "drawing_url":     drawing_url or None,
        "cad_url":         cad_url or None,
        "frd_url":         frd_url or None,
        "zma_url":         zma_url or None,
        "quality":         "M",
        "issue":           "scraped_not_human_verified",
        "detail":          detail or None,
        "corrections":     corrections or None,
        "reviewed_by":     None,
        "driver_type":     driver_type or None,
        "nominal_size_cm": nominal_size_cm,
        "obsolete":        obsolete,
        "dq_issue":        dq_combined,
        "community":       None,
        "fetched_sku":     fetched_sku or None,
        "_sources":        sources or None,
        "specs":           _build_specs(specs, fields),
    }
    _write_meta(meta_path, meta)

    # ── 6. Schema validation — patch corrections + schema dq tags back in ─────
    all_issues  = validate_driver(wdr_path, meta_path)
    hard_errors = [e for e in all_issues if ": INFO:" not in e and not e.startswith("INFO:")]
    infos       = [e for e in all_issues if ": INFO:" in e or e.startswith("INFO:")]

    if infos or hard_errors:
        if infos:
            existing_corr = meta.get("corrections") or ""
            new_corr = "; ".join(e.split(": INFO: ", 1)[-1] for e in infos)
            meta["corrections"] = (existing_corr + "; " + new_corr) if existing_corr else new_corr
        if hard_errors:
            existing_dq = meta.get("dq_issue") or ""
            schema_tags = "; ".join(f"schema:{e[:60]}" for e in hard_errors)
            meta["dq_issue"] = (existing_dq + "; " + schema_tags) if existing_dq else schema_tags
        _write_meta(meta_path, meta)

    return WriteResult(
        wdr_name=wdr_name,
        dq_issues=dq_issues,
        hard_errors=hard_errors,
        infos=infos,
    )


def _write_meta(path: Path, meta: dict) -> None:
    """Reorder + annotate + write a meta dict as YAML."""
    raw = yaml.dump(reorder_meta_for_save(meta), allow_unicode=True, sort_keys=False)
    path.write_text(annotate_specs_yaml(raw), encoding="utf-8")


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
    pdf_dir = out / "_datasheets"
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

        brand   = product.get("brand", "")
        model   = product.get("model", "")
        today   = datetime.now(timezone.utc).strftime("%Y%m%d")
        extras  = []
        frd_url = ""
        zma_url = ""

        if product.get("datasheet_url"):
            pdf_name = urllib.parse.unquote(product["datasheet_url"].split("/")[-1])
            pdf_path = pdf_dir / pdf_name
            if not pdf_path.exists():
                try:
                    pdf_path.write_bytes(fetch_binary(product["datasheet_url"]))
                    extras.append("+PDF")
                except Exception as e:
                    extras.append(f"(PDF err: {e})")

        if product.get("frd_url"):
            fname = urllib.parse.unquote(product["frd_url"].split("/")[-1])
            fpath = out / fname
            if not fpath.exists():
                try:
                    fpath.write_bytes(fetch_binary(product["frd_url"]))
                    extras.append("+FRD")
                except Exception as e:
                    extras.append(f"(FRD err: {e})")
            if fpath.exists():
                frd_url = product["frd_url"]

        if product.get("zma_url"):
            fname = urllib.parse.unquote(product["zma_url"].split("/")[-1])
            fpath = out / fname
            if not fpath.exists():
                try:
                    fpath.write_bytes(fetch_binary(product["zma_url"]))
                    extras.append("+IMP")
                except Exception as e:
                    extras.append(f"(IMP err: {e})")
            if fpath.exists():
                zma_url = product["zma_url"]

        for link in product.get("extra_links", []):
            fname = urllib.parse.unquote(link.split("/")[-1])
            fpath = out / fname
            if not fpath.exists():
                try:
                    fpath.write_bytes(fetch_binary(link))
                    extras.append(f"+{fname}")
                except Exception as e:
                    extras.append(f"({fname} err: {e})")

        comment_parts = [f"Source: {url}"]
        if product.get("datasheet_url"):
            comment_parts.append(f"Datasheet: {product['datasheet_url']}")

        result = write_driver(
            out,
            brand=brand,
            model=model,
            manufacturer=product.get("manufacturer", ""),
            fields=product["fields"],
            provided_by=product.get("provided_by", vendor_name),
            url=url,
            today=today,
            comment=" | ".join(comment_parts),
            is_manufacturer_site=is_manufacturer_site,
            datasheet_url=product.get("datasheet_url") or None,
            frd_url=frd_url or None,
            zma_url=zma_url or None,
            driver_type=product.get("driver_type") or None,
            detail=(f"Automatically scraped from {product.get('provided_by', vendor_name)}. "
                    "T/S parameters have not been verified by a human against the datasheet."),
            specs=product.get("specs") or None,
        )

        if result.ts_fail:
            # write_driver found missing mandatory fields — log, clean up stale files, skip
            print(f"[{ts()}]   [{i}/{total}] {slug} SKIP: missing T/S: "
                  f"{', '.join(sorted(result.missing_ts))}", flush=True)
            _stale = out / safe_filename(f"{brand} {model}".strip())
            if _stale.exists():
                _stale.unlink()
                print(f"[{ts()}]   [{i}/{total}] {slug} DELETED stale WDR: {_stale.name}", flush=True)
            _stale_meta = _stale.with_suffix("").with_name(_stale.stem + "_meta.yml")
            if _stale_meta.exists():
                _stale_meta.unlink()
            with counters_lock:
                mark_scraped(url, manifest, None, status="skipped", title=slug, category="")
                skipped += 1
                done = ok + skipped + failed
                if done % 50 == 0:
                    save_manifest(out, manifest)
            time.sleep(delay_s)
            return

        for rule_id in result.dq_issues:
            print(f"[{ts()}]   [{i}/{total}] {slug} DQ {rule_id}", flush=True)

        wdr_name = result.wdr_name
        suffix   = " ".join(extras)
        if result.schema_fail:
            print(f"[{ts()}]   [{i}/{total}] {slug} SCHEMA FAIL ({len(result.hard_errors)}) {suffix}".rstrip(),
                  flush=True)
        else:
            print(f"[{ts()}]   [{i}/{total}] {slug} OK {suffix}".rstrip(), flush=True)
        with counters_lock:
            mark_scraped(url, manifest, wdr_name,
                         status="ok" if not result.schema_fail else "schema_fail")
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
