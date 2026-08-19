# The "returns a private _Name" arch gate has no same-file-owner exemption, and managedProject.ts has three real cross-file leaks

# Status
PARTIAL — gate fixed (item 1), application leak open as QO59 (item 2)

## Symptom

`packages/ui/test/ui/architecture.test.ts`'s `'every exported function/const/class-member
returning or typed as a private _Name is itself named _...'` test currently fails with 4
offences:

```
model/src/openisdDriver.ts exports 'OpenISDDriver.toRecord' typed as private _OpenISDDriverJson
ui/src/logic/managedProject.ts exports 'ManagedOpenISDProject.snapshot' typed as private _OpenISDProjectJson
ui/src/logic/managedProject.ts exports 'ManagedOpenISDProject.recordToPersist' typed as private _OpenISDProjectJson
ui/src/logic/managedProject.ts exports 'ManagedOpenISDProject.groundRecord' typed as private _OpenISDProjectJson
```

These are two different offences:

1. **`OpenISDDriver.toRecord`** — `_OpenISDDriverJson` is declared in the SAME file
   (`packages/model/src/openisdDriver.ts:216` declares both the interface and the method). The
   sibling gate one block up (`'no file outside a name's declaring file and its own
   PrivateAllow list imports it'`, architecture.test.ts:662-678) already exempts the declaring
   file (`f !== owner` check at line 666) — a type's own owner is allowed to name it. The
   return-type gate (line 725 on) has no equivalent same-file check, so it flags the owner's own
   public accessor as if it were a stranger. This is a **gate false positive**, not a real leak:
   `toRecord()` is `OpenISDDriver`'s documented public API for handing back its record
   (openisdDriver.ts:41-43, "the bytes `toRecord()` hands back").

2. **`ManagedOpenISDProject.snapshot`/`recordToPersist`/`groundRecord`** — `_OpenISDProjectJson`
   is declared in `packages/model/src/openisdProject.ts:196`, a DIFFERENT file from
   `managedProject.ts`. This is a genuine cross-file leak of the private shape through three
   public methods, same class as QO58 (store.ts's `driverRecord` export leaking
   `_OpenISDDriverJson` through inference) — a real architectural violation, not a gate bug.

## Cause

1. is a gap in the gate itself: it was ported to `ts-morph` (closing
   `BUG_20260818_private_type_return_gate_uses_line_anchored_regex_and_misses_class_methods.md`)
   without carrying over the same-file-owner exemption its sibling gate already has.

2 is pre-existing application code that the newly-AST-complete gate now correctly detects for
the first time — `ManagedOpenISDProject` hands its wrapped project record straight out under a
public name in three places instead of exposing it only through the owning module's API.

## Fix

Not applied — reported per bug-first rule.

- **For 1**: add a same-file-owner exemption to the return-type gate, mirroring
  `privateDeclarationSites`/`f !== owner` — skip a hit when the reporting file is also the
  declaring file of the private name being returned.
- **For 2**: requires a human decision (this is exactly QO58's question, now with three more
  call sites). `<Name>PrivateAllow` lists are human-edit-only per architecture.test.ts:599-600 —
  an agent cannot add `managedProject.ts` to `_OpenISDProjectJsonPrivateAllow` on its own
  judgement. The two legitimate options per the gate's own message: (a) rename
  `snapshot`/`recordToPersist`/`groundRecord` to `_snapshot`/`_recordToPersist`/`_groundRecord`
  and let the human add `managedProject.ts` to `_OpenISDProjectJsonPrivateAllow`, or (b) change
  their return type to a public shape (a plain `DriverJSON`-style export) instead of the raw
  private project record.

## Verification

Item 1 applied: `architecture.test.ts`'s return-type gate now filters each hit through
`ownedHere(f, hit)`, which drops any private name whose `privateDeclarationSites` entry
includes the reporting file `f` — generic over every `_Name`, not `_OpenISDDriverJson`-specific.
`npx vitest run packages/ui/test/ui/architecture.test.ts -t "private _Name"` before the fix
reported 4 offences (`OpenISDDriver.toRecord` + the 3 `ManagedOpenISDProject` methods); after
the fix it reports the same 3 `ManagedOpenISDProject` offences only — `toRecord` cleared.

Item 2 not applied — tracked as QO59, needs a human ruling between renaming the three methods
(plus a human-made `PrivateAllow` addition) or returning a public shape instead.
