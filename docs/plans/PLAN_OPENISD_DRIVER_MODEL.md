# OpenISDDriver / WinISDDriver migration — plan

Successor to `PLAN_DRIVER_ADT.md` (that plan is DONE — it built today's
`packages/winisd/src/driver.ts` `Driver` class). This plan executes
[ARCHITECTURE.md](../../ARCHITECTURE.md) **AD-8** (human decision, 2026-07-31), whose own text
says it "needs its own plan" and that "today's `Driver` class dies." Companion: this repo's
existing [`../design/DRIVER_ADT_DESIGN.md`](../design/DRIVER_ADT_DESIGN.md) describes the
class AD-8 retires — not repeated here.

---

## Status

**Already built, unconsumed** — `packages/winisd/src/native/`:

- `openisdRecord.ts` (213 lines) — the full `openisd.yml` shape, hand-transcribed against the
  real Python pydantic models: `OpenISDRecord` (top-level record), `Specs`/`SpecSection`
  (per-driver-type — `woofer`/`tweeter`/`passive_radiator` — since a field lives at
  `record.specs[driverType][field]`, not one flat bag), `SpecEntry`/`ScrapedField<T>`/
  `DerivedField<T>`/`BookkeepingField<T>` (the four field-kind envelopes), `Reading`,
  `winningReading()`.
- `openisdYaml.ts` (32 lines) — `fromYaml`/`toYaml`. Read is solid; write is a first cut, not
  yet verified byte-identical to the Python canonical serializer (`_KEY_PRIORITY`/
  `_FLOW_LIST_KEYS` unreplicated — flagged in the file itself).
- `openisdDerive.ts` (57 lines) — `deriveOpenISDFields()`, explicitly labeled "the T/S
  consistency-group adapter for `OpenISDDriver`." Flattens `readings[origin].read_value` into
  the numeric bag `solveConsistencyGroup` needs, and back.
- Test coverage: `packages/winisd/test/native/{openisdRecord,openisdYaml,openisdDerive}.test.ts`.

**Confirmed zero consumers**: `grep -rl "openisdRecord\|openisdYaml\|openisdDerive\|SpecEntry\|OpenISDDriver" packages/ui/src packages/engine/src` returns nothing. This is fully-typed,
partially-tested groundwork with no live caller anywhere in the app.

**Missing, and this plan's actual scope**:

1. `OpenISDDriver` — the stateful, `enter`/`clear`-style class the app should hold and mutate.
   Does not exist. Only the plain data types above exist.
2. `WinISDDriver` — the serializer-only class. Does not exist. Today's `Driver.toWdr()`/
   `fromWdr()` still do this job, coupled to the class AD-8 retires.
3. Migrating every call site off `@openisd/winisd`'s `Driver` onto `OpenISDDriver`. 8 files
   currently import it: `logic/store.ts`, `logic/useDesignIO.ts`, `logic/useDriverCells.ts`,
   `logic/wprMapping.ts`, `db/useDriverSelection.ts`, `db/useDriverLibrary.ts`,
   `ui/components/DriverEditorModal.vue`, `types.ts`.

**Blocking gap arising from AD-8** (this plan is its owner — `ARCHITECTURE.md` records the
decision, not the gap): `SPL` (a manufacturer's printed sensitivity figure, not a derived value)
is a canonical spec field — `CANONICAL_SPEC_FIELDS`, `winisd_tools/record_registries.py:273-284`
— with no equivalent anywhere in today's engine types. Already present in `SpecSection` here
(`openisdRecord.ts:166`) but nothing downstream consumes it yet. Must be resolved before "no data
loss" is true; does not block Phase 1 starting.

Everything else checked against AD-8 maps cleanly: the WDR-carried dimension fields (`thick_mm`,
`depth_mm`, `magnet_depth_mm`, `Hc_mm`, `Hg_mm`) have direct equivalents, and every _calculated_
field's absence from the schema (`no`/η₀, `Vd`, `SPLmax`, `SPLmaxLF`, `Mpow`, `Mcost`, `Rme`,
`gamma`) is correct by design (`winisd_tools/DESIGN.md` §10a), not a gap.

**Open mechanical question, also owned here**: for a `manual`-origin entry, what happens to
`read_precision` and `actual_reading` — omitted (no printed form has a rounding half-width or a
source string to echo), or synthesized? Phase 1 needs an answer before `enter()`'s write shape is
locked. Carry it forward as a blocking question; do not invent an answer.

---

## Phase 0 — `OpenISDDriver` API surface (design, then lock)

Same job as today's `Driver` (`enter`/`clear`/`cell`/`errors`/`consistencyIssues`), adapted to
the nested shape:

