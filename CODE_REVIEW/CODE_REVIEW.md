# Resonate — Code Review Findings

Full-codebase review covering Python scrapers, JavaScript/Vue, and repository
structure/documentation. Every correctness finding was verified against the
source before listing. Each finding states the exact file, the failure scenario,
and a preventative practice.

This is a work artifact: delete each item once it is fixed (the fix and its
rationale belong in the commit message, not here).

---

## Correctness bugs — Python (scrapers)

### 1. `scripts/scrapers/scrape_pe.py:188` — pagination silently truncates catalogs

`if len(items) >= (data.get("total") or 0) or not page: break` — when the API
response omits `total`, `(... or 0)` makes the test `len(items) >= 0`, always
true → the loop stops after the first 50-item page. A 120-driver brand whose
response lacks `total` yields only 50 drivers.

**Preventative:** never coerce a missing count to `0` as a loop bound; treat
absent `total` as "unknown" and rely on `not page` to terminate.

### 2. `scripts/scrapers/scrape_pe.py:309` — frequency regex mis-scales kHz ranges

Low-end unit is optional `(kHz|Hz)?`, high-end is required. Input `"1.5 – 20 kHz"`
→ `freq_low_hz = 1.5` (unscaled) while `freq_high_hz = 20000`.

**Preventative:** when only the trailing unit is present, apply it to both
endpoints. `pdf_lib.find_freq_range` already does this — share that logic.

### 3. `scripts/scrapers/scrape_wavecor.py:251` — label gate reads the wrong cell

`if "recommended" not in label and "frequency range" not in label: continue` — a
"Recommended amplifier power [W]" row passes the gate, then `cells[2]` reads e.g.
`100` → writes `freq_high_hz: 100` from a wattage.

