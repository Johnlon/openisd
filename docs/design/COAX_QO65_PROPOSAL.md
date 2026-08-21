# QO65 — `OpenISDDriver` locks to one spec section; a coaxial driver's tweeter data is unreachable

## Evidence

`packages/model/src/openisdDriver.ts:279-284`:
```ts
function sectionFor(record: _OpenISDDriverJson): 'woofer' | 'tweeter' | 'passive_radiator' {
  const t = record.driver_type?.value;
  if (t === 'tweeter') return 'tweeter';
  if (t === 'passive-radiator' || t === 'passive_radiator') return 'passive_radiator';
  return 'woofer';   // 'coaxial' falls through to here
}
```
`#section` is set once in the private constructor (`openisdDriver.ts:303-306`) and never revisited.
Every field access goes through it: `#specs()` (`openisdDriver.ts:499-504`) reads/creates only
`this.#record.specs[this.#section]`, and `cell()`, `enter()`, `clear()`, `#stated()`, `dqMarks()`
all call `#specs()`/`#entry()` — none of them can reach a different section of the same record.

`_Specs` (`packages/model/src/openisdDriver.ts:234-238`) already carries all three sections
side by side:
```ts
export interface _Specs {
  woofer?: _SpecSection;
  tweeter?: _SpecSection;
  passive_radiator?: _SpecSection;
}
```

**A real record with both sections populated**: `winisd_drivers/db/datasheets/dayton-audio/cx120-8/openisd.yml`
(`driver_type.value: coaxial`, line 48). It carries a full `woofer` section (Fs=87.5, Re=6.22,
Le=0.00063, Znom=8.0, Qts=0.48, Qes=0.57, Qms=2.89, Vas=0.003, …) AND a full `tweeter` section
(Fs=2745, Re=5.6, Le=4.0e-05, Znom=8.0, Qts=1.72, Qes=7.91, …), the latter carrying its own DQ
mark (`dq_status: UNMATCHED`, a `range-above-max` error on Qes=7.91 against limit 5.0).

This is not an edge case invented for this investigation. Of the 36 `driver_type: coaxial`
records under `winisd_drivers/db/datasheets` (measured: `grep -rl "value: coaxial" ... | wc -l`),
15 carry a populated `tweeter` section alongside `woofer` (measured by grepping each record's
top-level `specs:` child keys) — e.g. also every `dayton-audio` coax model. The remaining 21 are
woofer-only because the datasheet itself never published HF specs (`quality.issue:
coax:hf-specs-not-published` on e.g. `tang-band/w6-2313/openisd.yml`), which is a data-source gap,
not a model limitation.

`drivers/sources.json:8` wires `winisd_drivers/db/datasheets` in as the app's bundled driver
catalogue (`"winisd-drivers": { "path": "../winisd_drivers/db/datasheets", ... }`), so
`cx120-8` and the other 14 dual-section coax records are real, user-reachable catalogue entries,
not synthetic test fixtures.

No test in `packages/model/test`, `packages/ui/test`, or `packages/winisd/test` references
`sectionFor`, `#section`, or `driver_type: coaxial` (verified: grep for all three across those
three test trees returns nothing). Coax is entirely untested today.

There is a prior bug record on this exact defect —
`bugs/BUG_20260818_coaxial_driver_type_still_locks_openisddriver_to_the_woofer_section_only.md` —
carrying a human ruling dated 2026-08-21: *"Coax out of scope atm but add this as an open item in
openisd and mark it as human deferred until big refactoring complete."* That bug file cites the
ledger id as QO62; the ledger's current QO62 is a different, unrelated question (`.wdr`/`.wpr`
CP1252 fallback). Per commit `7a2fb00` ("ledger ids repaired (coax=QO65, wizard=QO64)"), QO65 is
the id now assigned to this topic — the bug file's QO62 citation is stale, but the ruling text
itself is dated the same day this ledger entry was raised and is about this exact defect. QO65's
own ledger body is empty; the ruling exists only in the bug file. **This proposal treats that
ruling as still standing and asks the human to reconfirm or override it, not as a fresh, unopened
question.**

