"""
scraper_lib.py — enhanced scraper infrastructure for scripts/scrapers/.

Re-exports everything from the parent scripts/scraper_lib.py and adds:
  - ProblemLog: mandatory per-collection problem log (CLAUDE.md § Script rules)
  - merge_fields(): PDF-primary field merge helper
  - run_scraper(): PDF-primary scrape loop with automatic problem log writing

Vendor scrapers in scripts/scrapers/ import from here, not from the parent.
They provide parse_product(html, url) -> dict | None exactly as before; the
enhanced runner transparently adds PDF extraction on top.
"""

from __future__ import annotations

import dataclasses
import importlib.util
import re
import sys
import time
import urllib.parse
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

# ── Parent library import (avoids circular-import via importlib) ───────────────
# Both this file and the parent are named scraper_lib.py. Loading the parent
# via importlib.util with a distinct module name prevents Python from resolving
# "from scraper_lib import ..." to this file itself.

_PARENT_SCRIPTS = Path(__file__).parent.parent  # scripts/

# Ensure scripts/ is in sys.path so that the parent's own deps (dq_check) resolve
if str(_PARENT_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_PARENT_SCRIPTS))


def _load_module(alias: str, path: Path):
    spec = importlib.util.spec_from_file_location(alias, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[alias] = mod
    spec.loader.exec_module(mod)
    return mod


_plib = _load_module("_parent_scraper_lib", _PARENT_SCRIPTS / "scraper_lib.py")
_dqlib = _load_module("_parent_dq_check",   _PARENT_SCRIPTS / "dq_check.py")

# Re-export parent symbols so vendor scrapers can import them from here
fetch               = _plib.fetch               # noqa: F401
fetch_binary        = _plib.fetch_binary        # noqa: F401
fetch_product_urls  = _plib.fetch_product_urls  # noqa: F401
load_manifest       = _plib.load_manifest       # noqa: F401
save_manifest       = _plib.save_manifest       # noqa: F401
is_new_url          = _plib.is_new_url          # noqa: F401
mark_scraped        = _plib.mark_scraped        # noqa: F401
to_wdr              = _plib.to_wdr              # noqa: F401
safe_filename       = _plib.safe_filename       # noqa: F401
parse_number        = _plib.parse_number        # noqa: F401
DEFAULT_DELAY_S     = _plib.DEFAULT_DELAY_S     # noqa: F401
HEADERS             = _plib.HEADERS             # noqa: F401
check_fields        = _dqlib.check_fields       # noqa: F401

# pdf_lib is NOT imported at module level here — imported inside each worker process.

# Schema validation — imported at module level (lightweight; no fitz/tesseract dependency).
_schema_mod = _load_module("_wdr_meta_schema", _PARENT_SCRIPTS / "wdr_meta_schema.py")
_validate_driver  = _schema_mod.validate_driver
validate_driver   = _schema_mod.validate_driver   # noqa: F401 — re-exported for vendor scrapers

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ── Problem log ────────────────────────────────────────────────────────────────

class ProblemLog:
    """
    Per-collection problem log as specified in CLAUDE.md § Script rules.

    Log file: drivers/<collection>/_problems.log
    Format per entry:
        [HH:MM:SS] RUN <iso-datetime> scraper=<name> collection=<dir>
        [HH:MM:SS] PROBLEM field=<field> item=<id> url=<url> offset=<N>
                   raw_value=<repr>
                   reason=<text>
        [HH:MM:SS] DONE problems=<N> items_processed=<N>

    Append-only — each run adds a new block to the same file.
    A run with zero problems still writes the RUN + DONE header pair so there
    is a record that the run completed cleanly.
    """

    def __init__(self, collection_dir: Path, scraper_name: str) -> None:
        self._path = collection_dir / "_problems.log"
        self._scraper = scraper_name
        self._count = 0
        now = datetime.now()
        ts = now.strftime("%H:%M:%S")
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(
                f"[{ts}] RUN {now.isoformat()} "
                f"scraper={scraper_name} collection={collection_dir.name}\n"
            )

    def log(self, field: str, item_id: str, url: str,
            raw_value: object, reason: str, offset: int = 0) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(
                f"[{ts}] PROBLEM field={field} item={item_id} "
                f"url={url} offset={offset}\n"
                f"         raw_value={raw_value!r}\n"
                f"         reason={reason}\n"
            )
        self._count += 1

    def finalize(self, items_processed: int) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(
                f"[{ts}] DONE problems={self._count} "
                f"items_processed={items_processed}\n\n"
            )

    @property
    def count(self) -> int:
        return self._count


# ── Field merge ────────────────────────────────────────────────────────────────

def merge_fields(pdf_fields: dict, html_fields: dict) -> dict:
    """
    Merge T/S fields with PDF as primary source.
    PDF values overwrite HTML values for matching keys; HTML fills any gaps.
    """
    merged = dict(html_fields)
    merged.update(pdf_fields)
    return merged


# ── PDF fetch / cache helper ───────────────────────────────────────────────────

def _get_or_fetch_pdf(pdf_url: str, pdf_dir: Path,
                      name_suffix: str = "") -> Path | None:
    """
    Return path to a cached PDF, downloading it if not already on disk.
    name_suffix is inserted before .pdf to avoid filename collisions when the
    same slug is used for multiple PDF types (e.g. primary vs adv datasheet).
    Returns None on network error; never raises.
    """
    pdf_name = urllib.parse.unquote(pdf_url.rstrip("/").split("/")[-1])
    if not pdf_name.lower().endswith(".pdf"):
        pdf_name += ".pdf"
    if name_suffix:
        pdf_name = pdf_name[:-4] + name_suffix + ".pdf"
    pdf_path = pdf_dir / pdf_name
    if pdf_path.exists():
        return pdf_path
    try:
        data = fetch_binary(pdf_url)
        pdf_path.write_bytes(data)
        return pdf_path
    except Exception:
        return None


# ── Extra-file classification ─────────────────────────────────────────────────

_FRD_EXTENSIONS  = {"frd"}
_ZMA_EXTENSIONS  = {"zma", "imp"}
_CAD_EXTENSIONS  = {"igs", "step", "stp", "x_t", "stl", "obj"}
_DATA_EXTENSIONS = _FRD_EXTENSIONS | _ZMA_EXTENSIONS | {"txt"}

_FRD_SIGNATURE = re.compile(r"^\s*[\d.eE+\-]+\s+[\d.eE+\-]+\s+[\d.eE+\-]+", re.M)
_ZMA_SIGNATURE = re.compile(r"^\s*[\d.eE+\-]+\s+[\d.eE+\-]+\s+[\d.eE+\-]+", re.M)


def _sniff_text(path: Path) -> str:
    """Return 'frd', 'zma', or '' based on first numeric data lines of a text file."""
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:2000]
    except Exception:
        return ""
    # FRD: "freq SPL phase" columns — first col is frequency (20–20000)
    # ZMA: "freq |Z| phase" columns — similar structure, no reliable header diff
    # Both look identical structurally; name/context is the only distinguisher.
    # Treat .frd files as FRD, .zma/.imp as ZMA; .txt sniffed by column count.
    lines = [l for l in head.splitlines() if l.strip() and not l.strip().startswith(("#", "!"," *"))]
    numeric_lines = [l for l in lines if re.match(r"^\s*[\d.eE+\-]+", l)]
    if not numeric_lines:
        return ""
    cols = len(numeric_lines[0].split())
    return "frd" if cols >= 2 else ""


