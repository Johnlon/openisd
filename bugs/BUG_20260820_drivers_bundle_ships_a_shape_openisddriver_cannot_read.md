Status: RESOLVED (2026-08-22, task A7)

# `drivers-bundle.json` ships a flat `{inputs}` bag that `OpenISDDriver` cannot read

## Symptom

Every bundled catalogue row asks `OpenISDDriver` for its values, and `OpenISDDriver` cannot
answer, because the bundle's record is not the record shape the model declares.

## Evidence

**The shipped bundle** — `packages/ui/src/drivers-bundle.json`, 1,267,358 bytes, 1,526 drivers
in one source. Read 2026-08-20: every entry's `record` has exactly ONE key, `inputs`, holding a
flat bag:

```json
{"inputs":{"Fs":27,"Pe":250,"Re":9,"Le":0.001,"Bl":12.1,"Xmax":0.008,"Cms":0.00097,
"Qms":4.35,"Qes":0.38,"Qts":0.35,"Rms":1.4,"Mms":0.036,"Sd":0.0161,"Vas":0.0355,
"brand":"Accuton","model":"AS168-9-470","sku":…}}
```

Row keys are `path`, `name`, `driverType`, `record`.

**What the model declares** — `packages/model/src/openisdDriver.ts:53-81`, `_OpenISDDriverJson`
requires `uuid`, `quality`, `manufacturer`, `brand`, `model`, `sku`, `driver_type`,
`disposition`, `data_sources`, `authoritative`, `specs`, each an ENVELOPE (`_ScrapedField` has
`{value, origin, definition, dq}`; `specs` is `_Specs` → `_SpecSection` → `_SpecEntry` with
`origin`/`readings`).

**The consumer** — `packages/ui/src/db/driverRepo.ts:472-503`, `bundledEntry`, on that record:
- `readCell(rec, field)` = `OpenISDDriver.fromRecord(rec).cell(field)`
  (`openisdDriver.ts:717`), and `cell()` resolves through `#specs()` → `this.#record.specs[...]`.
  The bundle has no `specs`, so every one of `_Fs`, `_Sd`, `_Re`, `_Znom`, `_Pe` is affected.
- `myDriverName(rec)` → `readDisplayName(rec)` reads `record.brand?.value`
  (`openisdDriver.ts:731-734`). The bundle has `inputs.brand` as a bare string, so there is no
  `.value`.
- `rec.added?.value`, `rec.data_sources?.value?.manufacturer_datasheet` (and the two sibling
  URLs) — none of these keys exist on the bundle shape.

Dates support drift: `scripts/bundle-drivers.mjs` last changed 2026-08-14,
`drivers-bundle.json` 2026-08-17, `openisdDriver.ts` 2026-08-19.

**NOT runtime-verified.** The above is traced through the source, not observed in a running app.
Confirm the live symptom before acting on the fix.

## Cause

The bundler emits a shape the application cannot consume. Producing a consumable driver
catalogue is its ONLY job, so this is not a partial defect — it is a total failure of the
component's purpose (John's assessment, 2026-08-20: "bundler is 100 wrong as it does not meet
the need of the App so it is a total failure in its only job"). Whatever reasoning produced the
flat `{inputs}` bag, it was not checked against what the app has to do with the result.

## Fix

**RULED (John, 2026-08-20): "I always expect the bundle to look like the Json object so it
should be 100pc compatible."** The bundle carries canonical `_OpenISDDriverJson` records —
`OpenISDDriver.fromRecord()` reads a bundled record with no adaptation, no projection type, no
second shape. `scripts/bundle-drivers.mjs` stops flattening into `{inputs}` and emits the record
as the model declares it; `driverRepo`'s existing `readCell`/`readDisplayName`/`data_sources`
reads then work as written.

Cost accepted: the record payload is already 1,170,044 B of the 1,347,317 B of row data (87%),
and full provenance envelopes are larger than a flat bag, so the bundle grows.

Not fixed yet — implementation tracked in the QO60/QO61 plan, objective 4.

**What must NOT happen:** teaching `OpenISDDriver` a second factory that accepts `{inputs}`
alongside the canonical shape. That is one concept with two shapes and a branch selecting
between them — banned outright by the ONE-model-version rule, whose stated precedent
(`_coerce_flat_fields`) is this exact case: a flat bag accepted beside the canonical record,
ruled delete-don't-adapt.

## Verification

`scripts/bundle-drivers.mjs`'s `project()` (moved to `scripts/bundleProjection.mjs`, see
`bugs/BUG_20260822_bundle_drivers_cli_guard_breaks_under_vite_node.md`) no longer builds an
`inputs` bag — it carries the parsed `openisd.yml` record through as `record` verbatim.
`driverRepo.ts::bundledEntry` already read the canonical shape (`readCell`/`readMetaCell` on
`_OpenISDDriverJson`) before this fix; it was the bundle that disagreed. Regenerated the bundle
against the live `winisd_drivers` checkout (`npx vite-node scripts/bundle-drivers.mjs`): 1197
records, each `record` a full `_OpenISDDriverJson` (`uuid`, `quality`, `specs`, `data_sources`,
…), confirmed by inspecting the written `drivers-bundle.json`.
`npx vitest run packages/ui/test/db/drivers-bundle.test.ts
packages/ui/test/db/bundle-drivers-disposition.test.ts` — 9/9 pass. `npx vue-tsc -p packages/ui
--noEmit` clean.

## Why this matters beyond the picker

It blocks the catalogue-index work (QO60 objective 4): the index is to be built at runtime from
records via the real `OpenISDDriver`, which cannot happen while the shipped records are
unreadable by it.
