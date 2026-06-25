"""
dq_check.py — WDR data quality rules, shared by the CLI tool and scrapers.

check_fields(fields) is the single source of truth for all DQ rules.
It is imported by scraper_lib.py to validate at write time.

Run: python scripts/dq_check.py [--collection <name>] [--check-urls]
  --collection   only check one collection subdirectory
  --check-urls   HTTP HEAD every URL in flagged files; report status + content-type
"""

import math
import pathlib
import re
import sys
import urllib.request
import urllib.error
import argparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DRIVERS_DIR = pathlib.Path(__file__).parent.parent / "drivers"
URL_FIELDS = ["boxbench_datasheet", "boxbench_manu_page", "boxbench_vendor_page"]


def parse_fields(text: str) -> dict:
    fields = {}
    for line in text.splitlines():
        eq = line.find("=")
        if eq < 0 or line.startswith("["):
            continue
        fields[line[:eq].strip()] = line[eq + 1:].strip()
    return fields


def _n(f: dict, key: str):
    try:
        v = float(f.get(key, ""))
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


# ── Rules ─────────────────────────────────────────────────────────────────────
# Each rule is a plain function: fields -> str | None
# Returns None (pass) or a short detail string describing what is wrong.
# RULES list at the bottom maps each function to its id and description.

def _missing_Fs(f):
    v = _n(f, "Fs")
    if "Fs" not in f:           return "Fs absent"
    if v == 0:                  return "Fs=0 (scraper artifact)"
    if v is None or v < 0:     return f"Fs={f['Fs']} (invalid)"

def _missing_Sd(f):
    v = _n(f, "Sd")
    if "Sd" not in f:           return "Sd absent"
    if v == 0:                  return "Sd=0 (scraper artifact)"
    if v is None or v < 0:     return f"Sd={f['Sd']} (invalid)"

def _missing_Re(f):
    v = _n(f, "Re")
    if "Re" not in f:           return "Re absent"
    if v == 0:                  return "Re=0 (scraper artifact)"
    if v is None or v < 0:     return f"Re={f['Re']} (invalid)"

def _zero_BL(f):
    return "BL=0" if ("BL" in f and _n(f, "BL") == 0) else None

def _zero_Mms(f):
    return "Mms=0" if ("Mms" in f and _n(f, "Mms") == 0) else None

def _zero_Qts(f):
    return "Qts=0" if ("Qts" in f and _n(f, "Qts") == 0) else None

def _zero_Qms(f):
    return "Qms=0" if ("Qms" in f and _n(f, "Qms") == 0) else None

def _zero_Vas(f):
    return "Vas=0" if ("Vas" in f and _n(f, "Vas") == 0) else None

def _Fs_low(f):
    v = _n(f, "Fs")
    return f"Fs={v}" if (v and 0 < v < 5) else None

def _Fs_high(f):
    v = _n(f, "Fs")
    return f"Fs={v}" if (v and v > 5000) else None

def _Fs_no_Q(f):
    v = _n(f, "Fs")
    if not v or v <= 500:
        return None
    if "Qts" not in f and "Qes" not in f:
        return (f"Fs={v:.0f} Hz with no Qts/Qes — likely crossover/range freq, "
                f"not T/S resonance; compression drivers and AMTs don't publish T/S Fs")

def _Sd_huge(f):
    v = _n(f, "Sd")
    return f"Sd={v*1e4:.0f} cm²" if (v and v * 1e4 > 3000) else None

def _Sd_tiny(f):
    v = _n(f, "Sd")
    return f"Sd={v*1e4:.3f} cm²" if (v and 0 < v * 1e4 < 0.5) else None

def _Re_low(f):
    v = _n(f, "Re")
    return f"Re={v}" if (v and v < 1) else None

def _Re_high(f):
    v = _n(f, "Re")
    return f"Re={v}" if (v and v > 64) else None

def _Qts_impossible(f):
    qts, qes = _n(f, "Qts"), _n(f, "Qes")
    return f"Qts={qts} Qes={qes}" if (qts and qes and qts >= qes) else None

def _Qts_impossible2(f):
    qts, qms = _n(f, "Qts"), _n(f, "Qms")
    return f"Qts={qts} Qms={qms}" if (qts and qms and qts >= qms) else None

def _Qts_high(f):
    v = _n(f, "Qts")
    return f"Qts={v}" if (v and v > 5) else None

def _Qes_zero(f):
    v = _n(f, "Qes")
    return f"Qes={v}" if (v is not None and v <= 0) else None

def _Qms_low(f):
    v = _n(f, "Qms")
    return f"Qms={v}" if (v and v < 0.5) else None

def _Pe_one(f):
    v = _n(f, "Pe")
    return "Pe=1 (scraper artifact)" if v == 1 else None

