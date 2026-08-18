# `ManagedProject`'s edit-draft lifecycle (`beginEdit`/`commitEdit`/`cancelEdit`) is dead in production — driver-field edits go straight to committed state, uncancellable

## Symptom

`ManagedProject`'s own header doc describes an edit-draft mechanism as central to the design:
an in-progress edit is meant to accumulate silently in an overlay, and `cancelEdit()` is meant
to discard it, leaving committed state "byte-identical to before `beginEdit()`." In the actual
running app, this mechanism is never entered. Every driver-field edit in the tuning panel
(`OgTune.vue`) writes directly and irreversibly to committed state the instant it's typed —
there is no session to cancel, and no way to discard a batch of in-progress driver-field
changes. The only undo available is `clear()`, one field at a time.

## Evidence

`packages/ui/src/logic/managedProject.ts:313-336` — `beginEdit()`/`commitEdit()`/`cancelEdit()`
are fully implemented, matching the class's own extensive header documentation of the
ground/committed/overlay model.

Every call site of `.beginEdit()` in the repo:
```
packages/ui/src/logic/store.ts:65        (doc comment only, mentions the method exists)
packages/ui/test/logic/managedProject.test.ts:64,96,154,163,190   (unit tests only)
```
`grep -rn "\.beginEdit()" packages/ui/src` finds **zero** matches outside that one doc comment —
no `.vue` component, no other `.ts` module, calls it.

`packages/ui/src/ui/shells/original/OgTune.vue:66-73` — the driver-field input handler:
```ts
function onField(key: NumKey, scale: number, e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  ...
  if (raw.trim() === '') clearDriverField(key);
  else if (isFinite(v)) enterDriverField(key, v / scale);
}
```
calls straight into `store.ts:299-303`:
```ts
export function enterDriverField(field: SpecField, value: number): void {
  managedProject.enter(field, value);
}
export function clearDriverField(field: SpecField): void {
  managedProject.clear(field);
}
```
Neither wraps a `beginEdit()`/`commitEdit()`/`cancelEdit()` session. `managedProject.enter()`
routes through `#effective()` (`managedProject.ts:145-147`), which returns `#overlay?.layer ??
#committed` — since nothing ever calls `beginEdit()` (or `beginWhatIf()`, which OgTune.vue DOES
use, but only for the box `Vb` what-if scrub at line 174, not for driver-field typing), `#overlay`
is always null for driver fields, so every keystroke writes straight to `#committed`.

`DriverEditorModal.vue` does not use `ManagedProject`'s overlay either — it builds its own
separate `draftDriver` instance (`OpenISDDriver.fromRecord(seed.json)`, line 51), entirely
outside `ManagedProject`'s edit lifecycle.

## Cause

The edit-draft mechanism was built and tested against `ManagedProject`'s own unit test suite,
but no UI call site was ever wired to use it for driver-field edits — `OgTune.vue` calls the
per-field `enter`/`clear` API directly, which is `ManagedProject`'s always-available live-write
path, not gated by `beginEdit()`. The what-if mechanism (`beginWhatIf`/`cancelWhatIf`) IS wired
up and used (for the box `Vb` scrub), so the app's authors clearly knew how to invoke the
overlay pattern — the edit-draft half of the same class was simply never connected to any
driver-field UI.

## Fix

**Ruled (human, 2026-08-18): the edit-draft lifecycle dies.** Not option (a) — `OgTune.vue` is
not getting wrapped in `beginEdit()`/`commitEdit()`/`cancelEdit()`. `clear()` (per the sibling
ruling on this same date — see `BACKLOG.md` "Driver data & T/S") is the one and only per-field
undo mechanism; there is no batch/session-level cancel for driver fields, and none is being
added. Delete outright, not applied yet:
- `beginEdit()`, `commitEdit()`, `cancelEdit()` (`managedProject.ts:313-336`)
- `isEditActive()` and any `Overlay` variant/branch that exists only to support the `'edit'` kind
  (the `'whatif'` kind stays — `beginWhatIf`/`cancelWhatIf`/`isWhatIfActive` are real, used code)
- `managedProject.test.ts`'s tests covering the deleted methods (lines 64, 96, 154, 163, 190 and
  whatever each test body covers)
- The header doc comment's description of an "EDIT draft" as one of the two overlay kinds —
  rewrite once only what-if remains, don't leave it describing a mechanism that's gone

Not applied here — reported/ruled per bug-first rule, implementation is separate follow-up work.

## Verification

Not yet — no fix applied.