```ts
class OpenISDDriver {
  constructor(record: OpenISDRecord); // driver_type pins which SpecSection is live

  enter(field: string, value: number | string): void;
  // Writes specs[driverType][field] = { origin: 'manual', readings: { manual: {
  //   actual_reading: String(value), read_value: <numeric>, read_precision: <TBD, see gap
  //   above> } }, dq: [] } — mirrors today's Driver.enter() "presence ⇒ E" rule, but here
  // "E" IS origin==='manual', not a separate flag (AD-8's per-field origin already models
  // human-vs-source provenance; there is no third mark to invent).

  clear(field: string): void;
  // Deletes specs[driverType][field] entirely — "removes it from storage again" (AD-8,
  // "Decision... resolved — the lifecycle of origin for a live edit").

  cell(field: string): FieldCell;
  // Present in specs[driverType] -> winningReading(entry).read_value, state 'E' (or 'C'/'N'
  // per origin==='manual' vs a source role) sourced from entry.origin, not a flag.
  // Absent -> deriveOpenISDFields(enteredBag)[field], state 'C' if resolvable else 'N'.

  errors(): DriverError[]; // deriveOpenISDFields(...).errors, unchanged authority
  consistencyIssues(): ConsistencyIssue[]; // checkConsistency(enteredBag), unchanged authority
  toRecord(): OpenISDRecord; // current state -> the record shape, for toYaml()
  static fromRecord(record: OpenISDRecord): OpenISDDriver;
  subscribe(listener): () => void; // same framework-free notify pattern as today's Driver
}
```

Decide before building: does "E" (provenance UI needs — the green/blue/black mark) map
1:1 to `origin === 'manual'` vs `origin !== 'manual'`, or does a non-manual `origin` (a real
datasheet source) ALSO count as "asserted/E" for provenance-display purposes (it should — a
manufacturer-datasheet reading is exactly as "entered, not calculated" as a manual one; only
absence from `specs[driverType]` entirely is C/N). Lock this before Phase 1's tests are
written — it is the field that used to be `Driver`'s binary E-vs-not-E and is now a
`SourceRole` with more than two values.

## Phase 1 — Build `OpenISDDriver` (TDD, red→green per `/test-driven-development`)

Per the locked API above. Write failing tests first for:

- `enter('Fs', 40)` on a record whose `specs.woofer` has no `Fs` → `cell('Fs')` is
  `{ value: 40, state: 'E' }`, and `record.specs.woofer.Fs.origin === 'manual'`.
- `clear('Fs')` after a manual entry → field absent from `specs.woofer` entirely (not merely
  blanked), `cell('Fs').state` reverts to `'C'` if `deriveOpenISDFields` can still resolve it,
  else `'N'`.
- A field present with `origin: 'manufacturer_datasheet'` (a real scraped record, not manually
  entered) reads as `state: 'E'` too — datasheet-asserted counts the same as manual for
  provenance display (per the Phase 0 decision above).
