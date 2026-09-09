# Two components import the domain and the engine directly, skipping the logic layer

Status: OPEN

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

Afterwards neither component imports `@openisd/design` or `@openisd/design/engine` at all, and
the exemption is deleted rather than reworded.

One open question for John, because it is a structure decision and not a mechanical move: whether
the draft state belongs in an existing `logic/` module or a new one.

## Verification

None yet — recorded, not fixed.