def _Pe_zero(f):
    v = _n(f, "Pe")
    return "Pe=0 (scraper artifact)" if (v is not None and v == 0) else None

def _Xmax_zero(f):
    v = _n(f, "Xmax")
    return "Xmax=0 (scraper artifact)" if (v is not None and v == 0) else None

def _Xmax_huge(f):
    v = _n(f, "Xmax")
    return f"Xmax={v*1000:.0f} mm" if (v and v * 1000 > 100) else None

def _Vas_huge(f):
    v = _n(f, "Vas")
    return f"Vas={v*1000:.0f} L" if (v and v * 1000 > 2000) else None

def _Vas_tiny_for_driver(f):
    vas, sd = _n(f, "Vas"), _n(f, "Sd")
    if not sd or not vas:
        return None
    sd_cm2, vas_L = sd * 1e4, vas * 1000
    if sd_cm2 > 150 and vas_L < sd_cm2 / 60:
        return (f"Sd={sd_cm2:.0f} cm² Vas={vas_L:.2f} L "
                f"(min plausible ≈ {sd_cm2/60:.1f} L)")

def _tweeter_fs(f):
    sd, fs = _n(f, "Sd"), _n(f, "Fs")
    if sd and fs and sd * 1e4 < 5 and fs < 100:
        return f"Sd={sd*1e4:.1f} cm² Fs={fs}"

def _SPL_high(f):
    v = _n(f, "SPL")
    return f"SPL={v}" if (v and v > 120) else None

def _SPL_low(f):
    v = _n(f, "SPL")
    return f"SPL={v}" if (v and v < 65) else None


RULES = [
    # ── Absent or zero core fields ────────────────────────────────────────────
    ("missing_Fs",  "Fs absent, zero, or invalid — scraper artifact",                       _missing_Fs),
    ("missing_Sd",  "Sd absent, zero, or invalid — scraper artifact",                       _missing_Sd),
    ("missing_Re",  "Re absent, zero, or invalid — scraper artifact",                       _missing_Re),
    ("zero_BL",     "BL = 0 — scraper artifact; no real motor has zero force factor",       _zero_BL),
    ("zero_Mms",    "Mms = 0 — scraper artifact; no cone has zero moving mass",             _zero_Mms),
    ("zero_Qts",    "Qts = 0 — scraper artifact; Qts=0 is thermodynamically impossible",   _zero_Qts),
    ("zero_Qms",    "Qms = 0 — scraper artifact; no suspension has zero mechanical Q",      _zero_Qms),
    ("zero_Vas",    "Vas = 0 — scraper artifact; equivalent air volume cannot be zero",     _zero_Vas),
    # ── Fs ───────────────────────────────────────────────────────────────────
    ("Fs_low",    'Fs < 5 Hz — impossible; dot-thousands bug ("1.600 Hz" → 1.6); fix: ×1000', _Fs_low),
    ("Fs_high",   "Fs > 5000 Hz — implausible for a cone driver",                          _Fs_high),
    ("Fs_no_Q",   "Fs > 500 Hz but no Qts/Qes — crossover/range freq captured as Fs (compression driver or AMT)", _Fs_no_Q),
    # ── Sd ───────────────────────────────────────────────────────────────────
    ("Sd_huge",   "Sd > 3000 cm² — larger than any real driver",                           _Sd_huge),
    ("Sd_tiny",   "Sd < 0.5 cm² — scraper artifact (near-zero)",                           _Sd_tiny),
    # ── Re ───────────────────────────────────────────────────────────────────
    ("Re_low",    "Re < 1 Ω — below DC resistance of any voice coil",                      _Re_low),
    ("Re_high",   "Re > 64 Ω — implausibly high voice coil resistance",                    _Re_high),
    # ── Q values ─────────────────────────────────────────────────────────────
    ("Qts_impossible",  "Qts ≥ Qes — thermodynamically impossible (Qts must be < Qes)",   _Qts_impossible),
    ("Qts_impossible2", "Qts ≥ Qms — thermodynamically impossible",                        _Qts_impossible2),
    ("Qts_high",        "Qts > 5 — physically unreasonable for any driver",                _Qts_high),
    ("Qes_zero",        "Qes ≤ 0 — impossible (zero electrical Q = infinite motor damping)", _Qes_zero),
    ("Qms_low",         "Qms < 0.5 — extremely lossy suspension, very unusual",            _Qms_low),
    # ── Pe ───────────────────────────────────────────────────────────────────
    ("Pe_one",    'Pe = 1 W — dot/comma-thousands scraper bug ("1.000 W" → 1)',            _Pe_one),
    ("Pe_zero",   "Pe = 0 — scraper artifact; no datasheet publishes Pe=0",                _Pe_zero),
    # ── Xmax ─────────────────────────────────────────────────────────────────
    ("Xmax_zero", "Xmax = 0 — scraper artifact; no datasheet publishes Xmax=0",           _Xmax_zero),
    ("Xmax_huge", "Xmax > 100 mm — mm stored as m by scraper; divide by 1000",            _Xmax_huge),
    # ── Vas ──────────────────────────────────────────────────────────────────
    ("Vas_huge",           "Vas > 2000 L — implausible (would need a room-sized box)",    _Vas_huge),
    ("Vas_tiny_for_driver","Vas implausibly small for piston area — likely ft³-as-liters scraper bug", _Vas_tiny_for_driver),
    # ── Cross-field ──────────────────────────────────────────────────────────
    ("tweeter_fs","Sd < 5 cm² but Fs < 100 Hz — tiny piston with woofer-range Fs",       _tweeter_fs),
    # ── SPL ──────────────────────────────────────────────────────────────────
    ("SPL_high",  "SPL > 120 dB/1W/1m — physically implausible for a passive driver",    _SPL_high),
    ("SPL_low",   "SPL < 65 dB/1W/1m — implausibly inefficient",                         _SPL_low),
]


