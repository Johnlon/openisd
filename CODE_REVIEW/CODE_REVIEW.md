# Resonate — Code Review Findings

Full-codebase review covering Python scrapers, JavaScript/Vue, and repository
structure/documentation. Every correctness finding was verified against the
source before listing. Each finding states the exact file, the failure scenario,
and a preventative practice.

Finding numbers (`§N`) are **stable IDs**: `HOW_NOT_TO_BE_SHITTY_VIBE_CODED.md`
references them, so a resolved finding is marked **✓ RESOLVED** in place (with the
verifying evidence) rather than deleted and renumbered. New findings take the next
free number. Verify the two docs agree after any edit.

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

### 4. `scripts/scraper_lib.py` — written files not schema-validated — ✓ RESOLVED

**✓ RESOLVED (verified):** `run_scraper` now calls `validate_driver(wdr_path, meta_path)`
in the shared write path (`scripts/scraper_lib.py:686`) before counting `ok += 1`
(`:940`). ⚠ Not yet asserted by a test — the preventative below asked for one, so a
regression could silently reopen this.

_Original:_ `run_scraper` wrote the `.wdr`/`_meta.yml` and counted `ok += 1` with no
validation call, unlike `scrape_pe.py`. An invalid field was committed reporting "OK".

**Preventative:** validation must live in the single shared write path, asserted
by a test.

### 5. `scripts/scraper_lib.py` vs `scripts/scrapers/scraper_lib.py` — two copies — ◐ PARTLY RESOLVED

**◐ PARTLY RESOLVED (verified):** `scripts/scrapers/scraper_lib.py` now re-exports the
infrastructure functions (`is_new_url`, `mark_scraped`, `run_scraper`, …) from `_plib`
(= `scripts/scraper_lib.py`) rather than defining its own divergent copies, so those no
longer drift; the duplicate `scrape_sbacoustics.py` has also been removed (one copy).
**Still open:** two modules named `scraper_lib.py` remain importable from two locations
(958 vs 1045 lines — the second adds extraction helpers), so the naming ambiguity and
split-brain risk are reduced but not eliminated.

**Preventative:** one canonical `scraper_lib.py`; the other becomes a thin
re-export or is deleted (or renamed, e.g. `extract_lib.py`, to end the name clash).

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

### 9. `FiltersPanel.vue` — `nextId` resets to 1 on reload, colliding with persisted filter ids — ✓ RESOLVED

**✓ RESOLVED (verified):** `addFilter` now assigns `id: crypto.randomUUID()`
(`packages/ui/src/components/FiltersPanel.vue:12`) — no module counter, no reset,
no collision. ⚠ Not guarded by a lint rule, so a future module-counter id could
reintroduce it.

_Original:_ `let nextId = 1` was module-local; filters persist with ids from prior
sessions, so after reload `addFilter` reassigned `id: 1` → duplicate `:key` → Vue
patched the wrong row.

**Preventative:** stable ids from `crypto.randomUUID()` (done); consider a lint
rule against module-counter ids for persisted entities.

### 10. `sweep.ts` — NaN propagation when a driver has no `Xmax` — ✓ RESOLVED

**✓ RESOLVED (verified):** `packages/engine/src/sweep.ts:103` now guards
`(excAt283 > 0 && drv.Xmax != null) ? 2.83 * (drv.Xmax / excAt283) : 1e9` — a
missing `Xmax` falls back to an effectively-infinite voltage limit, so only the
`Pe` limit applies and no `NaN` reaches the Max-SPL/Max-Power curves.

_Original:_ `vXmax = 2.83 * (drv.Xmax / excAt283)` with no `Xmax`-present guard made
`vXmax` NaN → blank graphs.

**Preventative:** skip the Xmax limit (use only the Pe limit) when `Xmax` is
absent. (done)

### 11. `packages/engine/src/driver.ts:29-30` — division by zero deriving Qes/Qms

`r.Qes = (Qts*Qms)/(Qms - Qts)` and the Qms line divide by `(Qms − Qts)` /
`(Qes − Qts)`. An external file with `Qms == Qts` yields `Infinity`, poisoning
`Bl`/circuit math.

