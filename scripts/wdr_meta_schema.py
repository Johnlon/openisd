"""
wdr_meta_schema.py — single source of truth for .wdr and _meta.yml validity.

Reading the data structures below IS reading the schema.
The validation functions below ARE the enforcement of that schema.
No other document defines what valid output looks like.

Schema changes require human approval before editing this file — see CLAUDE.md §Schema discipline.
"""
from __future__ import annotations

import configparser
import json
import re
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ══════════════════════════════════════════════════════════════════════════════
# 1.  _meta.yml schema
#     Pydantic v2 with extra="forbid" — any key absent from MetaModel is a
#     violation caught at runtime. This is the only definition of _meta.yml.
# ══════════════════════════════════════════════════════════════════════════════

class FieldProvenanceEntry(BaseModel):
    """One T/S field's source record — what each source had and which won."""
    model_config = ConfigDict(extra="forbid")

    sources: dict[str, float] = Field(description="source_key → SI value")
    winner: str               = Field(description="source key whose value is in the WDR")


class MetaModel(BaseModel):
    """
    _meta.yml sidecar — provenance, quality, and source links for one driver.
    extra="forbid" rejects any key not listed here.
    """
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    # ── mandatory ─────────────────────────────────────────────────────────────
    quality: Literal["H", "M", "L"] = Field(
        description="H = human-verified against datasheet; M = scraped/unverified; L = known data problem")
    source: str = Field(
        description="URL the scraper read T/S data from — primary evidence chain for the values in the WDR")

    # ── human review ──────────────────────────────────────────────────────────
    issue: Optional[str] = Field(None,
        description="Short issue tag, e.g. 'scraped_not_human_verified', 'xmax_convention_uncertain'")
    detail: Optional[str] = Field(None,
        description="Prose provenance description — what was scraped, caveats, source reliability. Multi-line OK.")
    corrections: Optional[str] = Field(None,
        description="AI-authored correction notes: what was fixed, evidence, datasheet reference. "
                    "Never contains 'human verified' language — corrections is AI-owned.")
    reviewed_by: Optional[str] = Field(None,
        description="Human reviewer name. Remains null until the human explicitly authorises it "
                    "for this driver in the current conversation. An AI check is not human verification.")

    # ── driver classification ─────────────────────────────────────────────────
    driver_type: Optional[str] = Field(None,
        description="Product type from manufacturer page, e.g. 'woofer', 'tweeter', 'midrange', 'subwoofer'")
    nominal_size_cm: Optional[float] = Field(None,
        description="Nominal driver diameter in cm — 10 cm ≈ 4\", 30 cm ≈ 12\". From manufacturer page.")

    # ── source URLs ───────────────────────────────────────────────────────────
    datasheet_url: Optional[str] = Field(None,
        description="URL of the primary datasheet PDF")
    adv_datasheet_url: Optional[str] = Field(None,
        description="URL of an advanced-parameters datasheet PDF (e.g. Scan-Speak publishes a separate sheet)")
    drawing_url: Optional[str] = Field(None,
        description="URL of a dimensional drawing file")
    cad_url: Optional[str] = Field(None,
        description="URL of a CAD zip or DXF file")
    manu_page_url: Optional[str] = Field(None,
        description="URL of the manufacturer's product page for this driver")
    vendor_page_url: Optional[str] = Field(None,
        description="URL of a vendor product page (e.g. Parts Express, Mouser)")

    # ── measurement file URLs ─────────────────────────────────────────────────
    frd_url: Optional[str] = Field(None,
        description="URL of a Frequency Response Data (FRD) file. "
                    "Verify content is FRD data before setting — see SCRAPING_RULES.md.")
    zma_url: Optional[str] = Field(None,
        description="URL of an impedance sweep data file (ZMA format)")

    # ── status flags ──────────────────────────────────────────────────────────
    obsolete: Optional[bool] = Field(None,
        description="true if the driver is discontinued. null when unknown.")
    dq_issue: Optional[str] = Field(None,
        description="Data quality flag written by dq_check.py — field name of the failing check, or null if clean")
    community: Optional[str] = Field(None,
        description="Notes on community-sourced data: measurement source, contributor, version marker in filename")
    fetched_sku: Optional[str] = Field(None,
        description="SKU/product ID the scraper used to fetch this driver's data — aids re-scraping")

    # ── named source index ────────────────────────────────────────────────────
    # Maps source keys used in specs.*.winner/sources to their URLs.
    # Keys: 'datasheet', 'adv_datasheet', 'manu_page', 'vendor_page'
    source_index: Optional[dict[str, Optional[str]]] = Field(None, alias="_sources",
        description="Named source index. Maps source keys to URLs. "
                    "Keys: datasheet, adv_datasheet, manu_page, vendor_page.")

    # ── per-field provenance (legacy — replaced by specs.*. sources) ──────────
    field_provenance: Optional[dict] = Field(None,
        description="Legacy per-field source record. Superseded by specs block. Kept for backward compatibility.")

    # ── frequency range (legacy — now in specs.freq_low_hz / freq_high_hz) ───
    freq_low_hz: Optional[float] = Field(None,
        description="Legacy: lower frequency limit (Hz). Superseded by specs.freq_low_hz.")
    freq_high_hz: Optional[float] = Field(None,
        description="Legacy: upper frequency limit (Hz). Superseded by specs.freq_high_hz.")

    # ── unified specs block ───────────────────────────────────────────────────
    # Every field (T/S + non-T/S) with full source provenance.
    # Each entry: {value: <SI>, winner: <source_key>, sources: {key: val, ...}, note?: str}
    # Source keys map to URLs via the _sources block above.
    # Field names match WDR keys (Fs, Re, SPL, Pe, Xmax…) where a WDR field exists;
    # non-WDR fields use descriptive names (voice_coil_dia_mm, Hg_mm, freq_low_hz…).
    # Coaxial drivers: {woofer: {field: {value,winner,sources}}, tweeter: {...}}
    specs: Optional[dict] = Field(None,
        description="Unified parameter block. Each entry has value, winner, sources, optional note. "
                    "All T/S values in SI units. See _sources for URL index.")


