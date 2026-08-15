# Plan 2 — `@openisd/projection`, the export function `winisd_tools` calls

**Runs AFTER [Plan 1](OPENISD_TARGET_MIGRATION_PLAN.md).** It projects `OpenISDDriver`,
`OpenISDPassiveRadiator` and the alignment types into files, so those types must exist first.
Starting this early means writing a projection of a model that is still being reshaped.

Implements [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §1 — "`openisd.yml` and `.wdr` are PRODUCED
exclusively by JS/TS owned by OpenISD" — and R23, the package boundary.

---

## What exists today, measured 2026-08-14

**Nothing of this plan is built, and the current reality is its opposite.**

- `packages/projection` does not exist. The packages are `engine`, `model`, `ui`, `ui-proposals`,
  `winisd`.
- **No TypeScript anywhere reads `driver.yml`.** The only two hits in `packages/*/src` are
  COMMENTS mentioning the format — `openisdRecord.ts:8`, `openisdDriver.ts:60`. There is no
  reader, no parser and no type.
- **`winisd_tools` does the whole chain in Python.** `scrapers/scrapers/lib/rebuild_wdr.py`
  imports `model_driver.DriverFile`, `model_openisd.OpenIsdYmlFile` and `model_wdr.WdrFile`, and
  contains no `node`, `v8` or `subprocess` call.

So `driver.yml → openisd.yml → .wdr` runs entirely in Python today, using Python's own model of
`openisd.yml` — the model R4 says must be deleted. **Deleting it is the LAST step here, not the
first**: nothing may be deleted until its replacement is proven byte-identical.

---

## The contract, from `ARCHITECTURE.md`

**Text in, text out, and it never throws.** Invalid input and well-formed-but-wrong input both come
back as `Result{value: null, errors}`, because a thrown value cannot usefully cross an embedded-V8
boundary.

**The utility touches no files.** `winisd_tools` reads `driver.yml`, passes the TEXT, receives the
`openisd.yml` and `.wdr` TEXT, and writes both files itself. The utility is handed no path and
opens nothing — no filesystem, no working directory, nothing to mock.

**It is a SEPARATE package.** `winisd_tools` embeds V8 and loads ONE bundled JavaScript file; it
cannot load a Vue application. `@openisd/projection` depends on `@openisd/model` and
`@openisd/engine` and on nothing touching a DOM, a `window`, a network or a filesystem.

---

## The steps

### Step 1 — The package, empty but loadable

`packages/projection/`, building to ONE file with no runtime imports.

**Prove the constraint before writing the logic**, because discovering a DOM dependency after the
transforms are written means unpicking them: build the bundle with a single exported function that
returns a constant, load it in the real embedded V8 from Python, and call it.

**Done when:** Python gets the constant back from the bundle. Not from `node` — from embedded V8,
the thing that actually has to work.

### Step 2 — A gate on what the bundle may contain

A test asserting the built bundle references no `document`, `window`, `navigator`, `fetch`,
`XMLHttpRequest`, `require('fs')` or `node:` import.

Written NOW, while the bundle is trivial, so it fails the moment a transform pulls one in — rather
than being written afterwards to describe whatever the bundle happens to contain.

**Done when:** the gate is green on the empty bundle and fails on a deliberately-added `document`.

### Step 3 — Read `driver.yml` in TypeScript

OpenISD must parse a format `winisd_tools` owns. Port the shape from `model_driver.py`'s
`DriverFile`.

**This is the mutual dependency `ARCHITECTURE.md` §1 accepts on purpose:** one reader of that
format in one language beats two readers that agree only until someone adds a field.

**Done when:** every `driver.yml` in `winisd_drivers/db` parses without loss — verified by
re-serialising and diffing against the source, not by spot checks.

### Step 4 — `driver.yml → openisd.yml`

Port the projection from `model_openisd.py`. Its output is `OpenISDDriverJson`.

**The oracle is the existing Python output.** For every driver in the db, the TypeScript
`openisd.yml` must match the committed one byte for byte. A difference is a defect in the port
until proven otherwise — this step changes no data, it changes which language produces it.

**Done when:** every record in the db round-trips byte-identical, and the count is stated in the
commit rather than "most".

### Step 5 — `openisd.yml → .wdr`

`WinISDDriver.fromOpenISDRecord()` already does this and is proven at 436/436 against WinISD's own
goldens. This step EXPOSES it through the bundle; it does not reimplement it.

**Done when:** every `.wdr` in the db is byte-identical to the committed one.

### Step 6 — Passive radiators

Plan 1 gives PRs a record. Project it the same way — a PR has no `.wdr` (WinISD does not model
them), so this is `driver.yml → openisd.yml` only.

**Done when:** a PR record produced by the bundle matches the committed one.

### Step 7 — Wire `rebuild_wdr.py` to the bundle

Replace `model_openisd.OpenIsdYmlFile` and `model_wdr.WdrFile` with calls into embedded V8.
`winisd_tools` still writes every file.

**Run both implementations side by side over the whole db first** and diff, before removing the
Python path. A rewrite of a data pipeline that is only checked on the happy path is how a silent
field-drop ships.

**Done when:** a full rebuild produces a byte-identical db, and the diff is empty.

### Step 8 — DELETE the Python model (R4)

`model_openisd.py` and `model_wdr.py`. Their tests go with them, EXCEPT any asserting facts about
the FORMAT rather than about the Python classes — that coverage moves to the TypeScript side.

`model_driver.py` STAYS. `winisd_tools` owns `driver.yml`.

**Done when:** no Python model of `openisd.yml` or `.wdr` remains, and a full rebuild still
produces a byte-identical db.

---

## Definition of done

- `winisd_tools` produces `openisd.yml` and `.wdr` through embedded V8, from one bundled file.
- A full rebuild of `winisd_drivers/db` is byte-identical to the current committed state.
- No Python model of `openisd.yml` or `.wdr` exists.
- `model_driver.py` still owns `driver.yml`.
- The bundle-purity gate is green.
- Parity still 436/436.

---

## What this plan does NOT do

**It does not change any driver's data.** Every step is a change of which language produces a
file, checked byte for byte against the file that language already produced. A step that wants to
CHANGE a value is a different piece of work, raised separately, and never smuggled in here where
a byte diff would be the only thing standing between it and the db.

`provided_by`/`comment`/`added` (ledger QO42) ARE such a change: `winisd_tools` must populate them
in `driver.yml`, and that is its own task, done before or after this plan but not inside it.
