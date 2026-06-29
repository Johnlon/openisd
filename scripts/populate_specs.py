#!/usr/bin/env python3
"""
populate_specs.py — migrate all _meta.yml sidecars to unified specs + _sources format.

Converts existing files to:
  _sources: {manu_page|vendor_page: url, datasheet: url, ...}
  specs:
    Fs:  # free air resonance (Hz)
      value: 20.0
      winner: datasheet
      sources: {datasheet: 20.0, manu_page: 20.0}
    ...

Sources:
  1. field_provenance (if present) — T/S fields with existing source contest record
  2. WDR file — T/S fields for drivers with no field_provenance (old HTML-only scrapers)
  3. Cached HTML — non-T/S specs (sensitivity, power, physical dims)
  4. Meta top-level freq_low_hz / freq_high_hz (legacy, migrated in)

Removes legacy fields: field_provenance, freq_low_hz, freq_high_hz.
Skips: matt/, loudspeakerdatabase/, sample/ (no sidecars)

Usage:
    python scripts/populate_specs.py [--force] [--collection <name>]
    --force  : rewrite even if specs already has the new provenance format
    --collection: only process one collection
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
from wdr_meta_schema import reorder_meta_for_save

DRIVERS_DIR = Path(__file__).resolve().parent.parent / "drivers"
SKIP_COLLECTIONS = {"matt", "loudspeakerdatabase", "sample"}

# Fields renamed with _url suffix (Option A). Maps old key → new key.
# Used by _normalise_meta_fields() to migrate existing files.
_URL_RENAMES: dict[str, str] = {
    "datasheet":      "datasheet_url",
    "adv_datasheet":  "adv_datasheet_url",
    "drawing":        "drawing_url",
    "cad":            "cad_url",
    "manu_page":      "manu_page_url",
    "vendor_page":    "vendor_page_url",
    "frd":            "frd_url",
    "frd_plot":       "frd_url",
    "impedance":      "zma_url",
    "impedance_plot": "zma_url",
}
# Keys to strip: superseded by specs block or no longer in schema.
_STRIP_KEYS = frozenset({"series", "datasheet_fields", "adv_datasheet_fields",
                          "manu_page_fields", "field_provenance", "freq_low_hz", "freq_high_hz"})


def _normalise_meta_fields(meta: dict) -> None:
    """Apply URL renames and strip orphaned extra fields in-place."""
    for old_key, new_key in _URL_RENAMES.items():
        if old_key in meta:
            if new_key not in meta:
                meta[new_key] = meta.pop(old_key)
            else:
                del meta[old_key]
    for k in list(meta.keys()):
        if k in _STRIP_KEYS:
            del meta[k]

SPEC_FIELD_COMMENTS: dict[str, str] = {
    "Fs":                "free air resonance (Hz)",
    "Re":                "DC voice coil resistance (Ω)",
    "Qts":               "total Q factor",
    "Qes":               "electrical Q factor",
    "Qms":               "mechanical Q factor",
    "BL":                "force factor (T·m)",
    "Mms":               "moving mass incl. air load (kg)",
    "Cms":               "mechanical compliance (m/N)",
    "Sd":                "effective piston area (m²)",
    "Vas":               "equivalent acoustic volume (m³)",
    "Xmax":              "one-way linear excursion (m)",
    "Le":                "voice coil inductance (H)",
    "Znom":              "nominal impedance (Ω)",
    "Pe":                "rated power input (W)",
    "SPL":               "sensitivity (dB, 2.83 V/1 m)",
    "Rms":               "mechanical resistance (kg/s)",
    "voice_coil_dia_mm": "voice coil diameter (mm)",
    "Hg_mm":             "magnetic gap height (mm)",
    "freq_low_hz":       "published lower frequency limit (Hz)",
    "freq_high_hz":      "published upper frequency limit (Hz)",
    "power_peak_W":      "peak power handling (W)",
    "weight_kg":         "driver weight (kg)",
}

# WDR T/S field names — values in these fields came from datasheets or HTML T/S tables
_WDR_TS = frozenset({
    "Fs","Re","Qts","Qes","Qms","BL","Mms","Cms","Sd","Vas","Xmax","Le",
    "Znom","Pe","SPL","Rms",
})

# Old flat-specs key → canonical WDR key (or None = special handling)
_RENAME = {
    "sensitivity_db":  "SPL",
    "power_rms_W":     "Pe",
    "linear_xmax_mm":  None,   # p-p mm → one-way m, fold into Xmax
    "power_peak_W":    "power_peak_W",
    "weight_kg":       "weight_kg",
    "voice_coil_dia_mm": "voice_coil_dia_mm",
    "Hg_mm":           "Hg_mm",
    "freq_low_hz":     "freq_low_hz",
    "freq_high_hz":    "freq_high_hz",
}


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def annotate_specs_yaml(yaml_str: str) -> str:
    """Insert inline # comments on spec field key lines."""
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


