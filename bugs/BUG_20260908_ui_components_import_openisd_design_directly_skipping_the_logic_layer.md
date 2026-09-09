# Two components import the domain and the engine directly, skipping the logic layer

Status: RESOLVED 2026-09-09

## Symptom

`packages/ui/test/ui/architecture.test.ts` reports the same three imports against four separate
rules:

```
ui/components/DriverEditorModal.vue imports @openisd/design
ui/shells/original/OriginalShell.vue imports @openisd/design
ui/shells/original/OriginalShell.vue imports @openisd/design/engine
ui/components->engine: ui/shells/original/OriginalShell.vue imports @openisd/design/engine
```

The rules broken: "the presentation layer depends on logic and nothing below it", "a component
imports no value from the domain", "the draft exemption names a file that still exists and still
holds a draft", and the ruled layer matrix (`ui/components->engine` is not on it).

## Exactly what is imported, and where each one is used

### `packages/ui/src/ui/components/DriverEditorModal.vue`

```ts
line 9:  import { OpenISDDriver, VoiceCoilWiring } from '@openisd/design';
line 13: import type { Cell, FieldHandle } from '@openisd/design';
```

Line 13 is type-only and is NOT an offence — the gate states a type-only import is not a
dependency. Line 9 imports two values:

| Name | What it is | Used at | Doing what |
|---|---|---|---|
| `OpenISDDriver` | the domain's driver class | `seedDraft()` line 62–65 | return type, and `OpenISDDriver.empty(engine)` constructs a blank driver for a new My Driver |
| | | `commitToMyDrivers(driver)` line 77 | parameter type |
| | | `savedEntryForSubject()` line 86 | return type |
| `VoiceCoilWiring` | the domain's coil-wiring enum | `setWiring()` line 294 | `VoiceCoilWiring.Series` / `.Parallel` written into `d.spec[d.section].VCCon.set(...)` |

`OpenISDDriver.empty(engine)` at line 64 is a CONSTRUCTION site, which is what the "only one file
constructs an OpenISDDriver" rule exists to prevent. The file's own comment (lines 38–40) says it
is one of the licensed constructors — naming `managedProject.ts`, which no longer exists.

### `packages/ui/src/ui/shells/original/OriginalShell.vue`

```ts
line 35: import { OpenISDPassiveRadiatorStandalone, type OpenISDProject } from '@openisd/design';
line 44: import { Engine, type BoxType } from '@openisd/design/engine';
```

`OpenISDProject` and `BoxType` are type-only and are NOT offences. The two values:

| Name | What it is | Used at | Doing what |
|---|---|---|---|
| `OpenISDPassiveRadiatorStandalone` | the domain's passive-radiator class | line 764 | `project.value.box.passiveRadiator.configurePR(OpenISDPassiveRadiatorStandalone.empty(engine))` — constructs a blank radiator |
| `Engine` | the physics engine class | line 106 | `const isSimulatable = (b: BoxType) => new Engine().simulatableBoxType(b) !== null` — constructs an engine and calls it to decide which box types the picker offers |

Line 106 is the one the layer matrix names separately: a component builds an `Engine` and calls a
method on it, so a physics decision is made inside the view.

### The passive-radiator components read the domain object field by field

Three components hold `OpenISDPassiveRadiatorStandalone` and call domain methods on it:

| File | Line | The domain call |
|---|---|---|
| `PRBrowser.vue` | `nameOf` / `summaryOf` | `pr.spec.Sd_m2.get().value`, `Mms_kg`, `Cms_m_per_N` — spec reads in the template's own helpers |
| `PRBrowser.vue` | emits | `load: [OpenISDPassiveRadiatorStandalone]` — a domain object crosses a component event |
| `PREditModal.vue` | `saveCurrentPR` | `radiator.detach()` then `myPassiveRadiators.upsert(...)` — a domain call and a repo call in one component function |
| `PREditModal.vue` | `loadPR` | `project.value.box.passiveRadiator.configurePR(pr)` |
| `OriginalShell.vue` | `loadPREntry`, `loadBundledPassiveRadiatorEntry` | the same `configurePR(pr)` |

John, 2026-09-09: "view isnt allowed to talk to domain". Same defect as the driver editor above,
in the radiator half of the app: the component names the domain class, reads its fields, and
decides what to save.

## Cause

The `packages/model` → `packages/design` migration changed the specifier these components import
without moving the calls behind `logic/`. The written exemption that covered
`DriverEditorModal.vue` names `@openisd/model`, a package that no longer exists, so it stopped
matching the import that is actually there.

## The editor also holds the edit state, which is the larger half

The import is the symptom the check can see. Underneath it, `DriverEditorModal.vue` runs the
whole editing session itself.

```ts
function seedDraft(): OpenISDDriver {
  if (subject.kind === 'project') return project.value.driver.detach();
  return subject.seed ? subject.seed.detach() : OpenISDDriver.empty(engine);
}
```

Two lines of branching that use no template, no event and no DOM — ordinary logic, sitting in a
component, and RETURNING a domain object into view code.

```ts
function reset() {
  draftDriver.value = markRaw(seedDraft());
  forceUpdate();
}
```