> ⚠ This is `packages/engine/src` calculation code — needs explicit human sign-off before
> change (calculation-stability rule). The fix is an input-validation guard, not
> a formula change.

**Preventative:** small-denominator guard before the divide.

### 12. `DriverPanel.vue` — manufacturer link reads a property never set — ✓ RESOLVED

**✓ RESOLVED (verified):** the driver-load path now maps `manupage → manuPageUrl`
(`packages/ui/src/components/DriverBrowser.vue:494`), so a driver selected from the
library carries `manuPageUrl` and the "Manufacturer ↗" link (`DriverPanel.vue:78`)
renders. Note the mapping lives in the loader, not `parseWdr` — a driver built
purely via `parseWdr` still won't have it, but no live path does that.

_Original:_ `r.manuPageUrl` was never produced by any loader, so the link could
never render.

**Preventative:** map `manupage → manuPageUrl` at the load boundary (done).

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
   arithmetic in `packages/engine/src`/`sweep`. (10, 11)
9. **Stable entity ids** — derive from persisted data, never a module counter that
   resets. (9)
10. **CI guards for doc rules** — no-history grep + markdown link-checker. (13, 14)

---

## Engine / calculation core (`packages/engine/src/`) — robustness

The math in `packages/engine/src/` is correct on inspection, pure, side-effect-free, and
deterministic (verified: no `console`/`fetch`/`localStorage`/`Date`/`Math.random`,
no module-level mutable state, no argument mutation — `deriveDriver` and
`maxCurves` defensively copy their inputs). **These are not "vibe-coded".** The one
systemic weakness is the absence of an input-validation boundary: the pure
functions trust their callers completely and emit `NaN`/`Infinity` instead of a
clear error when handed incomplete or degenerate data.

See `CODE_REVIEW/ENGINE_HARDENING.md` for the proposed fix (a boundary guard) and
an explanation of why that is better than returning `NaN`.

### 16. `parseWdr` — driver with `Vas` but no `Qes`/`Qms` derives `Bl`/`Rms` as `NaN` — ✓ RESOLVED (at parseWdr only)

**✓ RESOLVED at the file-import path (verified):** `parseWdr` now requires **two** of
{Qts, Qes, Qms} before accepting a driver (`packages/engine/src/driver.ts:91-93`:
`_qCount >= 2`), matching `deriveDriver`'s contract — so a `.wdr` with only `Qts`+`Vas`
is rejected with `'missing core T/S parameters'` instead of yielding `NaN`.
**⚠ Does not cover the live UI path:** the app computes `deriveDriver(state.driverRaw)`
directly (not via `parseWdr`), so incomplete input from the What-If/Define editors
still reaches `deriveDriver` unguarded — see **§22**.

_Original:_ `parseWdr` accepted a `Vas`-only driver whose `Qes`/`Qms` stayed
`undefined`, so `Rms`/`Bl` derived as `NaN` → blank graphs, no error.

**Preventative:** one validated definition of "complete driver" enforced at **every**
engine entry, not just `parseWdr` (see §22).

### 17. `complex.ts:5-6` — `cDiv`/`cInv` divide by `re²+im²` with no zero guard

Root enabler of every `NaN` above: a zero denominator yields `Infinity`/`NaN`
silently. (Keep the hot path branch-free; prevent zero denominators at the
boundary instead — see ENGINE_HARDENING.md.)

### 18. `circuit.ts:85,126,128` — `Cab = Vb/(ρc²)` with `Vb` 0/undefined → `cInv(0)` poison

A box volume of 0 or an unset `Vb` makes `Zc = cInv(cx(0, 0))` → `Infinity`/`NaN`
through the entire solve.

### 19. `sweep.ts` — silent fabricated power rating `(drv.Pe || 50)` — ✓ RESOLVED