def _parse_wdr_fields(wdr_path: Path) -> dict[str, float]:
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


# ── Collection-specific HTML spec extractors ───────────────────────────────────
# Each returns a raw dict with OLD flat keys (sensitivity_db, power_rms_W, etc.)
# _build_specs() renames them to canonical keys.

def _extract_sb(html: str) -> dict:
    import html as html_module
    specs: dict = {}
    li_items = re.findall(r"<li>(.*?)</li>", html, re.S | re.I)
    for li_raw in li_items:
        item = html_module.unescape(re.sub(r"<[^>]+>", "", li_raw)).strip()
        if not item:
            continue
        il = item.lower()
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
            specs["linear_xmax_mm"] = val
        elif "frequency" in il and "hz" in il:
            nums = re.findall(r"(\d[\d.,]*)", parse_text)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
    return specs


def _extract_si(html: str) -> dict:
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
        elif "power" in label and "handling" in label and "rms" in label:
            specs["power_rms_W"] = val
        elif "power" in label and "handling" in label and "max" in label:
            specs["power_peak_W"] = val
        elif "frequency range" in label or "frequency response" in label:
            nums = re.findall(r"(\d[\d.,]*)", value)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
        elif "voice coil diameter" in label and "mm" in vl:
            specs["voice_coil_dia_mm"] = val
        elif "weight" in label and "kg" in vl:
            specs["weight_kg"] = val
    return specs


def _extract_ss(html: str) -> dict:
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
        elif ("frequency range" in label or ("freq" in label and "range" in label)):
            nums = re.findall(r"(\d[\d.,]*)", value)
            if len(nums) >= 2:
                specs.setdefault("freq_low_hz", float(nums[0].replace(",", ".")))
                specs.setdefault("freq_high_hz", float(nums[1].replace(",", ".")))
        elif "power" in label and "handling" in label:
            specs["power_rms_W"] = val
    return specs


def _extract_wavecor(html: str) -> dict:
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
        elif "power" in label and ("w" in vl or "watt" in vl):
            specs["power_rms_W"] = val
        elif ("frequency range" in label or ("freq" in label and "range" in label)):
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
    specs: dict = {}
    for m in re.finditer(
        r"(?i)(sensitivity|power\s+handling|frequency\s+response)[^<]{0,200}", html
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
    "new_ss_tool":   _extract_ss,
    "scan-speak":    _extract_ss,
    "wavecor":       _extract_wavecor,
    "parts-express": _extract_pe,
}


def _find_html(coll_dir: Path, meta: dict) -> str | None:
    html_dir = coll_dir / "_html"
    if not html_dir.exists():
        return None
    source = meta.get("source") or meta.get("vendor_page_url") or meta.get("manu_page_url") or ""
    if source:
        slug = source.rstrip("/").split("/")[-1]
        slug = re.sub(r"[^\w\-.]", "_", slug)
        for candidate in [slug + ".html", slug, slug.replace(".html", "") + ".html"]:
            p = html_dir / candidate
            if p.exists():
                return p.read_text(encoding="utf-8", errors="replace")
        for p in html_dir.glob("*.html"):
            if p.stem.lower() in source.lower() or source.lower() in p.stem.lower():
                return p.read_text(encoding="utf-8", errors="replace")
    return None