def _classify_extra(
    fpath: Path, ext: str, log_prob, slug: str, link: str
) -> tuple[bool, bool]:
    """
    Inspect a downloaded file and return (is_frd, is_zma).
    For ZIPs: extracts members, discards CAD-only archives, extracts data files
    into the same directory, and classifies by member extension.
    For individual files: classifies by extension then content-sniff for .txt.
    """
    import zipfile as _zf

    if ext == "zip":
        try:
            with _zf.ZipFile(fpath) as z:
                members = z.namelist()
                member_exts = {m.rsplit(".", 1)[-1].lower() for m in members if "." in m}
                data_members = [m for m in members
                                if m.rsplit(".", 1)[-1].lower() in _DATA_EXTENSIONS]
                cad_only = member_exts <= _CAD_EXTENSIONS

                if cad_only:
                    log_prob("extra_cad_zip", slug, link,
                             repr(members[:5]), "ZIP contains only CAD files — skipped")
                    return (False, False)

                # Extract data members alongside the ZIP
                out_dir = fpath.parent
                found_frd = found_zma = False
                for m in data_members:
                    member_name = m.split("/")[-1]  # flatten any subdirs
                    member_ext  = member_name.rsplit(".", 1)[-1].lower()
                    dest = out_dir / member_name
                    if not dest.exists():
                        dest.write_bytes(z.read(m))
                    if member_ext in _FRD_EXTENSIONS:
                        found_frd = True
                    elif member_ext in _ZMA_EXTENSIONS:
                        found_zma = True
                    elif member_ext == "txt":
                        kind = _sniff_text(dest)
                        if kind == "frd":
                            found_frd = True
                return (found_frd, found_zma)
        except _zf.BadZipFile:
            log_prob("extra_bad_zip", slug, link, None, "Not a valid ZIP file")
            return (False, False)

    elif ext in _FRD_EXTENSIONS:
        return (True, False)
    elif ext in _ZMA_EXTENSIONS:
        return (False, True)
    elif ext == "txt":
        kind = _sniff_text(fpath)
        return (kind == "frd", False)
    else:
        return (False, False)