def check_fields(fields: dict) -> list[tuple[str, str, str]]:
    """
    Run all DQ rules against a parsed WDR fields dict.
    Returns list of (rule_id, description, detail) for every failing rule.
    Empty list means no issues found.
    """
    hits = []
    for rule_id, desc, fn in RULES:
        detail = fn(fields)
        if detail:
            hits.append((rule_id, desc, detail))
    return hits


# ── CLI ───────────────────────────────────────────────────────────────────────

def _check_url(url: str) -> str:
    try:
        req = urllib.request.Request(url, method="HEAD",
                                     headers={"User-Agent": "resonate-dq/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            ct = r.headers.get("Content-Type", "unknown").split(";")[0]
            cl = r.headers.get("Content-Length", "")
            kb = f" {int(cl)//1024}KB" if cl else ""
            return f"{r.status} {ct}{kb}"
    except urllib.error.HTTPError as e:
        return f"{e.code} {e.reason}"
    except Exception as e:
        return f"ERR {str(e)[:60]}"


def main():
    ap = argparse.ArgumentParser(description="WDR data quality check")
    ap.add_argument("--collection", help="Only check this collection subdirectory")
    ap.add_argument("--check-urls", action="store_true",
                    help="HTTP HEAD every URL in flagged files")
    args = ap.parse_args()

    issues = []  # (collection, fname, rule_id, desc, detail, fields)

    for coll_path in sorted(DRIVERS_DIR.iterdir()):
        if not coll_path.is_dir():
            continue
        if args.collection and coll_path.name != args.collection:
            continue
        for wdr_path in sorted(coll_path.glob("*.wdr")):
            fields = parse_fields(wdr_path.read_text(encoding="utf-8", errors="replace"))
            for rule_id, desc, detail in check_fields(fields):
                issues.append((coll_path.name, wdr_path.name, rule_id, desc, detail, fields))

    url_status = {}
    if args.check_urls:
        url_set = set()
        for *_, fields in issues:
            for k in URL_FIELDS:
                v = fields.get(k, "")
                if v.startswith("http"):
                    url_set.add(v)
        print(f"\nChecking {len(url_set)} URLs (HEAD, 8 s timeout)…\n")
        for url in sorted(url_set):
            sys.stdout.write(f"  {url}  →  ")
            sys.stdout.flush()
            status = _check_url(url)
            url_status[url] = status
            print(status)

    by_rule: dict[str, dict] = {}
    for coll, fname, rule_id, desc, detail, fields in issues:
        if rule_id not in by_rule:
            by_rule[rule_id] = {"desc": desc, "hits": []}
        by_rule[rule_id]["hits"].append((coll, fname, detail, fields))

    total = 0
    seen_files = set()
    for rule_id, data in sorted(by_rule.items()):
        hits = data["hits"]
        print(f"\n── {rule_id} ({len(hits)}) — {data['desc']}")
        for coll, fname, detail, fields in hits:
            print(f"   {coll}/{fname}  [{detail}]")
            for k in URL_FIELDS:
                url = fields.get(k, "")
                if not url:
                    continue
                status = f"  → {url_status[url]}" if url in url_status else ""
                print(f"     {k}: {url}{status}")
            corr = fields.get("boxbench_corrections", "")
            if corr:
                print(f"     boxbench_corrections: {corr[:120]}{'…' if len(corr) > 120 else ''}")
            seen_files.add(f"{coll}/{fname}")
        total += len(hits)

    print(f"\nTotal issues: {total} across {len(seen_files)} files")


if __name__ == "__main__":
    main()