def _build_specs_provenance(
    wdr_fields: dict,
    meta: dict,
    html_specs_raw: dict,  # old flat keys from HTML extractor
    coll_name: str,
) -> tuple[dict | None, dict]:
    """
    Returns (new_specs, sources_index).
    new_specs: unified provenance format {field: {value, winner, sources, note?}}
    sources_index: {source_key: url}
    """
    html_src = "manu_page" if meta.get("manu_page_url") else "vendor_page"

    # Build _sources index from URL fields (new _url names after normalisation)
    sources_index: dict[str, str | None] = {}
    if meta.get("datasheet_url"):
        sources_index["datasheet"] = meta["datasheet_url"]
    if meta.get("adv_datasheet_url"):
        sources_index["adv_datasheet"] = meta["adv_datasheet_url"]
    if meta.get("manu_page_url"):
        sources_index["manu_page"] = meta["manu_page_url"]
    if meta.get("vendor_page_url"):
        sources_index["vendor_page"] = meta["vendor_page_url"]

    # Old source key → new source key mapping
    old_to_new: dict[str, str] = {
        "pdf":     "datasheet" if "datasheet" in sources_index else html_src,
        "adv_pdf": "adv_datasheet" if "adv_datasheet" in sources_index else "datasheet",
        "html":    html_src,
    }

    new_specs: dict = {}

    # 1. Convert existing field_provenance (T/S fields with contest record)
    old_fp = meta.get("field_provenance") or {}
    for fld, entry in old_fp.items():
        if not isinstance(entry, dict):
            continue
        old_srcs: dict = entry.get("sources") or {}
        old_winner: str = entry.get("winner") or ""
        new_srcs = {old_to_new.get(k, k): v for k, v in old_srcs.items()}
        new_winner = old_to_new.get(old_winner, old_winner)
        val = new_srcs.get(new_winner)
        if val is None and new_srcs:
            val = next(iter(new_srcs.values()))
        _entry: dict = {"value": val, "winner": new_winner, "sources": new_srcs}
        if (fld in _WDR_TS and new_winner != "datasheet"
                and "datasheet" in sources_index):
            _entry["note"] = f"Not in datasheet; value from {new_winner}"
        new_specs[fld] = _entry

    # 2. T/S fields in WDR but absent from field_provenance (old HTML-only scrapers)
    for fld in _WDR_TS:
        if fld not in new_specs and fld in wdr_fields and wdr_fields[fld] != 0.0:
            val = wdr_fields[fld]
            # For old HTML scrapers: source was html; if datasheet URL exists but we have
            # no fp record, that means the old scraper didn't do PDF — mark as html_src
            new_specs[fld] = {"value": val, "winner": html_src, "sources": {html_src: val}}

    # 3. Non-T/S HTML specs — rename old flat keys to canonical names
    for old_key, val in html_specs_raw.items():
        new_key = _RENAME.get(old_key, old_key)
        if new_key is None:
            # linear_xmax_mm (p-p mm) → Xmax (one-way m)
            xmax_m = round(val * 0.5e-3, 6)
            if "Xmax" not in new_specs:
                new_specs["Xmax"] = {"value": xmax_m, "winner": html_src,
                                     "sources": {html_src: xmax_m}}
            elif html_src not in new_specs["Xmax"]["sources"]:
                new_specs["Xmax"]["sources"][html_src] = xmax_m
        elif new_key not in new_specs:
            new_specs[new_key] = {"value": val, "winner": html_src,
                                  "sources": {html_src: val}}
        elif html_src not in new_specs[new_key].get("sources", {}):
            new_specs[new_key]["sources"][html_src] = val

    # 4. Legacy top-level freq range fields
    for fkey in ("freq_low_hz", "freq_high_hz"):
        if meta.get(fkey) and fkey not in new_specs:
            new_specs[fkey] = {"value": meta[fkey], "winner": html_src,
                               "sources": {html_src: meta[fkey]}}

    return (new_specs or None), sources_index


def _is_new_format(specs: object) -> bool:
    """True if specs is already in the provenance format {field: {value,winner,sources}}."""
    if not isinstance(specs, dict):
        return False
    for v in specs.values():
        if isinstance(v, dict) and "value" in v and "winner" in v:
            return True
        if isinstance(v, dict) and ("woofer" in v or "tweeter" in v):
            # Coaxial — check inner structure
            for comp_fields in v.values():
                if isinstance(comp_fields, dict):
                    for fv in comp_fields.values():
                        if isinstance(fv, dict) and "value" in fv:
                            return True
        return False
    return False


