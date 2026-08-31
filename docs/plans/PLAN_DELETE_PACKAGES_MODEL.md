# Plan — delete `packages/model`, move the UI onto design's Field/Cell API

**Governing ruling (John, 2026-08-31):** _"yes move to field/cell - remove all convenience
methods"_, and _"dont mangle the design and dont introduce new casts or other horrors"_.

**So `packages/design`'s driver grows nothing. The consumers move to it.**

---

## 1. Why

`packages/model` and `packages/design` are two models of one concept, mid-migration under the
standing order DUPLICATE → MIGRATE → DELETE (`packages/design/AGENTS.md`). Phase 3 has not run.

The engine work of 2026-08-30/31 removed `EngineDriver` and `deriveEngineDriver` from
`packages/design/engine`. `packages/model` imports both — `openisdProject.ts:39`,
`openisdDerive.ts:53` — so **`packages/model` does not currently compile**, and it is what the
shipped UI runs on. Finishing the migration is now the shortest path to a green tree, not a
deferred tidy-up.

## 2. The gap, measured 2026-08-31

```
methods called on a driver by ui/winisd/persistence : 258
packages/model's  OpenISDDriver provides            : 266
packages/design's OpenISDDriver provides            :  14
overlap                                             :   0
```

Zero overlap because the two express the same thing differently:

- **model** publishes a flat accessor quartet per field — `Fs()`, `FsCell()`, `enterFs()`,
  `clearFs()`.
- **design** publishes `DriverSpec` (`domain/project.ts:1234`), a class of **56 `Field<T>`
  members**, reached as `driver.spec[driver.section].Fs_hz`, each with:

```ts
interface FieldHandle<T> { get(): Cell<T>; set(v: T): void; clear(): void; }
interface Cell<T> { readonly value: T | null; readonly state: Provenance; }
```

**228 of the 258 calls are one mechanical substitution:**

| model call | count | design equivalent |
| --- | --- | --- |
| `driver.Fs()` | 52 | `spec.Fs_hz.get().value` |
| `driver.FsCell()` | 52 | `spec.Fs_hz.get()` |
| `driver.enterFs(v)` | 62 | `spec.Fs_hz.set(v)` |
| `driver.clearFs()` | 62 | `spec.Fs_hz.clear()` |
| everything else | 30 | §4 |

Meta is Field-shaped on the design side too — `manufacturer`, `providedBy` and the rest are
`Field<string>` built by `#buildMeta` (`project.ts:1432-1457`) — so `manufacturer()` /
`manufacturerCell()` / `enterManufacturer()` collapse the same way.

## 3. Order of work

**Step B (§4) comes before step A (§5).** A codemod run over a surface that is still moving is
wasted work.

1. Settle every disposition in §4. One decision each, no code.
2. Give the settled ones design-side homes. **Nothing lands on `OpenISDDriver` itself.**
3. Run the codemod (§5); typecheck; iterate.
4. Delete `packages/model`. Its tests move or die with it.
5. Finish the design test port (§7).

## 4. The 30 with no design equivalent — decisions needed

| model method | disposition |
| --- | --- |
| `errors()` | came from the deleted `deriveEngineDriver`. `sweep` now returns `Result<Curves>`; callers read its `errors`, which name the field a user can enter |
| `consistencyIssues()` | design has `checkConsistency()` — rename at the call sites |
| `toDriver()` | **deleted.** Callers pass `terminalFields()` + `Le_H()` straight to `sweep` |
| `ebp()` | resolve with `bugs/BUG_20260830_two_ebp_methods_disagree…` — `ebp()` and `EBP()` return different numbers on 42 of 209 corpus records. ONE accessor, through the cell |
| `toWdrText()` | `domain/openisdYamlToWdr.ts` exists design-side; wire the call sites to it |
| `toOwdrJson()`, `toOwdrYml()` | serialisation, not driver behaviour — needs a home that is not the driver |
| `standingEvidence()`, `sku()`, `description()`, `dataSourceUrl()`, `withDataSourceLinks()` | record identity/provenance; no design-side home yet |
| `mintFreshUuid()`, `previewField()` | editor mechanics; check the UI still needs them at all before porting |
| `added`/`addedCell`/`enterAdded`/`clearAdded` | confirm `#buildMeta` covers `added` |

**Also blocking deletion — model exports with no design home:**

