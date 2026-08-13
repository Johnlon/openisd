# Plan — reach the architecture specification

[`ARCHITECTURE.md`](../../ARCHITECTURE.md) specifies the system. This plan is the ordered work
that makes the code match it. Where the two disagree, the specification is correct.

Two strands run through the same files, so they are interleaved rather than sequenced:

- **M** — the OpenISD record becomes the app's driver model; `@openisd/winisd` becomes
  serialisation only.
- **L** — the layering: `ui → logic → services → domain`, a composition root, injected
  dependencies, no module-level singletons.

Each step states **what changes**, **the proof**, and **what it unblocks**. A step is done when
its proof is green.

---

## Starting position

Measured 2026-08-13.

| Fact | Value |
| --- | --- |
| `OpenISDDriver` | exists, `packages/winisd/src/native/openisdDriver.ts`, 4 tests green |
| App code consuming the OpenISD record types | **0 files** outside `packages/winisd` |
| `Driver` class consumers | 4 value-import sites · 35 call sites · 8 test files / 48 tests |
| `DriverRaw` | 100 references across 23 files |
| `DriverJSON` | 37 references across 9 files |
| engine `Driver` interface | 15 annotation sites |
| Architecture gate | red — layering and IoC violations enumerated by the test itself |
| Only witness for ParState slots 1–48 against a genuine WinISD save | `driver-roundtrip.test.ts` |
| Coverage gate | 15.8 / 78.5 / 54.0 / 15.8 |

The app has not moved onto the new model at all. That is the useful fact in this table: there is
nothing to unpick, only wiring to do.

---

## Step 1 — `@openisd/model` becomes a package (M)

**Change.** `packages/winisd/src/native/` moves to `packages/model/src/` as `@openisd/model`:
the record types, the YAML codec, the derivation adapter, `OpenISDDriver`. `packages/winisd`
keeps `classic/` and depends on `@openisd/model`.

**Proof.** `packages/winisd/package.json` lists `@openisd/model`; `@openisd/model`'s own
`package.json` lists only `@openisd/engine` and `yaml`; typecheck clean; the moved tests pass at
their new paths.

**Unblocks.** Everything. While the model lives inside the WinISD package, no consumer can depend
on the model without also depending on the serialiser, and the specification's dependency table
cannot be satisfied.

---

## Step 2 — `OpenISDDriver` covers what the app needs (M)

**Change.** Extend `OpenISDDriver` to the surface the store actually calls. Read
`packages/winisd/src/driver.ts` and enumerate every public member the 35 call sites use;
implement each on `OpenISDDriver` against the OpenISD record. Includes at minimum: consistency
issues, the auto-calculate toggle, the errors list, and the field-group rules the editor relies
on.

**Proof.** A test per member, expected values derived from the T/S relations, not read back from
the implementation. The enumeration itself is a checked list in this step's ledger note.

**Unblocks.** Step 4.

---

## Step 3 — the services layer and the composition root (L)

**Change.** Create `packages/ui/src/services/` holding `driverRepo`, `myDriverRepo`, `prefsStore`,
`fileIO`, `diagnostics`, `logging`. Each exports one `create<Name>(deps)` factory and nothing
pre-built. `KeyValueStore` is an interface with a `localStorage` implementation and an in-memory
implementation. `main.ts` becomes the composition root: it constructs every service and the store,
wires them, and mounts the app.

The workflow currently in `db/` — "the user chose a driver", the browse-dialog state, the
reload-on-edit watch — moves **up** into `logic/`. What remains is query and persistence.

**Proof.** These architecture-gate assertions go green: a service imports neither `logic` nor a
sibling service; no service exports a pre-built instance or a mutable binding; every service module
offers a `create*()` factory.

**Unblocks.** Step 5, and it is the step that stops the dependency arrow pointing backwards.

---

## Step 4 — the store holds `OpenISDDriver` (M)

**Change.** `createStore` holds an `OpenISDDriver`. The driver enters the store from
`driverRepo`/`myDriverRepo` as an `OpenISDRecord`. `logic` computes every value a component
displays.

**Proof.** The unit suite green. The parity suite green with the WinISD-compatibility toggle on.
The golden fixtures unmoved, or moved by an amount that is explained and stated before regenerating.

**Unblocks.** Steps 6 and 7.

---

## Step 5 — `ui` depends on `logic` alone (L)

**Change.** Components stop importing services, the engine and the serialiser. The app facade is
provided at the root and injected. Every value a component renders arrives as data.

**Proof.** These gate assertions go green: `ui` imports nothing below `logic`; a component imports
no value from `@openisd/*`.

**Unblocks.** Step 7, and any future second front-end.

---

## Step 6 — delete the WinISD-shaped model (M)

**Change.** Delete the `Driver` class, `DriverRaw`, `DriverJSON` and the engine's `Driver`
interface. Migrate every consumer as it breaks. No shim, no adapter, no re-export: a caller that
breaks is the signal that it must be migrated.

**Before deleting**, `driver-roundtrip.test.ts` must assert ParState slots 1–48 against a genuine
WinISD save through the NEW serialisation path. It is the only witness for those slots, and it
currently runs through the class being deleted.

**Proof.** Zero references to the four types. Typecheck clean. The unit suite green. The coverage
gate **rebaselined** — recomputed against the smaller tree, not lowered.

**Unblocks.** Step 7.

---

## Step 7 — `@openisd/winisd` is serialisation only (M)

**Change.** The package exports a reader and a writer over `.wdr`/`.wpr` and nothing else. No
model, no state, no derivation. ParState, the carried-key set, the voice-coil encoding and write
precision are internal to it.

**Proof.** Its public surface is a reader and a writer. `command grep -rn "ParState" packages/ui
packages/model` returns nothing.

**Unblocks.** The `winisd_tools` half: Python stops carrying its own `.wdr` mapping and calls this
one, which is what ends the two-writer divergence that put `Gloss = 0` into 245 library records.

---

## Step 8 — the gate is green and stays green (L)

**Change.** Any assertion still red is resolved by changing the code. An assertion is only changed
if it is wrong, and then the reasoning is recorded.

**Proof.** `npx vitest run packages/ui/test/ui/architecture.test.ts` — all assertions green.

---

## Definition of done

All of the following are true at once:

1. `packages/ui/test/ui/architecture.test.ts` — every assertion green.
2. No reference anywhere to `Driver` (the class), `DriverRaw`, `DriverJSON`, or the engine's
   `Driver` interface.
3. `@openisd/winisd`'s public surface is a reader and a writer over WinISD's files.
4. `ParState` appears in no package above the domain layer.
5. `npm run typecheck` clean across every package.
6. `npm run test:unit` green.
7. The browser suite green at `--workers=1`.
8. The parity suite green with the WinISD-compatibility toggle on, and every deliberate divergence
   expected by name rather than reported.
9. The coverage gate green against a recomputed baseline.

---

## Conflicts to clean up

Documents that disagree with the specification. Each is a TODO. **None of them blocks a step
above.**

| Document | Conflict |
| --- | --- |
| `docs/plans/PLAN_OPENISD_DRIVER_MODEL.md` | Its phase numbering predates the specification |
| `docs/plans/OPENISD_MODEL_MIGRATION_READINESS.md` | Its blocker list is superseded by this plan's steps |
| `openspec/project.md` | Names the module set the specification replaces |
| `openspec/specs/*/spec.md` | Written against the current component boundaries |