# ── Worker config (picklable dataclass for ProcessPoolExecutor) ───────────────

@dataclasses.dataclass
class _WorkerConfig:
    out:                  Path
    pdf_dir:              Path
    html_dir:             Path
    problems_dir:         Path   # _problems/<slug>.log written here by each worker
    cache_html_dir:       Path | None
    vendor_name:          str
    total:                int
    delay_s:              float
    is_manufacturer_site: bool
    no_pdf:               bool
    html_wins:            bool  # if True, HTML fields overwrite PDF (use when HTML is more reliable than OCR)
    parse_product:        Any   # top-level function from vendor module — picklable


@dataclasses.dataclass
class _WorkerResult:
    status:   str          # "ok" | "skip" | "error" | "schema_fail"
    wdr_name: str | None
    url:      str


def _init_worker():
    """
    ProcessPoolExecutor initializer — runs once per worker process, before any
    task and before any module-level fitz/Tesseract imports execute.

    Tesseract threading is left at its default (no OMP_THREAD_LIMIT override).
    Each worker process spawns tesseract.exe as a subprocess; tesseract manages
    its own thread pool internally. Throughput comes from multiprocessing across
    drivers, not from pinning each tesseract instance to a single thread.
    """
    pass


def _scrape_one(idx_url: tuple[int, str], cfg: _WorkerConfig) -> _WorkerResult:
    """
    Top-level picklable worker — one driver per call.
    Writes WDR + meta.yml directly; returns status and any problems for the
    main process to aggregate into the log and manifest.
    """
    import pdf_lib as _pdf_local
    from pathlib import Path as _Path

    # Re-import parent lib symbols in worker process
    _PARENT = _Path(__file__).parent.parent
    if str(_PARENT) not in sys.path:
        sys.path.insert(0, str(_PARENT))

    import importlib.util as _ilu
    def _load(alias, path):
        if alias in sys.modules:
            return sys.modules[alias]
        spec = _ilu.spec_from_file_location(alias, path)
        mod = _ilu.module_from_spec(spec)
        sys.modules[alias] = mod
        spec.loader.exec_module(mod)
        return mod

    _plib  = _load("_parent_scraper_lib_w", _PARENT / "scraper_lib.py")
    _dqlib = _load("_parent_dq_check_w",    _PARENT / "dq_check.py")

    def ts():
        return datetime.now().strftime("%H:%M:%S")

    i, url = idx_url
    slug = url.rstrip("/").split("/")[-1]
    html_filename = re.sub(r"[^\w\-.]", "_", slug) + ".html"

    _prob_path = cfg.problems_dir / (re.sub(r"[^\w\-.]", "_", slug) + ".log")
    _prob_count = 0

    def _prob(field, item, purl, raw_value, reason, offset=0):
        nonlocal _prob_count
        _prob_count += 1
        ts_now = datetime.now().strftime("%H:%M:%S")
        with open(_prob_path, "a", encoding="utf-8") as _f:
            _f.write(
                f"[{ts_now}] PROBLEM field={field} item={item} "
                f"url={purl} offset={offset}\n"
                f"         raw_value={raw_value!r}\n"
                f"         reason={reason}\n"
            )

    # ── Fetch / load HTML ────────────────────────────────────────────────────
    try:
        cached = cfg.cache_html_dir / html_filename if cfg.cache_html_dir else None
        if cached and cached.exists():
            html = cached.read_text(encoding="utf-8", errors="replace")
        else:
            html = _plib.fetch(url)
            (cfg.html_dir / html_filename).write_text(html, encoding="utf-8")
    except Exception as e:
        print(f"[{ts()}]   [{i}/{cfg.total}] {slug} HTML ERROR: {e}", flush=True)
        _prob("html_fetch", slug, url, None, f"HTTP error: {e}")
        return _WorkerResult("error", None, url)

    # ── Parse HTML (vendor-specific) ─────────────────────────────────────────
    try:
        product = cfg.parse_product(html, url)
    except Exception as e:
        print(f"[{ts()}]   [{i}/{cfg.total}] {slug} PARSE ERROR: {e}", flush=True)
        _prob("html_parse", slug, url, None, f"Exception in parse_product: {e}")
        return _WorkerResult("error", None, url)

    if product is None:
        return _WorkerResult("skip", None, url)

    brand           = product.get("brand", "")
    model           = product.get("model", "")
    item_id         = model or slug   # use official model name in all problem log entries
    html_fields: dict = product.get("fields", {})
    pdf_url: str | None     = product.get("pdf_url")
    adv_pdf_url: str | None = product.get("adv_pdf_url")
    drawing_url: str | None = product.get("drawing_url")
    cad_url: str | None     = product.get("cad_url")
    extras_log: list[str] = []

    # ── PDF extraction (primary source) ──────────────────────────────────────
    pdf_fields: dict = {}
    pdf_source: str  = ""
    freq_low_hz: float | None = None
    freq_high_hz: float | None = None

    if pdf_url and not cfg.no_pdf:
        pdf_path = _get_or_fetch_pdf(pdf_url, cfg.pdf_dir)
        if pdf_path:
            extras_log.append("+PDF")
            try:
                text    = _pdf_local.full_text(pdf_path)
                _pdf_rejects: list = []
                pass1   = _pdf_local.find_ts_fields(text, brand=brand, problems=_pdf_rejects)
                freq_low_hz, freq_high_hz = _pdf_local.find_freq_range(text)
                spatial = _pdf_local.extract_text_spatial(pdf_path)
                pass2   = _pdf_local.find_ts_fields(spatial, brand=brand, problems=_pdf_rejects)

                for rej in _pdf_rejects:
                    _prob(
                        f"pdf_range_{rej['field']}",
                        item_id,
                        pdf_url,        # URL of the PDF, not the product page
                        (f"extracted={rej['field']}={rej['extracted_si']:.4g} "
                         f"raw={rej['raw_str']!r} range={rej['range_desc']} pos={rej['pos']} "
                         f"local={pdf_path} "
                         f"context=…{rej['context']}…"),
                        "PDF extraction rejected: value outside physical range — likely font-encoding artifact",
                    )

                if len(pass2) >= len(pass1):
                    pdf_fields = pass2
                    pdf_source = "pdf_spatial" if pass2 else ""
                else:
                    pdf_fields = pass1
                    pdf_source = "pdf" if pass1 else ""

                model_pattern = product.get("model_from_pdf")
                if model_pattern and text:
                    m_pdf = re.search(model_pattern, text)
                    if m_pdf:
                        model = m_pdf.group(0)

                if pdf_fields:
                    print(f"[{ts()}]   [{i}/{cfg.total}] {slug} "
                          f"PDF({pdf_source})→{list(pdf_fields.keys())}", flush=True)
                else:
                    _prob("pdf_no_fields", item_id, pdf_url, None,
                          f"pass1={len(pass1)} pass2={len(pass2)} chars={len(text)}")
            except Exception as e:
                _prob("pdf_extract", item_id, pdf_url or url, None, f"Exception: {e}")
        else:
            _prob("pdf_fetch", item_id, pdf_url, None, "Could not download or cache PDF")

    # parse_product() may supply HTML-sourced freq range; prefer it over PDF when present.
    if product.get("freq_low_hz") is not None:
        freq_low_hz = product["freq_low_hz"]
    if product.get("freq_high_hz") is not None:
        freq_high_hz = product["freq_high_hz"]

    # ── Advanced parameters PDF (secondary source) ───────────────────────────
    adv_pdf_fields: dict = {}
    if adv_pdf_url and not cfg.no_pdf and adv_pdf_url != pdf_url:
        adv_path = _get_or_fetch_pdf(adv_pdf_url, cfg.pdf_dir, name_suffix="_adv")
        if adv_path:
            try:
                adv_text    = _pdf_local.full_text(adv_path)
                _adv_rejects: list = []
                adv_pass1   = _pdf_local.find_ts_fields(adv_text, brand=brand, problems=_adv_rejects)
                adv_spatial = _pdf_local.extract_text_spatial(adv_path)
                adv_pass2   = _pdf_local.find_ts_fields(adv_spatial, brand=brand, problems=_adv_rejects)
                for rej in _adv_rejects:
                    _prob(
                        f"adv_pdf_range_{rej['field']}",
                        item_id,
                        adv_pdf_url,    # URL of the adv PDF, not the product page
                        (f"extracted={rej['field']}={rej['extracted_si']:.4g} "
                         f"raw={rej['raw_str']!r} range={rej['range_desc']} pos={rej['pos']} "
                         f"local={adv_path} "
                         f"context=…{rej['context']}…"),
                        "Adv PDF extraction rejected: value outside physical range",
                    )
                adv_pdf_fields = adv_pass2 if len(adv_pass2) >= len(adv_pass1) else adv_pass1
            except Exception:
                pass

    # ── Merge ────────────────────────────────────────────────────────────────
    # cfg.html_wins=True  → HTML is strongest (manufacturer sites: HTML is authoritative)
    # cfg.html_wins=False → PDF is strongest (resellers: PDFs often more complete)
    if cfg.html_wins:
        fields = dict(pdf_fields)
        fields.update(adv_pdf_fields)
        fields.update(html_fields)
    else:
        fields = dict(html_fields)
        fields.update(adv_pdf_fields)
        fields.update(pdf_fields)
    if not fields:
        _prob("no_fields", item_id, url, None, "No T/S fields from PDF or HTML")

    # ── Field provenance ──────────────────────────────────────────────────────
    # For each T/S field that appeared in any source, record which sources had it,
    # each source's value in WDR SI units, and which source's value was written.
    #
    # Priority (highest to lowest) matches the merge order above:
    #   html_wins=True  → html > adv_pdf > pdf
    #   html_wins=False → pdf  > adv_pdf > html
    _all_src = {"pdf": pdf_fields, "adv_pdf": adv_pdf_fields, "html": html_fields}
    _priority = (["html", "adv_pdf", "pdf"] if cfg.html_wins
                 else ["pdf", "adv_pdf", "html"])
    field_provenance: dict[str, dict] = {}
    for _fld in set().union(*[s.keys() for s in _all_src.values()]):
        _srcs = {s: _all_src[s][_fld]
                 for s in ("pdf", "adv_pdf", "html") if _fld in _all_src[s]}
        if not _srcs:
            continue
        _winner = next(s for s in _priority if s in _srcs)
        field_provenance[_fld] = {"sources": _srcs, "winner": _winner}

    # ── HTML vs PDF discrepancy check ────────────────────────────────────────
    # For any field present in both HTML and the winning PDF source, flag
    # differences > 10% as a DQ fault so data quality issues surface immediately.
    for fld, html_val in html_fields.items():
        pdf_val = pdf_fields.get(fld) or adv_pdf_fields.get(fld)
        if pdf_val and html_val and html_val != 0:
            ratio = abs(pdf_val - html_val) / abs(html_val)
            if ratio > 0.10:
                detail = (f"{fld}: HTML={html_val:.4g} PDF={pdf_val:.4g} "
                          f"({ratio*100:.0f}% diff)")
                _prob("html_pdf_mismatch", item_id, url, detail,
                      "HTML and PDF values disagree by >10%")

    # ── DQ check ─────────────────────────────────────────────────────────────
    for rule_id, desc, detail in _dqlib.check_fields(fields):
        print(f"[{ts()}]   [{i}/{cfg.total}] {slug} DQ {rule_id}: {detail}", flush=True)
        _prob(rule_id, item_id, url, detail, desc)

    # ── Dimensional drawing + CAD zip ────────────────────────────────────────
    def _fetch_asset(asset_url: str | None, label: str) -> None:
        if not asset_url:
            return
        fname = urllib.parse.unquote(asset_url.rstrip("/").split("/")[-1])
        fpath = cfg.pdf_dir / fname
        if not fpath.exists():
            try:
                fpath.write_bytes(_plib.fetch_binary(asset_url))
                extras_log.append(f"+{label}")
            except Exception as e:
                _prob(f"{label}_fetch", item_id, asset_url, None, str(e))

    _fetch_asset(drawing_url, "drw")
    _fetch_asset(cad_url, "cad")

    # ── Extra files ───────────────────────────────────────────────────────────
    frd_ok = impedance_ok = ""
    for link in product.get("extra_links", []):
        fname = urllib.parse.unquote(link.rstrip("/").split("/")[-1])
        fpath = cfg.out / fname
        if not fpath.exists():
            try:
                fpath.write_bytes(_plib.fetch_binary(link))
                extras_log.append(f"+{fname}")
            except Exception as e:
                extras_log.append(f"({fname} err)")
                _prob("extra_fetch", item_id, link, None, str(e))
                continue
        if not fpath.exists():
            continue
        ext = fname.rsplit(".", 1)[-1].lower()
        frd_file, zma_file = _classify_extra(fpath, ext, _prob, item_id, link)
        if frd_file:
            frd_ok = link
        if zma_file:
            impedance_ok = link

    # Direct frd_url / impedance_url keys bypass content classification.
    # Use when the vendor explicitly names the file type (e.g. Wavecor "_SPL_response.txt").
    def _fetch_measurement(murl: str | None, label: str) -> str:
        if not murl:
            return ""
        mname = urllib.parse.unquote(murl.rstrip("/").split("/")[-1])
        mpath = cfg.out / mname
        if not mpath.exists():
            try:
                mpath.write_bytes(_plib.fetch_binary(murl))
                extras_log.append(f"+{label}")
            except Exception as e:
                _prob(f"{label}_fetch", item_id, murl, None, str(e))
                return ""
        return murl if mpath.exists() else ""

    frd_ok      = frd_ok      or _fetch_measurement(product.get("frd_url"),       "FRD")
    impedance_ok = impedance_ok or _fetch_measurement(product.get("impedance_url"), "IMP")

    # ── Write WDR ─────────────────────────────────────────────────────────────
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    comment_parts = [f"Source: {url}"]
    if pdf_url:
        comment_parts.append(f"Datasheet: {pdf_url}")

    wdr_text = _plib.to_wdr(
        brand=brand, model=model, fields=fields,
        provided_by=product.get("provided_by", cfg.vendor_name),
        comment=" | ".join(comment_parts),
        manufacturer=product.get("manufacturer", brand),
        date_added=today, date_modified=today,
    )
    wdr_name = _plib.safe_filename(f"{brand} {model}".strip())
    (cfg.out / wdr_name).write_text(wdr_text, encoding="utf-8")

    # ── Write _meta.yml sidecar ───────────────────────────────────────────────
    detail_parts = [
        f"Automatically scraped from {product.get('provided_by', cfg.vendor_name)}.",
        "T/S parameters not human-verified.",
    ]
    if pdf_fields:
        detail_parts.append(
            f"T/S extracted from PDF ({pdf_source}): {','.join(sorted(pdf_fields))}.")
    if html_fields and not pdf_fields:
        detail_parts.append("PDF extraction returned no matches; using HTML only.")

    meta = {
        "quality":            "M",
        "issue":              "scraped_not_human_verified",
        "detail":             " ".join(detail_parts),
        "corrections":        None,
        "reviewed_by":        None,
        "driver_type":        product.get("driver_type") or None,
        "nominal_size_cm":    product.get("nominal_size_cm"),
        "datasheet":          pdf_url or None,
        "adv_datasheet":      adv_pdf_url or None,
        "drawing":            drawing_url or None,
        "cad":                cad_url or None,
        "manu_page":          url if cfg.is_manufacturer_site else None,
        "vendor_page":        None if cfg.is_manufacturer_site else url,
        "source":             url,
        "frd":                frd_ok or None,
        "impedance":          impedance_ok or None,
        "obsolete":           None,
        "dq_issue":           None,
        "community":          None,
        "fetched_sku":        None,
        "field_provenance":   field_provenance or None,
        "freq_low_hz":        freq_low_hz,
        "freq_high_hz":       freq_high_hz,
    }
    meta_path = cfg.out / wdr_name.replace(".wdr", "_meta.yml")
    meta_path.write_text(yaml.dump(meta, allow_unicode=True, sort_keys=False), encoding="utf-8")

    # ── Strict schema validation ───────────────────────────────────────────────
    # Both files must pass before the driver counts as success.
    # Failures are logged as PROBLEM entries; the driver is marked "schema_fail".
    _val_errors = _validate_driver(cfg.out / wdr_name, meta_path)
    if _val_errors:
        for _e in _val_errors:
            _prob("schema_fail", item_id, url, _e, "File failed strict schema validation")
        print(f"[{ts()}]   [{i}/{cfg.total}] {slug} SCHEMA FAIL ({len(_val_errors)} errors)",
              flush=True)
        # Still write the marker so the run can resume; driver is not re-scraped.
        with open(_prob_path, "a", encoding="utf-8") as _f:
            _f.write(f"[{ts()}] SCHEMA_FAIL errors={len(_val_errors)}\n")
        return _WorkerResult("schema_fail", wdr_name, url)

    # Always write the marker file so parent can track completion via mtime.
    with open(_prob_path, "a", encoding="utf-8") as _f:
        _f.write(f"[{ts()}] DONE problems={_prob_count}\n")

    print(f"[{ts()}]   [{i}/{cfg.total}] {slug} OK {' '.join(extras_log)}".rstrip(),
          flush=True)
    time.sleep(cfg.delay_s)
    return _WorkerResult("ok", wdr_name, url)