# ══════════════════════════════════════════════════════════════════════════════
# 1b. Canonical _meta.yml field order — used by populate_specs and scrapers.
#     Groups: source/URLs → quality → classification → status → structured data.
#     Any field NOT in this list is appended at the end (forward compat).
# ══════════════════════════════════════════════════════════════════════════════

META_FIELD_ORDER: list[str] = [
    # ── Where this data came from ─────────────────────────────────────────────
    "source",
    "manu_page_url",
    "vendor_page_url",
    "datasheet_url",
    "adv_datasheet_url",
    "drawing_url",
    "cad_url",
    "frd_url",
    "zma_url",
    # ── Quality and curation ──────────────────────────────────────────────────
    "quality",
    "issue",
    "detail",
    "corrections",
    "reviewed_by",
    # ── Physical classification ───────────────────────────────────────────────
    "driver_type",
    "nominal_size_cm",
    # ── Status flags ─────────────────────────────────────────────────────────
    "obsolete",
    "dq_issue",
    "community",
    "fetched_sku",
    # ── Structured provenance and parameters ──────────────────────────────────
    "_sources",
    "specs",
    # ── Legacy fields (stripped on next populate_specs run) ───────────────────
    "field_provenance",
    "freq_low_hz",
    "freq_high_hz",
]


def reorder_meta_for_save(meta: dict) -> dict:
    """Return a new dict with keys in META_FIELD_ORDER. Unknown keys go at the end."""
    ordered: dict = {}
    for k in META_FIELD_ORDER:
        if k in meta:
            ordered[k] = meta[k]
    for k, v in meta.items():
        if k not in ordered:
            ordered[k] = v
    return ordered


# ══════════════════════════════════════════════════════════════════════════════
# 2.  WDR field spec
#     All 56 WinISD-native fields. Source: direct analysis of drivers/matt/
#     (423 human-curated files) and drivers/sample/ (53 probe experiments).
#     Reference: WDR_SCHEMA.md §2–§8.
#
#     kind  — 'str' | 'float'
#     lo/hi — physical range in SI units; None = no bound on that side
#     unit  — SI unit string (informational; appears in error messages)
#     desc  — only present where the field name is opaque to a non-specialist
#
#     Range checks skip val == 0.0. Zero is WinISD's "not set" sentinel for
#     most numeric fields; WinISD recomputes them from T/S on load.
# ══════════════════════════════════════════════════════════════════════════════

