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
| `toWdrText()` | superseded by §4d — `toOpenIsdYml()`/`toWdrIni()` on `domain/openisdYamlToWdr.ts` |
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

## 4b. Construction and import — RULED: everything goes through `conformingRecordToDriver`

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

**So design gets three seams, not one combined one (John, 2026-08-31: _"in the call site why
don't we know which kind of file it is expected to be?"_ — checked, and it does):**

```ts
driverFromWdrIni(text: string): OpenISDDriver | string[]
driverFromOpenIsdYml(text: string): OpenISDDriver | string[]
driverFromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[]
```

**All three are free functions in `domain/project.ts`, not statics on a class** —
`conformingRecordToDriver` already lives there (`:1759`, alongside `conformingRecordToPassiveRadiator`
at `:1782`), and the two new ones join it. Neither `OpenISDDriver.fromWdrIni()` nor any other
class-static form exists in this design — unlike `packages/model`'s old `OpenISDDriver.fromX()`
statics and `packages/winisd`'s `WinISDDriver.fromWdrIni()`/`WinISDProject.fromWprIni()` (both
untouched, WinISD-format code, statics on their own classes, no part of this migration).

**No combined `driverFromWdrIniOrOpenIsdYml(text, format)`.** Verified against the two real
call sites that classify a file before reading it — `driverBrowsingState.ts:392-398` and
`useDesignIO.ts:181-198` — both already run `DriverFileFormat.ofFileName(file.name) ??
sniff(bytes)` and branch on the result BEFORE calling anything. `useDesignIO.ts` already calls
two separate format-specific methods from that branch (`loadDriverFromWdrText` /
`loadDriverFromOwdrText` today). Only the old `OpenISDDriver.fromFileText(text, format)` /
`driverFromFileText(text, format, fileName)` pointlessly undo that: the caller turns its
already-known format into a `'wdr' | 'owdr'` string, hands it to a "combined" function, which
re-branches on the string to reach the real single-format code — two dispatches to do one job.
A `format` parameter passed in by a caller that already knows the answer is not a reason for a
combined name; it is evidence the combination is unnecessary. Each call site keeps its own
`if (format === DriverFileFormat.Wdr) { ... } else { ... }` (it already has one) and calls
`driverFromWdrIni`/`driverFromOpenIsdYml` directly from each branch — matching the pattern
`useDesignIO.ts` already uses, not the one `driverFromFileText` uses.

The persisted/share-link JSON blob is `loadDriverFromPersistedJson` (§4c), a separate function
outside these two formats.

Each of `driverFromWdrIni`/`driverFromOpenIsdYml` parses INSIDE, in a `try`, and a parse failure
becomes one more entry in the same `string[]` before handing off to the record seam. That makes
the boundary type exact, reports a malformed file the same way as a malformed record, and
collapses five scattered `try/catch` blocks into two (one per format, not one per call site).

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

## 4c. `ManagedProject` is DELETED, not ported (John, 2026-08-31)

**John:** *"managedProject in logic is defunct ... its useless now that the OpenISDProject itself
manages layer state"*. Verified: `domain/project.ts:1857-1861` —

```ts
#saved: OpenISDProjectJson;
#edited: OpenISDProjectJson | null = null;   // null until the first write
```

with `#current()` answering `#edited ?? #saved`, `#mutable()` copying on first write, and
modified-ness answered by the presence of `#edited`. Save, Cancel and the modified flag are the
domain's.

`packages/ui/src/logic/managedProject.ts` is **980 lines** implementing the same two-layer scheme
in the UI. It is the single largest thing the migration removes, and it is a DELETION rather than
a port — every consumer moves to the project itself.

Its consumers: `logic/appState.ts`, `logic/useVentGroup.ts`, `logic/usePrGroup.ts`,
`logic/presentationState.ts`, `ui/shells/original/OriginalShell.vue`, plus five tests.

Two things it does that the domain does NOT, and which therefore need homes before it goes:

- **the driver-editor seam** — `committedDriverText()`/`persistedDriverText()`, which serialise the
  driver so `DriverEditorModal` can re-parse it into a draft. Design has `driver.detach()`, which
  gives a detached copy with no text round trip and no model import; that is the replacement.