**Preventative:** anchor labels to exact phrases ("frequency range"/"upper
frequency limit"); don't substring-match "recommended".

### 4. `scripts/scraper_lib.py:574-608` — written files not schema-validated

`run_scraper` writes the `.wdr`/`_meta.yml` and counts `ok += 1` with no
validation call, unlike `scrape_pe.py` which calls `validate_driver`. CLAUDE.md
claims `_scrape_one` validates every file — this path doesn't. An invalid field
is committed reporting "OK".

**Preventative:** validation must live in the single shared write path, asserted
by a test.

### 5. `scripts/scraper_lib.py` vs `scripts/scrapers/scraper_lib.py` — two divergent copies (632 vs 834 lines)

Top-level scrapers import the 632-line lib (no `ProblemLog`/`validate_driver`);
`scrapers/` scrapers import the 834-line one. A fix to one leaves the other
broken; there are even two `scrape_sbacoustics.py` copies.

**Preventative:** one canonical `scraper_lib.py`; the other becomes a thin
re-export or is deleted. No module importable from two locations.

### 6. `scripts/scrapers/scrape_pe.py:337-353` — PDF errors swallowed with bare `except: pass`

Fetch/extract exceptions are discarded with no `_problems.log` entry, violating
CLAUDE.md's "log full traceback, item identity, and source URL." A brand whose
PDFs all 404 reports clean.

**Preventative:** catch → record to problem log with SKU+URL → continue. Never
bare `pass`. (Runs in a `ProcessPoolExecutor` worker, so return the error to the
parent to log.)

### 7. `scripts/scrapers/scrape_pe.py:419-421` (+ `scraper_lib.py:486`) — error URLs never retried

`mark_scraped(url, status="error: …")` adds the URL to `manifest["scraped"]`, and
`is_new_url` skips anything in that set → a transient timeout permanently excludes
a driver until someone runs `--refresh` (which re-scrapes everything).

**Preventative:** only skip URLs with `status == "ok"`; always re-attempt
error/skip statuses.

### 8. `scripts/scrapers/pdf_lib.py:356-360` — OCR cache keyed by filename only, never invalidated

A re-downloaded PDF with the same name keeps serving stale extracted text, so
corrected vendor T/S values are never picked up.

**Preventative:** include content hash or mtime/size in the cache key; invalidate
`.txt` when the PDF is re-fetched.

---

## Correctness bugs — JavaScript / Vue

### 9. `src/components/FiltersPanel.vue:4,14` — `nextId` resets to 1 on reload, colliding with persisted filter ids

`let nextId = 1` is module-local; filters persist to localStorage/URL with ids
from prior sessions. After reload, `addFilter` assigns `id: 1` again → duplicate
`:key` → Vue patches the wrong row / `v-model` binds to the wrong filter.

**Preventative:** seed `nextId` from `max(existing ids)+1` on mount, or use
`crypto.randomUUID()`.

### 10. `src/core/sweep.js:103` — NaN propagation when a driver has no `Xmax`

`vXmax = 2.83 * (drv.Xmax / excAt283)`; `parseWdr` drops undefined fields, so a
`.wdr` without `Xmax` makes `vXmax` NaN → Max-SPL/Max-Power graphs go blank. The
`excAt283 > 0` guard doesn't cover a missing `Xmax`.

**Preventative:** skip the Xmax limit (use only the Pe limit) when `Xmax` is
absent.

### 11. `src/core/driver.js:29-30` — division by zero deriving Qes/Qms

`r.Qes = (Qts*Qms)/(Qms - Qts)` and the Qms line divide by `(Qms − Qts)` /
`(Qes − Qts)`. An external file with `Qms == Qts` yields `Infinity`, poisoning
`Bl`/circuit math.

> ⚠ This is `src/core` calculation code — needs explicit human sign-off before
> change (calculation-stability rule). The fix is an input-validation guard, not
> a formula change.

**Preventative:** small-denominator guard before the divide.

### 12. `src/components/DriverPanel.vue:19-22` — manufacturer link reads a property never set

`r.manuPageUrl` is never produced by `parseWdr` (which sets
`vendorpageUrl`/`sourceUrl`/etc.); the bundle field is `manupage` and is dropped
on load. The "Manufacturer ↗" link can never render.

**Preventative:** map `manupage → manuPageUrl` in `parseWdr`, or remove the dead
branch.

---

## Structure & documentation

### 13. History-in-docs violations (the project's own hard rule)

`BACKLOG.md:43-50` ("preserved for history", struck-through text),
`BACKLOG.md:23-37` (`## Shipped ✓` closed `[x]` list), `WDR_SCHEMA.md:439`
("previously in this section"), `ARCHITECTURE.md:48` ("pre-Vite era no longer
applies"), `FEATURES.md` dated "as of mid-2025" snapshots.

**Preventative:** CI grep over `*.md` for
`preserved for history|~~|previously|as of <date>|^\s*- \[x\]` — fail the build.

### 14. Broken cross-references to `drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md`

Referenced from `CLAUDE.md:145`, `PLAN_SCRAPING.md:4`, `drivers/README.md:6`,
`drivers/SCRAPING_RULES.md:240`, but the file is at repo root. All four links 404.

**Preventative:** move the file to `drivers/` (matches all four refs) and add a
markdown link-checker to CI.

### 15. Competing "canonical" / roadmap sources

`FEATURES.md:190` names `drivers/README.md` canonical while `WDR_SCHEMA.md:3` and
`wdr_meta_schema.py` are the real sources of truth; `FEATURES.md`, `COMPARISON.md`,
and `BACKLOG.md` all act as the roadmap; `FEATURES.md` still documents the
obsolete `_meta.json` sidecar. 16 root `.md` files sit beside an empty `docs/`
dir.

**Preventative:** one roadmap (`BACKLOG.md`), one canonical schema doc
(`WDR_SCHEMA.md`); other docs link rather than restate. Consolidate root docs into
`docs/` or remove the empty dir.

---

## Preventative measures — practices to adopt

Generalised rules worth adding to `CLAUDE.md`/CI:

1. **One source of truth per concern** — collapse duplicate `scraper_lib.py` and
   duplicate roadmap/canonical docs. (5, 15)
2. **Validation lives in the shared write path** — never per-scraper; assert with
   a test. (4)
3. **Never coerce a missing value into a control-flow bound** — absent ≠ 0/empty.
   (1)
4. **No bare `except: pass` in scrapers** — log SKU+URL+traceback then continue.
   (6)
5. **Retry policy by status** — only skip `status == "ok"`. (7)
6. **Cache keys must include content identity** (hash/mtime), never just a
   filename. (8)
7. **Share extraction helpers** instead of re-implementing regexes per scraper.
   (2, 3)
8. **Guard against missing optional fields and zero denominators** before
   arithmetic in `src/core`/`sweep`. (10, 11)
9. **Stable entity ids** — derive from persisted data, never a module counter that
   resets. (9)
10. **CI guards for doc rules** — no-history grep + markdown link-checker. (13, 14)

---

## Engine / calculation core (`src/core/`) — robustness

The math in `src/core/` is correct on inspection, pure, side-effect-free, and
deterministic (verified: no `console`/`fetch`/`localStorage`/`Date`/`Math.random`,
no module-level mutable state, no argument mutation — `deriveDriver` and
`maxCurves` defensively copy their inputs). **These are not "vibe-coded".** The one
systemic weakness is the absence of an input-validation boundary: the pure
functions trust their callers completely and emit `NaN`/`Infinity` instead of a
clear error when handed incomplete or degenerate data.

See `CODE_REVIEW/ENGINE_HARDENING.md` for the proposed fix (a boundary guard) and
an explanation of why that is better than returning `NaN`.

### 16. `driver.js:91` vs `:28-30` — driver with `Vas` but no `Qes`/`Qms` derives `Bl`/`Rms` as `NaN`

`parseWdr` accepts a driver if it has `Vas` even without `Qes`/`Qms`
(`if (!(d.Fs && d.Sd && d.Re && (d.Vas || (d.Qts && d.Qes))))`). But
`deriveDriver` can only fill a missing Q when it has **two** of {Qts, Qes, Qms}
(lines 28-30). With only `Qts`+`Vas`, `Qes`/`Qms` stay `undefined`, so
`Rms = ws·Mms/undefined` → `NaN` (line 34) and `Bl = √(…/undefined)` → `NaN`
(line 35). The whole circuit then produces `NaN` → blank graphs, with no error.
The parser's contract and the derivation's contract disagree.

**Preventative:** one validated definition of "complete driver". Either `parseWdr`
rejects incomplete-Q drivers, or `deriveDriver` handles the `Vas`+`Qts` case — and
a boundary guard throws a named error rather than letting `NaN` propagate.

### 17. `complex.js:5-6` — `cDiv`/`cInv` divide by `re²+im²` with no zero guard

Root enabler of every `NaN` above: a zero denominator yields `Infinity`/`NaN`
silently. (Keep the hot path branch-free; prevent zero denominators at the
boundary instead — see ENGINE_HARDENING.md.)

### 18. `circuit.js:85,126,128` — `Cab = Vb/(ρc²)` with `Vb` 0/undefined → `cInv(0)` poison

A box volume of 0 or an unset `Vb` makes `Zc = cInv(cx(0, 0))` → `Infinity`/`NaN`
through the entire solve.

### 19. `sweep.js:98` — silent fabricated power rating `(drv.Pe || 50)`

A driver with no `Pe` gets a fabricated **50 W** baked into its max-SPL/max-power
curves and presented to the user as fact. ⚠ Affects computed output — sign-off
gated.

**Preventative:** require `Pe`, or surface "assumed 50 W (no datasheet rating)" in
the UI so the number is not presented as truth.

### 20. `constants.js:11-12` — values labelled "20 °C" correspond to ~24 °C

`C = 345.0` m/s and `RHO = 1.184` kg/m³ are commented "20 °C", but textbook 20 °C
dry-air values are ≈343.2 m/s and ≈1.204 kg/m³ (345/1.184 ≈ 24 °C). A fixed ~1%
systematic offset on all volume/SPL/tuning math, with no user temperature input.
⚠ Affects computed output — sign-off gated; verify exact textbook values first.

### 21. `driver.js:110` — opaque 48-char `ParState` magic string

A WinISD field-state string with no explanation. Maintainability wart inside core.

### Already listed above (engine-related)

- §10 `sweep.js:103` — `NaN` max curves when `Xmax` absent.
- §11 `driver.js:29-30` — division by zero when `Qms == Qts`.
