# Two WinISD converters build domain objects and pass live ones in and out

Status: OPEN

## Symptom

`packages/ui/test/ui/architecture.test.ts` reports an unapproved dependency:

```
winisd->engine: packages/design/winisd/openIsdProjectToWinIsdProject.ts imports ../engine/index.js
winisd->engine: packages/design/winisd/driverYmlToOpenisdAndWdr.ts imports @openisd/design/engine
```

and the same two files reach into the domain, which `ARCHITECTURE.md` §2 says they may not.

## What actually crosses, and what does not

The rule is about STATE, not about naming. Sorted on that basis (John, 2026-09-08: *"if they are
schemata - especially constants then that doesn't really count - more like a type tbh"*):

| Import | What it is | Breaks the rule? |
|---|---|---|
| `CellState` (`parstate.ts:3`, `winisdDriver.ts:23`) | a type | no |
| `Box`, `FieldHandle`, `OpenIsdPassiveRadiatorSpec`, `DriverSpec` | types | no |
| `winISDDriverToOpenISDDeviceJson`, `wdrFields` | pure functions in `domain/openisdSchema.ts`; take a value, return a value, hold nothing | no — schema vocabulary |
| `OpenISDDriver`, `OpenISDProject`, `OpenISDPassiveRadiatorStandalone` | classes, used to CONSTRUCT domain objects | **yes** |
| a live `OpenISDProject` | passed in at `openIsdProjectToWinIsdProject.ts:40`, returned at `:213` | **yes — the real breach** |

So `parstate.ts` and `winisdDriver.ts` — the actual `.wdr` reader and writer — are clean. Only
the two converters are at fault, which their filenames already admit: each names both sides.

## Which function in which file, and what crosses

All in package `@openisd/design`, subpath `winisd/` (`packages/design/winisd/`).

| File | Function | Domain classes used | What crosses | Breach |
|---|---|---|---|---|
| `openIsdProjectToWinIsdProject.ts` | `openIsdProjectToWinIsdProject` :39 | `OpenISDProject` | live instance **in** (:40) | yes |
| `openIsdProjectToWinIsdProject.ts` | `winIsdProjectToOpenIsdProject` :211 | `OpenISDDriver` :221, `OpenISDProject` :229, `OpenISDPassiveRadiatorStandalone` :304 | constructs; live instance **out** (:213) | yes |
| `driverYmlToOpenisdAndWdr.ts` | `openIsdDriverToWinIsdDriver` :466 | `OpenISDDriver` | live instance **in** | yes |
| `driverYmlToOpenisdAndWdr.ts` | `winIsdDriverTextToOpenIsdDriver` :590 | `OpenISDDriver` | constructs; live instance **out** | yes |
| `driverYmlToOpenisdAndWdr.ts` | `driverYmlToOpenisdAndWdr` :613 | via the two above | both directions | yes |
| `driverYmlToOpenisdAndWdr.ts` | `radiatorStatedValues` :158, `statedValues` :189, `wdrVCCon` :434 | `OpenIsdPassiveRadiatorSpec`, `DriverSpec` — types | nothing | no |
| `parstate.ts` | — | `CellState` — type | nothing | no |
| `winisdDriver.ts` | — | `CellState` — type | nothing | no |

## Detached value vs live link into another layer's state

These are not the same offence, and only one risks corrupting what the user is editing.

| File | Function | Object crossing | Detached or linked | Why |
|---|---|---|---|---|
| `openIsdProjectToWinIsdProject.ts` | `winIsdProjectToOpenIsdProject` :211 | `OpenISDProject` **out** | **detached** | built here from `.wpr` text via `OpenISDProject.builder()`; the caller is its first holder. The writes at :325–337 land on this new object, not on anyone else's |
| `driverYmlToOpenisdAndWdr.ts` | `winIsdDriverTextToOpenIsdDriver` :590 | `OpenISDDriver` **out** | **detached** | built here from `.wdr` text |
| `openIsdProjectToWinIsdProject.ts` | `openIsdProjectToWinIsdProject` :39 | `OpenISDProject` **in** | **LINKED** | receives the UI's live project and reads through it — `project.driver` :45, `project.box` :48, `project.description`/`creator`/`created`/`modified` :60–63, `project.Rs_ohm` :67, `project.powerDrive_W()` :68 |
| `driverYmlToOpenisdAndWdr.ts` | `openIsdDriverToWinIsdDriver` :466 | `OpenISDDriver` **in** | **LINKED** | receives the UI's live driver |

**Detached (out):** a factory in the format package returns an object nobody else holds. No state
is shared. The layering complaint is only that a format package knows how to CONSTRUCT a domain
object; nothing can be corrupted through it.

**Linked (in):** `packages/ui`'s live `OpenISDProject` — the object the app is editing and the
store holds — is handed to the WinISD package, which reaches into its driver, its box and six of
its meta fields. Those functions do not currently write to it, but nothing prevents them: the
object arrives fully live and fully writable, so a future edit inside a `.wpr` export would
silently mutate the user's open project. This is the half worth fixing first.

## Who calls them from outside the package

| Caller package | Caller file | Calls | Receives / sends |
|---|---|---|---|
| `@openisd/ui` | `logic/fileImportExport.ts:47` | `openIsdProjectToWinIsdProject` | sends a live `OpenISDProject` |
| `@openisd/ui` | `logic/fileImportExport.ts:68` | `winIsdProjectToOpenIsdProject` | receives a live `OpenISDProject` |
| `@openisd/ui` | `logic/fileImportExport.ts:33` | `openIsdDriverToWinIsdDriver` | sends a live `OpenISDDriver` |
| `@openisd/ui` | `logic/fileImportExport.ts:54` | `winIsdDriverTextToOpenIsdDriver` | receives a live `OpenISDDriver` |
| build script | `scripts/roundTripGate.mjs:156,161` | both driver converters | both directions |

Every UI caller is one file, `logic/fileImportExport.ts`, already in the correct layer — so
moving the two converters does not disturb the UI: `fileImportExport.ts` keeps calling the same
names from a different path.

## Evidence

`../packages/design/domain/openIsdProjectToWinIsdProject.ts`, read 2026-09-08:

```ts
line 21:  import { OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone } from '../domain/index.js';
line 40:    project: OpenISDProject, engine: Engine,
line 213: ): { value: OpenISDProject | null; errors: DriverError[] } {
line 221:   const driverOrErrors = OpenISDDriver.fromConformingRecord(record, engine);
line 229:   const builder = OpenISDProject.builder(driver, engine);
line 304:      const radiatorOrErrors = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorRecord, engine);
```

A live `OpenISDProject` goes in at line 40 and a newly built one comes out at line 213, so both
directions of domain state cross a package meant to know only WinISD's file format.

## Cause

The rule in `ARCHITECTURE.md` §2 — the WinISD package "imports NOTHING from the domain and must
never learn OpenISD exists" — is a sound boundary for a serialiser: it stops the format reader
from depending on the shape of our own model.

The two conversion functions were then placed inside that package. A function named
`openIsdProjectToWinIsdProject` cannot honour a rule that forbids naming `OpenISDProject`; by
existing where it does, it breaks the boundary by construction. The already-approved
`domain -> winisd` direction is where a converter belongs, because the domain is allowed to
project itself into WinISD's format.

## Fix

Not applied — needs John's ruling on placement, though the direction is implied by the existing
approved dependency:

- move `openIsdProjectToWinIsdProject.ts` and `driverYmlToOpenisdAndWdr.ts` to the domain side,
  leaving `packages/design/winisd/` as the pure `.wdr`/`.wpr` reader and writer it claims to be;
  the approved `domain -> winisd` edge then covers them, and the `winisd -> engine` and
  `winisd -> domain` dependencies disappear rather than needing approval; or
- rule that a converter may sit in `winisd/` and record the two new edges as legal.

The first keeps the rule; the second retires it.

## Verification

None yet — recorded, not fixed.