_WDR_FIELD_SPEC: dict[str, dict[str, Any]] = {

    # ── metadata (positions 1–7) ──────────────────────────────────────────────
    "Brand":        {"kind": "str", "required": True},
    "Model":        {"kind": "str", "required": True},
    "Manufacturer": {"kind": "str", "required": True},
    "ProvidedBy":   {"kind": "str", "required": False},
    "Comment":      {"kind": "str", "required": False},
    "DateAdded":    {"kind": "str", "required": False},    # YYYYMMDD — validated below
    "DateModified": {"kind": "str", "required": False},

    # ── T/S parameters (positions 8–25) ──────────────────────────────────────
    # Optional: scrapers only write fields they successfully extracted.
    "Qts":  {"kind": "float", "lo": 0.01,   "hi": 5.0,     "unit": "—",       "desc": "Total Q"},
    "Znom": {"kind": "float", "lo": 1.0,    "hi": 64.0,    "unit": "Ω",       "desc": "Nominal impedance (descriptive only; not used in simulation)"},
    "Fs":   {"kind": "float", "lo": 1.0,    "hi": 5000.0,  "unit": "Hz",      "desc": "Free-air resonance frequency"},
    "Pe":   {"kind": "float", "lo": 1.0,    "hi": 20000.0, "unit": "W",       "desc": "Thermal power limit"},
    "SPL":  {"kind": "float", "lo": 50.0,   "hi": 150.0,   "unit": "dB/W/m"},
    "Re":   {"kind": "float", "lo": 0.1,    "hi": 64.0,    "unit": "Ω",       "desc": "DC voice coil resistance"},
    "Le":   {"kind": "float", "lo": 0.0,    "hi": 0.1,     "unit": "H",       "desc": "Voice coil inductance — H not mH"},
    "fLe":  {"kind": "float", "lo": 0.0,    "hi": None,    "unit": "Hz",      "desc": "Freq at which Le/KLe were measured; 0 = standard Le model"},
    "KLe":  {"kind": "float", "lo": 0.0,    "hi": None,    "unit": "H·√Hz",   "desc": "Semi-inductance (Vanderkooy model); 0 = not active"},
    "BL":   {"kind": "float", "lo": 0.1,    "hi": 50.0,    "unit": "T·m",     "desc": "Force factor — case-sensitive BL= not Bl="},
    # Xmax lo=0.0001 not 0: zero is "not set"; 0.1 mm is the smallest plausible real Xmax
    "Xmax": {"kind": "float", "lo": 0.0001, "hi": 0.15,    "unit": "m",       "desc": "One-way peak linear excursion — m not mm"},
    "Cms":  {"kind": "float", "lo": 1e-6,   "hi": 0.1,     "unit": "m/N",     "desc": "Mechanical compliance — m/N not mm/N"},
    "Qms":  {"kind": "float", "lo": 0.1,    "hi": 50.0,    "unit": "—",       "desc": "Mechanical Q"},
    "Qes":  {"kind": "float", "lo": 0.01,   "hi": 5.0,     "unit": "—",       "desc": "Electrical Q"},
    "Rms":  {"kind": "float", "lo": 0.0,    "hi": 200.0,   "unit": "kg/s",    "desc": "Mechanical resistance"},
    "Mms":  {"kind": "float", "lo": 1e-5,   "hi": 2.0,     "unit": "kg",      "desc": "Moving mass including air load — kg not grams"},
    "Sd":   {"kind": "float", "lo": 1e-5,   "hi": 0.3,     "unit": "m²",      "desc": "Effective piston area — m² not cm²"},
    "Vas":  {"kind": "float", "lo": 1e-6,   "hi": 1.0,     "unit": "m³",      "desc": "Equivalent compliance volume — m³ not litres"},

    # ── position 26 ──────────────────────────────────────────────────────────
    "Dia":  {"kind": "float", "lo": 0.0, "hi": None, "unit": "m",
             "desc": "Voice coil diameter — superseded by Dd in WinISD alpha2 (2001); source: versions.txt alpha2"},

    # ── calculatable fields (positions 27–44) ────────────────────────────────
    "Vd":       {"kind": "float", "lo": 0.0, "hi": None,  "unit": "m³",       "desc": "Sd × Xmax"},
    "no":       {"kind": "float", "lo": 0.0, "hi": 1.0,   "unit": "fraction", "desc": "Limit efficiency η₀ (stored as fraction, displayed as % in UI)"},
    "Dd":       {"kind": "float", "lo": 0.0, "hi": 2.0,   "unit": "m",        "desc": "Effective piston diameter: 2·√(Sd/π)"},
    "EBP":      {"kind": "float", "lo": 0.0, "hi": None,  "unit": "Hz",       "desc": "Efficiency bandwidth product: Fs/Qes"},
    "numVC":    {"kind": "float", "lo": 1.0, "hi": 4.0,   "unit": "count"},
    "Hc":       {"kind": "float", "lo": 0.0, "hi": None,  "unit": "m",        "desc": "Voice coil winding height"},
    "Hg":       {"kind": "float", "lo": 0.0, "hi": None,  "unit": "m",        "desc": "Magnetic airgap height"},
    "SPLmax":   {"kind": "float", "lo": 0.0, "hi": 200.0, "unit": "dB",       "desc": "SPL + 10·log10(Pe)"},
    "SPLmaxLF": {"kind": "float", "lo": 0.0, "hi": 200.0, "unit": "dB",       "desc": "Excursion-limited SPL at 20 Hz, closed box half-space"},
    "USPL":     {"kind": "float", "lo": 0.0, "hi": 200.0, "unit": "dB/2.83V", "desc": "Voltage sensitivity: SPL + 10·log10(8/Re)"},
    "alfaVC":   {"kind": "float", "lo": 0.0, "hi": 1.0,   "unit": "1/K",      "desc": "VC resistance temperature coefficient; copper ≈ 0.0039"},
    "Rt":       {"kind": "float", "lo": 0.0, "hi": None,  "unit": "K/W"},
    "Ct":       {"kind": "float", "lo": 0.0, "hi": None,  "unit": "J/K"},
    "gamma":    {"kind": "float", "lo": 0.0, "hi": None,  "unit": "m/(s²·A)", "desc": "Acceleration factor: BL/Mms"},
    "Rme":      {"kind": "float", "lo": 0.0, "hi": None,  "unit": "N·s/m",    "desc": "Electromagnetic damping: BL²/Re"},
    "Mpow":     {"kind": "float", "lo": 0.0, "hi": None,  "unit": "N/√W",     "desc": "Motor power factor: BL/√Re"},
    "Mcost":    {"kind": "float", "lo": 0.0, "hi": None,  "unit": "N·s/m",    "desc": "Motor cost factor (source: thielesmall.html, T.L. Clarke)"},
    "Gloss":    {"kind": "float", "lo": 0.0, "hi": 1.0,   "unit": "fraction", "desc": "Cone sag fraction of Xmax when mounted horizontally"},

    # ── VC connection (position 45) ───────────────────────────────────────────
    # WinISD save bug: always writes VCCon=1 regardless of UI selection.
    # VCCon=2 (series) can only be set by hand-editing. Source: WDR_SCHEMA.md §3.5.
    "VCCon": {"kind": "float", "lo": 1.0, "hi": 2.0, "unit": "1=parallel 2=series"},

    # ── environmental constants (positions 46–47) ─────────────────────────────
    # Present in all matt/ and sample/ files. SPL calculation depends on these.
    # Typical: c=343.684120962152 m/s, roo=1.20095217714682 kg/m³ (~20°C, 1 atm).
    "c":   {"kind": "float", "lo": 300.0, "hi": 360.0, "unit": "m/s",   "desc": "Speed of sound"},
    "roo": {"kind": "float", "lo": 0.9,   "hi": 1.5,   "unit": "kg/m³", "desc": "Air density"},

    # ── physical dimensions (positions 48–55) ─────────────────────────────────
    "Thick":    {"kind": "float", "lo": 0.0, "hi": None, "unit": "m"},
    "Depth":    {"kind": "float", "lo": 0.0, "hi": None, "unit": "m"},
    "MagDepth": {"kind": "float", "lo": 0.0, "hi": None, "unit": "m"},
    "Magnet":   {"kind": "float", "lo": 0.0, "hi": None, "unit": "m",   "desc": "Magnet diameter"},
    "Basket":   {"kind": "float", "lo": 0.0, "hi": None, "unit": "m",   "desc": "Basket diameter"},
    "Outer":    {"kind": "float", "lo": 0.0, "hi": None, "unit": "m",   "desc": "Outer flange diameter"},
    "Vcd":      {"kind": "float", "lo": 0.0, "hi": None, "unit": "m³",  "desc": "Voice coil diameter"},
    "DVol":     {"kind": "float", "lo": 0.0, "hi": None, "unit": "m³",  "desc": "Driver displacement volume"},

    # ── parameter state string (position 56) ─────────────────────────────────
    "ParState": {"kind": "str", "required": False},
}

