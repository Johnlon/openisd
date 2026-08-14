# OpenISD target migration plan

**The goal, verbatim (human, 2026-08-13):** _"complete the impmt to make openisd the base model for
the app and sideline winisd into the serialisation to file according to the findings and the
plan"_.

[`ARCHITECTURE.md`](../../ARCHITECTURE.md) specifies the system. This plan is the ordered set of
changes that makes the code match it. Where this plan and `ARCHITECTURE.md` disagree,
`ARCHITECTURE.md` is correct.

Every step below states **what changes · the proof · what it unblocks**. A step whose input is
unknown is a step to DETERMINE that input, not a caveat on another step.

---

## Where the code is, measured 2026-08-13

Every number here came from a command run on this tree today.

| Fact                      | Measurement                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OpenISDDriver` exists    | `packages/winisd/src/native/openisdDriver.ts`, 199 lines. `fromRecord`, `toRecord`, `section`, `cell`, `enter`, `clear`, `errors`, `subscribe`                                                                                                                                                                                                 |
| Its tests                 | `packages/winisd/test/native/openisdDriver.test.ts` — **4 tests, all pass** (`npx vitest run`, 2026-08-13)                                                                                                                                                                                                                                     |
| It is not reachable       | **Not exported** from `packages/winisd/src/index.ts` — the barrel lists 8 modules and `native/openisdDriver.js` is not one                                                                                                                                                                                                                     |
| `@openisd/model`          | **Does not exist.** `packages/model/` is absent; `native/` sits inside `packages/winisd/src/`                                                                                                                                                                                                                                                  |
| The old `Driver` class    | `packages/winisd/src/driver.ts`, 469 lines. **3 value-import sites in `packages/ui/src`** — `logic/store.ts:5`, `logic/driverSelection.ts:1`, `ui/components/DriverEditorModal.vue:8` — and **34 `DriverModel.`/`DriverModel(` call sites** under `packages/ui/src`                                                                            |
| Tests pinned to it        | **11 test files / 71 `it()`** import `Driver` — 9 in `packages/winisd/test` (driver-class 10, driver-derive 9, winisd-parity 9, driver-projection 8, wdr-carried-keys 6, driver-json 5, driver-roundtrip 5, driver-hardening 4, roundtrip 3) and 2 outside it (`ui/test/ui/driver-editor-units.test.ts` 12, `ui/test/logic/persist.test.ts` 9) |
| `DriverRaw`               | `packages/engine/src/types.ts:43-102`. **104 referencing lines across 23 files** — 13 under `packages/*/src`, 10 under `packages/*/test`                                                                                                                                                                                                       |
| Engine `Driver` interface | `packages/engine/src/types.ts:110-122`, `extends DriverRaw`. **26 type-annotation sites**                                                                                                                                                                                                                                                      |
| `DriverJSON`              | **37 referencing lines across 9 files** — `ui/src/{types.ts,db/driverRepo.ts,logic/{store,persist,driverSelection,useDesignIO,projectFile}.ts,logic/model/OpenISDProject.ts}` plus `winisd/src/driver.ts`                                                                                                                                      |
| Architecture gate         | `packages/ui/test/ui/architecture.test.ts` — **3 failed, 5 passed of 8**, **29 offences**                                                                                                                                                                                                                                                      |
| Parity suite              | `packages/winisd/test/winisd-parity.test.ts` exists and is committed — **341 failed, 122 passed of 463**. 7 goldens under `test/fixtures/winisd-parity/goldens/`                                                                                                                                                                               |
| Composition root          | **Does not exist.** `packages/ui/src/main.ts` is 14 lines: `createApp(App).directive(…).mount('#app')`. It constructs no service and injects nothing                                                                                                                                                                                           |
| Skins                     | **One UI.** `packages/ui/src/ui/shells/` contains only `original/`; `packages/ui/src/ui/skins.ts` does not exist                                                                                                                                                                                                                               |
| Working tree              | **Mid-refactor and broken.** `db/useDriverLibrary.ts` and `db/useDriverSelection.ts` are deleted; their replacements are `logic/driverLibrary.ts` and `logic/driverSelection.ts` (untracked). **5 import specifiers in 3 `.vue` files still name the deleted modules**                                                                         |

### The 29 architecture-gate offences, by assertion

| Assertion                                                        | Result   | Offences                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a service never imports the application state or the logic layer | **PASS** | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| a service never imports a sibling service                        | **PASS** | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| the presentation layer depends on logic and nothing below it     | **FAIL** | **21**, across 11 `.vue` files: `App.vue`→`diagnostics/selftest`; `DriverBrowserWinisd.vue`→`db/useDriverLibrary`×2, `db/useDriverSelection`; `DriverEditorModal.vue`→`db/useDriverSelection`, `@openisd/engine`, `@openisd/winisd`, `db/myDrivers`, `logging/flash`; `Flash.vue`→`logging/flash`; `OptionsModal.vue`→`@openisd/engine`; `PRBrowser.vue`→`db/prLibrary`; `PRDefineModal.vue`→`@openisd/engine`; `PREditModal.vue`→`@openisd/engine`, `db/prLibrary`; `OgFilters.vue`, `OgNewProject.vue`, `OgTune.vue`→`@openisd/engine`; `OriginalShell.vue`→`@openisd/engine`×2, `db/useDriverSelection` |
| a component imports no value from the domain                     | **FAIL** | **7**, across 6 files: `DriverEditorModal.vue`(engine, winisd), `OptionsModal.vue`, `PRDefineModal.vue`, `PREditModal.vue`, `OgTune.vue`, `OriginalShell.vue`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| logic and the services hold no view components                   | **PASS** | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| a service exports no mutable module-level binding                | **PASS** | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| a service exports no pre-built instance                          | **PASS** | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| every service module offers a `create*()` factory                | **FAIL** | **1** — `diagnostics/selftest.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Rulings this plan implements

| Ledger  | Ruling                                                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QO36 B3 | A manually entered field carries the value and `origin: manual`. `read_precision` and `actual_reading` are OMITTED, not synthesised. One reading shape, those two absent                                                           |
| QO36 B4 | Any real reading displays as `E`; only a solver result is `C`. `E` means STATED, not typed-by-this-user                                                                                                                            |
| QO38    | `ui → logic → services → domain`. `ui` depends on `logic` and nothing else. A service never reads or writes the app's state. The layering fix and the model swap touch the same files, so they run as one pass, not two            |
| QO39    | Xmax row 19 `abs(Hc−Hg)/2` WINS; `Vd/Sd` is the fallback. The branch order at `packages/engine/src/driver.ts:151`/`:160` is already right. **One divergence:** when `Hc === Hg`, row 19 must decline so `Vd/Sd` supplies the value |

---

## Why the steps run in this order

Two strands, and they collide in three files.

**Strand A — the model.** The OpenISD record becomes the app's driver model; WinISD becomes
serialisation only.

**Strand B — the layering.** `ui → logic → services → domain`, a real composition root, injected
dependencies, no module-level singletons.

**The collision.** `logic/store.ts`, `logic/driverSelection.ts` and
`ui/components/DriverEditorModal.vue` are the files that both hold the old `Driver` and violate the
layering. Doing A then B rewrites them twice. **Steps 10 and 11 do both strands in one pass on
those files**, which is why the pure-layering work that touches no driver code (Step 9) runs first
and the pure-model work that touches no view (Steps 2–8) runs before that.

**The oracle comes first.** Steps 3–5 fix the engine's one known numerical divergence and turn the
parity suite green _before_ any call site moves. Refactoring the whole driver layer with a red
oracle means no regression net for the numbers.

---

## The steps

### Step 1 — Land the in-flight layering move

**Changes.** Repoint the 5 dangling import specifiers in `ui/components/DriverBrowserWinisd.vue`
(3), `ui/components/DriverEditorModal.vue` (1) and `ui/shells/original/OriginalShell.vue` (1) from
`db/useDriverLibrary.js` / `db/useDriverSelection.js` onto `logic/driverLibrary.js` /
`logic/driverSelection.js`. Commit `logic/driverLibrary.ts`, `logic/driverSelection.ts`,
`db/driverRepo.ts`, `db/kv.ts`, `db/prefs.ts`, `driverName.ts`.

**Proof.** `npx vue-tsc --noEmit` reports zero unresolved-module errors. The full unit suite runs
green on a quiet tree.

**Unblocks.** Everything. No step can be verified on a tree that does not typecheck.

---

### Step 2 — Extract `@openisd/model`

**Changes.** Create `packages/model/` with `name: "@openisd/model"` and
`dependencies: { "@openisd/engine": "*" }`. Move `packages/winisd/src/native/*` (6 files:
`openisdRecord.ts`, `openisdYaml.ts`, `openisdDerive.ts`, `openisdDriver.ts`, `openisdToWdr.ts`,
and the barrel) into `packages/model/src/`, except `openisdToWdr.ts`, which is serialisation and
stays in `@openisd/winisd`. Move `packages/winisd/test/native/*` alongside. Add a `model` vitest
project. Export `OpenISDDriver` from the `@openisd/model` barrel. Add `@openisd/model` to
`packages/winisd/package.json` dependencies. Delete the record re-exports from
`packages/winisd/src/index.ts`.

**Proof.** `packages/model/package.json` `dependencies` is exactly `{"@openisd/engine":"*"}`.
`packages/engine/package.json` `dependencies` is still empty. The moved test files pass under the
new project. `grep -rn "native/" packages/winisd/src` returns nothing but `openisdToWdr`.

**Unblocks.** The dependency-rule table in `ARCHITECTURE.md` §2 becomes expressible and checkable;
`@openisd/winisd` can be reduced to serialisation without dragging the record with it.

---

### Step 3 — Fix the Xmax `Hc === Hg` fall-through

**Changes.** `packages/engine/src/driver.ts:151` — guard the `abs(Hc−Hg)/2` branch so it declines
when `Hc === Hg`, letting `:160`'s `Vd/Sd` supply the value:

```ts
if (r.Xmax == null && r.Hc != null && r.Hg != null && r.Hc !== r.Hg)
```

**Proof.** A test asserting `Hc = Hg = 0.012, Sd = 0.022, Vd = 0.000407 → Xmax = 0.0185`, matching
probe row `G_hchg_equal` in `winisd_research/runs/xmax_route.jsonl`. The six other probe rows keep
their current answers.

**Unblocks.** Step 5 — a golden pinned before this fix bakes `Xmax = 0` into the parity fixtures.

---

### Step 4 — Determine the ParState slot-0 (`Znom`) rule

**Changes.** Run the WinISD probe under wine, the way QO39's Xmax campaign was run: author drivers
with `Znom` stated, absent, and defaulted, save each from WinISD, and read slot 0. Write the rule
into `docs/design/WDR_SCHEMA.md` with the observed rows. Remove the slot-0 exclusion from
`packages/winisd/test/driver-roundtrip.test.ts`.

**Proof.** A probe run file under `winisd_research/runs/`, and `driver-roundtrip.test.ts` asserting
slots 0..48 with no exclusion.

**Unblocks.** Step 8 — `WinISDDriver`'s writer must emit slot 0, and today three implementations
give three different answers (WinISD writes `C` on `drivers/sample/winisd/John-all-manu-populated.wdr`,
openisd emits `N`, `classic/wdr.ts parstate()` emits a third).

---

### Step 5 — Turn the parity suite green

**Changes.** Work `packages/winisd/test/winisd-parity.test.ts` from 341 failures to zero. Each
failure resolves exactly one of three ways, and the step records which: **(a)** openisd is wrong →
fix openisd; **(b)** the golden lacks the field WinISD never wrote (the `EBP` case at
`winisd-parity.test.ts:240` is this shape) → fix the assertion to skip a field the oracle does not
carry, not to accept a wrong value; **(c)** openisd is deliberately different → add the row to
`test/fixtures/winisd-parity/divergences.json` with its ruling. The three standing divergences go
in `divergences.json` now: `numVC` ParState stays `C`; `VCCon = 2` for series wiring; humidity and
pressure are live, so the suite runs with the `air.ts:81` ignore-flag ON.

**Proof.** `npx vitest run packages/winisd/test/winisd-parity.test.ts` — 463 passed, 0 failed.
`divergences.json` has one entry per deliberate difference, each naming its ruling.

**Unblocks.** Steps 7, 8, 10, 12, 13, 14. This is the only mechanical proof that openisd's numbers
match WinISD's. Every step after it that moves a call site is verified against it.

---

### Step 6 — Determine `OpenISDDriver`'s required API

**Changes.** Every one of the 34 lines matched by
`command grep -rn "DriverModel\.\|DriverModel(" packages/ui/src` (`store.ts` 20, `driverSelection.ts`
11, `DriverEditorModal.vue` 4 — `useDesignIO.ts`'s 4 matches include one comment line), classified
against the old `Driver`'s member it invokes:

| #   | Call site                   | Old member                                  | Classification    | Notes                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------- | ------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `DriverEditorModal.vue:49`  | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord` (already on it)                                                                                                                                                                                                                                                                           |
| 2   | `DriverEditorModal.vue:359` | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 3   | `DriverEditorModal.vue:387` | `fromWdr`                                   | **WinISDDriver**  | `.wdr` text parse — Step 8                                                                                                                                                                                                                                                                               |
| 4   | `DriverEditorModal.vue:388` | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 5   | `useDesignIO.ts:35`         | —                                           | **dies**          | comment text, not a call (`getDriverModel()` mentioned in prose)                                                                                                                                                                                                                                         |
| 6   | `useDesignIO.ts:142`        | `toWdr`                                     | **WinISDDriver**  | `.wdr` export — Step 8                                                                                                                                                                                                                                                                                   |
| 7   | `useDesignIO.ts:153`        | `toWdr`                                     | **WinISDDriver**  | `.wdr` export (WPR driver section) — Step 8                                                                                                                                                                                                                                                              |
| 8   | `useDesignIO.ts:196`        | `fromWdr` (via `.constructor` hack)         | **WinISDDriver**  | Step 8; the `.constructor as unknown` indirection itself dies — Step 10/11 imports `WinISDDriver` directly                                                                                                                                                                                               |
| 9   | `store.ts:199`              | `fromRaw`                                   | **dies**          | superseded once `DEFAULT_DRIVER` is an `OpenISDRecord` literal in `logic` (Step 10), then `fromRecord`                                                                                                                                                                                                   |
| 10  | `store.ts:212`              | type annotation (`DriverModel` return type) | **dies**          | the name; the function's return type becomes `OpenISDDriver` (already exists)                                                                                                                                                                                                                            |
| 11  | `store.ts:240`              | `fromJSON(b).raw().name`                    | **OpenISDDriver** | → `fromRecord(b).toRecord().name?.value` — `name` is already a `DerivedField` on `OpenISDRecord`, no new member                                                                                                                                                                                          |
| 12  | `store.ts:246`              | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 13  | `store.ts:250`              | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 14  | `store.ts:254`              | `fromRaw`                                   | **dies**          | as #9                                                                                                                                                                                                                                                                                                    |
| 15  | `store.ts:260`              | `fromWdr`                                   | **WinISDDriver**  | Step 8                                                                                                                                                                                                                                                                                                   |
| 16  | `store.ts:268`              | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 17  | `store.ts:269`              | `fromRaw`                                   | **dies**          | as #9 (v1-blob fallback path)                                                                                                                                                                                                                                                                            |
| 18  | `store.ts:270`              | `getDriverModel().toJSON()`                 | **OpenISDDriver** | → `toRecord` (already on it)                                                                                                                                                                                                                                                                             |
| 19  | `store.ts:297`              | `fromJSON(_model.toJSON())`                 | **OpenISDDriver** | → `fromRecord(_model.toRecord())` — deep-copy pattern, both members already exist                                                                                                                                                                                                                        |
| 20  | `store.ts:332`              | `fromRaw`                                   | **dies**          | as #9 (what-if-from-raw)                                                                                                                                                                                                                                                                                 |
| 21  | `store.ts:338`              | `fromJSON` / `fromRaw` (ternary)            | **OpenISDDriver** | `fromJSON` branch → `fromRecord`; the `fromRaw` branch dies, as #9                                                                                                                                                                                                                                       |
| 22  | `store.ts:353`              | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 23  | `driverSelection.ts:105`    | `fromWdr`                                   | **WinISDDriver**  | Step 8                                                                                                                                                                                                                                                                                                   |
| 24  | `driverSelection.ts:106`    | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 25  | `driverSelection.ts:136`    | `fromWdr`                                   | **WinISDDriver**  | Step 8                                                                                                                                                                                                                                                                                                   |
| 26  | `driverSelection.ts:208`    | `fromRaw`                                   | **dies**          | `myDriverData` becomes an `OpenISDRecord` once `MyDriverRepo` carries records (Step 12)                                                                                                                                                                                                                  |
| 27  | `driverSelection.ts:211`    | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 28  | `driverSelection.ts:224`    | `fromRaw(d).toJSON()`                       | **OpenISDDriver** | `toRecord` survives; `fromRaw` dies as #26 — `d` is already a record post-Step 12, nothing to convert                                                                                                                                                                                                    |
| 29  | `driverSelection.ts:232`    | `fromRaw`                                   | **dies**          | as #26                                                                                                                                                                                                                                                                                                   |
| 30  | `driverSelection.ts:235`    | `fromJSON`                                  | **OpenISDDriver** | → `fromRecord`                                                                                                                                                                                                                                                                                           |
| 31  | `driverSelection.ts:249`    | —                                           | **dies**          | comment text, not a call                                                                                                                                                                                                                                                                                 |
| 32  | `driverSelection.ts:268`    | `new DriverModel()` (blank ctor)            | **logic**         | a blank-`OpenISDRecord` literal in `logic` (mirrors `DEFAULT_DRIVER`) + `fromRecord`/`toRecord` — no new model member; constructing valid pipeline bookkeeping (`uuid`, `quality`, `disposition`, `authoritative`, `data_sources`) for a from-scratch driver is a workflow decision, not model behaviour |
| 33  | `driverSelection.ts:276`    | `getDriverModel().toJSON()`                 | **OpenISDDriver** | → `toRecord`                                                                                                                                                                                                                                                                                             |
| 34  | `driverSelection.ts:289`    | `fromJSON(json).raw()`                      | **OpenISDDriver** | `fromRecord` survives; `.raw()` dies — the rename-move logic reads `record.brand.value`/`record.model.value` directly                                                                                                                                                                                    |

**Counts:** OpenISDDriver 17 (rows 1,2,4,11,12,13,16,18,19,21,22,24,27,28,30,33,34) · WinISDDriver 7
(rows 3,6,7,8,15,23,25) · dies 9 (rows 5,9,10,14,17,20,26,29,31) · logic 1 (row 32). 17+7+9+1 = 34.

**Members used off the same instances but not spelled `DriverModel.`/`DriverModel(`** — surfaced by
reading the rest of `DriverEditorModal.vue` (which holds its instance in `draftDriver`, a typed
local) and the 9 pinned `packages/winisd/test` files' `it()` bodies, cross-checked per file:

| Old member                                                                                                                                                                                                                                  | Where used                                                                                                                                                             | Classification    | Notes                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enter`/`clear`/`cell` (numeric T/S)                                                                                                                                                                                                        | `DriverEditorModal.vue`, all 9 winisd test files, `driver-editor-units.test.ts`, `persist.test.ts`                                                                     | **OpenISDDriver** | already on it (8 members)                                                                                                                                                                                                               |
| `enter`/`clear`/`cell` for `brand`/`model`/`manufacturer` (string)                                                                                                                                                                          | `DriverEditorModal.vue:74-84,280-281`, `driverSelection.ts` (`driverFromFileText`'s `m.enter('model', base)`)                                                          | **OpenISDDriver** | new — Step 7. `ScrapedField<string>`, not `SpecEntry`; B3/B4 apply the same way, on the other envelope                                                                                                                                  |
| `enter` for `comment`/`providedBy`/`added`(`DateAdded`)                                                                                                                                                                                     | `DriverEditorModal.vue:74` (`setText`)                                                                                                                                 | **WinISDDriver**  | no `OpenISDRecord` field exists for these — WDR-only carried pass-through (Step 8)                                                                                                                                                      |
| `enter` for link fields (`datasheetUrl`, `manuPageUrl`, `vendorpageUrl`, `frdUrl`, `impedanceUrl`)                                                                                                                                          | `driverSelection.ts`'s `withLinks()`                                                                                                                                   | **logic**         | catalogue-sourced, not user-typed — merges into `data_sources` (a `BookkeepingField`) directly, not a provenance-marked manual entry                                                                                                    |
| `errors()`                                                                                                                                                                                                                                  | `DriverEditorModal.vue:224`, `driver-hardening.test.ts`                                                                                                                | **OpenISDDriver** | already on it                                                                                                                                                                                                                           |
| `subscribe()`                                                                                                                                                                                                                               | `store.ts` (throughout), `driver-class.test.ts`                                                                                                                        | **OpenISDDriver** | already on it                                                                                                                                                                                                                           |
| `toDriver()`                                                                                                                                                                                                                                | `DriverEditorModal.vue:63`, `driver-hardening.test.ts`, `driver-projection.test.ts`, `roundtrip.test.ts`                                                               | **OpenISDDriver** | new — Step 7. Resolved engine-ready flat bag for `sweep()`/`maxCurves()`; calls the existing `deriveOpenISDFields` (→ `solveConsistencyGroup`/`deriveDriver`), not a re-derivation                                                      |
| `consistencyIssues()`                                                                                                                                                                                                                       | `DriverEditorModal.vue:194`                                                                                                                                            | **OpenISDDriver** | new — Step 7. Calls the engine's `checkConsistency`, memoised like `errors()`                                                                                                                                                           |
| `autoCalculate` (get/set)                                                                                                                                                                                                                   | `DriverEditorModal.vue:105-111`                                                                                                                                        | **OpenISDDriver** | new — Step 7. A derivation-mode toggle: off, `cell()` never reports `C` and `errors()`/`toDriver()` validate the entered-only set                                                                                                       |
| `cell(field).error` (per-field, `ERROR_ALIASES` Sd→Dia, Qts→[Qms,Qes])                                                                                                                                                                      | nowhere in current UI — only `driver-class.test.ts` tests 8 and 9                                                                                                      | **dies**          | `chartBlockingReasons` reads `errors()` (whole-list); DQ display reads `consistencyIssues()`+`dqNote()` — a different, already-live mechanism. Step 14 records these two `it()` as "assertion now meaningless" per its own escape hatch |
| `toWdr()`                                                                                                                                                                                                                                   | `useDesignIO.ts`, `driver-json.test.ts`, `driver-roundtrip.test.ts`, `roundtrip.test.ts`, `wdr-carried-keys.test.ts`, `wdr-import-fidelity.test.ts`, `persist.test.ts` | **WinISDDriver**  | Step 8                                                                                                                                                                                                                                  |
| `fromWdr()`                                                                                                                                                                                                                                 | as above, plus `driver-projection.test.ts`, `driver-editor-units.test.ts`                                                                                              | **WinISDDriver**  | Step 8                                                                                                                                                                                                                                  |
| `WDR_META`/`WDR_META_NUMERIC` (carried-key table: `Hc`, `Hg`, `numVC`-as-slot, `VCCon`'s 1/2 encoding, `tc`, `Rth`, `Cth`, `loss`, `thick`, `depth`, `magnetDepth`, `magnet`, `basket`, `outer`, `VCd`, `basketDisplacement`, `fLe`, `Le2`) | `driver.ts:87-122`                                                                                                                                                     | **WinISDDriver**  | Step 8. The _value_ for fields that already have a `SpecEntry` home (`numVC`, `VCCon`, `Hc_mm`, `Hg_mm`, …) stores through `OpenISDDriver.enter`/`cell` today; only the WDR key-name/units/ParState-bit mapping is WinISDDriver's       |
| `DriverJSON` (`{inputs, carry}`), `FieldCell`                                                                                                                                                                                               | throughout                                                                                                                                                             | **dies**          | replaced by `OpenISDRecord` (Step 12) and `Cell` (already exists) respectively                                                                                                                                                          |
| `raw()`                                                                                                                                                                                                                                     | `DriverEditorModal.vue`, `driverSelection.ts`, `driver-json.test.ts`, `driver-projection.test.ts`, `roundtrip.test.ts`, `persist.test.ts`                              | **dies**          | superseded by `toRecord()` + reading `.value` off the `ScrapedField`/`DerivedField` directly                                                                                                                                            |
| `toJSON()`                                                                                                                                                                                                                                  | throughout                                                                                                                                                             | **dies**          | superseded by `toRecord()`                                                                                                                                                                                                              |
| `fromJSON()`                                                                                                                                                                                                                                | throughout                                                                                                                                                             | **dies**          | superseded by `fromRecord()`                                                                                                                                                                                                            |
| `fromRaw()`                                                                                                                                                                                                                                 | throughout                                                                                                                                                             | **dies**          | as #9                                                                                                                                                                                                                                   |
| `new Driver()` (blank ctor)                                                                                                                                                                                                                 | `driverSelection.ts:268`                                                                                                                                               | **logic**         | as row 32                                                                                                                                                                                                                               |
| `ERROR_ALIASES`                                                                                                                                                                                                                             | `driver.ts:69-72`                                                                                                                                                      | **dies**          | moves nowhere — see `cell(field).error` above                                                                                                                                                                                           |

**Step 7's work, in full:** 6 new capabilities on `OpenISDDriver` — `metaCell`/`enterMeta`/`clearMeta`
(brand/model/manufacturer, B3/B4 on the `ScrapedField` envelope), `toDriver()`, `consistencyIssues()`,
`autoCalculate` get/set — added to the 8 it already has (`fromRecord`, `toRecord`, `section`, `cell`,
`enter`, `clear`, `errors`, `subscribe`).

**Proof.** The table exists, every one of the 34 call sites appears in it exactly once, and every
member classified "belongs on `OpenISDDriver`" is either already on it (the 8 members it has) or
listed in Step 7's work.

**Unblocks.** Step 7. Building the class against a guessed surface is the failure mode that forces
a second rewrite.

---

### Step 7 — Complete `OpenISDDriver` to that API

**Changes.** Implement the members Step 6 classified as model behaviour, TDD, red→green per
`/test-driven-development`. The derivation algorithms move off `driver.ts` rather than being
re-derived — the engine is validated to < 0.03 dB and that correctness is not re-paid. `E`/`C`/`N`
follows QO36 B4; `enter()` writes the B3 shape.

**Proof.** `packages/model/test/openisdDriver.test.ts` covers every member. The E/C/N tests ported
from `driver-class.test.ts` (10 `it()`) pass against `OpenISDDriver`. The parity suite stays at 463
passed.

**Unblocks.** Step 10 — the call sites cannot move onto a class that lacks what they call.

---

### Step 8 — Build `WinISDDriver`, one class, both directions

**Changes.** One class in `@openisd/winisd`, replacing `classic/wdr.ts`'s `toWdr()` and
`native/openisdToWdr.ts`'s `openisdYamlToWdr()` with a single writer, and adding the reader half.
It validates, holds no live state, derives nothing, and does not persist between calls. Import
diffs the as-read values against what `OpenISDDriver` independently derives and reports a mismatch
as a data-quality signal instead of overwriting. Slot 0 follows Step 4's rule.

**DQ marks travel into `Comment=` as a suffix** (human ruling, 2026-08-14; ARCHITECTURE.md §3 "the
DQ mark paragraph"). One line per mark, appended after any existing comment text, each naming the
offending field, the offending value, and the offence — `[DQ] <field>=<value>: <offence>`. A record
with no marks leaves `Comment=` unchanged.

**Proof.** `grep -c "function toWdr\|function openisdYamlToWdr" packages/winisd/src` → 0; one
`class WinISDDriver`. The 11 `it()` of `openisdToWdr.test.ts` and the 6 of `wdr-carried-keys.test.ts`
pass against the class. `driver-roundtrip.test.ts` round-trips slots 0..48 against the genuine
WinISD save. The parity suite stays at 463 passed. A new test asserts: zero-DQ record leaves
`Comment=` byte-identical to today's writer; a record with N marks produces N `[DQ]` lines in
record order, each matching the three-part shape exactly.

**Unblocks.** Step 14 — `driver.ts` cannot be deleted while it is the only `.wdr` reader.

---

### Step 9 — Composition root and the last service factory

**Changes.** `packages/ui/src/main.ts` becomes the composition root: it constructs `driverRepo`,
`myDriverRepo`, `prefsStore`, `fileIO`, `diagnostics`, `logging`, then the store, injects them, and
provides the app facade at the root via Vue `provide`. `diagnostics/selftest.ts` gains
`createDiagnostics(deps)` taking the engine and a reporter. No module below `main.ts` constructs a
service.

**Proof.** The gate's `every service module offers a create*() factory` assertion passes — 8 of 8
architecture-gate assertions is not yet reached, but this one is green. `main.ts` contains every
`create*()` call in `packages/ui/src`.

**Unblocks.** Step 11 — `ui` can only be routed through `logic` once `logic` is something that was
handed the services rather than importing them.

---

### Step 10 — Swap the model in `logic`, and give `logic` a facade

**Changes.** One pass over `logic/store.ts`, `logic/driverSelection.ts` and `logic/driverLibrary.ts`:
replace `Driver as DriverModel` with `OpenISDDriver` from `@openisd/model` at all 34 call sites, and
in the same edit expose the facade `ui` will consume — the selectors and intents that replace `ui`'s
21 direct reaches into services and the domain. `logic` calls the services it was injected with; it
constructs none.

**Proof.** `grep -rn "@openisd/winisd" packages/ui/src/logic` returns only `fileIO`'s serialiser
edge. The unit suite is green. The parity suite stays at 463 passed. The self-test's three gates
pass in the browser (`window._selfTestDone`).

**Unblocks.** Step 11, Step 12, Step 14. This is the step that makes OpenISD the app's base model.

---

### Step 11 — Route every `ui` import through `logic`

**Changes.** The 21 offending specifiers across the 11 `.vue` files listed above become `logic`
imports of the facade Step 10 exposed. The 7 domain value-imports become values `logic` computed
and handed down as data — a component may hold an `import type` from `@openisd/*`, which erases,
but no value import.

**Proof.** The gate's `the presentation layer depends on logic and nothing below it` and
`a component imports no value from the domain` assertions both pass. **8 of 8 architecture-gate
assertions green.** The browser suite passes on `--workers=1`.

**Unblocks.** The layering strand is complete. Nothing further depends on it, but the gate now
stops a regression silently reintroducing the inversion.

---

### Step 12 — Persistence carries `OpenISDRecord`

**Changes.** Replace `DriverJSON` with `OpenISDRecord` at all 37 referencing lines across the 9
files. `localStorage` My Drivers, the URL-hash share link and `.owpr` all carry the record shape.
Complete `openisdYaml.ts`'s write parity with the Python canonical serializer (`_KEY_PRIORITY`,
`_FLOW_LIST_KEYS`), which becomes load-bearing the moment the app writes `.owdr`.

**Proof.** `grep -rn "DriverJSON" packages` → 0. A test asserting a driver saved into a project and
the same driver exported as `.owdr` produce identical bytes. `ui/test/logic/persist.test.ts` (9
`it()`) passes against the record shape. A round-trip test against a real
`packages/model/test/fixtures/openisd/*.openisd.yml` reproduces the file byte for byte.

**Unblocks.** Step 14 — `driver.ts` owns `DriverJSON` and cannot be deleted while anything persists it.

---

### Step 13 — Retire `DriverRaw`

**Changes.** Delete `DriverRaw` from `packages/engine/src/types.ts:43-102` and replace it at the
`deriveDriver`/`sweep` boundary with a type scoped to exactly the fields those functions read — no
all-optional bag, no metadata fields, no URL fields. Reshape the engine `Driver` interface
(`types.ts:110-122`), which inherits from it. Update the 104 referencing lines across 23 files.

**Proof.** `grep -rn "DriverRaw" packages` → 0. `deriveDriver`'s parameter type lists only fields
its body reads — checked by reading the body against the type. The parity suite stays at 463 passed
and the engine's golden-master tests are unchanged.

**Unblocks.** Step 15 — the last shape that is not the OpenISD record is gone, so the coverage
baseline that follows is the final one.

---

### Step 14 — Delete `driver.ts` and port its tests

**Changes.** Delete `packages/winisd/src/driver.ts` (469 lines) and its export from the barrel.
Port the 71 pinned `it()` onto `OpenISDDriver` and `WinISDDriver` — every one of them, or a written
statement of which assertion is now meaningless and why. `driver-roundtrip.test.ts` in particular is
the only witness that ParState slots round-trip against a genuine WinISD save.

**Proof.** `grep -rn "from '@openisd/winisd'" packages | grep Driver` returns only `WinISDDriver`.
No test file imports `Driver`. The full unit suite and the browser suite are green on a quiet tree,
one suite at a time.

**Unblocks.** Step 15.

---

### Step 15 — Rebaseline the coverage gate

**Changes.** Recompute `vitest.config.js:20-25` thresholds (today statements 15.8, branches 78.5,
functions 54.0, lines 15.8) from the post-migration run and set them to the measured numbers.
**Rebaseline, not lower:** a threshold is set to what the suite now achieves, and if a number falls
the missing tests are written before it is written down.

**Proof.** `npm run test:unit -- --coverage` passes with the new thresholds, and each threshold
equals the measured coverage to one decimal place.

**Unblocks.** The gate stops reporting a mechanical failure as a quality regression.

---

### Step 16 — Repoint the citations `ARCHITECTURE.md` no longer carries

**Changes.** `ARCHITECTURE.md` is a specification with named sections, not a numbered decision log.
Repoint the **41 `AD-n` citations across 22 files under `packages/`** and the citations in the 15
markdown files that carry them (`AGENTS.md`, `BACKLOG.md`, `LOG.md`, `docs/spec/SPEC_ENGINE.md`,
`docs/design/{STATE_MODEL,DRIVER_ADT_DESIGN}.md`, `docs/plans/*`, `drivers/demos/README.md`,
`packages/ui/src/drivers-bundle.README.md`, `openspec/changes/reorganize-project-docs/*`) at the
section that now owns each rule. Repoint the three stale `driver.ts:432` citations
(`BACKLOG.md:485-486`, `docs/spec/SPEC_ENGINE.md:397`, QO28) — the `numVC` autofill is at
`driver.ts:445`, and both die with the file at Step 14.

**Proof.** `grep -rn "AD-[0-9]" .` returns nothing outside `LOG.md` and the ledger, which are
historical records.

**Unblocks.** Nothing depends on it. It is the cleanup that keeps `ARCHITECTURE.md` reachable from
the code.

---

## TODO — documents that conflict with `ARCHITECTURE.md`

These are cleanup items. **None of them blocks any step above.** `ARCHITECTURE.md` is correct; each
file below is wrong and gets corrected when someone is next in it.

| Conflict                                                                                                                                                                                                                                                                       | File                                                                                                                                                                                                   | Correction                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A live `SHALL` requiring multiple skins.** `openspec/specs/ui-presentation/spec.md:23-25` — _"The UI SHALL support multiple distinct skin layouts (Modern, Classic, Original)"_. Its own cited tests `classic-skin.browser.spec.ts` and `skins.test.ts` do not exist on disk | `openspec/specs/ui-presentation/spec.md:23-25`, `openspec/project.md:60`                                                                                                                               | There is ONE UI, `packages/ui/src/ui/shells/original/`. Delete the requirement                                                                    |
| Refers to skins in the plural / names `classic` or `modern`                                                                                                                                                                                                                    | `AGENTS.md` (9 lines), `docs/spec/SPEC_ENGINE.md` (2), `docs/design/STATE_MODEL.md` (2), `openspec/project.md` (2), `docs/spec/SPEC_UI.md` (1)                                                         | There is ONE UI                                                                                                                                   |
| **`openspec/project.md:58` declares a different taxonomy** — nine boundaries `@ui`/`@logic`/`@engine`/`@wdr`/`@wpr`/`@owdr`/`@owpr`/`@db`/`@logging`/`@diagnostics`, with `@owdr`/`@owpr` as modules separate from `@wdr`/`@wpr` (`project.md:28-30`)                          | `openspec/project.md:28-30,58`                                                                                                                                                                         | `ARCHITECTURE.md` §2 carves the system into four layers and eleven modules. `.owdr`/`.owpr` are formats, not modules; one serialiser handles them |
| **`docs/spec/SPEC_ENGINE.md:237` says dependency arrows "point up only"** — the exact inverse of the spec                                                                                                                                                                      | `docs/spec/SPEC_ENGINE.md:237`                                                                                                                                                                         | Every import points DOWNWARD (`ARCHITECTURE.md` §2)                                                                                               |
| **`.owdr` called "OpenISD native JSON format"**                                                                                                                                                                                                                                | `openspec/specs/driver-database/spec.md:32`                                                                                                                                                            | `.owdr` is the `openisd.yml` schema byte for byte — YAML, not JSON                                                                                |
| Cites `AD-n` decision numbers, which no longer exist as anchors                                                                                                                                                                                                                | the 15 markdown files and 22 source files in Step 16 — verified dangling: `docs/spec/SPEC_ENGINE.md:94` (AD-8/AD-9), `:237` (AD-6), `:257` (AD-8), `docs/design/STATE_MODEL.md:9` (AD-7), `:17` (AD-8) | Cite the `ARCHITECTURE.md` section                                                                                                                |
| `docs/design/WDR_SCHEMA.md:268` says Xmax row 20 takes precedence                                                                                                                                                                                                              | `docs/design/WDR_SCHEMA.md`                                                                                                                                                                            | Row 19 wins (QO39). Line 310's table is right; line 268 is wrong                                                                                  |
| `PLAN_OPENISD_DRIVER_MODEL.md:34-36` says the `.wdr` writer does not exist                                                                                                                                                                                                     | `docs/plans/PLAN_OPENISD_DRIVER_MODEL.md`                                                                                                                                                              | `openisdYamlToWdr()` exists; only the reader half is missing                                                                                      |
| `OPENISD_MODEL_MIGRATION_READINESS.md` says `OpenISDDriver` is UNTOUCHED and the parity suite is untracked                                                                                                                                                                     | `docs/plans/OPENISD_MODEL_MIGRATION_READINESS.md`                                                                                                                                                      | Both have landed. `openisdDriver.ts` is committed with 4 passing tests; `winisd-parity.test.ts` is committed and red at 341/463                   |
| `AGENTS.md:450` gives `packages/winisd/src/` "E/C/N provenance"                                                                                                                                                                                                                | `AGENTS.md:450`                                                                                                                                                                                        | Provenance belongs to `@openisd/model`; `@openisd/winisd` is `.wdr`/`.wpr` bytes only                                                             |

---

## Definition of done

The goal is met when every assertion below is green in one run on a quiet tree.

**The model.**

1. `packages/model/` exists, exports `OpenISDDriver` and the record types, and depends only on
   `@openisd/engine`.
2. `grep -rn "class Driver\b" packages` → 0. `packages/winisd/src/driver.ts` does not exist.
3. `grep -rn "DriverRaw\|DriverJSON" packages` → 0.
4. `grep -rn "@openisd/winisd" packages/ui/src` matches only the `fileIO` service.
5. Every driver the app holds is an `OpenISDDriver`; every `.wdr` is produced by `WinISDDriver` on
   demand and never stored.
6. A driver saved into a project and the same driver exported as `.owdr` are byte-identical.

**The layering.**

7. `npx vitest run packages/ui/test/ui/architecture.test.ts` — **8 assertions, 8 pass, 0 offences.**
8. `packages/ui/src/main.ts` contains every `create*()` call in `packages/ui/src`.
9. No `.vue` file imports a value from `@openisd/*` or from `db/`, `diagnostics/`, `logging/`.

**The numbers.**

10. `npx vitest run packages/winisd/test/winisd-parity.test.ts` — **463 passed, 0 failed**, with
    every deliberate difference carried in `divergences.json`.
11. The engine golden-master tests are byte-unchanged from before Step 3, except the `Hc === Hg`
    row.
12. The runtime self-test's three gates pass in the browser and `window._selfTestDone` is set.

**The gates.**

13. `npm run test:unit -- --coverage` passes, with each threshold equal to the measured coverage —
    rebaselined upward from 15.8 / 78.5 / 54.0 / 15.8, never lowered.
14. `npx vue-tsc --noEmit` — 0 errors.
15. The browser suite passes at `--workers=1`.
16. `grep -rn "AD-[0-9]" .` returns nothing outside `LOG.md` and the ledger.