`draftDriver` is the in-progress edit — the state of the whole editing session — held in the
`.vue` file. `markRaw` is there to stop Vue looking inside the domain object, and `forceUpdate()`
exists to redraw by hand because `markRaw` removed the tracking that would have done it. Both
calls are consequences of keeping domain state in a component; neither is needed once the draft
lives in `logic/`.

The component also imports `engine` from `logic/appState.js` purely to feed
`OpenISDDriver.empty(engine)` — so it holds the engine and the domain class to run a two-line
function.

John, 2026-09-08: "the ui components code is meant to be interactons and callbacks only and all
the logic and refs to the domain go in the logic", and "there really is not excuse at all".

## Fix

The calls move behind `logic/`. Re-granting the exemption is not an alternative — the exemption
was written for `@openisd/model`, a package that no longer exists, and re-issuing it against
`@openisd/design` would bless exactly what is wrong here.

What moves:

| From | What goes to `logic/` |
|---|---|
| `DriverEditorModal.vue:62` `seedDraft()` | the function itself; the component asks for a draft and never names `OpenISDDriver` |
| `DriverEditorModal.vue` `draftDriver` + `reset()` | the draft state, so `markRaw` and `forceUpdate()` are no longer needed |
| `DriverEditorModal.vue:77,86` `commitToMyDrivers`, `savedEntryForSubject` | both take or return `OpenISDDriver` |
| `DriverEditorModal.vue:294` `VoiceCoilWiring.Series/.Parallel` | the component sends `'series'`/`'parallel'`; `logic/` maps it to the enum |
| `OriginalShell.vue:106` `new Engine().simulatableBoxType(b)` | a `logic/` helper answering "is this box type simulatable?" |
| `OriginalShell.vue:764` `OpenISDPassiveRadiatorStandalone.empty(engine)` | a `logic/` call the component asks for; the component never constructs a domain object |
| `PRBrowser.vue` `nameOf` / `summaryOf` | a `logic/` function returning the row's display strings; the component renders strings, never spec fields |
| `PRBrowser.vue` emits | the row's identity (a uuid, or an index into the bundled list), not the radiator |
| `PREditModal.vue` `saveCurrentPR` / `loadPR`, `OriginalShell.vue` `loadPREntry` / `loadBundledPassiveRadiatorEntry` | a `logic/` pair — "save the box's radiator to my library", "load this library radiator into the box" — each taking the row identity, not a domain object |

Afterwards neither component imports `@openisd/design` or `@openisd/design/engine` at all, and
the exemption is deleted rather than reworded.

One open question for John, because it is a structure decision and not a mechanical move: whether
the draft state belongs in an existing `logic/` module or a new one.

## What was done

Every call in the table above moved behind `logic/`. No component imports `@openisd/design` or
`@openisd/design/engine` as a value.

| New in `logic/` | Replaces |
|---|---|
| `driverDraft.ts` — `openDriverDraft(subject, projectDriver)`, returning a handle with `driver`, `reset()`, `replace()`, `setWiring('series'\|'parallel')` | `DriverEditorModal.vue`'s `seedDraft()`, its `markRaw`/`shallowRef` draft holder, and its `VoiceCoilWiring` writes |
| `driverDisplay.ts` — `passiveRadiatorRows(entries)` returning `{id, name, sd, mms, cms}` strings | `PRBrowser.vue`'s `nameOf`/`summaryOf` spec reads and `PREditModal.vue`'s row rendering |
| `appState.ts` — `definePassiveRadiator()` | `OriginalShell.vue:764` `OpenISDPassiveRadiatorStandalone.empty(engine)` |
| `appState.ts` — `boxTypeIsSimulatable(boxType)` | `OriginalShell.vue:106` `new Engine().simulatableBoxType(b)` |

`PRBrowser.vue` now emits a row `id` (a storage uuid, or the bundled list position) instead of a
radiator; `OriginalShell.vue` resolves that id back to a radiator. `PREditModal.vue` holds rows of
strings and calls `loadPR(uuid)`.

`DriverEditorModal.vue` keeps `type { Cell, FieldHandle }` — type-only, which the gate states is
not a dependency.

## Verification

```
npx vitest run packages/ui/test/ui/architecture.test.ts
  ✓ the presentation layer depends on logic and nothing below it
  ✓ a component imports no value from the domain — a type-only import is not a dependency
  ✓ every cross-layer import matches a ruled-legal edge
npx vitest run packages/ui/test/ui/no-domain-value-through-component.test.ts   5 passed
npx vue-tsc -p packages/ui --noEmit                                           0 errors
```

Both gates were made to fail on purpose and watched go red before being restored: re-adding
`import { OpenISDDriver } from '@openisd/design'` to `DriverEditorModal.vue` fired the layering
gate; declaring `load: [OpenISDPassiveRadiatorStandalone]` on `PRBrowser.vue`'s emits fired the
A9 gate.

New tests: `packages/ui/test/logic/driverDraft.test.ts` (5), `driverDisplay.test.ts`
`passiveRadiatorRows` (4), `newProject.test.ts` `definePassiveRadiator` + `boxTypeIsSimulatable`
(4). Each was watched fail for the right reason before its implementation existed.

The four remaining `architecture.test.ts` failures are a DIFFERENT defect — gates naming deleted
files — recorded in
`bugs/BUG_20260909_five_architecture_gates_name_deleted_packages_so_three_error_and_two_guard_nothing.md`.