# Fields that must be present and non-empty in every WDR.
_WDR_MANDATORY = {"Brand", "Model"}

# 49 chars from {E, C, N}. Source: WDR_SCHEMA.md §8; confirmed via sample/ probe experiments.
_PARSTATE_RE = re.compile(r"^[ECN]{49}$")

# YYYYMMDD — no separators. Source: WDR_SCHEMA.md §3.1 / §5.4.
_DATE_RE = re.compile(r"^\d{8}$")

import math as _math

# Calculatable fields: if all dependencies are present and non-zero, the stored value
# must match the formula within tolerance. Discrepancy → DQ warning (not a hard error).
# Tolerance is relative: abs(stored - expected) / expected > tol → alert.
_WDR_CALCULATABLE: dict[str, dict] = {
    # tol_info: discrepancy above this but below tol → INFO note written to meta corrections
    #           (not a schema fail — recorded for transparency only).
    #
    # Qts tolerance rationale — SETTLED, do not re-litigate:
    #   Formula: Qts = Qes·Qms / (Qes + Qms).  Stored Qts is the manufacturer's rounded
    #   published value; our calculated Qts uses rounded Qes and Qms (typically 2 d.p.).
    #   Error propagation: δQts/Qts ≈ [Qms/(Qms+Qes)]·(δQes/Qes) + [Qes/(Qms+Qes)]·(δQms/Qms).
    #   For Qes=0.25, Qms=3.99 (typical): dominant term ≈ 0.94 × 0.02 ≈ 1.9%.
    #   Rounding of stored Qts adds another ~0.5%, giving ~2.4% total from rounding alone.
    #   3% fail threshold covers all legitimate rounding; >3% indicates a data entry error.
    "Qts":   {"deps": ("Qms", "Qes"),   "tol": 0.03, "tol_info": 0.01,
               "fn": lambda f: f["Qms"] * f["Qes"] / (f["Qms"] + f["Qes"])},
    "Vd":    {"deps": ("Sd", "Xmax"),   "tol": 0.01,
               "fn": lambda f: f["Sd"] * f["Xmax"]},
    "Dd":    {"deps": ("Sd",),          "tol": 0.01,
               "fn": lambda f: 2.0 * _math.sqrt(f["Sd"] / _math.pi)},
    "EBP":   {"deps": ("Fs", "Qes"),    "tol": 0.01,
               "fn": lambda f: f["Fs"] / f["Qes"]},
    "Rme":   {"deps": ("BL", "Re"),     "tol": 0.01,
               "fn": lambda f: f["BL"] ** 2 / f["Re"]},
    "Mpow":  {"deps": ("BL", "Re"),     "tol": 0.01,
               "fn": lambda f: f["BL"] / _math.sqrt(f["Re"])},
    "gamma": {"deps": ("BL", "Mms"),           "tol": 0.01,
               "fn": lambda f: f["BL"] / f["Mms"]},
    # Vas tolerance rationale — SETTLED, do not re-litigate:
    #   Formula: Vas = ρ·c²·Sd²·Cms.  Two independent sources of discrepancy:
    #   (1) Rounding: Sd appears squared, so a 0.5% Sd rounding error gives 1% Vas error.
    #       Cms rounded to 2 sig figs (e.g. 1.1 mm/N instead of 1.13) gives up to 2.7% error.
    #       Combined: ~3.5% from rounding alone is reachable.
    #   (2) Measurement method: vendors often publish Vas from a direct box or delta-mass
    #       measurement, while our cross-check recomputes it from Sd×Cms.  These two methods
    #       can legitimately disagree by 3–5% even with perfect inputs (Sd is hard to measure).
    #   4% fail threshold is mathematically justified by rounding alone; >4% suggests a
    #   unit conversion error or a fundamentally wrong field value.
    "Vas":   {"deps": ("roo", "c", "Sd", "Cms"),       "tol": 0.04, "tol_info": 0.01,
               "fn": lambda f: f["roo"] * f["c"] ** 2 * f["Sd"] ** 2 * f["Cms"]},
    # η₀ = (4π² / (roo × c³)) × (Fs³ × Mms / (Qes × BL²))  [fraction, not %]
    "no":       {"deps": ("roo", "c", "Fs", "Mms", "Qes", "BL"), "tol": 0.02,
                  "fn": lambda f: (4 * _math.pi ** 2 / (f["roo"] * f["c"] ** 3))
                                   * (f["Fs"] ** 3 * f["Mms"] / (f["Qes"] * f["BL"] ** 2))},
    # SPLmax = SPL + 10·log10(Pe)
    "SPLmax":   {"deps": ("SPL", "Pe"),  "tol": 0.01,
                  "fn": lambda f: f["SPL"] + 10 * _math.log10(f["Pe"])},
    # SPLmaxLF: excursion-limited SPL at 20 Hz, half-space, r=1m
    # p_rms = roo × 2π × f² × Sd × Xmax / √2  →  SPL = 20·log10(p_rms / 20µPa)
    "SPLmaxLF": {"deps": ("roo", "Sd", "Xmax"), "tol": 0.05,
                  "fn": lambda f: 20 * _math.log10(
                      f["roo"] * 2 * _math.pi * 400 * f["Sd"] * f["Xmax"]
                      / (_math.sqrt(2) * 20e-6))},
    # USPL = SPL + 10·log10(8 / Re)  (voltage sensitivity re 2.83 V into 8 Ω)
    "USPL":     {"deps": ("SPL", "Re"),  "tol": 0.01,
                  "fn": lambda f: f["SPL"] + 10 * _math.log10(8.0 / f["Re"])},
}


