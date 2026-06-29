#!/usr/bin/env python3
"""
populate_specs.py — backfill specs: block in all _meta.yml sidecars.

Reads cached HTML (_html/), WDR fields, and existing meta — no network.
Writes a consistent specs: dict to every _meta.yml across all collections.

For coaxial drivers (specs already has woofer/tweeter sub-dicts): preserved.
For all other drivers: builds specs from:
  1. WDR fields  (SPL → sensitivity_db, Pe → power_rms_W)
  2. Existing meta (freq_low_hz, freq_high_hz)
  3. Cached HTML  (richer data: voice coil dia, Hg, linear Xmax, freq range, power)

Usage:
    python scripts/populate_specs.py [--force] [--collection <name>]
    --force  : rewrite even if specs: is already populated
    --collection: only process one collection (e.g. sb-acoustics)
"""
from __future__ import annotations

import argparse
import configparser
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))

DRIVERS_DIR = Path(__file__).resolve().parent.parent / "drivers"
SKIP_COLLECTIONS = {"matt", "loudspeakerdatabase"}  # no sidecars / human-curated


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _parse_wdr_fields(wdr_path: Path) -> dict[str, float]:
    """Return numeric WDR fields as floats."""
    parser = configparser.RawConfigParser()
    parser.optionxform = str
    try:
        parser.read_string(wdr_path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return {}
    if not parser.has_section("Driver"):
        return {}
    out: dict[str, float] = {}
    for k, v in parser.items("Driver"):
        try:
            f = float(v)
            if f != 0.0:
                out[k] = f
        except (ValueError, TypeError):
            pass
    return out


# ── Collection-specific HTML spec extractors ──────────────────────────────────

def _extract_sb(html: str) -> dict:
    """SB Acoustics: <li> items like 'Sensitivity (2.83V/1m) 88 dB'."""
    import html as html_module
    specs: dict = {}
    li_items = re.findall(r"<li>(.*?)</li>", html, re.S | re.I)
    for li_raw in li_items:
        item = html_module.unescape(re.sub(r"<[^>]+>", "", li_raw)).strip()
        if not item:
            continue
        il = item.lower()
        # Strip parenthesized references (e.g. "(2.83V/1m)") before number extraction
        # so "Sensitivity (2.83V/1m) 86 dB" picks up 86, not 2.83
        parse_text = re.sub(r"\([^)]*\)", " ", item)
        m = re.search(r"(\d[\d.,]*)", parse_text)
        if not m:
            continue
        val = float(m.group(1).replace(",", "."))
        if "sensitivity" in il and "db" in il:
            specs["sensitivity_db"] = val
        elif "rated power" in il and ("w" in il or "watt" in il):
            specs["power_rms_W"] = val
        elif "voice coil diameter" in il:
            specs["voice_coil_dia_mm"] = val
        elif "air gap height" in il:
            specs["Hg_mm"] = val
        elif "linear coil travel" in il:
            specs["linear_xmax_mm"] = val  # p-p mm from HTML
        elif "frequency" in il and "hz" in il:
            nums = re.findall(r"(\d[\d.,]*)", parse_text)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
    return specs


def _extract_si(html: str) -> dict:
    """SoundImports: <dt>Label</dt><dd>Value</dd> pairs — additional non-T/S fields."""
    import html as html_module
    specs: dict = {}
    pattern = re.compile(
        r"<dt[^>]*>([\s\S]*?)(?:</dt>)?\s*<dd[^>]*>([\s\S]*?)</dd>", re.I
    )
    for match in pattern.finditer(html):
        label = html_module.unescape(
            re.sub(r"<[^>]+>", "", match.group(1))
        ).replace("\xa0", " ").strip().lower()
        value = html_module.unescape(
            re.sub(r"<[^>]+>", "", match.group(2))
        ).replace("\xa0", " ").strip()
        if not label or not value:
            continue
        m = re.search(r"(\d[\d.,]*)", value)
        if not m:
            continue
        val = float(m.group(1).replace(",", "."))
        vl = value.lower()
        if "sensitivity" in label and "db" in vl:
            specs["sensitivity_db"] = val
        elif "power" in label and "handling" in label:
            specs["power_rms_W"] = val
        elif "frequency range" in label:
            nums = re.findall(r"(\d[\d.,]*)", value)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
        elif "voice coil diameter" in label:
            if "mm" in vl:
                specs["voice_coil_dia_mm"] = val
        elif "air gap" in label or ("hg" in label and "mm" in vl):
            specs["Hg_mm"] = val
        elif "linear" in label and "excursion" in label:
            specs["linear_xmax_mm"] = val * 2  # SI publishes one-way → p-p
    return specs


def _extract_ss(html: str) -> dict:
    """Scan-Speak: <tr><td> spec table — sensitivity and any freq range."""
    specs: dict = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        if len(cells) < 2:
            continue
        label = re.sub(r"<[^>]+>", "", cells[0]).replace("&nbsp;", "").strip().lower()
        value = re.sub(r"<[^>]+>", "", cells[1]).replace("&nbsp;", "").strip()
        m = re.search(r"(\d[\d.,]*)", value)
        if not m:
            continue
        val = float(m.group(1).replace(",", "."))
        vl = value.lower()
        if "sensitivity" in label and ("db" in vl or "db" in label):
            specs["sensitivity_db"] = val
        elif "frequency range" in label or "freq" in label and "range" in label:
            nums = re.findall(r"(\d[\d.,]*)", value)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
        elif "power" in label and "handling" in label:
            specs["power_rms_W"] = val
    return specs


def _extract_wavecor(html: str) -> dict:
    """Wavecor: extract sensitivity, power, freq from HTML product pages."""
    specs: dict = {}
    # Wavecor uses a specs table with <td> pairs
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        if len(cells) < 2:
            continue
        label = re.sub(r"<[^>]+>", "", cells[0]).replace("&nbsp;", "").strip().lower()
        value = re.sub(r"<[^>]+>", "", cells[1]).replace("&nbsp;", "").strip()
        m = re.search(r"(\d[\d.,]*)", value)
        if not m:
            continue
        val = float(m.group(1).replace(",", "."))
        vl = value.lower()
        if "sensitivity" in label and ("db" in vl or "db" in label):
            specs["sensitivity_db"] = val
        elif "power" in label and ("w" in vl or "watt" in vl):
            specs["power_rms_W"] = val
        elif "frequency range" in label or ("freq" in label and "range" in label):
            nums = re.findall(r"(\d[\d.,]*)", value)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
        elif "voice coil" in label and "diam" in label:
            specs["voice_coil_dia_mm"] = val
        elif "air gap" in label:
            specs["Hg_mm"] = val
    return specs


def _extract_pe(html: str) -> dict:
    """Parts Express: HTML product pages (Playwright-cached)."""
    specs: dict = {}
    for m in re.finditer(
        r'(?i)(sensitivity|power\s+handling|frequency\s+response)[^<]{0,200}', html
    ):
        line = m.group(0)
        nums = re.findall(r"([\d]+(?:\.\d+)?)", line)
        if not nums:
            continue
        ll = line.lower()
        if "sensitivity" in ll and "db" in ll:
            specs.setdefault("sensitivity_db", float(nums[0]))
        elif "power" in ll and ("w" in ll or "watt" in ll):
            specs.setdefault("power_rms_W", float(nums[0]))
        elif "frequency" in ll and len(nums) >= 2:
            specs.setdefault("freq_low_hz", float(nums[0]))
            specs.setdefault("freq_high_hz", float(nums[1]))
    return specs


_HTML_EXTRACTORS = {
    "sb-acoustics":  _extract_sb,
    "soundimports":  _extract_si,
    "scan-speak":    _extract_ss,
    "wavecor":       _extract_wavecor,
    "parts-express": _extract_pe,
}


def _find_html(coll_dir: Path, meta: dict) -> str | None:
    """Return cached HTML text for a driver, or None if not cached."""
    html_dir = coll_dir / "_html"
    if not html_dir.exists():
        return None
    # Try to derive filename from source URL
    source = meta.get("source") or meta.get("vendor_page") or ""
    if source:
        slug = source.rstrip("/").split("/")[-1]
        slug = re.sub(r"[^\w\-.]", "_", slug)
        for candidate in [slug + ".html", slug, slug.replace(".html", "") + ".html"]:
            p = html_dir / candidate
            if p.exists():
                return p.read_text(encoding="utf-8", errors="replace")
    # Fallback: scan for any file whose name appears in the source URL
    if source:
        for p in html_dir.glob("*.html"):
            if p.stem.lower() in source.lower() or source.lower() in p.stem.lower():
                return p.read_text(encoding="utf-8", errors="replace")
    return None


def _build_specs(wdr_fields: dict, meta: dict, html: str | None, coll_name: str) -> dict | None:
    """Build a specs dict for a non-coaxial driver."""
    specs: dict = {}

    # Always extract from HTML first (most authoritative)
    if html:
        extractor = _HTML_EXTRACTORS.get(coll_name)
        if extractor:
            try:
                html_specs = extractor(html)
                specs.update(html_specs)
            except Exception:
                pass

    # Fill gaps from WDR fields
    if "SPL" in wdr_fields and wdr_fields["SPL"] > 0:
        specs.setdefault("sensitivity_db", wdr_fields["SPL"])
    if "Pe" in wdr_fields and wdr_fields["Pe"] > 0:
        specs.setdefault("power_rms_W", wdr_fields["Pe"])

    # Fill gaps from existing meta top-level freq range fields
    if meta.get("freq_low_hz"):
        specs.setdefault("freq_low_hz", meta["freq_low_hz"])
    if meta.get("freq_high_hz"):
        specs.setdefault("freq_high_hz", meta["freq_high_hz"])

    return specs if specs else None


def process_collection(coll_dir: Path, force: bool) -> tuple[int, int, int]:
    """Return (ok, skipped, errors)."""
    coll_name = coll_dir.name
    meta_files = sorted(coll_dir.glob("*_meta.yml"))
    ok = skipped = errors = 0

    for meta_path in meta_files:
        wdr_path = meta_path.with_name(meta_path.name.replace("_meta.yml", ".wdr"))
        if not wdr_path.exists():
            errors += 1
            continue
        try:
            meta = yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}
        except Exception:
            errors += 1
            continue

        # Skip coaxials — specs block is already correctly structured
        existing_specs = meta.get("specs")
        if isinstance(existing_specs, dict) and (
            "woofer" in existing_specs or "tweeter" in existing_specs
        ):
            skipped += 1
            continue

        # Skip if already populated and not forcing
        if existing_specs and not force:
            skipped += 1
            continue

        wdr_fields = _parse_wdr_fields(wdr_path)
        html = _find_html(coll_dir, meta)
        new_specs = _build_specs(wdr_fields, meta, html, coll_name)

        meta["specs"] = new_specs
        try:
            meta_path.write_text(
                yaml.dump(meta, allow_unicode=True, sort_keys=False),
                encoding="utf-8",
            )
            ok += 1
        except Exception as e:
            print(f"[{_ts()}]   ERROR writing {meta_path.name}: {e}", flush=True)
            errors += 1

    return ok, skipped, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill specs: in all _meta.yml files")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing non-coaxial specs: blocks")
    parser.add_argument("--collection", default=None,
                        help="Only process one collection (directory name under drivers/)")
    args = parser.parse_args()

    t0 = time.monotonic()
    total_ok = total_skip = total_err = 0

    collections = (
        [DRIVERS_DIR / args.collection]
        if args.collection
        else sorted(
            d for d in DRIVERS_DIR.iterdir()
            if d.is_dir() and d.name not in SKIP_COLLECTIONS
        )
    )

    print(f"[{_ts()}] populate_specs — {len(collections)} collection(s)", flush=True)
    for coll_dir in collections:
        if not coll_dir.exists():
            print(f"[{_ts()}] SKIP {coll_dir.name} (not found)", flush=True)
            continue
        n_meta = len(list(coll_dir.glob("*_meta.yml")))
        print(f"[{_ts()}] {coll_dir.name}: {n_meta} sidecars", flush=True)
        ok, skip, err = process_collection(coll_dir, args.force)
        total_ok += ok; total_skip += skip; total_err += err
        print(
            f"[{_ts()}] {coll_dir.name}: {ok} updated, {skip} skipped, {err} errors",
            flush=True,
        )

    elapsed = time.monotonic() - t0
    print(
        f"[{_ts()}] Done: {total_ok} updated, {total_skip} skipped, {total_err} errors"
        f" — {elapsed:.0f}s",
        flush=True,
    )


if __name__ == "__main__":
    main()
