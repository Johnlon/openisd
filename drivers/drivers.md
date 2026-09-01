# OpenISDDevice — one record type, one bridge call, both derived files

Approved by John, 2026-08-30.

## Context

`openisd.yml` and `winisd.wdr` are both DERIVED from `driver.yml`. Today the projection is
split: Python builds `openisd.yml` with its own model (`model_openisd.py`), then calls the
OpenISD app through an embedded V8 bridge for the `.wdr` only. Two owners of one derivation,
and the app's own record type cannot read either file.

John's design (2026-08-30):

> "what we need in openisd is a Json datastructure OpenISDDevice that sits [under] the driver
> and pr domain object and is used for bundle and my** stores, this datastructure omits that
> scraper section so serialisation via it loses the bit we don't want, bridge uses it to read
> the driver.yml sent to bridge and it strips off the scraper then adds dq_calc and returns the
> result object X to the caller, but it also puts X thru the wdr transformer and returns that
> And does all the round trips"

Two ideas carry the whole design:

**The scraper section is dropped BY THE TYPE, not by a delete step.** `OpenISDDeviceJson` does
not declare `scraper_meta`, so serialising a record through it loses that section structurally.
Nothing has to remember to remove it, and nothing can forget.

**One bridge call produces both files.** The app parses `driver.yml` into `OpenISDDeviceJson`,
adds `dq_calculated`, runs the result through the `.wdr` transformer, runs every round-trip
check, and hands Python both artefacts plus one error array. Python writes bytes and parses
neither format — the contract `openisd_js.py` already documents.

### Established this session, by measurement

- `openisd.yml` = `driver.yml` minus `scraper_meta`, `model` composed as `series + model`
  (`model_openisd.py:47-56` is the whole of the current projection).
- A spec entry carries `origin`, `readings{role → {actual_reading, read_value, read_precision}}`,
  `corroboration`, `definition`, and now `dq_scraper`. It states NO value of its own: the number
  is `readings[origin].read_value` (Q31 — a fact stored twice needs a validator to police it).
- Metadata fields are a different envelope — `{value, origin, definition}` — because they are
  single-source. `sku` is a third: `value` plus `grounds[]`, no `origin`.
- `dq_marks` → `dq_scraper` is DONE: 45 Python sites, 125 corpus files, 135 marks intact.
- The corpus holds 2064 `driver.yml`, and 0 `openisd.yml` / 0 `.wdr` — all deleted, awaiting
  regeneration.
- The V8 bundle exists at `packages/winisd/dist/openisd-bridge.js`; `project_ui_files` is the
  production entry (`framework.py:1710`) and worked on 5 records this session.

## Part A — `OpenISDDeviceJson`, in `packages/design/domain/project.ts`

ONE record type for a driver AND a passive radiator — a device is a device; which specs section
it carries is what differs. It replaces design's current `OpenISDDriverJson`, which declares
only six metadata fields and cannot read a real record.

It MIRRORS `driver.yml` field-for-field, minus `scraper_meta`:

```
uuid, quality, manufacturer, brand, model, sku, driver_type, data_sources,
authoritative, description?, series?, product_image?, surround_material?, curves?
specs: { woofer? | tweeter? | 'passive-radiator'? }
```

Names are the corpus's own — `read_precision`, `corroboration`, never a renamed variant. Three
envelope types, because `driver.yml` genuinely has three: `SpecEntry` (readings map, no value),
`ScrapedField<T>` (value + origin), and the `sku` grounds shape.

Each entry gains `dq_calculated?: DqMark[]` beside `dq_scraper?`. Absent, not empty, when the
engine has not run: an empty list claims "checked, found nothing".

`OpenISDDriver` and `OpenISDPassiveRadiator` wrap this one type. The bundle and the `my*` stores
serialise through it, so neither can leak a scraper section.

## Part B — `dq_calculated`, computed in design