def _wrap_coaxial(specs: dict, html_src: str) -> dict:
    """Wrap a flat coaxial {woofer: {Fs: val}, tweeter: {Fs: val}} in provenance."""
    result = {}
    for comp, comp_fields in specs.items():
        if isinstance(comp_fields, dict):
            wrapped = {}
            for k, v in comp_fields.items():
                if isinstance(v, dict) and "value" in v:
                    wrapped[k] = v  # already wrapped
                else:
                    wrapped[k] = {"value": v, "winner": html_src, "sources": {html_src: v}}
            result[comp] = wrapped
        else:
            result[comp] = comp_fields
    return result


def process_collection(coll_dir: Path, force: bool) -> tuple[int, int, int]:
    coll_name = coll_dir.name
    meta_files = sorted(coll_dir.glob("*_meta.yml"))
    ok = skipped = errors = 0

    for meta_path in meta_files:
        wdr_path = meta_path.with_name(meta_path.name.replace("_meta.yml", ".wdr"))
        if not wdr_path.exists():
            errors += 1
            continue
        try:
            raw_text = meta_path.read_text(encoding="utf-8")
            meta = yaml.safe_load(raw_text) or {}
        except Exception:
            errors += 1
            continue

        # Apply URL renames and strip orphaned fields before any processing
        _normalise_meta_fields(meta)

        html_src = "manu_page" if meta.get("manu_page_url") else "vendor_page"
        existing_specs = meta.get("specs")

        # Coaxial with flat woofer/tweeter structure — wrap in provenance
        if isinstance(existing_specs, dict) and (
            "woofer" in existing_specs or "tweeter" in existing_specs
        ):
            if not force and _is_new_format(existing_specs):
                skipped += 1
                continue
            meta["specs"] = _wrap_coaxial(existing_specs, html_src)
            try:
                meta_path.write_text(
                    annotate_specs_yaml(yaml.dump(reorder_meta_for_save(meta), allow_unicode=True, sort_keys=False)),
                    encoding="utf-8",
                )
                ok += 1
            except Exception as e:
                print(f"[{_ts()}]   ERROR {meta_path.name}: {e}", flush=True)
                errors += 1
            continue

        # Skip if already in new provenance format and not forcing
        if not force and _is_new_format(existing_specs):
            skipped += 1
            continue

        wdr_fields = _parse_wdr_fields(wdr_path)
        html = _find_html(coll_dir, meta)
        html_specs_raw: dict = {}
        if html:
            extractor = _HTML_EXTRACTORS.get(coll_name)
            if extractor:
                try:
                    html_specs_raw = extractor(html)
                except Exception:
                    pass

        new_specs, sources_index = _build_specs_provenance(
            wdr_fields, meta, html_specs_raw, coll_name
        )

        # Also fold any flat specs that already exist (from previous populate_specs run)
        if isinstance(existing_specs, dict) and not _is_new_format(existing_specs):
            for old_key, val in existing_specs.items():
                new_key = _RENAME.get(old_key, old_key)
                if new_key is None:
                    xmax_m = round(val * 0.5e-3, 6)
                    if new_specs and "Xmax" not in new_specs:
                        new_specs = new_specs or {}
                        new_specs["Xmax"] = {"value": xmax_m, "winner": html_src,
                                             "sources": {html_src: xmax_m}}
                elif new_specs is not None and new_key not in new_specs:
                    new_specs[new_key] = {"value": val, "winner": html_src,
                                          "sources": {html_src: val}}

        meta["_sources"] = sources_index if sources_index else None
        meta["specs"] = new_specs

        try:
            meta_path.write_text(
                annotate_specs_yaml(yaml.dump(reorder_meta_for_save(meta), allow_unicode=True, sort_keys=False)),
                encoding="utf-8",
            )
            ok += 1
        except Exception as e:
            print(f"[{_ts()}]   ERROR writing {meta_path.name}: {e}", flush=True)
            errors += 1

    return ok, skipped, errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate all _meta.yml to unified specs + _sources provenance format"
    )
    parser.add_argument("--force", action="store_true",
                        help="Rewrite even if already in new provenance format")
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
        total_ok += ok
        total_skip += skip
        total_err += err
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