## (a) What breaks today, concretely

- **Read**: `OpenISDDriver.fromJsonRecord(cx120-8-record)` constructs with `#section = 'woofer'`
  (the `sectionFor` fallthrough). `record.specs.tweeter` still exists in `#record` (untouched),
  so nothing is destroyed on load — but every reading of it through the class is dead code from
  here down.
- **Display**: `cell(field: SpecField)` (`openisdDriver.ts:549-557`) only ever indexes
  `#specs()`, i.e. the woofer section. There is no code path in `DriverEditorModal.vue`
  (grepped: no `section`/`coaxial`/`driver_type` handling in that file beyond an unrelated CSS
  class and an inert diagram caption) that could show the tweeter's Fs=2745/Re=5.6/etc. even if
  `cell()` could reach it — no section-switcher UI exists.
- **DQ marks**: `dqMarks()` (`openisdDriver.ts:671-692`) iterates `this.#specs()` only. The
  tweeter section's own `range-above-max` DQ error on Qes=7.91 (present in the raw record) never
  reaches `dqMarks()`'s output, so the quality-rating UI never surfaces a real, sourced data
  quality warning that the record carries.
- **Engine solve / consistency**: `#stated()` (`openisdDriver.ts:511-521`) flattens only the
  woofer section for `deriveOpenISDFields`/`checkConsistency`. The tweeter's own T/S set is
  never solved or consistency-checked as its own driver.
- **`.wdr` export**: `toWinISDDriver()` (`openisdDriver.ts:370-431`) builds `INI_ROWS` cells
  from `cell()`, so only woofer values are written. This matches classic WinISD's own `.wdr`
  format, which has exactly one T/S slot per file — a `.wdr` genuinely cannot hold two sections,
  so this is not a *new* loss on export; the loss already happened at the `cell()` boundary,
  before export is reached.
- **`.owdr` round-trip**: `toJsonRecord()` (`openisdDriver.ts:356`) returns `this.#record`
  directly, and nothing in the class mutates `specs.tweeter` when `#section` is `'woofer'`, so a
  load→save cycle through `OpenISDDriver` does NOT delete the tweeter section from the JSON —
  data survives at the storage layer. The defect is that the class's entire read/write/validate
  API (`cell`, `enter`, `clear`, `dqMarks`, `#stated`, `consistencyIssues`) is blind to it, not
  that the bytes are lost.

## (b) Minimal model change (one-shape constraint)

`OpenISDDriver` must stay ONE class, one shape — no `OpenISDCoaxDriver` subtype, no
`sectionFor()` v2 that special-cases `'coaxial'` into a still-single section (that would keep the
exact defect, just silence the fallthrough). The record shape (`_Specs` with three optional
sections) is already correct and needs no change — the defect is entirely in the class's
single-`#section` access pattern over a shape that was never single-section.

The behavioural requirement, stated precisely: a driver whose `specs` has more than one populated
section must expose ALL of them through the same, single API surface `cell()`/`enter()`/`clear()`/
`dqMarks()` already define — not a second envelope, not a second method family. Concretely:

- Every `SpecField`-taking method (`cell`, `enter`, `clear`) gains a `section` parameter
  (`'woofer' | 'tweeter' | 'passive_radiator'`), defaulting to `this.section` (today's single
  resolved section) so every existing non-coax call site is unchanged.
- `sections()` (or equivalent) replaces the single `section` getter with the set of sections the
  record actually has populated data or a `driver_type` claim for — a coax record answers
  `['woofer', 'tweeter']`, a plain woofer answers `['woofer']`. This is a genuine generalisation
  of `sectionFor()`, not a second parallel function: today's single-section case becomes the
  one-element-set case, computed from the same rule.