- **file adoption** — no ported/renamed wrapper (John, 2026-08-31: _"get rid of the useless
  wrapper"_). Today's `loadDriverFromWdrText`/`loadDriverFromOwdrText`/`loadDriverFromPersistedText`
  (`managedProject.ts:841,849,861`) are each exactly `const driver = fromX(text);
  this.mutate(p => p.setDriver(driver))` — a name that adds nothing once §4b's
  `driverFromWdrIni`/`driverFromOpenIsdYml` already parse AND validate, and once the persisted-JSON
  case is just `driverFromConformingRecord(JSON.parse(text), engine)` (same substitution as the
  `fromOwdrJson` row in §4b's own table — no third wrapper needed for it either). Since
  `ManagedProject` itself is deleted, not ported, there is no object left to hang a one-line
  wrapper method on. Each caller (`driverBrowsingState.ts:398`, `useDesignIO.ts:184,198,204`)
  calls the seam function directly and sets the result on the project itself:
  `project.setDriver(driverFromWdrIni(text))` (or the `string[]`-checking
  equivalent for the two that can fail), inline, no intermediate method.

## 4d. The WDR export pipeline — see `drivers/drivers.md`, not this section

**Consolidated 2026-08-31.** This section used to duplicate a design that already exists,
approved, at `drivers/drivers.md` (John, 2026-08-30) — `OpenISDDeviceJson`, the
`driverYmlToOpenisdAndWdr(driverYmlText) → { openisd, wdr, errors }` bridge, and the
`dq_scraper`/`dq_calculated` split. Verified 2026-08-31 that nothing has drifted: `OpenISDDeviceJson`
(`domain/project.ts:345`) and `SpecEntryJson`/`ScrapedFieldJson`'s paired `dq_scraper?`/
`dq_calculated?` (`:125-142`, PER SPEC ENTRY, not a top-level record field — an earlier draft of
this section wrongly placed `dq_calculated` after the top-level `quality` key) are already live
code, matching `drivers.md` Part A. Only `drivers.md`'s Part C bridge function itself is still
unbuilt — confirmed by grep, zero hits for `driverYmlToOpenisdAndWdr` anywhere in the tree.

The one addition this section's drafting produced that `drivers.md` didn't already have — round-tripping
against the TRUE ORIGINAL `driver.yml` object rather than an intermediate, with an absent key
throwing and a changed key joining `errors[]` — is now folded into `drivers.md` Part C step 6
directly. Read it there.

This supersedes the WDR-only contract in §4b: `driverFromWdrIni`/`driverFromOpenIsdYml`/
`conformingRecordToDriver` stay the UI's file-import record-shape boundary — a separate
pipeline from `drivers.md`'s corpus-generation bridge, not the same one under a different name.
`packages/winisd/src/bridge.ts`'s JSON envelope and docstring need updating to carry `openisd`
alongside `wdr` once `drivers.md` Part C lands — its current contract (`{ wdr, errors }`)
predates that design.

## 4d-bis. ⛔ `drivers.md` Part C cannot live in `packages/design` — dependency cycle

**Found 2026-08-31 while building Part C, TDD red in place
(`packages/design/test/driverYmlToOpenisdAndWdr.test.ts`, 5 tests failing on "not a function").**

`drivers.md` Part C says _"Files: the entry in `packages/design`, exposed through
`packages/winisd/src/bridge.ts`"_. That is not implementable as written:

| fact | evidence |
| --- | --- |
| `packages/winisd` depends on `@openisd/design` | `packages/winisd/package.json:17` |
| `packages/design` declares NO dependencies, and imports nothing from winisd | its `package.json`; grep finds zero live `@openisd/winisd` imports in `packages/design` |
| the `.wdr` transformer lives in winisd | `WinISDDriver`, `packages/winisd/src/winisdDriver.ts` |

So an entry point in `packages/design` that builds `.wdr` text must import `WinISDDriver` from
`@openisd/winisd`, and **design → winisd → design is a cycle**. The commented-out
`packages/design/domain/openisdYamlToWdr.ts:102` is literally `import { INI_ROWS } from
'@openisd/winisd'` — uncommenting that file as-is creates the cycle.

**Corroborating evidence that this was already hit once:** `packages/design/winisd/iniRows.ts`
exists (created 2026-08-29), a second copy of `INI_ROWS` inside design, and **nothing imports
it** — an orphaned start on duplicating the key list to dodge this exact cycle.

**RULED (John, 2026-08-31, QO103): _"opt 1"_ — the entry lives in `packages/winisd`.**

It already depends on design, so there is no cycle; `bridge.ts` — the V8 door — is already there;
and it needs NO change to `packages/design`, keeping that package's zero-dependency state.
`drivers.md` Part C is corrected to match.

Rejected: moving `WinISDDriver`/`INI_ROWS` into design (a package-boundary change that would cost
a second `INI_ROWS` list with nothing checking the two agree), and splitting the job across both
packages.

**Still open, deliberately NOT folded into that ruling:** the dead
`packages/design/winisd/iniRows.ts` — a 48-key verbatim duplicate of `winisdDriver.ts:69`,
imported by nothing, verified independently by two sessions. Deleting it is itself a change to
`packages/design` and needs its own approval.

## 4e. The bundler self-check (QO102) — BLOCKED on one file, and on one ruling

**What John asked for (2026-08-31):** _"bundler shoud emit bundle then try loading the entire
bundle using same code path app uses and then compare the two sets"_, and earlier _"the bundle
shoud get checked during bundling, and the startup should implicetely check it"_.

**Why it cannot run today.** `scripts/bundle-drivers.mjs:43` imports `./roundTripGate.mjs`, whose
line 20 is `import { OpenISDDriver } from '@openisd/model'` — a module that now exports nothing.
The bundler therefore cannot start at all. The same dead import sits in
`packages/persistence/src/repos/driverRepo.ts` lines 3 and 7 (`OpenISDDriver`, then
`DriverType, Chip`), which is the app's own load path — so "reload through the code path the app
uses" has no working path to reload through. (A pre-existing TS7006 at `driverRepo.ts:219`,
param `c` implicitly `any`, is downstream of the dead `Chip` import and clears with it.)

**Everything `bundledEntry()` calls on a driver** — `driverRepo.ts:579-608`, read 2026-08-31:

```
OpenISDDriver.fromJsonRecord(record)
driver.Fs()  driver.Sd()  driver.Re()  driver.Znom()  driver.Pe()
driver.added()
driver.dataSourceUrl('manufacturer_datasheet' | 'manufacturer_product_page' | 'distributor_product_page')
```

plus `myDriverName(driver)` and `classifyTypes(driver.Fs(), driver.Sd(), …)` in the same file.

### ⛔ The blocking ruling — do NOT resolve this by re-adding accessors

**Design has none of `Fs()`, `Sd()`, `Re()`, `Znom()`, `Pe()`, `dataSourceUrl()`** — verified by
grep 2026-08-31, zero hits in `domain/project.ts`. They are absent **because John removed them**
(2026-08-31: _"and why are there accessors on OpenISDDriver"_, then _"kill them all"_). `added` is
a `Field<string>` on `OpenISDDevice`, not the `added()` method `driverRepo` calls. There is no
`DriverType`/`Chip` design-side either.

So the obvious repair — put the accessors back so `driverRepo` compiles — **silently reverses a
decision John made the same day**, and `packages/design/AGENTS.md` makes adding any API there his
call regardless. The likely shape is `driverRepo` reading through `fields()`/`spec.woofer` rather
than accessors returning, but that is a ruling, not an inference. **PROPOSE AND STOP.**

### The strictness change this introduces, which must not arrive as a surprise

The model path built bundled rows with **no conformance check at all** — `driverRepo.ts:84-88`
states it outright: _"bundled drivers ship inside this build's own dist and are always current, so
no conformance check runs against them"_. `conformingRecordToDriver` validates every record. So
reloading the bundle through design is a **stronger gate than the app has ever had**, and it
should be expected to reject records the old path accepted silently. That is the gate working, not
a regression — but it lands during a build, so it needs saying in advance.

### Already landed (`api-design`, uncommitted; verified 2026-08-31, do not rebuild)

- `readBundle(json)` — `driverRepo.ts:126`, returning `{bundle}` or `{problems: string[]}`, with
  `BundleRecord.record` typed `unknown` so no member goes unchecked. `DriverBundle` at `:103`.
- Both exported from `packages/persistence/src/index.ts:14`.
- `DriverRepoDeps.bundle` is now `DriverBundle`, so the check is the only way to obtain one.
- `packages/ui/src/main.ts` calls `readBundle` instead of casting; the `main.ts:30` cast is gone.

**So the "check during bundling" half is one line** once the load path is alive: import
`readBundle` from `@openisd/persistence` in `bundle-drivers.mjs` (it runs under vite-node, so TS
imports resolve) and refuse to write when it returns problems. **The emit/reload/compare half is
what needs the migrated `driverRepo`** — and therefore the accessor ruling above.

**Ownership:** `driverRepo.ts` is `api-design`'s working file right now. These edits are theirs to
make once John rules, not this session's.

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