- DQ vocabulary: `DqKind`, `DqMark`, `DqSeverity`, `DQStatus`, `QualityBlock`, `Rating`
- `DriverType`, `Chip`
- conformance/standing: `recordConforms`, `recordStandingIsOk`, `driverIsSimulatable`,
  `driverRecordProblems`
- project extras: `UiParams`, `CurvesBlock`, `OpenISDTarget`, `OpenISDListening`,
  `OpenISDSimOptions`, `ProjectFieldId`, `WinIsdBType`

Some of these (`SpecField`, `SpecSection`, `SpecEntry`) exist inside `domain/project.ts` but are
**deliberately unexported** — `domain/index.ts` says so. They are not gaps to fill by exporting;
the design copy hides them on purpose, and a consumer wanting one is a consumer doing something
the design says it should not.

## 4b. Construction and import — RULED: everything goes through `driverFromConformingRecord`

**John, 2026-08-31: _"ok use driverFromConformingRecord"_.**

`packages/model` has four entry points onto one operation — "text → record → driver" — and each
casts:

```ts
fromJsonRecord(record)  ->  new OpenISDDriver(record)                        // pass-through
fromOwdrJson(text)      ->  new OpenISDDriver(JSON.parse(text) as ...)       // NOT a file format
fromOwdrYml(text)       ->  fromJsonRecord(parse(text) as ...)               // the real .owdr
copy()                  ->  new OpenISDDriver(JSON.parse(JSON.stringify(r)) as ...)
```

`fromOwdrJson` is misnamed: its own first docstring line says it is **not** the `.owdr` format —
it is the record's own JSON, used for localStorage autosave and the share-link payload. That is a
choice of ENCODING, not a second data model, and it does not earn a second entry point.

All of them are replaced by the design seam, which already exists:

```ts
driverFromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[]
```

It validates metadata, requires a `woofer` or `tweeter` section, returns EVERY problem rather than
the first, and the union forces the caller to narrow. Its docstring holds the monopoly: _"Only
this function casts to the record type; no caller with an untrusted value casts itself."_

So each import path becomes **parse the text, hand the object to the seam**:

| was | becomes |
| --- | --- |
| `OpenISDDriver.fromOwdrJson(text)` | `driverFromConformingRecord(JSON.parse(text), engine)` |
| `OpenISDDriver.fromOwdrYml(text)` | `driverFromConformingRecord(parse(text), engine)` |
| `OpenISDDriver.fromJsonRecord(rec)` | `driverFromConformingRecord(rec, engine)` |
| `OpenISDDriver.fromWdrText(text)` | `packages/winisd` parses `.wdr` → record → the seam |
| `OpenISDProject.fromWprText(text)` | `packages/winisd` parses `.wpr` → record → the project seam |
| `OpenISDDriver.upgrade(blob)` | upgrade the blob, then the seam |
| `OpenISDDriver.fromFileText(text, fmt)` | dispatch on format in the UI, then one of the above |

**Every caller now handles `string[]`.** Today a corrupt autosave blob or a hand-edited share link
becomes a driver with nothing checked; after this it is rejected with a list of reasons a picker
can show. That is a behaviour improvement, and it is user-visible.

### The seam is a PAIR, because text is not `unknown` (John, 2026-08-31: _"isn't the shared link a string for instance"_)

`unknown` is the honest type only for a value that is ALREADY a parsed object of unverified
shape — the `drivers-bundle.json` import, a store row, a project's own driver slot. For a share
link, a localStorage blob, `.owdr` text or `.wdr` text the true boundary type is **`string`**;
`unknown` appears only because the parse was pushed out to the caller.

And pushing it out broke the seam's own contract. Measured:

| parse site | guarded? |
| --- | --- |
| `managedProject.ts:863`, `myDriverRepo.ts:129`, `projectRepo.ts:252,378,382` | yes — try/catch |
| `model/openisdDriver.ts:369` (`fromOwdrJson`) | **no — throws** |
| `model/openisdDriver.ts:377` (`fromOwdrYml`) | **no — throws** |

So a corrupt share link or a hand-edited `.owdr` raises an exception at exactly the boundary where
the seam promises _"returns problems rather than throwing"_. The contract holds for records and is
defeated for text — and text is the untrusted half.

**So design gets two seams, not one widened one:**

```ts
driverFromText(text: string, format: DriverFileFormat): OpenISDDriver | string[]
driverFromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[]
```

