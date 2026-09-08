# UI components import @openisd/design directly, so the view calls the domain and the engine

Status: OPEN

## Symptom

`packages/ui/test/ui/architecture.test.ts` reports the same three imports against four separate
layering rules:

```
ui/components/DriverEditorModal.vue imports @openisd/design
ui/shells/original/OriginalShell.vue imports @openisd/design
ui/shells/original/OriginalShell.vue imports @openisd/design/engine
```

The rules they break: "the presentation layer depends on logic and nothing below it", "a
component imports no value from the domain", "the draft exemption names a file that still holds
a draft", and "ManagedProject never hands an OpenISDDriver out".

## Evidence

Read 2026-09-08 from the two components' import lines. `OriginalShell.vue` reaches the engine
package directly, so a physics call sits in a shell component; `DriverEditorModal.vue` reaches
the domain package.

The `DriverEditorModal.vue` exemption in the gate is written for `@openisd/model`, a package
that no longer exists, so it does not match the import that is actually there.

## Cause

The `packages/model` → `packages/design` migration changed the specifier the components import
without moving the calls behind `logic/`. The exemption that used to cover the editor names the
old package name and therefore stopped applying at the same moment.

## Fix

Not decided. Two shapes, and the choice is John's:

- move what the two components use behind a `logic/` module, deleting the need for any
  exemption; or
- rule the `@openisd/design` edge legal for the editor and restate the exemption in the gate
  against the current package name.

An agent may not widen the gate's allow-list on its own authority.

## Verification

None yet — the defect is recorded, not fixed.
