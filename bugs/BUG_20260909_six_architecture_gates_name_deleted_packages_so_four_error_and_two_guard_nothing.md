# Six architecture gates name deleted files, so four error out and two guard nothing

Status: OPEN

## Symptom

`npx vitest run packages/ui/test/ui/architecture.test.ts` — 7 of 23 tests fail. Four of them
never reach an assertion:

```
× ManagedProject is the only holder of OpenISDDriver > managedProject.ts itself is the one file that constructs an OpenISDDriver
  → ENOENT: no such file or directory, open '.../packages/ui/src/logic/managedProject.ts'
× containment is total > ManagedProject never hands an OpenISDDriver out — every public member returns data
  → File not found: .../packages/ui/src/logic/managedProject.ts
× ManagedProject is the only holder of OpenISDDriver > the draft exemption names a file that still exists and still holds a draft
  → DriverEditorModal.vue no longer holds a live draft
× export * is banned outright — QO86 ratchet > no export * site outside the recorded baseline
  → the scan found fewer export * sites than the baseline records — the gate would pass vacuously
```

## Cause

The `packages/model` → `packages/design` migration deleted the files these gates point at. The
gates were not updated, so each one now names a path that resolves to nothing.

| Gate | `architecture.test.ts` line | Names | State |
|---|---|---|---|
| `managedProject.ts itself is the one file that constructs an OpenISDDriver` | 308, 358 | `src/logic/managedProject.ts` | file deleted — test throws ENOENT |
| `ManagedProject never hands an OpenISDDriver out` | 465, 474 | same | file deleted — test throws |
| `the draft exemption names a file that still exists and still holds a draft` | 324, 334 | `DriverEditorModal.vue` calling `OpenISDDriver.fromOwdrJson` | the call is gone; the exemption is not |
| `export * ... no baselined site has grown` | 711–724 | `model/src/index.ts`, `winisd/src/index.ts` | both packages deleted — the vacuity check at line 787 fires |
| the WHOLE of `architecture-notify.test.ts` | that file's line 52 | `src/logic/managedProject.ts` | file deleted — the suite throws at module scope, so NONE of its tests run |

`architecture-notify.test.ts` is the worst of them: the throw happens while the file is loading,
so vitest reports "Tests no tests" and every notify rule in it is unenforced, not merely one.

## The dangerous half: two gates now pass by guarding nothing

These two are GREEN, and green for the wrong reason. Both filter against paths that match no
file, so they scan a set that can never contain an offence:

```ts
// architecture.test.ts:499 — MANAGED is src/logic/managedProject.ts, which does not exist
.filter(f => f !== STORE && f !== MANAGED)

// architecture.test.ts:517 — @openisd/model was deleted, so this regex matches no import
.filter(vi => /(^|\/)@openisd\/model(\/|$)/.test(vi.spec))
```

`nothing reaches past ManagedProject into the model package for a driver value` cannot fail: it
looks for value imports from `@openisd/model`, and nothing imports that package because it is
gone. The equivalent imports from `@openisd/design` are invisible to it.

This is the same failure mode as the `CellState` exemption in
`bugs/BUG_20260820_model_depends_on_winisd_and_re_exports_its_cellstate.md` — an exemption or
filter written against an old package name stops matching, and the rule silently stops applying.

## Impact

Four permanent red entries in `npm run test:unit`, a gate the project requires green. Worse, two
containment rules are unenforced while reporting green, so a new file naming `OpenISDDriver` as a
value would not be caught.

## Fix

Not mechanical, because `ManagedProject` as a concept is gone — `appState.ts` and `liveProject.ts`
hold what it used to. Each gate needs a decision about what the rule is NOW:

| Gate | What must be decided |
|---|---|
| the three `ManagedProject` gates | whether the containment rule still exists, and if so which file is its subject — the rule was "one facade over a driver", and the facade was deleted |
| the draft exemption | whether `DriverEditorModal.vue` keeps a ruled exemption at all, given `BUG_20260908_ui_components_import_openisd_design_directly_skipping_the_logic_layer.md` says its draft state moves to `logic/` |
| the `export *` baseline | re-record it against the packages that exist (`design`, `persistence`, `ui`), which is a ratchet reset and needs the human's sign-off, not an agent's |

A gate whose subject was deleted is not repaired by deleting the gate — that is the outcome the
rule exists to prevent. It is repaired by naming the rule's current subject, or by ruling the
rule retired.

## The three remaining failures are a different bug

`the presentation layer depends on logic and nothing below it`, `a component imports no value from
the domain`, and `every cross-layer import matches a ruled-legal edge` are real breaches in the
code, recorded separately in
`bugs/BUG_20260908_ui_components_import_openisd_design_directly_skipping_the_logic_layer.md`.

## Verification

None yet — recorded, not fixed.
