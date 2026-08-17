# OpenISD model migration — readiness

**What must be true before the app moves off the WinISD driver model and onto the OpenISD one.**

Companion to [`PLAN_OPENISD_DRIVER_MODEL.md`](PLAN_OPENISD_DRIVER_MODEL.md), which says _how_ the
migration runs. This document says _whether it can start_, and what is still unverified.

Governing decisions: [`ARCHITECTURE.md`](../../ARCHITECTURE.md) **AD-8** (`OpenISDDriver` is the
app's model, `WinISDDriver` is a serialiser) and **AD-9** (`DriverRaw` is retired).

Every row below records the check that produced it. A row marked **❔ untested** is a claim nobody
has run; it is not a soft yes.

---

## 1. State of play

**The app has not moved at all.** The OpenISD-native record types exist, are exported and are
tested — but nothing in the running application touches them. A grep for
`OpenISDRecord|SpecEntry|SpecSection|ScrapedField|winningReading` across `packages/ui` and
`packages/engine` returns **0 lines**. Every driver the app holds is still an instance of the
WinISD-shaped `Driver` class in `packages/winisd/src/driver.ts`.

What _has_ landed is the data layer beneath the migration, plus one direction of the serialiser —
as a function, not as the class AD-8 specifies.

### AD-8 / AD-9, part by part

| Part                                                                                                                  | Verdict                           | Evidence                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native record types (`OpenISDRecord`, `Specs`/`SpecSection`, the four field envelopes, `Reading`, `winningReading()`) | **DONE**                          | `packages/winisd/src/native/openisdRecord.ts` (213 lines); `test/native/openisdRecord.test.ts`, 3 `it()`                                                                                                                                                                                                                      |
| YAML read/write (`fromYaml`/`toYaml`)                                                                                 | **DONE, one gap**                 | `native/openisdYaml.ts` (32 lines); `test/native/openisdYaml.test.ts`, 6 `it()`. Write is **not** byte-verified against the Python canonical serializer — `_KEY_PRIORITY`/`_FLOW_LIST_KEYS` unreplicated, flagged in the file itself                                                                                          |
| T/S derive adapter (`deriveOpenISDFields()`)                                                                          | **DONE**                          | `native/openisdDerive.ts` (57 lines); `test/native/openisdDerive.test.ts`, 5 `it()`                                                                                                                                                                                                                                           |
| Export path `openisd.yml` → `.wdr`                                                                                    | **STARTED — function, not class** | `native/openisdToWdr.ts` (239 lines), `openisdYamlToWdr()`; `test/native/openisdToWdr.test.ts`, 11 `it()` across three describes (format conformance vs the `drivers/sample/winisd/` oracle; calculation per `SPEC_ENGINE` §4.7 obligation b; Result contract). AD-8 asks for a `WinISDDriver` class; this is a free function |
| All four wired into the package barrel                                                                                | **DONE**                          | `packages/winisd/src/index.ts:4-7`                                                                                                                                                                                                                                                                                            |
| `OpenISDDriver` (the stateful `enter`/`clear` class the app holds)                                                    | **UNTOUCHED**                     | `grep -rn "class OpenISDDriver" packages/` → no match                                                                                                                                                                                                                                                                         |
| `WinISDDriver` as a class, incl. the import half (`fromWdr` + diff-not-overwrite DQ step)                             | **UNTOUCHED**                     | `grep -rn "class WinISDDriver" packages/` → no match                                                                                                                                                                                                                                                                          |
| Phase 3 — migrate the call sites off `Driver`                                                                         | **UNTOUCHED**                     | all 4 value-import sites still import `Driver` from `@openisd/winisd` (below)                                                                                                                                                                                                                                                 |
| Phase 4 — persistence carries `OpenISDRecord`                                                                         | **UNTOUCHED**                     | `DriverJSON` still the persisted shape: 37 referencing lines across 9 files                                                                                                                                                                                                                                                   |
| Phase 5 — delete `driver.ts`                                                                                          | **UNTOUCHED**                     | file present, 469 lines                                                                                                                                                                                                                                                                                                       |
| AD-9 — `DriverRaw` retired, narrow successor at the `deriveDriver`/`sweep` boundary                                   | **UNTOUCHED**                     | `packages/engine/src/types.ts:43-102`, ~40 all-optional fields, intact. `Driver extends DriverRaw` at `:110`. `types.ts:38` carries a pointer comment to the plan — a marker, not an implementation                                                                                                                           |
| The `SPL` gap AD-8 calls blocking for "no data loss"                                                                  | **UNTOUCHED**                     | present in `SpecSection` at `openisdRecord.ts:166`; zero downstream consumers (same 0-line grep as above)                                                                                                                                                                                                                     |
| The Python→JS bridge that retires the second yml→wdr implementation                                                   | **UNTOUCHED**                     | `mini-racer` appears in `BACKLOG.md`, `docs/plans/MATH_MIGRATION.md`, `docs/plans/PLAN_JS_CALC_CONSOLIDATION.md` and one plan under `../brain/` — and in **no Python file**. `winisd_tools/scrapers/scrapers/lib/rebuild_wdr.py` still holds the Python implementation                                                        |

> `PLAN_OPENISD_DRIVER_MODEL.md:34-36` is stale on one point: it says the `.wdr` writer "does not
> exist" and that `Driver.toWdr()`/`fromWdr()` still do the job. The export half now exists as
> `openisdYamlToWdr()`. The import half does not.

### The four driver-shaped types

| Type                             | Where                                         | Role                                                                                                     | What still depends on it                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Driver` (**class**)             | `packages/winisd/src/driver.ts` (469 lines)   | The live, WinISD-shaped editable model the whole app runs on. Flat `#inputs` bag, `enter`/`clear`/`cell` | **4 value-import sites** — `logic/store.ts:5`, `db/useDriverSelection.ts:1`, `ui/components/DriverEditorModal.vue:7`, `ui/components/DriverDefineModal.vue:6`. **35 `DriverModel.`/`DriverModel(` call sites** in `packages/ui/src`; 79 referencing lines across those 4 files. Plus **8 test files / 48 tests** in `packages/winisd/test` |
| `DriverRaw` (**interface**)      | `packages/engine/src/types.ts:43-102`         | The all-optional flat bag AD-9 names as the defect                                                       | **100 referencing lines across 23 files** — 13 under `packages/*/src`, 10 under `packages/*/test`                                                                                                                                                                                                                                          |
| `Driver` (**interface**, engine) | `packages/engine/src/types.ts:110-122`        | The fully-derived driver — `extends DriverRaw`, adds 11 required fields                                  | 15 type-annotation sites across `packages/*/src`; 30 files import from `@openisd/engine`. Retiring `DriverRaw` reshapes this too, since it inherits from it                                                                                                                                                                                |
| `OpenISDRecord` family           | `packages/winisd/src/native/openisdRecord.ts` | The target shape — `openisd.yml` byte for byte                                                           | **0 consumers outside `packages/winisd`.** Fully typed, partially tested, no live caller                                                                                                                                                                                                                                                   |

A fifth, adjacent: `DriverJSON` — the persisted/share-link shape, 37 lines across 9 files. Phase 4
replaces it with `OpenISDRecord`.

---

## 2. Outstanding work, in the order it must happen

### 🔴 BLOCKS the migration — do these first

| #   | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Why it blocks                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B2  | **`Xmax` route precedence — SETTLED, one divergence left to rule on.** Seven live WinISD runs ([`runs/xmax_route.jsonl`](http://localhost:8000/winisd/winisd_research/runs/xmax_route.jsonl), tabulated in [`WDR_SCHEMA.md` §4.1](../design/WDR_SCHEMA.md)) put row 19 `abs(Hc−Hg)/2` ahead of row 20 `Vd/Sd` at two magnitudes, confirm both routes fire alone, and confirm an entered `Xmax` pins against both. `solveConsistencyGroup` already evaluates them in that order (`packages/engine/src/driver.ts:151-152` before `:160-161`). **What remains:** when `Hc = Hg`, row 19 yields 0 and WinISD falls through to `Vd/Sd`, while the engine writes `Xmax = 0` and stops. A human ruling is needed on whether to match WinISD's fall-through | The fall-through is a one-line guard in the shared derivation authority, so it must be decided before Phase 1's tests pin the current behaviour. Distinct from `BACKLOG.md:338`, which rules the back-calc _direction_ is allowed ("winisd wins that decision") — that is the permission, this is the order                          |
| B3  | **The `manual`-origin write shape.** For a manually entered field, what do `read_precision` and `actual_reading` hold — omitted or synthesised?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `PLAN_OPENISD_DRIVER_MODEL.md:54-57` states this explicitly as blocking and says "do not invent an answer". `enter()` cannot be written without it, and it is the shape every Phase 1 test asserts                                                                                                                                   |
| B4  | **Lock the provenance mapping.** Does `origin !== 'manual'` (a real datasheet reading) display as `E`, or only `origin === 'manual'`?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `PLAN_OPENISD_DRIVER_MODEL.md:94-100` requires this locked _before_ Phase 1 tests are written. It is the field that used to be `Driver`'s binary E-vs-not-E and is now a `SourceRole` with more than two values                                                                                                                      |
| B5  | **Land the QO8 parity suite.** `packages/winisd/test/fixtures/winisd-parity/scenarios.json` (15 KB) is **untracked**; `packages/winisd/test/winisd-parity.test.ts` does not yet exist in the tree. Its own open blocker is unresolved: `BACKLOG.md:466-469`, getting curves out as **text rather than pixels**                                                                                                                                                                                                                                                                                                                                                                                                                                      | It is the only mechanical proof that openisd matches WinISD. Today parity is hand-checked spot values. Refactoring the entire driver model without that oracle in place means no regression net for the numbers                                                                                                                      |

### 🟡 DURING the migration — fold in, do not sequence separately

| #   | What                                                                                                                                   | Note                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **AD-9 — retire `DriverRaw`**, narrow successor scoped to what `deriveDriver`/`sweep` actually read                                    | Cannot sensibly precede the migration: the successor type is only definable once `OpenISDDriver` exists to feed it. 100 references, 23 files                                                                                                                                                                                                                  |
| D2  | **Phase 4 persistence** — `DriverJSON` → `OpenISDRecord` in `localStorage` and the share link                                          | 37 lines / 9 files. AD-8's stated goal: a saved project's driver and a saved `.owdr` are the same bytes                                                                                                                                                                                                                                                       |
| D3  | **`openisdYaml.ts` write parity** with the Python canonical serializer (`_KEY_PRIORITY`, `_FLOW_LIST_KEYS`)                            | Inert today; becomes load-bearing the moment the app _writes_ `.owdr`, which is Phase 4                                                                                                                                                                                                                                                                       |
| D4  | **The `SPL` gap** — canonical spec field, present in `SpecSection`, no engine equivalent, no consumer                                  | AD-8 calls it blocking for "no data loss". Resolve before claiming that, not before starting                                                                                                                                                                                                                                                                  |
| D5  | **Coverage thresholds will go red mechanically** — `vitest.config`: statements 15.8, branches 78.5, functions 54.0, lines 15.8         | Deleting 469 covered source lines and 48 tests moves all four numbers. Re-baseline _after_ the ported tests are green — lowering the gate to clear the red is the wrong move                                                                                                                                                                                  |
| D6  | **QO24 — GAPS.md section F, 11 ranked parity fixes, none applied**                                                                     | These are behaviours the new class must reproduce, so applying them against the dying class is wasted work. Two caveats: item .5 is **partly wrong as written** (human, 2026-08-13 — `Rme`/`gamma`/`Mpow` _are_ calculated by WinISD, deleting `Rme` makes it recompute), and item 11 depends on QO23's solver rule plus the `winisd_research` probe campaign |
| D7  | **Repoint the stale `driver.ts:432` citations**                                                                                        | `BACKLOG.md:485-486`, `docs/spec/SPEC_ENGINE.md:397` and QO28's note all cite `packages/winisd/src/driver.ts:432` for the `numVC` autofill. Verified by Read: line 432 is `if (r.c == null) r.c = C;`; the autofill is at **line 445**. They die with the file anyway — repoint at `OpenISDDriver` as part of the move                                        |
| D8  | **`BACKLOG.md:85-122`, app-side half** — the disk loader and driver browser stop reading `.wdr`; `openisd.yml` is the only record read | Same ruling as AD-8, and it _is_ Phase 3. Still outstanding within it: the federated-GitHub path (fetches `.wdr` from third-party repos) and a build-time `.wdr` → `.owdr` converter. The bundler half is already done — it reads `openisd.yml`/`.owdr` only                                                                                                  |

### 🟢 AFTER — independent of the driver model's shape

| #   | What                                                                                                                                                                                                                 | Note                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **`BACKLOG.md:85-122`, cross-repo half** — the `mini-racer` bridge, retiring `rebuild_wdr.py`'s Python yml→wdr                                                                                                       | The JS side must be the single implementation _first_. Needs its own plan (`BACKLOG.md:120-122` says so)                                                                    |
| A2  | **QO32 — Gloss / SPLmaxLF / Mcost.** Not outstanding as a _probe_: all three were recovered from 41 live WinISD samples, worst relative residual ~1e-15, two competing forms refuted by purpose-built discriminators | Outstanding only as _implementation_, and it is advanced-panel display — independent of the record shape. Note `Gloss` is a fraction on disk and a percent in the UI (×100) |
| A3  | **QO29's separate suggestion** — free numeric end-correction per vent, replacing the closed three-item `<select>`                                                                                                    | The `0.732` default is confirmed correct and unchanged. Vent concern, not driver-record                                                                                     |
| A4  | **QO34 — brand-primary.** DB path from brand is implemented in `winisd_tools`; display name from `<brand> <model>` is live in openisd (`scripts/bundle-drivers.mjs:143-145`, `logic/store.ts:668-669`)               | The identity work (`BACKLOG.md:30-83`) touches the driver record but is orthogonal to its shape                                                                             |
| A5  | **QO31 / QO33** — rule-file audit and the repo-skill-symlink ruling                                                                                                                                                  | No code dependency on the driver model                                                                                                                                      |
| A6  | **`BACKLOG.md:490`** — one shared implementation of the three physics gates between `diagnostics/selftest.ts:43-47` and `engine/test/engine.test.ts:29-33`                                                           | Duplicate fixture declaration; unrelated to the record shape                                                                                                                |

### Status of the two sweeps dispatched today

| Sweep                   | Status                                                                                                                                                                                                                                                                                                                                                                      | How checked                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **QO8 parity suite**    | **In flight right now.** A sibling agent is executing `npx vitest run --project winisd packages/winisd/test/winisd-parity.test.ts` — a spec file not yet present in the tree. Its fixture `test/fixtures/winisd-parity/scenarios.json` is untracked and holds explicit-value scenarios (sealed-small, sealed-large, vented-b4, …) keyed by WinISD's own `.wdr`/`.wpr` names | `ps aux`; `git status --porcelain`; read the fixture                                                                                                                      |
| **Unit-boundary sweep** | **No artifact has landed.** Nothing to review and nothing to trust either way                                                                                                                                                                                                                                                                                               | `grep -rni "unit-boundary\|unit boundary\|units at the boundary"` over every `.md` in the repo → 0 hits. `git status --porcelain` shows only the parity fixture untracked |

### Clean bill on two counts

- **No skipped or pending tests anywhere** — `grep` for `.skip`/`.todo`/`.fixme`/`xit(` across
  `packages/*/test` returns only two `process.exit` lines in generator scripts, no test directives.
- **No `TODO`/`FIXME`/`XXX:` in any `packages/*/src` file.**
- **❔ untested:** whether the full unit and browser suites are currently green. Two sibling vitest
  runs were live in this working tree while this document was written, so no suite was started —
  concurrent suites manufacture false failures (QO10: 4 workers → 84 false fails; `--workers=1` →
  188 pass / 0 fail). Verify on a quiet tree before starting the migration.

---

## 3. Risks if the migration started today

**R1 — 48 tests are pinned to the class Phase 5 deletes, and some pin behaviour recorded nowhere
else.** Eight files under `packages/winisd/test` instantiate `Driver`: `driver-class` (10),
`driver-derive` (9), `driver-projection` (8), `driver-json` (5), `driver-roundtrip` (5),
`driver-hardening` (4), `wdr-carried-keys` (4), `roundtrip` (3). Four more test files reference
`@openisd/winisd` from outside the package (`ui/test/ui/driver-editor-units.test.ts`,
`ui/test/logic/persist.test.ts`, `engine/test/driver.test.ts`,
`engine/test/advanced-figures.test.ts`). `driver-roundtrip.test.ts` is the **only** place asserting
that ParState slots 1..48 round-trip identically against a genuine WinISD save, and it is the file
carrying the QO30 slot-0 exclusion. Deleting it without porting loses the Znom question's only
regression witness.

**R2 — the coverage gate fails for a reason that is not a regression.** Thresholds are pinned tight
(`vitest.config`: 15.8 / 78.5 / 54.0 / 15.8). Removing a 469-line covered file and 48 tests moves
every number. The failure will look like a quality regression and is not one; the correct response
is to re-baseline once the ported tests are green, never to lower the gate to clear the red.

**R3 — three `.wdr` writers exist, and the migration adds rather than removes.** `classic/wdr.ts`'s
`toWdr()` (driver authored in the OpenISD UI), `native/openisdToWdr.ts`'s `openisdYamlToWdr()` (the
full 56-field WinISD-faithful save), and `winisd_tools`' `rebuild_wdr.py`. `openisdToWdr.ts:18-21`
states the first two are deliberately not shared — "two writers exist because two formats exist".
The third is a genuine duplicate implementation, and an `Rme` formula divergence between it and the
JS side is already on record (`BACKLOG.md:100-101`). The bridge that would retire it exists in no
Python file. Until it does, "one implementation" is aspirational.