# ── Enhanced scrape loop ───────────────────────────────────────────────────────

def run_scraper(
    vendor_name: str,
    sitemap_url,
    parse_product,
    out_dir_default: str,
    url_filter=None,
    delay_s: float = DEFAULT_DELAY_S,
    is_manufacturer_site: bool = True,
    html_wins: bool = False,
) -> None:
    """
    PDF-primary scrape loop with mandatory problem log.

    Vendor contract — parse_product(html, url) returns dict | None:
      {
        "brand":        str,
        "model":        str,
        "manufacturer": str,
        "provided_by":  str,
        "fields":       dict[str, float],  # T/S from HTML (may be partial)
        "pdf_url":      str | None,
        "extra_links":  list[str],
      }

    The runner automatically:
      1. Tries PDF extraction (fitz) and merges results (PDF wins on conflicts).
      2. Writes _problems.log to the output directory.
      3. Writes WDR + _meta.yml sidecar.
      4. Manages manifest for resume-from-where-killed capability.

    CLI flags (same as parent):
      --out-dir, --limit, --refresh, --workers, --cache-html-dir
    """
    import argparse

    ap = argparse.ArgumentParser(description=f"Scrape {vendor_name} → WDR files")
    ap.add_argument("--out-dir", default=out_dir_default)
    ap.add_argument("--limit",   type=int, default=0,
                    help="Max new products to scrape (0 = all)")
    ap.add_argument("--refresh", action="store_true",
                    help="Re-scrape all URLs, not just new ones")
    ap.add_argument("--workers", type=int, default=1,
                    help="Parallel workers (default 1)")
    ap.add_argument("--cache-html-dir", default=None,
                    help="Read HTML from this dir instead of fetching live")
    ap.add_argument("--no-pdf", action="store_true",
                    help="Skip PDF extraction (HTML-only mode)")
    ap.add_argument("--delay", type=float, default=None,
                    help="Seconds to sleep between requests (default: 1.0 for deep, 0 for shallow/cached)")
    args = ap.parse_args()

    out = Path(args.out_dir)
    pdf_dir      = out / "datasheets"
    html_dir     = out / "_html"
    problems_dir = out / "_problems"
    out.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(exist_ok=True)
    html_dir.mkdir(exist_ok=True)
    problems_dir.mkdir(exist_ok=True)

    # Parent writes a run-start marker once. Workers write _problems/<slug>.log.
    # Resume: slug log exists AND is newer than run-start marker → done this run.
    # --refresh: re-touch the marker so all existing slug logs become "older".
    run_marker = problems_dir / "_run_start.marker"
    if args.refresh or not run_marker.exists():
        run_marker.touch()
    marker_mtime = run_marker.stat().st_mtime

    def _slug_done(url: str) -> bool:
        slug = url.rstrip("/").split("/")[-1]
        p = problems_dir / (re.sub(r"[^\w\-.]", "_", slug) + ".log")
        return p.exists() and p.stat().st_mtime > marker_mtime

    def ts():
        return datetime.now().strftime("%H:%M:%S")

    print(f"[{ts()}] [{vendor_name}] Collecting product URLs ...", flush=True)
    if callable(sitemap_url):
        all_urls = sitemap_url()
    else:
        all_urls = fetch_product_urls(sitemap_url, url_filter=url_filter,
                                      delay_s=delay_s)
    print(f"[{ts()}] [{vendor_name}] {len(all_urls)} product URLs found", flush=True)

    to_scrape = all_urls if args.refresh else [
        u for u in all_urls if not _slug_done(u)
    ]
    if not args.refresh:
        done_count = len(all_urls) - len(to_scrape)
        print(f"[{ts()}] [{vendor_name}] {len(to_scrape)} to do, "
              f"{done_count} already done (resuming)", flush=True)
    if args.limit:
        to_scrape = to_scrape[:args.limit]

    total = len(to_scrape)
    start_time = datetime.now()
    cache_html_dir = Path(args.cache_html_dir) if args.cache_html_dir else None
    # Shallow scan (cached HTML) needs no rate-limit delay; deep scan defaults to 1s.
    effective_delay = args.delay if args.delay is not None else (0.0 if cache_html_dir else delay_s)

    cfg = _WorkerConfig(
        out=out, pdf_dir=pdf_dir, html_dir=html_dir,
        problems_dir=problems_dir,
        cache_html_dir=cache_html_dir,
        vendor_name=vendor_name, total=total,
        is_manufacturer_site=is_manufacturer_site,
        no_pdf=args.no_pdf, html_wins=html_wins, parse_product=parse_product,
        delay_s=effective_delay,
    )

    import functools
    from concurrent.futures import as_completed
    worker = functools.partial(_scrape_one, cfg=cfg)

    # ── Main loop — one process per driver, no shared state ──────────────────
    # Workers write WDR, meta, and _problems/<slug>.log independently.
    # Main process counts statuses as futures complete and prints progress.
    ok = skipped = failed = 0
    if args.workers > 1:
        print(f"[{ts()}] [{vendor_name}] {args.workers} parallel workers", flush=True)

    with ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker) as ex:
        futures = {ex.submit(worker, idx_url): idx_url
                   for idx_url in enumerate(to_scrape, 1)}
        for fut in as_completed(futures):
            try:
                result = fut.result()
            except Exception as e:
                url = futures[fut][1]
                slug = url.rstrip("/").split("/")[-1]
                print(f"[{ts()}] {slug} WORKER CRASH: {e}", flush=True)
                # Write crash to its own problem file
                crash_path = problems_dir / (re.sub(r"[^\w\-.]", "_", slug) + ".log")
                with open(crash_path, "a", encoding="utf-8") as _f:
                    _f.write(f"[{ts()}] PROBLEM field=worker_crash item={slug} "
                             f"url={url} offset=0\n"
                             f"         raw_value=None\n"
                             f"         reason={e}\n")
                failed += 1
                continue

            if result.status == "ok":
                ok += 1
            elif result.status == "skip":
                skipped += 1
            else:
                failed += 1

    elapsed = (datetime.now() - start_time).seconds

    # ── Aggregate per-driver problem logs → _problems.log ────────────────────
    prob_files = sorted(problems_dir.glob("*.log"))
    total_problems = 0
    with open(out / "_problems.log", "w", encoding="utf-8") as agg:
        agg.write(f"# Run {datetime.now().isoformat()} scraper={vendor_name}\n")
        for pf in prob_files:
            content = pf.read_text(encoding="utf-8", errors="replace")
            total_problems += content.count("PROBLEM")
            if "PROBLEM" in content:
                agg.write(content)

    total_done = len(list(problems_dir.glob("*.log")))
    print(
        f"\n[{ts()}] [{vendor_name}] Done: {ok} WDRs, {skipped} skipped, "
        f"{failed} errors — {elapsed}s",
        flush=True,
    )
    print(f"  Output:      {out.resolve()}")
    print(f"  Total done:  {total_done}/{len(all_urls)} drivers")
    print(f"  Problems:    {total_problems} logged to {out / '_problems.log'}")
    try:
        import pdf_lib as _pdf_summary
        if not _pdf_summary._FITZ_OK:
            print("  WARNING: PyMuPDF not installed — PDF extraction was disabled")
        if not _pdf_summary._OCR_OK:
            print("  NOTE: pytesseract not installed — OCR fallback unavailable")
    except ImportError:
        pass