- Consistency-group staleness case (the actual QO13 scenario): `Qts` asserted from a datasheet,
  fresh `enter('Qes', ...)`/`enter('Qms', ...)` typed afterward → `checkConsistency` flags all
  three once they disagree beyond precision. **No auto-clear, no eviction** — this is where
  this session's wrong `DriverSession` attempt landed; the correct fix is `consistencyIssues()`
  surfacing the DQ mark, full stop (`ARCHITECTURE.md` §3 "Inconsistency is marked, not
  resolved", QP18 ruling).
- `toRecord()` / `fromRecord()` round-trip: entered + derived state survives unchanged.

**Gate:** new tests green; `docs/DRIVER_ADT_DESIGN.md` updated to describe `OpenISDDriver`
instead of (or alongside, marked superseded) today's `Driver`.

## Phase 2 — Build `WinISDDriver` (TDD)

Serializer only — no held state between calls, per AD-8's explicit constraint.

- **Export path:** `WinISDDriver.fromOpenISDDriver(d: OpenISDDriver): WinISDDriver`, then
  `.toWdr(): string`. Populate immediately before serializing, discard after. Write a
  round-trip-style test: known `OpenISDDriver` state → `.wdr` text → assert the exact fields
  and `ParState` characters expected (mirrors today's `Driver.toWdr()` test coverage, ported).
- **Import path:** `WinISDDriver.fromWdr(text): WinISDDriver` (parse only, no app logic) +
  a diff step: compare each `WinISDDriver` field against what `OpenISDDriver` would
  independently derive from the _asserted_ subset, and surface any mismatch as a DQ signal —
  **never silently overwrite** an existing `OpenISDDriver` field from an imported `.wdr`
  value that disagrees. Write the red test first: import a `.wdr` whose Qts contradicts its
  own Qes/Qms → assert a DQ mark appears, not a silent value change.

**Gate:** new tests green; existing `packages/winisd/test/classic/wdr.test.ts` /
`driver-roundtrip.test.ts` either migrate to target `WinISDDriver` or are confirmed still
correct against it (same on-disk format, different class producing/consuming it).

## Phase 3 — Migrate the 8 call sites off `Driver` onto `OpenISDDriver`

One composable/file at a time, TDD per site (existing test for that surface must go red
against the old wiring removed, green against the new):

- `logic/store.ts` — `_model`/`_whatIf`/`_baseline` hold `OpenISDDriver` instances instead of
  `Driver`. `getDriverModel()`, `driverCell`, `driverRaw`, `driverJSON`, `enterDriverField`/
  `clearDriverField` all re-point at the new class; **this session's whatif-never-commits
  and export/save/edit-auto-cancel work (already shipped, already tested) is unaffected** —
  it operates on "whichever driver-shaped thing `_whatIf`/`_model` hold," not on `Driver`'s
  identity, so it survives the swap unchanged.
- `ui/components/DriverEditorModal.vue` — `draftDriver` becomes an `OpenISDDriver`.
- `db/useDriverSelection.ts`, `db/useDriverLibrary.ts` — build `OpenISDDriver.fromRecord(...)`
  instead of `Driver.fromJSON`/`fromRaw`/`fromWdr`. A `.wdr` picked from the library goes
  through `WinISDDriver.fromWdr()` → diffed/imported into a fresh `OpenISDDriver`, per Phase 2.
- `logic/useDesignIO.ts` — export routes through `WinISDDriver.fromOpenISDDriver(...).toWdr()`;
  `.owdr`/project-JSON export routes through `toYaml(driver.toRecord())`.
- `logic/useDriverCells.ts`, `logic/wprMapping.ts`, `types.ts` — update type imports; no
  behavior change expected here (they consume `CellState`/`FieldCell`, which keep the same
  shape either class produces).

**Gate per site:** that site's own test file green; full `npx vitest run` + targeted Playwright
files (`whatif-auto-cancel-on-export.browser.spec.ts`, `sealed-fsc-winisd-golden.browser.spec.ts`,
`original-skin.browser.spec.ts`) still green after each site migrates — confirms nothing else
silently broke.

## Phase 4 — Persistence carries the native shape

`localStorage` (`openisd.state`) and the share link currently carry `driverJSON` = today's
`Driver.toJSON()` (`{inputs, carry?}`). Under `OpenISDDriver`, the natural persisted shape is
`toRecord()`'s `OpenISDRecord` — the same shape as `openisd.yml`/`.owdr`, so a saved project's
driver and a saved-to-disk `.owdr` are the same bytes (AD-8's own stated goal: "There is one
parse, not two").

**Gate:** existing persistence round-trip tests (`packages/ui/test/logic/persist.test.ts`)
extended/ported to the new shape; full health-check green.

## Phase 5 — Delete the obsolete code

- `packages/winisd/src/driver.ts` (today's `Driver` class) — deleted, per AD-8: "has no
  remaining architectural role once `OpenISDDriver` takes that job."
- `packages/winisd/src/driverSession.ts` if it still exists at this point — it doesn't; this
  session's `DriverSession` was reverted before this plan was written (see `LOG.md` /
  session notes: it implemented eviction/auto-clear, which contradicts the DQ-marking rule
  this plan's Phase 1 tests enforce instead).
- `docs/DRIVER_ADT_DESIGN.md` — either rewritten to describe `OpenISDDriver`, or marked
  explicitly superseded with a pointer to this plan, per the "no useless/stale text" rule.
- `STATE_MODEL.md`'s references to `Driver`/`DriverModel` — updated to `OpenISDDriver`.

**Gate:** full health-check green with the old code physically removed (not just unused).

---

## Non-goals

- No new UI features. Behavior visible to the user is unchanged, except where this fixes an
  existing provenance/DQ-surfacing gap (the class of bug this migration exists to close).
- Byte-identical `openisd.yml` write parity with the Python canonical serializer
  (`_KEY_PRIORITY`/`_FLOW_LIST_KEYS`) is `openisdYaml.ts`'s own already-flagged gap — real, but
  a separate, narrower fix, not blocking this plan.
- `SPL`'s missing engine-side equivalent (AD-8's "blocking gap") is a prerequisite for
  claiming "no data loss," not a blocker for Phase 0-3 to start — flagged, not silently
  deferred.