# ══════════════════════════════════════════════════════════════════════════════
# 3.  Validation
# ══════════════════════════════════════════════════════════════════════════════

def validate_wdr(wdr_path: Path) -> list[str]:
    """Return a list of schema violations for a .wdr file. Empty = valid."""
    errors: list[str] = []
    text = wdr_path.read_text(encoding="utf-8", errors="replace")

    if not text.startswith("[Driver]"):
        errors.append("First line must be [Driver]")

    parser = configparser.RawConfigParser()
    parser.optionxform = str  # preserve case — Brand not brand
    try:
        parser.read_string(text)
    except Exception as exc:
        errors.append(f"INI parse error: {exc}")
        return errors

    if not parser.has_section("Driver"):
        errors.append("Missing [Driver] section")
        return errors

    items = dict(parser.items("Driver"))

    for key in items:
        if key not in _WDR_FIELD_SPEC:
            errors.append(f"Unknown field: {key!r}")

    for field in _WDR_MANDATORY:
        if not items.get(field, "").strip():
            errors.append(f"Mandatory field missing or empty: {field!r}")

    for field, spec in _WDR_FIELD_SPEC.items():
        if spec["kind"] != "float":
            continue
        raw = items.get(field)
        if raw is None:
            continue
        try:
            val = float(raw)
        except ValueError:
            errors.append(f"{field!r}: cannot parse {raw!r} as float")
            continue
        if val == 0.0:
            continue  # 0 = not set; WinISD recomputes on load
        lo, hi, unit = spec.get("lo"), spec.get("hi"), spec.get("unit", "")
        if lo is not None and val < lo:
            errors.append(f"{field!r} = {val} below minimum {lo} {unit}")
        if hi is not None and val > hi:
            errors.append(f"{field!r} = {val} above maximum {hi} {unit}")

    for date_field in ("DateAdded", "DateModified"):
        raw = items.get(date_field)
        if raw and not _DATE_RE.match(raw):
            errors.append(f"{date_field!r} must be YYYYMMDD; got {raw!r}")

    parstate = items.get("ParState")
    if parstate is not None and not _PARSTATE_RE.match(parstate):
        errors.append(
            f"ParState must be 49 chars from {{E,C,N}}; got {len(parstate)}: {parstate!r}"
        )

    # DQ: calculatable field consistency check.
    # Parse all numeric fields once for the dependency lookups.
    # Also track fields that failed their own range check — if a dependency is
    # already out of range, skipping the cross-check avoids cascade false positives
    # (e.g., a bad Sd value produces an absurd calculated Vas).
    range_fail_fields: set[str] = set()
    numeric = {}
    for f, spec in _WDR_FIELD_SPEC.items():
        if spec["kind"] == "float" and f in items:
            try:
                v = float(items[f])
                if v != 0.0:
                    numeric[f] = v
                    lo, hi = spec.get("lo"), spec.get("hi")
                    if (lo is not None and v < lo) or (hi is not None and v > hi):
                        range_fail_fields.add(f)
            except ValueError:
                pass

    for field, rule in _WDR_CALCULATABLE.items():
        stored = numeric.get(field)
        if stored is None:
            continue  # not present — nothing to check
        deps = rule["deps"]
        if not all(d in numeric for d in deps):
            continue  # dependencies absent — cannot compute expected
        if range_fail_fields.intersection(deps):
            continue  # a dependency is already out of range — cross-check would be meaningless
        expected = rule["fn"](numeric)
        rel = abs(stored - expected) / abs(expected)
        msg = (f"{field!r} stored={stored:.6g} differs from calculated={expected:.6g} "
               f"(deps: {', '.join(f'{d}={numeric[d]:.6g}' for d in deps)})")
        if rel > rule["tol"]:
            errors.append(msg)
        elif rel > rule.get("tol_info", rule["tol"]):
            errors.append(f"INFO: {msg}")

    return errors


