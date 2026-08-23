# Box type has three enumerations across three packages, and two spellings of the PR member

Status: OPEN

## Symptom

One domain concept — which enclosure alignment a design uses — is declared three times, in
three packages, with three different member sets. Two of them spell the passive-radiator
member differently, so a translation function exists solely to convert one name for a thing
into another name for the same thing.

| declaration | members |
|---|---|
| `packages/engine/src/types.ts:65` `BoxType` | `sealed` `vented` `pr` `bandpass4` |
| `packages/model/src/openisdProject.ts:37` `AlignmentKind` | `sealed` `vented` `bandpass4` `passive-radiator` |
| `packages/ui/src/ui/shells/original/OriginalShell.vue:92` `OgBox` | `sealed` `vented` `pr` `bandpass4` `bandpass6` `abc` |

## Evidence

`packages/engine/src/types.ts:65`:

    export type BoxType = 'sealed' | 'vented' | 'pr' | 'bandpass4';

`packages/model/src/openisdProject.ts:37`:

    export type AlignmentKind = 'sealed' | 'vented' | 'bandpass4' | 'passive-radiator';

`packages/ui/src/ui/shells/original/OriginalShell.vue:92`:

    type OgBox = 'sealed' | 'vented' | 'pr' | 'bandpass4' | 'bandpass6' | 'abc';

`packages/ui/src/logic/managedProject.ts:67` states the overlap in its own words:
"`BoxType` (@openisd/engine) and `AlignmentKind` (@openisd/model) name the same four".
They do not name them the same: `pr` and `passive-radiator` are two names for one member.

`OriginalShell.vue:37` imports `toAlignmentKind` from `logic/managedProject.js`. That import
exists only to bridge the two spellings — a component needs it to say which box it is showing.

`OriginalShell.vue:108` carries the cast the divergence forces:

    watch(selectedBox, (b) => { if (SUPPORTED_BOX.has(b)) state.box = b as BoxType; });

The `as BoxType` assertion is unchecked: `OgBox` has two members (`bandpass6`, `abc`) that
`BoxType` cannot represent. Correctness here rests entirely on the `SUPPORTED_BOX` guard being
kept in sync by hand with `BoxType`'s member list, in a different package, with no gate
relating them.

## Cause

`OgBox` was declared inside the component because the Original shell needs to OFFER box types
the engine cannot yet simulate (`bandpass6`, `abc`) so the picker can show them as pending.
That is a real requirement, but it was met by declaring a third private enumeration in a `.vue`
file rather than by modelling "offered" and "simulatable" as two facts about one enumeration.

The `pr` / `passive-radiator` split is independent of that: two packages named the same member
differently and a converter was written instead of one of them being changed.

## Impact

- The alias mechanism the project bans: one concept, two names, a converter between them.
- `as BoxType` at `OriginalShell.vue:108` is an unchecked narrowing whose safety depends on a
  hand-maintained `Set` in a different package staying in sync.
- Adding a box type means editing three declarations in three packages, plus
  `REQUIRED_BY_BOX` (`packages/engine/src/params.ts:79`), with nothing failing if one is missed.
- The layering gate cannot see any of it: `packages/ui/test/ui/architecture.test.ts` scans
  `packages/ui/src` only, so a duplicated domain enumeration inside a `.vue` file is invisible
  to it.

## Fix

Not yet decided — needs a ruling on which spelling survives, because changing either is a
cross-package change:

1. Pick ONE spelling for the passive-radiator member (`pr` or `passive-radiator`), change the
   other package to match, and delete `toAlignmentKind`/`alignmentKindOfBType`'s spelling half.
   The `.wpr` `BType` integer mapping is genuine external-vocabulary parsing and stays.
2. Move the "which box types does the UI offer, and which can the engine simulate" question out
   of `OriginalShell.vue` into one module that derives the offered list from the engine's own
   `BoxType` rather than re-typing it.

## Verification

- `grep -rn "passive-radiator" packages/` returns hits only where a `.wpr` file's own
  vocabulary is being parsed, not in an app-internal type.
- No `as BoxType` assertion remains in `packages/ui/src`.
- A test asserts every member the picker offers is either in `BoxType` or flagged unsupported,
  derived from `BoxType` itself rather than a hand-written literal.