`driverFromText` parses INSIDE, in a `try`, and a parse failure becomes one more entry in the same
`string[]` before handing off to the record seam. That makes the boundary type exact, reports a
malformed file the same way as a malformed record, and collapses five scattered `try/catch` blocks
into one.

**Document the reasoning where an agent will meet it before narrowing the signature** — the
`unknown` rationale is currently in NO docstring, NO rule file and NO architecture doc (grepped
2026-08-31, zero hits). It belongs in `../_agent_files/rules/openisd-result-contract.md`, because
the failure mode is an agent "tidying" `unknown` to `OpenISDDriverJson`, which does not remove the
cast — it multiplies it by every call site.

**What still has no design-side home — a much shorter list than before:**

- a BLANK driver (`OpenISDDriver.empty()`) — the editor's seed for a hand-authored driver
- a BLANK project (`OpenISDProject.empty(driver)`)

Both are creation, not import, so the seam does not cover them. `newProject(driver, engine)`
exists design-side and covers the second half once a blank driver can be made.

## 5. The codemod — 228 call sites

One script, four rules, driven by `DriverSpec`'s own declared members read with **ts-morph**, so a
name it cannot resolve is a hard error and never a silent skip:

```
X()        -> spec.X_unit.get().value
XCell()    -> spec.X_unit.get()
enterX(v)  -> spec.X_unit.set(v)
clearX()   -> spec.X_unit.clear()
```

`spec` is `driver.spec[driver.section]`, bound once per component where several fields are read.

The record-name → unit-name mapping already exists: `recordName()` in `domain/project.ts`, a
`switch` with an exhaustiveness check that fails naming the field.

**Files:** 25 in `packages/ui`, 8 in `packages/winisd`, 5 in `packages/persistence`.

## 6. Constraints — non-negotiable

- **No new casts.** `packages/design/test/architecture-no-casts.test.ts` reports 102 casts and 3
  double casts today, all pre-existing. This work adds none. A `Cell`'s `value` is `T | null`:
  callers **narrow**, never assert. `.value!` is the failure mode to watch for in a codemod.
- **Design grows no convenience methods.**
- **`packages/design/AGENTS.md` still applies** — nothing changes there without explicit approval.
- **Provenance must survive.** A `Cell` carries `state: Provenance`; a careless
  `X()` → `.get().value` rewrite drops it. The driver editor shows Entered vs Calculated, so this
  is user-visible.

## 7. Verification

- `npx tsc --noEmit` clean for `design`, `ui`, `winisd`, `persistence` — with `packages/model`
  **deleted**, not merely unreferenced.
- `npx vitest run packages/design` green. 111 tests are currently red from the engine work,
  chiefly `driver.test.ts` and `hardening.test.ts`, which assert the OLD refusal contract
  (`Fs Re Sd Vas Qts Qes Qms`) rather than the current one (`Re Sd Cms Mms Rms BL`).
- `npx vitest run packages/design/test/engine/golden.test.ts` — 12 pass, byte-identical.
- `npx vite-node build/solver-diff.ts` — 0 differences over 1893 drivers.
- `npx playwright test` green.
- `bash scripts/health-check.sh` before any "done" claim.
- **On port 4000:** a driver-editor field still shows its Entered/Calculated state.

## 8. Engine work already landed (2026-08-30/31)

- **Classic solver branch deleted** — a second implementation of the same physics with a wrong
  guard (`Rms` gated on `Vas`, which its formula does not contain), no finiteness check, and one
  pass instead of a fixpoint. 461 of 1893 drivers computed a different `Cms` on it; worst
  **Dayton Audio PCS115-4**, out by a factor of 28.
- **`EngineQuantities`** — 37 optional `name_unit` fields, definitions from
  `docs/FIELD_REFERENCE.md`, `static NAMES` with a completeness proof made to fail on purpose in
  both directions. The solver destructures all 37 by name; order-independence proven by reversing
  twelve names in the pattern and re-solving all 1893 drivers to 0 differences.
- **`EngineDriver`, `deriveEngineDriver`, `toEngineDriver` deleted.** `sweep`/`maxCurves` return
  `Result<…>`, and a refused driver is told **which stated field would unblock it** — computed by
  asking the real solver, so the message cannot disagree with the engine.
- **`alignments.ts` → `boxDesign.ts`** — 1 of its 8 exports was an alignment.
- **12 goldens pass**: the physics did not move.