**R4 — the deliberate WinISD divergences must survive the rewrite.** These are correctness
decisions, not bugs, and a fresh implementation is exactly where they get silently "fixed" back
into WinISD's behaviour:

- **`numVC` ParState slot — openisd writes `C`, WinISD pins `E`.** WinISD asserts "entered by the
  human" on a value nobody typed (`../winisd_research/KNOWLEDGE_REPORT.md:190`, `:198`). openisd
  autofills `numVC = 1` inside `Driver#derive()` at `packages/winisd/src/driver.ts:445` (declared at
  `:408`), so the slot honestly reads `C`. Ruled 2026-08-13: _"there was a winisd bug here -
  obvuously dont replicate that"_. Recorded at `docs/spec/SPEC_ENGINE.md:396-397` and
  `BACKLOG.md:482-489`. **`OpenISDDriver` must keep emitting `C`**, and the parity suite must expect
  the one-character difference rather than flag it.
- **Humidity and pressure are live and default-on.** `packages/engine/src/air.ts:104-140` computes
  moist-air density and sound velocity from temperature, humidity and pressure;
  `air.ts:81` carries an explicit _opt-in_ flag to WinISD's behaviour of ignoring them, and
  `air.ts:136` defaults humidity to `RH_REF_PCT` rather than discarding it. Per QO7 and
  `BACKLOG.md:480-481`, the parity suite must run with that ignore-flag **ON** or it reports a
  permanent ~0.07 dB divergence at 30 °C. A migration that re-baselines goldens without the flag
  bakes the divergence into the new fixtures.
