# Math migration — retiring `winisd_tools` calc code into `@openisd/engine`

Companion to [PLAN_JS_CALC_CONSOLIDATION.md](http://localhost:8000/winisd/openisd/PLAN_JS_CALC_CONSOLIDATION.md#L1)
(the internal TS collapse this plan depends on, and the CNE/provenance findings) ·
[TODO.md QT39](http://localhost:8000/winisd/winisd_tools/TODO.md#L2405-L2447) (the ruling this
executes, verbatim: _"100% retire calc code in python and reimpl it js. python will call js for
all calcs. one source of truth… units MUST be SI throughout up until point of use."_) ·
[BACKLOG.md:25-44](http://localhost:8000/winisd/openisd/BACKLOG.md#L25-L44) (the Node-CLI
transport this plan specifies in detail).

**This is the executable plan.** Every phase below states its start condition, its exact file
changes, and its exit test. Proof lines are included wherever a claim can be independently
re-run, per the standing rule: no ✅/❌ without a quoted, repeatable test.

---

## 1. Scope — confirmed by direct inventory of every file in `scrapers/lib`

**Revised this session** — the original grep pass (`grep -rlE
"math\.(sqrt|pi|log10|pow)|sqrt\(|uncertainties|ufloat" scrapers/lib`) only catches PHYSICS
formula signatures, so it missed two files that do core precision arithmetic with no `sqrt`/`pi`
in sight: a tolerance-budget comparison (`readings_agree`, plain `+`/`<`) and a decimal-places
count (`_printed_half_width`, no transcendental functions at all). Corrected rule, stated once so
it doesn't need re-deriving per file: **the test is not "does it look like a physics formula", it
is "does this function operate on an already-known number/precision with no domain knowledge of
what that number represents."** A function that would behave identically whether the number in
front of it was `Fs` or a shoe size belongs in the shared math library; a function that needs to
know it's reading a loudspeaker datasheet stays in Python. Applied below.

**Four files carry code in scope**, not two:

| File                                                                                                           | What it does                                                                                                                                                                                                                                                                                                                                                                 | Category                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`model_wdr.py`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L1)              | Derives `Vd`/`Dd`/`EBP` for `.wdr` export; DQ-tolerance-checks 9 more formulas against scraped values (`_WDR_CALCULATABLE`); builds `ParState`                                                                                                                                                                                                                               | physics derivation — moves (§4)                                                          |
| [`precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/precision.py#L1)              | Propagates each source reading's rounding half-width through the 3 derived formulas                                                                                                                                                                                                                                                                                          | precision propagation — moves, file deleted outright (§7)                                |
| [`units.py`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/units.py#L1)                      | `exact()` (:156-166) and `_printed_half_width()` (:285-296) are core precision math with zero datasheet knowledge — **moves**. Everything else in the file (regex token extraction from raw printed text, tolerance-marker stripping, thousands-separator handling, compound dual-voice-coil parsing) genuinely needs to know it's reading a datasheet — **stays**, per §1.1 | split — see §1.1                                                                         |
| [`model_driver.py`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_driver.py#L725-L742) | `readings_agree()` — a pure interval-overlap-with-tolerance comparison of two `(value, half-width)` pairs, no T/S knowledge at all                                                                                                                                                                                                                                           | moves — **this was wrongly scoped "out" in the first pass of this plan; corrected here** |

**Explicitly out of scope, with reason (do not migrate these):**

- **`sweep.py`, `curves.py`** — false positives from the initial name-based scan. `sweep.py` is
  scraper rolling-upgrade bookkeeping (logic-version stamping); `curves.py` is `.frd`/`.zma` zip
  file mechanics. Neither does arithmetic on T/S parameters. Verified by reading both files in
  full this session.
- **Box/enclosure simulation** (sealed/vented/bandpass alignments, sweep response, circuit
  solving) — Python never had this code; it has only ever existed in `@openisd/engine`
  (`alignments.ts`, `sweep.ts`, `circuit.ts`). Nothing to retire.
- **`units.py`'s number-locating regex machinery** (`_PRINTED_NUMBER_RE`, `_TOLERANCE_MARKER_RE`,
  `_ungrouped`, the compound dual-voice-coil `2 x 4 ohm` parser) — this is datasheet-text
  extraction, not math; it has no TypeScript counterpart to converge with because TS never
  touches raw scraped strings. `parse_reading()` (`units.py:299`) stays as the orchestrator: it
  extracts a clean token from messy text (stays Python), then calls the shared library for the
  exact-value and half-width computation on that clean token (moves — see §1.1).
- **`_mm()`, `_build_parstate()`, `_WDR_FIELD_SPEC` range validation** in `model_wdr.py` — see
  §1.2, explained more precisely than the first draft of this plan did.

### 1.1 The exact boundary inside `units.py` — worked example

```
"0.49 mH @ 1 kHz"                              — raw printed text
        │  _TOLERANCE_MARKER_RE, _PRINTED_NUMBER_RE, _ungrouped   ← STAYS (datasheet-specific)
        ▼
"0.49"                                          — a clean numeric token, no domain meaning left
        │  exact(token) → Decimal("0.49")                        ← MOVES (§2)
        │  _printed_half_width(token) → Decimal("0.005")         ← MOVES (§2)
        ▼
(read_value=0.00049 H, read_precision=0.000005 H)                — after unit scale, still SI-generic
```

Once the token is clean, nothing left in the computation cares that it came from a datasheet.
`exact("0.49")` and `_printed_half_width("0.49")` would produce byte-identical answers if the
caller were a totally unrelated project parsing prices or measurements — that portability is
the definition of "core math concept" the human used to draw this line, and it's the same
property `readings_agree()` has (§2).

### 1.2 `_mm()` / `_build_parstate()` / range validation — two different reasons to stay, explained properly

The first draft of this plan collapsed these three into one line ("point-of-use projection, not
calc") — too compressed to be checkable. They actually stay for two _different_ reasons:

1. **`_WDR_FIELD_SPEC` lo/hi range validation** ([`model_wdr.py:55-127`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L55-L127)) —
   permanently out of scope, full stop. It isn't a formula: it doesn't compute a value from other
   values, it bounds-checks one already-known value (`0.1 ≤ Re ≤ 64.0`). There is no "duplicate
   implementation" risk the way `Vd`/`Dd`/`EBP` had, because there is no second implementation to
   converge with — **this is unverified, not assumed**: whether OpenISD's own driver-entry form
   validates the _same_ numeric bounds for the _same reason_ (DQ-plausibility of scraped data vs.
   UI-plausibility of typed input are different purposes that could still collide on the same
   numbers) has not been checked this session and should be, before assuming zero overlap.

2. **`_mm()` (unit projection into `.wdr`'s mm-in-metres convention) and `_build_parstate()`
   (E/C/N marking on write)** — stay _within this plan's scope_, but not for a standalone reason:
   they're carved out by TODO.md QT39's own SI-boundary rule (calc retires, point-of-use
   projection into WinISD's fixed file format doesn't) — same logic that keeps `wdr.ts`'s own
   unit conversions on the TypeScript side. **But this is not the end of their story.**
   [BACKLOG.md:25-40](http://localhost:8000/winisd/openisd/BACKLOG.md#L25-L40) separately rules
   that Python should stop writing `.wdr` itself at all and call a shared JS `ymlToWdr()` lib
   instead — and that JS side already has its own `_mm()`-equivalent unit conversion and its own
   `#buildParState()` ([`winisd/driver.ts:337`](http://localhost:8000/winisd/openisd/packages/winisd/src/driver.ts#L337),
   found in PLAN_JS_CALC_CONSOLIDATION.md §5). If that separate, not-yet-planned migration lands,
   `_mm()`/`_build_parstate()` retire too — just not as part of _this_ plan, which scopes itself
   to calc only, per QT39's own text. Flagging the connection so nobody mistakes "stays in this
   plan" for "stays permanently."

---

## 2. Complete function inventory — every symbol that moves

| Python symbol                                                      | Location                                                                                                               | Kind                                                           | TS destination                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vd = Sd*Xmax` inline                                              | [`model_wdr.py:370`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L370)                | derivation                                                     | `deriveDriver` (already exists, needs SI fix — see PLAN_JS_CALC_CONSOLIDATION §2 row 20)                                                                                                                                                                                                         |
| `dd = √(4·Sd/π)` inline                                            | [`:374`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L374)                            | derivation                                                     | `deriveDriver` (exists, `:42`)                                                                                                                                                                                                                                                                   |
| `ebp = Fs/Qes` inline                                              | [`:375`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L375)                            | derivation                                                     | `engine/alignments.ts:40` (exists, unused — wire it in)                                                                                                                                                                                                                                          |
| `_WDR_CALCULATABLE["Qts"]`                                         | [`:454-455`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L454-L455)                   | DQ-tolerance check                                             | new: `engine/src/dqFormulas.ts` (§4)                                                                                                                                                                                                                                                             |
| `_WDR_CALCULATABLE["Vd"]`                                          | [`:456-457`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L456-L457)                   | DQ-tolerance check                                             | `dqFormulas.ts`                                                                                                                                                                                                                                                                                  |
| `_WDR_CALCULATABLE["Dd"]`                                          | [`:458-459`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L458-L459)                   | DQ-tolerance check                                             | `dqFormulas.ts`                                                                                                                                                                                                                                                                                  |
| `_WDR_CALCULATABLE["EBP"]`                                         | [`:460-461`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L460-L461)                   | DQ-tolerance check                                             | `dqFormulas.ts`                                                                                                                                                                                                                                                                                  |
| `_WDR_CALCULATABLE["Rme"]`                                         | [`:462-463`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L462-L463)                   | DQ-tolerance check                                             | `dqFormulas.ts` — group 3 in the blessed table                                                                                                                                                                                                                                                   |
| `_WDR_CALCULATABLE["Mpow"]`                                        | [`:464-465`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L464-L465)                   | DQ-tolerance check                                             | `dqFormulas.ts` — group 8/9                                                                                                                                                                                                                                                                      |
| `_WDR_CALCULATABLE["gamma"]`                                       | [`:466-467`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L466-L467)                   | DQ-tolerance check                                             | `dqFormulas.ts` — group 13                                                                                                                                                                                                                                                                       |
| `_WDR_CALCULATABLE["Vas"]`                                         | [`:468-469`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L468-L469)                   | DQ-tolerance check                                             | `dqFormulas.ts` — group 10                                                                                                                                                                                                                                                                       |
| `_WDR_CALCULATABLE["no"]`                                          | [`:470-472`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L470-L472)                   | DQ-tolerance check                                             | `dqFormulas.ts` — group 14; **also resolves PLAN_JS_CALC_CONSOLIDATION §2 row 14/18's 3-constants defect**, since there will be exactly one implementation left to fix                                                                                                                           |
| `derived_precisions()`                                             | [`:492-528`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_wdr.py#L492-L528)                   | precision propagation                                          | new standalone package `uncertainties`, `src/propagate.ts` (§5) — NOT inside `engine`                                                                                                                                                                                                            |
| `quantity()`, `half_width()`, `value_of()`, `significant_digits()` | [`precision.py:69-143`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/precision.py#L69-L143)         | precision primitives                                           | `uncertainties` package, `src/propagate.ts`                                                                                                                                                                                                                                                      |
| `exact()` (Decimal multiply/divide)                                | [`units.py:156-166`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/units.py#L156-L166)               | exact-decimal arithmetic                                       | `uncertainties` package, `src/exact.ts`, built on `decimal.js` (§5.2). Called far more often than the derivation formulas above — every scraped field of every record, not once per `.wdr` write (§6: call volume is a known, explicitly out-of-scope tradeoff of the "dumb scraper" principle). |
| `_printed_half_width()` (decimal-places → half-width)              | [`units.py:285-296`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/units.py#L285-L296)               | core precision math, zero datasheet knowledge (§1.1)           | `uncertainties` package, new `src/halfWidthOfLiteral.ts`                                                                                                                                                                                                                                         |
| `readings_agree()` (interval-overlap-with-tolerance)               | [`model_driver.py:725-742`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/model_driver.py#L725-L742) | core precision math, zero T/S knowledge — corrected scope (§1) | `uncertainties` package, new `src/agree.ts`: `agree(a: Reading, b: Reading, relTol = 0.01): boolean`                                                                                                                                                                                             |

**9 DQ-tolerance formulas is new scope beyond BUG_20260731's original 3.** "100% migration"
means these move too — they are exactly as much duplication-in-waiting as the 3 that prompted
this: Python range/tolerance-checks Qts/Rme/Mpow/gamma/Vas/no against scraped values today,
using its own formula text; if TS ever adds equivalent DQ display (plausible, since it already
computes several of these for the UI), the same drift risk BUG_20260731 found reappears. Moving
the formula itself to TS and having Python call it removes that possibility structurally, not
just for the 3 already caught.

---

## 3. Phase 0 — prerequisite (not new work, blocks everything below)

**PLAN_JS_CALC_CONSOLIDATION.md §4.1 must land first**: `winisd/driver.ts#derive()` must
consume `engine`'s `deriveDriver().value` rather than reimplementing it, and the 3-constants SPL
defect (§7.1 of that doc) must be resolved. Reason this gates the math migration: whatever bridge
eventually implements `MathBridge` (§6) sits in front of `@openisd/engine`. Wiring any bridge up
to a package with three internally-disagreeing implementations means Python's answer depends on
which one got wired up last — the Python side would inherit whichever bug happens to be live,
invisibly. Wrapping a consolidated single implementation is the only way "one source of truth"
(QT39's own phrase) is actually true once this plan finishes, independent of which bridge is
chosen.

**Exit test:** `PLAN_JS_CALC_CONSOLIDATION.md`'s own parity guard (§4.1, the same-language
`deriveDriver`-vs-`Driver#derive()` test) is green, and its §7.1 open question (which SPL
constant is correct) is resolved and cited with proof, not guessed.

---

## 4. Phase 1 — port the 9 DQ-tolerance formulas + finish the 3 derivations

**File:** new `packages/engine/src/dqFormulas.ts`.

Design: one pure function per WDR_SCHEMA consistency group, taking and returning plain numbers
(SI units only, per QT39), with the group number as a doc-comment citation back to
[WDR_SCHEMA.md §4](http://localhost:8000/winisd/openisd/WDR_SCHEMA.md#L248-L271) so the
blessed-formula provenance travels with the code, not just this plan:

```ts
// packages/engine/src/dqFormulas.ts
/** WDR_SCHEMA.md group 3: Rme = BL²/Re. SI in, SI out. */
export function rme(BL: number, Re: number): number {
  return BL ** 2 / Re;
}

/** WDR_SCHEMA.md group 8: Mpow = BL/√Re. */
export function mpow(BL: number, Re: number): number {
  return BL / Math.sqrt(Re);
}

/** WDR_SCHEMA.md group 13: gamma = BL/Mms. */
export function gamma(BL: number, Mms: number): number {
  return BL / Mms;
}

/** WDR_SCHEMA.md group 10: Vas = ρ₀·c²·Sd²·Cms. */
export function vasFromCms(
  roo: number,
  c: number,
  Sd: number,
  Cms: number,
): number {
  return roo * c ** 2 * Sd ** 2 * Cms;
}

/** WDR_SCHEMA.md group 14: η₀ = (4π²/c³)·Fs³·Vas/Qes. THE formula — resolves the
 *  3-implementations-3-answers defect logged in PLAN_JS_CALC_CONSOLIDATION.md §2 row 14/18. */
export function noEfficiency(
  Fs: number,
  Vas: number,
  Qes: number,
  c: number,
): number {
  return (((4 * Math.PI ** 2) / c ** 3) * Fs ** 3 * Vas) / Qes;
}
```

Each function is a **direct, auditable transcription** of the Python source cited in §2 —
`git diff`-reviewable against the Python one-liner it replaces, not a reinterpretation. `Qts`,
`Vd`, `Dd`, `EBP` reuse `deriveDriver`/`alignments.ts` (already exist post-Phase-0; do not
duplicate a fourth time).

**Exit test:** a golden-value unit test per function, seeded from real driver records already in
the DQ-check corpus — reuse the exact numbers `test_wdr_projection.py` and
`test_semantic_dq_precision.py` already assert against, so the TS test is provably checking the
same cases Python currently does, not a freshly invented set.

---

## 5. Phase 2 — precision propagation, functionally equivalent

### 5.1 A standalone, reusable library — not smudged into `engine`

**Correction from the previous draft**, made in response to direct feedback: the first version
of this plan put the propagation code in `packages/engine/src/precision.ts` — one centralized
file, but still just an internal module of the physics package, not an actual reusable library
the way Python's `uncertainties` is. That's wrong for the same reason `model_wdr.py` doesn't
reimplement `uncertainties` inline: precision propagation is domain-agnostic — it knows nothing
about Sd, Xmax, or loudspeakers — so bolting it to `@openisd/engine` would coupled two things
that don't belong together.

**Fix:** a new, independent workspace package, **`packages/uncertainties`**, published under the
npm name **`uncertainties`** — checked available this session
(`curl -s https://registry.npmjs.org/uncertainties` → 404) — chosen to deliberately mirror the
Python package it replaces, so the pairing is legible on sight to anyone who knows the Python
side. It contains zero WinISD or Thiele-Small vocabulary. `@openisd/engine`'s formula code
(§4, §5.3) is a **consumer** of this package, not its container. Per the human's note this
session — _"maybe we will opensource it separately"_ — the package is designed so that move is
mechanical later: it's already dependency-clean of the rest of the monorepo, so extracting it to
its own repo and `npm publish`-ing it under its real name is a directory move plus flipping one
`package.json` line elsewhere from a workspace `"*"` reference to a real semver range, not a
rewrite.

### 5.2 Built on respected, actively-maintained libraries

**Correction from the previous draft's framing:** there was no actual human ruling for "zero
dependencies" — that line in
[`engine/package.json:6`](http://localhost:8000/winisd/openisd/packages/engine/package.json#L6)
is descriptive boilerplate this plan mistakenly treated as a constraint, not a decision anyone
made. Dropped. Respected third-party libraries are the preference, restated by the human this
session, so redo the library search with that mandate instead of trying to avoid dependencies:

| Package      | Latest | Published  | Monthly downloads | License    | Role                                                                                                   |
| ------------ | ------ | ---------- | ----------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `decimal.js` | 10.6.0 | 2025-07-06 | 307,266,351       | MIT        | exact-decimal arithmetic (`exact()`, §2)                                                               |
| `mathjs`     | 15.2.0 | 2026-04-07 | 12,991,112        | Apache-2.0 | symbolic `derivative()` — the ∂f/∂xᵢ term §5.1's old draft hand-rolled as a bespoke dual-number engine |

Both actively maintained, both mainstream (300M and 13M monthly downloads respectively),
reproducible via `curl -s https://registry.npmjs.org/<pkg>` + `curl -s
https://api.npmjs.org/downloads/point/last-month/<pkg>`. **Rejected, now for a stronger reason
than before:** `autodiff` (2017, 116 dl/mo), `autodiff-ts` (43 dl/mo), `na-error-propagation`
(2015, 25 dl/mo) — not just unmaintained, but superseded outright: `mathjs`'s `derivative()`
does the same job as a first-class, independently-tested feature of a library millions of
projects already depend on, so there is no remaining reason to hand-write derivative bookkeeping
at all.

**The one piece that genuinely stays custom, and must stay documented as a deliberate choice, not
a default:** the _combination_ rule. Every mainstream uncertainty library, including Python's own
`uncertainties`, combines contributions by quadrature (RSS — root-sum-square) by default.
`precision.py` explicitly overrides that —
[`half_width()`'s docstring, lines 88-104](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/precision.py#L88-L104) —
with a **guaranteed-enclosure sum of absolute contributions** instead:

```
halfWidth(f) = Σᵢ |∂f/∂xᵢ| · dᵢ        (dᵢ = source i's rounding half-width, NOT RSS)
```

re-derived from real data, not asserted: _"across all 4,122 comparable reading pairs in the
database, quadrature flips exactly one verdict"_
([`precision.py:36-38`](http://localhost:8000/winisd/winisd_tools/scrapers/scrapers/lib/precision.py#L36-L38)).
`mathjs` supplies `∂f/∂xᵢ`; this package's own ~10-line `combine()` supplies the summation rule —
the only logic in the whole package that isn't just "call a trusted library and use its answer."

### 5.3 Package layout and API

```
packages/uncertainties/
  package.json               — name: "uncertainties", deps: decimal.js, mathjs
  src/
    exact.ts                  — exact(a, b, op): decimal.js-backed exact multiply/divide, ports units.py exact()
    halfWidthOfLiteral.ts      — ports units.py _printed_half_width(): decimal-places -> half-width
    agree.ts                   — agree(a, b, relTol): ports model_driver.py readings_agree()
    propagate.ts               — propagate(expr, readings): the public API
    index.ts
  test/
    propagate.test.ts          — golden cases, see §5.4
    exact.test.ts, halfWidthOfLiteral.test.ts, agree.test.ts
```

```ts
// packages/uncertainties/src/propagate.ts
import { derivative, evaluate } from "mathjs";

/** One reading: a value plus the rounding HALF-WIDTH its printed form asserts — precision.py's
 *  (value, read_precision) pair, renamed for a library with no scraping vocabulary. */
export interface Reading {
  value: number;
  halfWidth: number;
}

/** Propagate `readings` through `expr` (a mathjs expression string — e.g. `"Sd*Xmax"` or
 *  `"2*sqrt(Sd/pi)"`) and return the derived value plus its GUARANTEED-ENCLOSURE half-width:
 *  Σᵢ|∂expr/∂xᵢ|·halfWidth(xᵢ). Deliberately NOT root-sum-square — see README "Why not RSS".
 *  `expr` IS the formula; there is no separate per-formula calculus to hand-write, unlike a
 *  hand-rolled dual-number engine — every future formula (any of the 22 WDR_SCHEMA groups,
 *  see PLAN_JS_CALC_CONSOLIDATION.md §2) gets propagation for free from its own expression
 *  string. */
export function propagate(
  expr: string,
  readings: Record<string, Reading>,
): Reading {
  const scope = Object.fromEntries(
    Object.entries(readings).map(([k, r]) => [k, r.value]),
  );
  const value = evaluate(expr, scope);
  let halfWidth = 0;
  for (const [name, reading] of Object.entries(readings)) {
    if (reading.halfWidth <= 0) continue; // exact input contributes nothing
    const partial = derivative(expr, name).evaluate(scope);
    halfWidth += Math.abs(partial) * reading.halfWidth;
  }
  return { value, halfWidth };
}
```

```ts
// packages/uncertainties/src/exact.ts — ports units.py's exact() (:156-166) onto decimal.js
import Decimal from "decimal.js";

/** Exact decimal multiply/divide — the value as it READS, not the binary fraction a float
 *  approximates it with. `Decimal(value.toString())` mirrors Python's `Decimal(repr(value))`:
 *  routing through the shortest-round-trip string, never the raw float constructor. */
export function exact(a: number, b: number, op: "*" | "/"): number {
  const da = new Decimal(a.toString()),
    db = new Decimal(b.toString());
  return Number(op === "*" ? da.times(db) : da.div(db));
}
```

```ts
// packages/uncertainties/src/halfWidthOfLiteral.ts — ports units.py _printed_half_width() (:285-296)
import Decimal from "decimal.js";

/** Half the last decimal place an ALREADY-CLEAN numeric literal states — the rounding the
 *  literal itself admits to. `"0.4"` -> 0.05, `"0.40"` -> 0.005 (a trailing zero is a precision
 *  claim), `"12"` -> 0.5, `"1.5e3"` -> 50. Takes a clean token (no units, no surrounding text —
 *  extracting that token from raw datasheet prose stays in Python, §1.1); has no idea what the
 *  number measures. */
export function halfWidthOfLiteral(token: string): number {
  const lower = token.toLowerCase();
  const [mantissa, expPart] = lower.split("e");
  const exponent = expPart ? parseInt(expPart, 10) : 0;
  const decimals = mantissa.includes(".") ? mantissa.split(".")[1].length : 0;
  return Number(
    new Decimal("0.5").times(new Decimal(10).pow(exponent - decimals)),
  );
}
```

```ts
// packages/uncertainties/src/agree.ts — ports model_driver.py readings_agree() (:725-742)
import type { Reading } from "./propagate.js";

/** Do two readings of the same quantity agree? Two rounded numbers agree when the intervals
 *  they assert can overlap, plus an allowance for genuine measurement variation between two
 *  independently-measured copies (`relTol`, default 1%, ported from _AGREE_REL_TOL). No
 *  knowledge of what `a`/`b` measure — pure interval-overlap-with-tolerance. */
export function agree(a: Reading, b: Reading, relTol = 0.01): boolean {
  const budget =
    a.halfWidth +
    b.halfWidth +
    relTol * Math.max(Math.abs(a.value), Math.abs(b.value));
  return Math.abs(a.value - b.value) < budget;
}
```

`@openisd/engine`'s call sites become one line each, formula = expression string, no bespoke
combine-function per operator:

```ts
import { propagate } from "uncertainties";

export const vdPrecision = (Sd: Reading, Xmax: Reading) =>
  propagate("Sd*Xmax", { Sd, Xmax });
export const ddPrecision = (Sd: Reading) => propagate("2*sqrt(Sd/pi)", { Sd });
export const ebpPrecision = (Fs: Reading, Qes: Reading) =>
  propagate("Fs/Qes", { Fs, Qes });
```

### 5.4 Golden cross-check — the actual proof of equivalence

Hand-verified algebra (§5.2) is not the proof; a byte-for-byte comparison against Python's real
output is. Reuse the exact numbers already committed in
[`test_precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_precision.py#L1) —
real values from `db/datasheets/scan-speak/18we-4542t00/driver.yml`:

```
Sd    = 0.0133 m²  ±5e-05     (test_precision.py:22)
Xmax  = 0.0072 m   ±5e-05     (test_precision.py:22)
```

`test_precision.py:44` asserts `value_of(vd) == SD * XMAX` and (via
`test_a_product_carries_the_precision_of_both_its_inputs`, [:39-49](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_precision.py#L39-L49))
a ≈1.07% relative half-width. The TS golden test:

```ts
// packages/uncertainties/test/propagate.test.ts
import { propagate } from "../src/propagate.js";

test("Vd half-width matches precision.py bit-for-bit (test_precision.py:39-49)", () => {
  const { value, halfWidth } = propagate("Sd*Xmax", {
    Sd: { value: 0.0133, halfWidth: 5e-5 },
    Xmax: { value: 0.0072, halfWidth: 5e-5 },
  });
  expect(value).toBeCloseTo(0.0133 * 0.0072, 15);
  expect(halfWidth).toBeCloseTo(9.5885e-7, 10); // = |Xmax|*dSd + |Sd|*dXmax
});
```

**Exit test for Phase 2:** the above passes, PLUS a corpus-scale check (§7) across every driver
record that currently has a non-empty `derived_precisions()` result — not just this one hand
worked case.

### 5.5 DECISION (human, this session): keep `uncertainties` clean — enforced, not promised

**Ruling, verbatim:** *"just keep the source code of the math lib clean ok - that enough for now

- create an arch test to prove it."* Scope is deliberately narrow — this closes the question of
  whether `uncertainties` stays domain-agnostic (yes, mechanically enforced) and nothing else;
  publish timing, DQ-formula sequencing, etc. are separate and untouched by this decision.

"Clean" made checkable, not aspirational: `packages/uncertainties/src` must never import
anything from outside the package — no `@openisd/*`, no relative path that escapes
`packages/uncertainties`. This is the same shape this repo already checks for a different
boundary — [`packages/engine/test/architecture.test.ts`](http://localhost:8000/winisd/openisd/packages/engine/test/architecture.test.ts#L1)
guards AD-3 ("engine has no DOM/UI dependency") by scanning `from '...'` import clauses on disk,
not by trusting a comment. Same mechanism, new boundary. Per this project's own rule against
vocabulary-based gates, this checks the IMPORT SHAPE only — it does not grep for domain words
like `Sd`/`Xmax`/`WinISD` in comments or examples, which are legitimate (a README explaining
`propagate('Sd*Xmax', ...)` as a usage example is documentation, not coupling).

```ts
// packages/uncertainties/test/architecture.test.ts
/**
 * Mechanical purity guard: `uncertainties` is a standalone, domain-agnostic library — it may
 * one day be published and consumed outside this monorepo (human decision, this session), so
 * it must never import OpenISD/WinISD code. If this test goes red, something in
 * packages/uncertainties/src reached outside the package — that's the boundary break to fix,
 * not the test to loosen.
 *
 * Modeled on packages/engine/test/architecture.test.ts (AD-3's DOM-free guard) — same
 * mechanism (scan `from '...'` import clauses on disk), different boundary.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

// Only these import sources are allowed from packages/uncertainties/src: Node builtins,
// the two adopted dependencies (§5.2), and relative imports that stay inside the package.
const ALLOWED_BARE = new Set(["decimal.js", "mathjs"]);
const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

function srcFiles(): string[] {
  return readdirSync(SRC_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"),
  );
}

describe("uncertainties package stays domain-agnostic (human decision, this session)", () => {
  it("no source file imports anything outside the package or its two dependencies", () => {
    for (const file of srcFiles()) {
      const text = readFileSync(join(SRC_DIR, file), "utf8");
      for (const [, spec] of text.matchAll(IMPORT_RE)) {
        const isRelativeWithinPackage =
          spec.startsWith(".") && !spec.includes("..");
        const isAllowedBare =
          ALLOWED_BARE.has(spec) || spec.startsWith("node:");
        assert.ok(
          isRelativeWithinPackage || isAllowedBare,
          `packages/uncertainties/src/${file} imports '${spec}' — this package must stay ` +
            `standalone (no @openisd/* or escaping relative imports); see MATH_MIGRATION.md §5.5`,
        );
      }
    }
  });

  it("discovers the package source set (guard is not silently empty)", () => {
    assert.ok(
      srcFiles().length >= 2,
      "expected propagate.ts + exact.ts at minimum; found too few — check SRC_DIR",
    );
  });
});
```

**Exit test:** this file exists and is green from the package's first commit — not bolted on
after the fact. Scaffold it alongside `propagate.ts`/`exact.ts` in the same PR, per this
project's own precedent (`test_no_calc_code_in_python.py`, §8.5, is the one exception, and only
because there's nothing to guard until Phase 4 deletes the code it bans — this case has
something to guard from day one, so it does not wait).

---

## 6. Phase 3 — the math API contract (bridge: embedded JS runtime, decided — see §9.2)

**Guiding principle (human, this session): the scraper becomes a dumb client for every math
matter.** Not "move the physics formulas and keep small utilities local" — `scrapers/lib` does
text extraction, HTTP, and orchestration; it does not compute, compare, or bound-check a number
itself once this plan lands. Every numeric operation in §2's inventory, including the
high-frequency ones (`exact`, `halfWidthOfLiteral`, `agree` — called per scraped field, not per
record) routes through this API.

**Bridge (human, 2026-08-02): an embedded JS runtime, in-process — not a subprocess CLI, not a
daemon.** Specifically V8 via `mini-racer` (PyPI `mini-racer`, the actively-maintained
bpcreech/PyMiniRacer fork). See §9.2 for the comparison against the other two embedded
candidates checked (`quickjs-ng`, `PythonMonkey`) and why V8 won. BACKLOG.md's "subprocess call
to a Node CLI" language ([`:41-43`](http://localhost:8000/winisd/openisd/BACKLOG.md#L41-L43))
was written for the separate `.wdr`-writer decision, predates this ruling, and needs correcting
to match — flagged, not yet done.

### 6.1 The API — `scrapers/lib/isdmaths.py`

**Named module, flat functions, not an accessor object at every call site** (human correction,
this session: `get_bridge().exact(...)` repeats the lookup at every call site for no benefit —
resolve the bridge once, internally, and expose plain functions). Every Python call site in
§2/§7 (`units.py`, `model_driver.py`, `model_wdr.py`) imports this module and calls it directly:
`isdmaths.exact(a, b, '*')`, `isdmaths.agree(...)` — no object to fetch first. This is the part
of Phase 3 that's actually ready to build:

**Concrete classes, not loose `dict`/`tuple` (human correction, this session): the API carries
typed data — Pydantic models mirroring the real TS shapes it talks to
([`packages/engine/src/types.ts`](http://localhost:8000/winisd/openisd/packages/engine/src/types.ts#L1),
[`packages/uncertainties/src/propagate.ts`](http://localhost:8000/winisd/openisd/packages/uncertainties/src/propagate.ts#L1))
— not `dict`, not bare `tuple[float, float]`. A `dict` accepts any key typo silently; these
models don't (`extra="forbid"`, matching this codebase's existing Pydantic convention in
`model_driver.py`/`model_wdr.py`).**

```python
# scrapers/lib/isdmaths.py
"""Every math operation the scraper needs, answered by OpenISD's JS engine — the scraper
computes, compares, or bound-checks nothing itself past this module (MATH_MIGRATION.md §6).

Resolves its bridge once, lazily, cached at module scope — callers never see the bridge object,
only these flat functions. Which bridge answers (§6.2) is resolved in ONE place (`_resolve()`),
so swapping it later touches this module and nothing else."""

from typing import Literal, Protocol
from pydantic import BaseModel, ConfigDict


class Reading(BaseModel):
    """A value plus the rounding half-width its printed form asserts. Mirrors the
    `uncertainties` TS package's `Reading` interface (packages/uncertainties/src/propagate.ts) —
    the SAME shape on both sides of the bridge, not a loose `(value, halfWidth)` tuple that
    only means something by argument position."""
    model_config = ConfigDict(extra="forbid")

    value: float
    half_width: float


class CalcInput(BaseModel):
    """Partial Thiele-Small input — the flat numeric physics subset that `deriveDriver()`/the
    DQ formulas actually read at the calc-layer boundary.

    NOT named `DriverRaw`, deliberately. Per
    [ARCHITECTURE.md AD-9](http://localhost:8000/winisd/openisd/ARCHITECTURE.md#L384-L398):
    `DriverRaw` (`packages/engine/src/types.ts`) is RETIRED — cited by name as the evidence
    case for "no more untyped grab-bag types" (~40 all-optional fields mixing T/S numerics
    with `brand`/`comment`/four URL fields, only a handful ever read by the one function that
    took it). Per
    [AD-8](http://localhost:8000/winisd/openisd/ARCHITECTURE.md#L400-L441): `OpenISDDriver`
    (the real app model, strongly typed against `openisd.yml`'s NESTED per-field shape —
    `{ Fs: { value, origin, read_precision, definition }, ... }`) owns the app; but AD-8 itself
    notes *"the calc layer still needs some flat numeric input to do arithmetic on, so a
    narrow successor type is needed at that boundary — but it must be scoped to exactly what
    those functions read, ... not a rename of `DriverRaw`'s current shape"* — i.e. reusing the
    name, even for a narrower type, is exactly the mistake to avoid. `CalcInput` is that
    successor: physics-only, no metadata, no URLs, no provenance — those belong on
    `OpenISDDriver`, not here.

    **Provisional pending AD-8's implementation:** the human is implementing AD-8 now: once
    `@openisd/engine`'s own successor type to `DriverRaw` is named on the TS side, THIS class
    must be renamed to match it exactly — it exists to mirror that type field-for-field, so it
    cannot have a different name than what TS actually calls it. Do not build against this
    name as final.

    Every field optional: a partial input is a valid intermediate state — `deriveDriver`
    reports which required fields are still missing rather than requiring them upfront."""
    model_config = ConfigDict(extra="forbid")

    Fs: float | None = None
    Qts: float | None = None
    Qes: float | None = None
    Qms: float | None = None
    Vas: float | None = None
    Sd: float | None = None
    Re: float | None = None
    Le: float | None = None
    Xmax: float | None = None
    Pe: float | None = None
    Hc: float | None = None
    Hg: float | None = None
    Dd: float | None = None


class CalcError(BaseModel):
    """One human-readable problem tied to a specific field. Mirrors `DriverError`
    (packages/engine/src/types.ts:18-22) — kept that TS-side name since `DriverError` was not
    named in AD-9's retirement (only `DriverRaw`/today's `Driver` class were); revisit if the
    AD-8 implementation renames it too."""
    model_config = ConfigDict(extra="forbid")

    level: Literal["error", "warn"]
    field: str
    message: str


class CalcOutput(CalcInput):
    """A fully-derived Thiele-Small parameter set — mirrors `Driver`
    (packages/engine/src/types.ts:107-119): `CalcInput` plus the fields `deriveDriver()`
    guarantees once validation passes. Same provisional-naming caveat as `CalcInput`."""

    Fs: float
    Re: float
    Sd: float
    Vas: float
    Qts: float
    Qes: float
    Qms: float
    Cms: float
    Mms: float
    Rms: float
    Bl: float


class DeriveResult(BaseModel):
    """Go-style result — mirrors `Result<Driver>` (packages/engine/src/types.ts:24-31).
    `value` is `None` when a BLOCKING error occurred; this is an expected outcome (a driver
    missing a required field), not a fault — contrast `ComputationError` in §6.2, which is for
    the bridge itself misbehaving, not the physics being under-determined."""
    model_config = ConfigDict(extra="forbid")

    value: CalcOutput | None
    errors: list[CalcError]


class MathBridge(Protocol):
    """What any bridge implementation must provide. Not imported by callers directly — this
    module's flat functions below are the actual public surface."""

    def exact(self, a: float, b: float, op: Literal["*", "/"]) -> float: ...
    def half_width_of_literal(self, token: str) -> float: ...
    def agree(self, a: Reading, b: Reading, rel_tol: float = 0.01) -> bool: ...
    def propagate(self, expr: str, readings: dict[str, Reading]) -> Reading: ...
    def derive_driver(self, raw: CalcInput) -> DeriveResult: ...
    def dq_check(self, field: str, values: CalcInput) -> float: ...

_bridge: MathBridge | None = None

def _resolve() -> MathBridge:
    """Locate the bridge once; cached for the process lifetime. WHICH bridge (§6.2, undecided)
    is named here and nowhere else in the module."""
    global _bridge
    if _bridge is None:
        _bridge = ...   # the undecided part — §6.2, not designed yet
    return _bridge

def exact(a: float, b: float, op: Literal["*", "/"]) -> float:
    """Exact decimal multiply or divide — the two operands combined base-10, the way they were
    printed, not as the binary fractions IEEE-754 approximates them with.

    Mathematical foundation: `0.1 + 0.2 != 0.3` in binary floating point because most decimal
    fractions have no exact binary representation. A datasheet value like `0.49 mH` is a base-10
    literal; multiplying or dividing it in binary invents digits the source never asserted
    (`0.0133 * 0.0072` gives `9.575999999999999e-05` in float64, `9.576e-05` exactly in decimal —
    the difference cost `Vd` a real significant digit across 544 records before this was fixed;
    see references). This function routes the operation through an arbitrary-precision decimal
    type instead, converting back to `float` only on return.

    Ports `units.py`'s `exact()`
    (winisd_tools/scrapers/scrapers/lib/units.py:156-166) onto `decimal.js` — see
    MATH_MIGRATION.md §5.2 for the library due-diligence (307M downloads/month, MIT license).

    Args:
        a: first operand — a plain float already extracted from raw text upstream; this
            function has no text-parsing role (extraction stays in Python, MATH_MIGRATION.md §1.1).
        b: second operand.
        op: `'*'` or `'/'`.

    Returns:
        The exact decimal result of `a op b`, as a float.

    Raises:
        InvalidArgumentError: `op` is neither `'*'` nor `'/'`, or `b == 0` under `'/'`.
        BridgeUnavailableError: the bridge could not be reached (§6.2).

    References:
        - IEEE 754-2008, "IEEE Standard for Floating-Point Arithmetic" — the binary-representation
          gap this function exists to route around.
        - decimal.js documentation: https://mikemcl.github.io/decimal.js/
        - Python `decimal` module (the standard library this ports): https://docs.python.org/3/library/decimal.html
        - winisd_tools bug this pattern fixed: BUG_20260729 (float noise in derived values),
          http://localhost:8000/winisd/winisd_tools/bugs/BUG_20260729_derived-values-are-written-with-16-digits-of-float-noise-and-no-propagated-precision.md
    """
    return _resolve().exact(a, b, op)

def half_width_of_literal(token: str) -> float:
    """The rounding half-width a CLEAN decimal literal asserts, purely from its own digit count.

    Mathematical foundation: a decimal number stated to N places after the point conventionally
    asserts precision to within half the last place shown — `"0.40"` claims the true value lies
    in `[0.395, 0.405)`, a tighter claim than `"0.4"`'s `[0.35, 0.45)`, even though both parse to
    the same float. This is the standard significant-figures reading of a printed measurement —
    a statement about how the number was WRITTEN, not a statistical distribution over how it
    might vary.

    Ports `units.py`'s `_printed_half_width()`
    (winisd_tools/scrapers/scrapers/lib/units.py:285-296). Takes an ALREADY-CLEAN token — no
    unit, no surrounding prose, no thousands separators. Extracting that token from raw
    datasheet text (`"0.49 mH @ 1 kHz"` → `"0.49"`) is a separate, domain-specific step that
    stays in Python (MATH_MIGRATION.md §1.1); this function has no idea what the number measures.

    Args:
        token: a clean decimal literal, e.g. `"0.40"`, `"12"`, `"1.5e3"`.

    Returns:
        Half the value of the literal's last significant decimal place — `"0.40"` → `0.005`,
        `"12"` → `0.5`, `"1.5e3"` → `50.0`.

    Raises:
        InvalidArgumentError: `token` does not parse as a decimal literal.
        BridgeUnavailableError: the bridge could not be reached (§6.2).

    References:
        - JCGM 200:2012, "International vocabulary of metrology — Basic and general concepts
          and associated terms" (VIM), 3rd ed., §2.9 — measurement precision as a property of
          how a result is expressed.
        - Taylor, J.R., "An Introduction to Error Analysis", 2nd ed. (University Science Books,
          1997), ch. 2 — significant figures and the precision a printed decimal implies.
    """
    return _resolve().half_width_of_literal(token)

def agree(a: Reading, b: Reading, rel_tol: float = 0.01) -> bool:
    """Do two independently-sourced readings of the same quantity agree, once each source's own
    rounding is accounted for?

    Mathematical foundation: interval-overlap-with-tolerance, not equality. Two rounded numbers
    are consistent whenever the INTERVALS their own rounding admits to can overlap, plus a
    relative allowance for genuine measurement variation between two physically different
    samples of a product:

        |a.value - b.value| < a.half_width + b.half_width + rel_tol * max(|a.value|, |b.value|)

    `rel_tol` defaults to 1%, empirically re-derived rather than assumed — see reference below.
    This is deliberately an interval-arithmetic bound, not a statistical hypothesis test: a
    rounding half-width is a hard limit on what a source could have meant, not a random
    variable with a known distribution.

    Ports `model_driver.py`'s `readings_agree()`
    (winisd_tools/scrapers/scrapers/lib/model_driver.py:725-742), human-ruled 2026-07-27
    (TODO.md QT24).

    Args:
        a: first reading.
        b: second reading.
        rel_tol: additional fractional allowance (of `max(|a.value|, |b.value|)`) for genuine
            measurement variation between two independently-measured copies — NOT a rounding
            budget; that's what `a.half_width`/`b.half_width` already are.

    Returns:
        `True` if the two readings' asserted intervals can be reconciled; `False` if they
        genuinely contradict.

    Raises:
        BridgeUnavailableError: the bridge could not be reached (§6.2).

    References:
        - JCGM 100:2008, "Evaluation of measurement data — Guide to the expression of
          uncertainty in measurement" (GUM), §D.5 — treating a rounding interval as a hard
          bound, not a probability distribution.
        - winisd_tools/scrapers/scrapers/lib/precision.py:36-38 — the 4,122-reading-pair
          empirical re-derivation of the 1% tolerance and the enclosure-vs-quadrature choice
          this function and `propagate()` both rely on.
    """
    return _resolve().agree(a, b, rel_tol)

def propagate(expr: str, readings: dict[str, Reading]) -> Reading:
    """Propagate `readings`' rounding half-widths through `expr` and return the derived value
    plus how much of it is actually known.

    Mathematical foundation: first-order (linear) propagation of uncertainty. For a derived
    quantity f(x1, ..., xn), the GUARANTEED-ENCLOSURE half-width at the operating point is

        halfWidth(f) = Σᵢ |∂f/∂xᵢ| · halfWidth(xᵢ)

    — the worst-case bound, deliberately NOT the statistical root-sum-square/quadrature
    combination most error-analysis references present as the default for independent random
    errors. The choice is empirical, not assumed: quadrature changes exactly one verdict across
    4,122 real comparable reading pairs in this project's own database (see reference). Partial
    derivatives are computed by a symbolic differentiation engine (mathjs `derivative()`), not
    hand-differentiated per formula — `expr` IS the formula.

    JS implementation: `packages/uncertainties/src/propagate.ts`
    (MATH_MIGRATION.md §5.3) — this Python function is a thin delegate to the bridge (§6.1); the
    math itself lives in the standalone `uncertainties` package, not here.

    Args:
        expr: a mathjs-parseable expression string over the keys of `readings`, e.g.
            `"Sd*Xmax"` or `"2*sqrt(Sd/pi)"`.
        readings: `{name: Reading}` for every free variable `expr` references.

    Returns:
        A `Reading` — the evaluated result and its guaranteed-enclosure half-width.

    Raises:
        InvalidArgumentError: `expr` doesn't parse, or references a name missing from `readings`.
        BridgeUnavailableError: the bridge could not be reached (§6.2).

    References:
        - Taylor, J.R., "An Introduction to Error Analysis", 2nd ed. (1997), ch. 3 — first-order
          propagation of uncertainty; worst-case (interval) vs. RSS (independent-error) combination.
        - "Propagation of uncertainty", Wikipedia: https://en.wikipedia.org/wiki/Propagation_of_uncertainty
        - mathjs `derivative()` documentation: https://mathjs.org/docs/reference/functions/derivative.html
        - winisd_tools/scrapers/scrapers/lib/precision.py:11,36-38 — the human ruling
          (2026-07-29) to use a maths library for the derivatives, and the empirical
          justification for the enclosure-sum over the library's native quadrature.
    """
    return _resolve().propagate(expr, readings)

def derive_driver(raw: CalcInput) -> DeriveResult:
    """Derive the full Thiele-Small parameter set from a partial driver spec, and validate it.

    Mathematical foundation: the Thiele/Small small-signal loudspeaker model — Qts from
    Qes/Qms, Cms/Mms/Rms/Bl from Fs/Vas/Sd/Qes/Qms/Re, and the derived quantities EBP, Dd, Vd,
    and sensitivity/efficiency (no/SPLref/USPL). Every formula the JS implementation runs
    corresponds to one WDR_SCHEMA.md §4 consistency group, each independently confirmed this
    session as genuine WinISD behaviour — ASCII strings inside `winisd.exe` itself, or WinISD's
    own shipped help text — not invented physics. See PLAN_JS_CALC_CONSOLIDATION.md §2 for the
    per-formula proof table.

    JS implementation: `@openisd/engine`'s `deriveDriver()`
    (packages/engine/src/driver.ts) — this Python function is a thin delegate to the bridge (§6.1).

    Args:
        raw: a `CalcInput` — any subset of fields populated is sufficient, so long as it's
            enough to solve the rest (see `deriveDriver`'s own completeness rules,
            packages/engine/src/driver.ts:51-62).

    Returns:
        A `DeriveResult`: `.value` is a `CalcOutput` when validation passed (`None` if a
        blocking error occurred — see `DeriveResult`'s own docstring on why that's not a raised
        exception), `.errors` carries both blocking and non-blocking (`warn`) issues.

    Raises:
        BridgeUnavailableError: the bridge could not be reached (§6.2). Note this is distinct
            from `DeriveResult.value is None` — a blocking validation error is physics being
            under-determined, not the bridge failing; it comes back as a normal return value.

    References:
        - "Thiele/Small parameters", Wikipedia: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
        - Small, R.H., "Direct-Radiator Loudspeaker System Analysis", Journal of the Audio
          Engineering Society 20(5), 1972 (paywalled): https://aes.org/e-lib/browse.cfm?elib=2008
          — the original derivation; cited verbatim at the top of packages/engine/src/driver.ts.
        - WDR_SCHEMA.md §4 — the 22 consistency groups, WinISD's own internal parameter
          dependency graph, reverse-engineered from the shipped binary and help text.
    """
    return _resolve().derive_driver(raw)

def dq_check(field: str, values: CalcInput) -> float:
    """Recompute `field` from `values` per its WDR_SCHEMA.md consistency group, for the CALLER
    to compare against an already-scraped value — a data-quality check, not a value to store.

    Mathematical foundation: the same Thiele-Small physics as `derive_driver()`, applied in the
    opposite direction — not "what should this driver's parameters be" but "does this
    ALREADY-SCRAPED value agree with what the driver's OTHER already-scraped values imply".
    The tolerance for disagreement is a genuine-measurement-variation allowance, the same
    concept `agree()` applies — not a rounding budget.

    JS implementation: `packages/engine/src/dqFormulas.ts`
    (MATH_MIGRATION.md §4) — one pure function per WDR_SCHEMA.md group.

    Args:
        field: the WDR field name being checked — one of the 9 DQ-tolerance formulas (`Qts`,
            `Rme`, `Mpow`, `gamma`, `Vas`, `no`, plus `Vd`/`Dd`/`EBP` when checked rather than
            derived) — see PLAN_JS_CALC_CONSOLIDATION.md §2 for the full list and each one's
            WDR_SCHEMA group number.
        values: a `CalcInput` carrying the other already-scraped fields `field`'s formula
            depends on — the same type `derive_driver()` takes, reused here since a DQ-check
            dependency set is just a subset of Thiele-Small fields, not a different shape.

    Returns:
        The recomputed value. This function does not itself emit a DQ mark — comparing the
        result against the scraped value and deciding a DQ disposition stays Python-side
        orchestration (MATH_MIGRATION.md §7).

    Raises:
        InvalidArgumentError: `field` isn't a known DQ-checkable formula, or `values` is missing
            a dependency `field`'s formula needs.
        BridgeUnavailableError: the bridge could not be reached (§6.2).

    References:
        - WDR_SCHEMA.md §4 — the specific consistency group each `field` corresponds to.
        - winisd_tools/scrapers/scrapers/lib/model_wdr.py:453-473 — `_WDR_CALCULATABLE`, the
          Python dict this function's JS implementation replaces one-for-one.
    """
    return _resolve().dq_check(field, values)
```

Call sites read as plain function calls: `isdmaths.exact(Sd, Xmax, '*')`, not
`isdmaths.get_bridge().exact(...)` — the module IS the API; `MathBridge`/`_resolve()` are its
internal plumbing, never named at a call site.

### 6.2 The fault contract — every bridge implementation must raise only these, whichever gets chosen

This is the part of "the bridge" that's safe to design now, because it constrains the decision
rather than making it: no matter what transport gets picked, callers need to be able to
distinguish these failure modes without knowing which transport produced them.

```python
# scrapers/lib/isdmaths.py (continued)

class MathBridgeError(Exception):
    """Base for every error a MathBridge implementation may raise. Callers catch this, or one
    of the three below — never a transport-specific exception (subprocess.CalledProcessError,
    a socket error, etc.), which would leak the undecided transport choice into every caller."""

class BridgeUnavailableError(MathBridgeError):
    """The bridge could not be reached at all — process failed to start, connection refused,
    timeout. Not the same as a computation failing: the JS side never got to answer.
    Retriable in principle; this plan does not decide a retry policy."""

class InvalidArgumentError(MathBridgeError):
    """The JS side rejected the call's shape or values before computing anything (e.g. `op`
    divide with `b=0`, a malformed `expr` `propagate` can't parse). Not retriable — the caller
    sent something the API contract doesn't accept."""

class ComputationError(MathBridgeError):
    """The JS side accepted the call and computed an answer, but reports failure (e.g.
    `deriveDriver`'s own `errors` array is non-empty). Carries the JS-side error detail
    verbatim — this plan does not re-word or summarise it, so the JS message is exactly what
    reaches the Python caller and, from there, any log or DQ record."""
```

**No dual-implementation safety net:** none of these three is "fall back to Python arithmetic."
A caller that catches `BridgeUnavailableError` and computes the answer itself would recreate
exactly the drift risk this plan exists to remove — the correct response to any `MathBridgeError`
is to fail the record/field being processed, not to silently answer a different way.

**Explicitly deferred, not decided here:** which transport implements `MathBridge` (subprocess,
daemon, embedded runtime, or otherwise), what `_resolve()`'s selection/config logic looks like,
and everything in the removed §6.2 of the previous draft (package location, entry point, wire
format) — all of that is a separate design step once the bridge itself is decided. §7 and §8
below reference "the bridge" generically for this reason; treat any prior draft language naming
a subprocess CLI as superseded by this correction.

---

## 7. Phase 4 — corpus-scale parity proof, then cutover

**Before any Python deletion:** run every derivation + DQ-check + precision call through BOTH
the current Python code and `isdmaths` (§6.1, whatever bridge is configured behind it by then), across
the full driver corpus published by winisd_tools. Script:
`scrapers/tools/verify_calc_parity.py` (new) — for every record with T/S fields present, compute
`Vd`/`Dd`/`EBP`/9 DQ formulas/3 precisions both ways, diff, report.

**Pass criterion:** exact equality for the DQ/derivation formulas (both are IEEE-754 double
arithmetic — `Math.sqrt`/`Math.pow`/`/` in JS and Python's `math.sqrt`/`**`/`/` are both
IEEE-754-compliant and should agree bit-for-bit on well-conditioned inputs; a mismatch is a real
bug to investigate, not a tolerance to widen). Precision half-widths pass at the golden test's
tolerance (§5.3, 10 decimal places) — not bit-exact, because floating summation order
(`math.fsum` vs. a JS accumulator loop) can differ in the last ULP; document the actual observed
max discrepancy from the real run rather than assuming it.

**Cutover, once parity is 100% across the corpus (no dual-path period):** per this project's
standing rule against version-supporting/fallback code — a "calls JS, falls back to Python on
mismatch" mode would itself be exactly the second-shape violation this plan exists to eliminate.
Delete the retired Python symbols in one PR once parity is proven, not gradually behind a flag.

**Deleted from `model_wdr.py`:** `_DERIVED_FORMULAS`, `_WDR_CALCULATABLE`, the inline `vd`/`dd`/
`ebp` computation at lines 370/374/375, `derived_precisions()`. **Deleted from `precision.py`:**
the whole file — its callers all move to `isdmaths` calls (§6.1). **Deleted from `units.py`:**
`exact()` (:156-166), `_printed_half_width()` (:285-296) — `parse_reading()` (:299) stays as the
text-extraction orchestrator (§1.1) but its body changes from computing the value/precision
inline to calling `isdmaths.exact(...)`/`isdmaths.half_width_of_literal(...)` on the clean token
it extracted. **Deleted from `model_driver.py`:** `readings_agree()` (:725-742) —
`crosscheck.py` and the record-guard caller both re-point at `isdmaths.agree(...)`. **Kept,
re-pointed at the API:** the DQ orchestration loop that currently calls
`_WDR_CALCULATABLE[field]["fn"](f)` now calls `isdmaths.dq_check(field, f)`.

---

## 8. Testing strategy — full rewrite, not additive

### 8.1 New TypeScript tests (created this plan)

- `packages/engine/test/dqFormulas.test.ts` — one golden-value case per §4 function, sourced
  from the same real records Python's DQ tests already use.
- `packages/uncertainties/test/propagate.test.ts` — §5.4's case plus one per derived formula (Dd, EBP) — lives with the library, not with `engine`, so it can be tested and versioned independently of any OpenISD-specific code.
- Contract/shape tests for whatever bridge implementation is eventually chosen (§6.2) — not
  specified here, since the bridge isn't decided; whatever it is, it must be tested against the
  `MathBridge` protocol and the three exception types, not against a specific transport.

### 8.2 New cross-language test (created this plan, lives in `winisd_tools` since it drives the

Python-side comparison)

- `scrapers/tests/lib/test_calc_parity.py` — calls `isdmaths` (§6.1) for a fixed small set of
  hand-picked records (not the full 2,662-record corpus — that's `verify_calc_parity.py`, a
  one-time migration gate, not a per-CI-run test) and asserts against values independently
  computed by hand or against the pre-migration Python formula, kept as a comment for
  traceability (not as live code — see §8.4). Runs against whatever bridge implementation is
  configured; does not assume a subprocess.

### 8.3 Python tests retired outright (the code they test is deleted in §7)

All three below reference `readings_agree()` directly (confirmed by grep this session) — with
§1's corrected scope (`readings_agree`/`_printed_half_width` now move, not just `precision.py`'s
formula propagation), all three retire, not just the first:

| Test file                                                                                                                                      | Why retired                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`test_precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_precision.py#L1)                                       | Tests `precision.py`, which is deleted. Its cases are ported to `packages/uncertainties/test/propagate.test.ts` (§8.1) — not lost, relocated.                                                                                                                                                                                                                                        |
| [`test_crosscheck_precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_crosscheck_precision.py#L1)                 | Tests precision propagation through DQ comparison, via `readings_agree()` — which moves (§1, §2). Cases port to `agree.test.ts`.                                                                                                                                                                                                                                                     |
| [`test_spec_entry_printed_precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_spec_entry_printed_precision.py#L1) | Tests `_printed_half_width()`-derived precision on spec entries — `_printed_half_width()` moves to `halfWidthOfLiteral.ts` (§2). Cases port to `halfWidthOfLiteral.test.ts`. Read it before deleting to confirm it doesn't ALSO cover `parse_reading()`'s token-extraction step, which stays Python (§1.1) and would need a slimmed-down Python test kept behind, not fully retired. |

### 8.4 Python tests kept, re-pointed at the API (not deleted — they test orchestration, not arithmetic)

| Test file                                                                                                                                                                                                                                                                                                                                                                                      | New behaviour                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`test_wdr_projection.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_wdr_projection.py#L1)                                                                                                                                                                                                                                                                             | Still asserts ParState/field-projection correctness; the derived values it checks now come from a (test-doubled or real, TBD in the implementation PR) CLI call instead of inline Python arithmetic |
| [`test_no_rounding_on_storage.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_no_rounding_on_storage.py#L1)                                                                                                                                                                                                                                                             | Still valid — "don't round on write" is a projection rule, not a calc rule; unaffected by where the arithmetic runs                                                                                 |
| [`test_semantic_dq_precision.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_semantic_dq_precision.py#L1)                                                                                                                                                                                                                                                               | DQ orchestration stays; the formula it compares against now comes from `isdmaths.dq_check(...)`                                                                                                     |
| [`test_dq_status_is_derived_not_stored.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_dq_status_is_derived_not_stored.py#L1)                                                                                                                                                                                                                                           | Unaffected — tests a storage-shape invariant, not a formula                                                                                                                                         |
| [`test_field_dq_marks_emit.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_field_dq_marks_emit.py#L1), [`test_dq_alert_wiring_coverage.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_dq_alert_wiring_coverage.py#L1), [`test_quality_dq_models.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_quality_dq_models.py#L1) | Unaffected — DQ-record shape/wiring, not formulas                                                                                                                                                   |
| [`test_rebuild_wdr.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_rebuild_wdr.py#L1), [`test_wdr_ini_file.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/lib/test_wdr_ini_file.py#L1)                                                                                                                                                                   | Unaffected — INI serialisation mechanics                                                                                                                                                            |

### 8.5 New architecture guard (mirrors this repo's existing shape-based pattern)

This project already has the exact pattern needed —
[`test_no_tmp.py`, `test_no_compat_shims.py`](http://localhost:8000/winisd/winisd_tools/scrapers/tests/test_architecture.py#L1)
gate on code SHAPE, never on prose/names. Add `test_no_calc_code_in_python.py`: asserts
`_DERIVED_FORMULAS`, `_WDR_CALCULATABLE`, `readings_agree`, `exact`, and `_printed_half_width`
(and `derived_precisions`/`precision.py` entirely) no longer exist as symbols in `scrapers/lib/`,
and that `model_wdr.py`'s DQ-check call sites are AST-verified to call through `isdmaths`,
not to contain inline arithmetic. Written AFTER Phase 4's deletion (§7), not before — it has
nothing to guard until the code it bans is actually gone; landing it early would just be a test
for a violation that doesn't yet exist to catch.

### 8.6 CI wiring

Depends on the bridge decision deferred in §6 — not specified here. Whatever the bridge turns
out to be, `openisd`'s CI picks up its package via the existing workspace glob (`packages/*`,
[`package.json:6-7`](http://localhost:8000/winisd/openisd/package.json#L6-L7)) with no extra
config. `winisd_tools`'s CI may gain a new runtime dependency (Node, or whatever the bridge
needs) to run `test_calc_parity.py` for real rather than mocked — flagged as Open Decision 2,
now explicitly contingent on the bridge choice rather than assumed to be Node/subprocess.

---

## 9. Open decisions requiring the human

1. ~~Publish `uncertainties` to npm now, or keep it workspace-only until it's proven?~~
   **CLOSED (human, this session): "just keep the source code of the math lib clean ok - that
   enough for now - create an arch test to prove it."** Scope narrowed to cleanliness, mechanically
   enforced by §5.5's `architecture.test.ts` from the package's first commit. Publish timing is
   not decided by this and stays open only in the narrow sense that nobody has to decide it yet.
2. ~~Which bridge implements `MathBridge` (§6)?~~ **CLOSED (human, 2026-08-02): "use embedded
   JS if its stable."** Verified stable and picked: **V8 via `mini-racer`**
   (bpcreech/PyMiniRacer, PyPI package `mini-racer`) — the original `sqreen/PyMiniRacer` is
   dead, but this fork was revived in 2024, ships CVE fixes current to 2024, covers Python
   3.10–3.14, and wraps the same V8 that runs Node/Chrome, the most hardened JS engine
   available to embed. Two other embedded candidates were checked and rejected: `quickjs-ng`
   (the maintained fork of `PetterS/quickjs`, itself archived 2026-01-01 — less runway, and a
   materially less battle-tested engine than V8) and `PythonMonkey` (SpiderMonkey; MVP only
   since September 2024, with a history of input-triggered segfaults, now fixed but a bad sign
   for a data-quality pipeline that must never crash on a malformed scrape). §6.2's fault
   contract stands unchanged — `BridgeUnavailableError`/`InvalidArgumentError`/
   `ComputationError` now map onto mini-racer's own exception surface, not a subprocess's exit
   code. `@openisd/engine` ships as TypeScript ESM source with no `dist/` build
   ([`packages/engine/package.json`](http://localhost:8000/winisd/openisd/packages/engine/package.json#L1-L12));
   the bridge needs a bundling step (tsc/esbuild → a single CJS/IIFE script with no `import`/
   `export`) before mini-racer can `eval` it — not yet built, next concrete task under this
   decision.
3. **CI runtime coupling** (§8.6) — downstream of decision 2. `winisd_tools`' CI does not
   currently require Node; whether it will, and what exactly `test_calc_parity.py` needs
   installed to run for real rather than mocked, both depend on the bridge chosen.
4. **9 DQ-tolerance formulas — migrate now or defer?** §2 scopes them in for "100%", but they
   carry no known live bug today (unlike Vd/Dd/EBP, which do). If corpus-scale time (§7) is a
   constraint, Phase 1's DQ formulas could ship after Phase 2/3's proven 3-formula core, as a
   separate follow-on plan — flagging the option, not choosing it.