def validate_meta(meta_path: Path) -> list[str]:
    """Return a list of schema violations for a _meta.yml file. Empty = valid."""
    import yaml
    from pydantic import ValidationError

    errors: list[str] = []
    try:
        data = yaml.safe_load(meta_path.read_text(encoding="utf-8", errors="replace")) or {}
    except Exception as exc:
        errors.append(f"YAML parse error: {exc}")
        return errors

    try:
        MetaModel.model_validate(data)
    except ValidationError as exc:
        for err in exc.errors():
            loc = ".".join(str(x) for x in err["loc"])
            errors.append(f"{loc}: {err['msg']}")

    return errors


def validate_driver(wdr_path: Path, meta_path: Path) -> list[str]:
    """Return combined violations for a driver's WDR + meta pair. Empty = valid."""
    return (
        [f"WDR: {e}" for e in validate_wdr(wdr_path)]
        + [f"META: {e}" for e in validate_meta(meta_path)]
    )


# ══════════════════════════════════════════════════════════════════════════════
# 4.  JSON Schema export  (language-agnostic reference for the _meta.yml schema)
# ══════════════════════════════════════════════════════════════════════════════

def export_meta_json_schema() -> dict:
    return MetaModel.model_json_schema()


if __name__ == "__main__":
    out = Path(__file__).parent.parent.parent / "drivers" / "SCHEMA_meta.json"
    out.write_text(json.dumps(export_meta_json_schema(), indent=2), encoding="utf-8")
    print(f"Written: {out}")