- `dqMarks()` and `#stated()`/`consistencyIssues()`/`toDriver()` iterate every populated section,
  not `#specs()` alone — each section is checked and solved independently (a tweeter is its own
  driver physically; nothing about Qes=7.91 on the tweeter should influence the woofer's solve).
- `toWinISDDriver()` stays woofer-only by construction — `.wdr` has one T/S slot and that
  constraint is the file format's, not the model's. Which section feeds a `.wdr` export becomes
  an explicit, named choice (default: `'woofer'`) rather than an accidental one baked into
  `#section`.

This is a real, non-trivial API change to a class ~15 call sites already depend on (see blast
radius below) — not a one-line branch add. It is the shape of fix the existing bug file already
concluded was necessary (*"the class's whole field-access surface... assumes one section"*).

## (c) Blast radius

- `packages/model/src/openisdDriver.ts` — `sectionFor`/`#section`/`#specs`/`cell`/`enter`/
  `clear`/`dqMarks`/`#stated`/`consistencyIssues`/`toDriver`/`toWinISDDriver` all touch the
  single-section assumption directly.
- `packages/model/test/*` — every existing `OpenISDDriver` unit test that calls `cell()`/
  `enter()`/`clear()` without a section argument must keep passing unmodified (the default-arg
  design above is chosen specifically to keep this set at zero required edits); new tests are
  needed for the coax dual-section case (none exist today — verified above).
- `packages/ui/src/ui/components/DriverEditorModal.vue` — has NO section-switching affordance
  today (verified above). Making the tweeter section actually usable, not just reachable through
  the model API, requires new UI: a section tab/toggle, plus wiring every field row to the
  selected section. This is real UI scope, not covered by the model change alone.
- `packages/ui/src/driverType.ts` — no change needed; `DriverType.Coaxial` is already a distinct,
  correctly-labelled enum member (`driverType.ts:78`) used only for catalogue chips/labels.
- Catalogue/browse/filter code — not investigated as part of this task beyond confirming
  `drivers/sources.json` wires in the 36 coax records; a full audit of every consumer that reads
  `driver.section`/`cell()` across the UI package is out of scope for this proposal and should be
  done at implementation time.
- `packages/winisd/*` — no change; `.wdr`'s one-T/S-slot format is unaffected, `toWinISDDriver()`
  keeps exporting the (explicitly chosen) woofer section only.

## (d) Scope recommendation: DEFER, not release-blocking

Reasoning:

1. **No data is destroyed today.** The tweeter section survives every load/save cycle at the
   storage layer (`toJsonRecord()` returns the untouched record) — the defect is inaccessibility
   through the app's read/edit/validate surface, not silent corruption. A release today ships a
   coax driver that displays and edits correctly for its LF section and simply cannot show or
   validate its HF section — a real functional gap, not a data-loss bug.
2. **The fix is not scoped to the model alone.** Even a correct `OpenISDDriver` API change earns
   the user nothing without the `DriverEditorModal.vue` section-switcher UI, which does not exist
   and was not scoped by this investigation. Shipping the model half without the UI half would
   leave `cell(field, 'tweeter')` correct and completely unreachable by any user action — a
   half-fix that adds surface area (a new parameter, a new test burden) for zero user-visible
   benefit.
3. **A standing human ruling already exists** (bug file `BUG_20260818_...`, 2026-08-21):
   defer until the larger refactoring in flight (the bug file references WinISDDriver-
   construction/QO55/QO60-service-layer work) lands, rather than bolt a section-parameter change
   onto the class mid-refactor.
4. **Prevalence is real but bounded.** 15 of 1626+ bundled records (dayton-audio's full coax
   line plus others) carry a populated tweeter section a user cannot currently see or edit — this
   is a known, named gap affecting a specific, enumerable driver set, not a crash or a data
   integrity risk, and is reasonable to document as a known limitation for this release.

**Recommendation: DEFER.** Keep QO65 open and human-deferred, matching the existing bug-file
ruling; do not block release on it. Record as a known limitation: coaxial drivers with a
published HF section display and export their woofer/LF section correctly; the HF section's data
is preserved on disk but not currently viewable, editable, or DQ-checked in the app.
