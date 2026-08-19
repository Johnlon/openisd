# `Driver.fromWdr` fabricates ENTERED defaults for keys the `.wdr` never carried, pinning `Gloss` to 0

# Status
- fabricated defaults for absent .wdr keys: FIXED
- export-side toWdr() still writes Gloss=0: OPEN


**Found** 2026-08-13, bucketing `packages/winisd/test/winisd-parity.test.ts` (341 failed of 463).
**Severity** wrong value returned to the app and written to file — a calculated field is reported
as a human-stated 0.

## Symptom

Import a `.wdr` that does not carry a `Gloss=` line. `cell('loss')` comes back
`{ state: 'E', value: 0 }` — openisd asserts a human entered a gravitational-sag figure of zero.
The engine's own `Gloss` rule never runs, because the solver refuses to overwrite an entered
value.

Exact device and values (parity scenario `sealed-small`, a driver defined only by explicit
numbers — Fs 37.2 Hz, Xmax 0.006 m, Sd 0.0132 m², Re 6.4 Ω):

| | value | ParState slot 37 |
| --- | --- | --- |
| WinISD 0.7.0.0 (`packages/winisd/test/fixtures/winisd-parity/goldens/sealed-small.wpr`) | `Gloss=0.0299173972896111` | `C` — WinISD calculated it |
| openisd `Driver.fromWdr(...).cell('loss')` | `0`, state `E` | `N` |

The engine formula is right: `G_STANDARD / ((2π·Fs)²·Xmax)` = 0.0299173972896111, agreeing with
all eight goldens to 1.9e-15 relative. It is simply never reached.

## The code

`packages/winisd/src/driver.ts:308-323` — after reading the file, `fromWdr` unshifts every key a
genuine WinISD save always carries into the same `order`/`raw` pair it just built from the file,
with a fabricated default:

    const STANDARD_NUMERIC_KEYS = ['Hc','Hg','alfaVC','Rt','Ct','Gloss','Thick', … ,'fLe','KLe'];
    for (const key of [...STANDARD_TEXT_KEYS, ...STANDARD_NUMERIC_KEYS, 'ProvidedBy','numVC','VCCon']) {
      if (order.includes(key)) continue;
      order.unshift(key);
      raw[key] = … STANDARD_NUMERIC_KEYS.includes(key) ? '0' : '';
    }

`packages/winisd/src/driver.ts:341-350` — the carried-metadata loop then reads that same `raw`
and cannot tell a fabricated default from a value the file stated:

    for (const [wdrKey, field] of WDR_META) {
      const v = raw[wdrKey];
      if (v == null || v === '') continue;
      if (WDR_META_NUMERIC.has(field)) { const n = parseFloat(v); if (isFinite(n)) d.#inputs[field] = n; }
      …
    }

`WDR_META` maps `Gloss → loss` (`:101`) and `WDR_META_NUMERIC` contains `loss` (`:119`), so
`#inputs.loss = 0`. Presence in `#inputs` **is** the E mark (`cell()`, `:188`), so the field is
reported as stated by a human.

## Root cause

The backfill exists for the EXPORT path — so `toWdr()` emits the keys WinISD expects even when
the source file omitted them. It writes into the same structure the IMPORT path reads, and no
record is kept of which keys actually came from the file. Presence in `raw` therefore means two
different things at once ("the file said this" and "we invented this for export"), and the one
consumer that must distinguish them cannot.

`Gloss` is the only backfilled key openisd computes, so it is the only one whose value is
currently wrong; `Hc`, `Hg`, `alfaVC`, `Rt`, `Ct`, `fLe`, `KLe` and the eight dimension keys are
equally fabricated as `E`, and their provenance is equally false.

## Fix

Capture the file's own key set before the backfill and let only those keys reach `#inputs`:

    const fromFile = new Set(order);            // before the STANDARD_*_KEYS loop
    …
    for (const [wdrKey, field] of WDR_META) {
      if (!fromFile.has(wdrKey)) continue;      // a backfilled default is not a stated value
      …
    }

Export is unaffected: `order`/`raw` still carry the backfilled keys, and `toWdr()`'s overlay only
substitutes a value when `#inputs` holds one.

## Verification

`packages/winisd/test/winisd-parity.test.ts` — the seven `Gloss` rows go from red to green
(WinISD's own calculated value, matched to better than 1e-9 relative). A dedicated regression
test asserts that a `.wdr` with no `Gloss=` line yields `cell('loss').state === 'C'`.

## Adjacent, NOT fixed here

`toWdr()` still writes `Gloss=0` for such a driver, because the export path echoes `#wdrRaw` and
never substitutes a CALCULATED value. `ARCHITECTURE.md` §"The two formats carry deliberately
different content" requires `.wdr` to carry every calculated value. That is the `WinISDDriver`
writer's job — `docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md` Step 8 — and is tracked there, not
here.