- **`VCCon=2` for series wiring** (`BACKLOG.md:348`) — WinISD has a save bug and always writes `1`;
  openisd must not replicate it.

**R5 — fixture and oracle exposure.**

- `drivers/sample/winisd/` — **78 `.wdr` files written by WinISD itself.** This is the oracle for
  `openisdToWdr.test.ts` and it must never be regenerated by our own writer;
  `openisdToWdr.ts:11-14` states the rule — a third-party database's `.wdr`-shaped export is not an
  oracle however plausible it looks. Two stray editor backups sit in the directory
  (`s-connection-serial-2vc.wdr~`, `s-connection-serial.wdr~`) and should not be read as samples.
- `packages/model/test/fixtures/openisd/8fr-8.openisd.yml` plus
  `packages/model/test/fixtures/real_openisd_fs10-20a8.yml`, and
  `packages/winisd/test/fixtures/openisd/{e150he-44,w5-1138smf}.openisd.yml` — the only
  native-shape fixtures in the tree. Phase 1 needs more, and they must be real records, not
  hand-written approximations.
- `packages/winisd/test/fixtures/winisd-parity/scenarios.json` — untracked, in flight. Do not edit.
- `packages/ui/src/drivers-bundle.json` — regenerated by `scripts/bundle-drivers.mjs` on every
  `predev`/`prebuild`. 1500+ records, so every browser run re-bundles; keep verification scoped to
  the specs the change actually touches.

**R6 — concurrent sessions in one working tree.** Two sibling vitest runs were live while this was
written. This has already produced untrustworthy results once (QO19) and false failures once (QO10).
The migration touches the whole driver layer; run it on a quiet tree, one suite at a time.

---

## 4. The shortest honest path to "ready"

1. Answer **B3** and **B4** — two decisions, no code, and Phase 1's tests cannot be written without
   them.
2. Fix **B2** — one document, one contradictory sentence, and it decides a derivation rule.
3. Land **B5** green and committed.
4. Confirm the full suite is green **on a quiet tree** with no sibling agent running.

Then Phase 0 starts.