- **`calc`** marks from `engine.checkConsistency()` — the app's one consistency implementation.
- **`range`** marks from a limits table copied into design (John: "Copy the limits table into
  design now"), sourced from the scraper's range registry — bounds live on the `SpecField`
  members (`range_lo`/`range_hi`, read by `semantic_dq.py:127-138`).

Mark shape follows the corpus `DqMark`: `kind`, `severity`, `rule`, `params`, `detail`.

## Part C — the bridge

`driverYmlToOpenisdAndWdr(driverYmlText) → { openisd, wdr, errors }`

1. parse `driver.yml` into `OpenISDDeviceJson` — `scraper_meta` falls away structurally
2. compose `model` = `series + model`
3. compute and attach `dq_calculated` (Part B) — this is X
4. serialise X → the `openisd.yml` text
5. run X through the `.wdr` transformer
6. round-trip both texts against the ORIGINAL `driver.yml` object read in step 1, not against `X`
   — comparing against `X` only proves the text writer/reader pair is lossless for whatever
   object it's handed, and says nothing about whether step 1's own parse or step 3's `dq_calculated`
   attachment silently dropped something. Comparing against the true original makes a dropped key,
   at any depth, a mismatch by construction — no separate "did every key make it into the text"
   check is needed on top. Within that one comparison: a key entirely ABSENT from the reparsed
   side is a serialiser defect and throws, uncaught, in the bridge (the same bug on every record,
   not a per-record finding worth a soft warning); a key PRESENT but changed (rounding, a unit
   conversion) is a real data-quality finding and folds into the SAME `errors` array as everything
   else in this list.
7. return both texts and the errors

A passive radiator returns `wdr: null` with no error — WinISD has no PR format — but MUST still
get `dq_calculated`. Today's `project_ui.py:119` returns early for radiators, before the bridge;
that early return goes, or radiators silently lose their marks.

Files: the entry in `packages/winisd`, exposed through `packages/winisd/src/bridge.ts` as the
one global the V8 caller sees.

**Why winisd and not design (John, 2026-08-31, QO103 "opt 1").** `packages/winisd` depends on
`@openisd/design`; `packages/design` declares no dependencies at all. The `.wdr` transformer
(`WinISDDriver`) lives in winisd, so a design-side entry building `.wdr` text would import
`@openisd/winisd` and close a design → winisd → design cycle. Siting it in winisd needs no change
to `packages/design`, and keeps that package's zero-dependency state.

## Part D — Python

- **`openisd_js.py:126-135`** — `_result_from` asserts `set(envelope) == {"wdr","errors"}`.
  Becomes `{"openisd","wdr","errors"}`; `WdrResult` gains `openisd`. This assertion is why the
  JS and Python halves MUST land together: a third key raises `BridgeFault` on every record.
- **`model_driver.py:442` `SpecEntry`** is `extra="forbid"` — add `dq_calculated: list[DqMark]`
  or every record carrying one fails to load.
- **`project_ui.py:113-127`** — call the bridge FIRST, then write both returned texts. The
  "attempt-if-missing, never overwrite" rule stays; the ordering inverts.
- **`model_openisd.py`** — deleted. Its projection now lives in the bridge.

## Part E — regenerate

Run the projection over all 2064 records via `project_ui_files`. Expect ~1970 `openisd.yml` and
~1893 `.wdr` (77 radiators get no `.wdr`).

**The bundler must not run before this.** `bundle-drivers.mjs:45` reads `openisd.yml`; with 5 on
disk it would replace the 1893+77 bundle with 5.

## Verification

- **The acceptance test**: a real corpus `driver.yml` through the bridge, and the resulting
  record read back by design's own `driverFromConformingRecord` — accepted, `Fs` readable,
  `toEngineDriver()` returns a driver. Design has NEVER read a real record; this is the proof
  that changes.
- **Round-trip via production code only** — `OpenISDDriver.fromJsonRecord` / `toWdrText`, no
  reimplementation. A round-trip through anything else proves nothing about the app.
- **Fail-on-purpose on every gate before trusting it**: break the section nesting, drop a
  `dq_calculated` mark, return the wrong reading — each must go red on demand.
- Counts after regeneration: `openisd.yml` == conforming `driver.yml` count; `.wdr` == non-PR
  count; no `openisd.yml` contains `scraper_meta`.
- `bundle-drivers` then runs: 1893 drivers + 77 radiators preserved.
- Suites in the background, one at a time. `winisd_tools` pytest is currently 147 RED, all
  pre-existing (verified by revert-and-compare) — `test_openisd_present` among them, which this
  work fixes.

## Not in this plan

- The MISMATCH three-tier fix is DONE in `crosscheck.py` but takes effect only on RE-EMIT
  (stage 5), not on projection — `scan-speak/r1904-613001` still carries `Re: 77`.
- `driverType.ts`'s stale cross-repo parity path.
- The `any`/double-cast AST gate.
- Design's remaining tsc error: `openisdYamlToWdr.ts`, the model-shaped copy, superseded by
  Part C and to be deleted with it.