**✓ RESOLVED (verified):** `packages/engine/src/sweep.ts:98` now uses
`(drv.Pe != null && drv.Pe > 0) ? drv.Pe * (P.nDrivers || 1) : null` and returns
`peAbsent: Pe == null` (`:110`); when `Pe` is absent the `Pe` voltage limit is set to
`Infinity` (only the `Xmax` limit applies) and the UI shows a "Pe not in datasheet"
warning (`store.js:58-63`, `driverWarnings`). No fabricated 50 W is presented as fact.

_Original:_ a driver with no `Pe` got a fabricated 50 W baked into its
max-SPL/max-power curves.

**Preventative:** require `Pe`, or surface the absence in the UI (done).

### 20. `constants.ts:11-12` — values labelled "20 °C" correspond to ~24 °C

`C = 345.0` m/s and `RHO = 1.184` kg/m³ are commented "20 °C", but textbook 20 °C
dry-air values are ≈343.2 m/s and ≈1.204 kg/m³ (345/1.184 ≈ 24 °C). A fixed ~1%
systematic offset on all volume/SPL/tuning math, with no user temperature input.
⚠ Affects computed output — sign-off gated; verify exact textbook values first.

### 21. `driver.ts` — opaque 48-char `ParState` magic string — ◐ DOCUMENTED

**◐ DOCUMENTED (verified):** the string is still hard-coded
(`packages/engine/src/driver.ts:113`) but now carries a comment explaining it is a
WinISD per-field edit-state flag sequence and mapping the positions to the WDR field
order (`:111-112`). The maintainability wart is annotated, not removed — a data-driven
builder (as `scraper_lib.py`'s `_parstate` does) would eliminate the literal.

### Already listed above (engine-related)

- §10 `sweep.ts:103` — `NaN` max curves when `Xmax` absent. ✓ RESOLVED.
- §11 `driver.ts:29-30` — division by zero when `Qms == Qts`. Still present.

---

## New findings — 2026-07-01 review

### 22. `store.js:56` — validation asymmetry: the live UI bypasses the `parseWdr` guard → `NaN` still reaches the UI

§16 hardened **`parseWdr`** (the `.wdr` file-import path) to require ≥2 of {Qts, Qes,
Qms}. But the app's live driver is `deriveDriver(state.driverRaw)`, computed **directly**
in `packages/ui/src/store.ts:56` — it never goes through `parseWdr`. `deriveDriver`
(`packages/engine/src/driver.ts:25-37`) has no validation boundary: given a driver with
only `Qts`+`Vas` (or `Qms == Qts`, or no `Re`), it returns `Bl`/`Rms`/`Cms` as `NaN`,
which `syncedP.eg = √(Pin·driver.Re)` (`store.js:73`) then spreads across the whole sweep
→ blank graphs, no error. Reachable from the What-If and Define-new editors, and from a
malformed `driverRaw` restored out of `localStorage`. So the §16 fix gives false comfort:
the file path is guarded, the interactive path is not.

**Failure scenario:** in the What-If editor, clear `Qes` and `Qms` leaving only `Qts`;
every graph goes blank with no message.

**Preventative:** put the boundary guard in `deriveDriver` (or a wrapper the store and
`parseWdr` both call) so **every** engine entry rejects incomplete input with a named
error — the single-definition fix §16's preventative already called for. See
`CODE_REVIEW/ENGINE_HARDENING.md`.

**Status:** fix in progress (engine input-validation boundary). Re-verify and mark
resolved once landed.

### 23. Two `localStorage` persistence systems with different keys can disagree — ✓ RESOLVED

**✓ RESOLVED (verified):** app-state persistence now has a single source of truth —
`resonate.state`, written by `App.vue`'s watch (`saveLocal`, `utils/persist.js:25-26`)
and restored by `loadLocal()` on mount. `store.js` no longer writes its own
`resonate_v2` key or runs a competing `setItem` watch; `store.js:19-20` documents the
single-writer contract. (The separate `MY_DRIVERS_KEY` and PR-library keys are distinct
concerns, not duplicates of app state.)

_Original:_ `store.js` wrote `resonate_v2` while `persist.js` wrote `resonate.state`;
both were read at startup and could silently override each other.

**Preventative:** one persistence module, one key, one serialise/restore path (done).
