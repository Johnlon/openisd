# PR T/S formulas and RHO/C air constants re-implemented outside the engine, one copy truncated

# Status
PARTIAL, engine-containment satisfied, domain-getter form NOT satisfied. `@openisd/engine/
src/formulas.ts` now exports `prCmsFromVas`/`prMmdFromFs`/`prRmsFromQms`; `packages/model/src/
openisdProject.ts:478-486` re-exports them as `prCmsFromWinIsdVas`/`prMmdFromWinIsdFs`/
`prRmsFromWinIsdQms`, and `prWinIsdFields.ts`'s `setPrFsFromWinIsd`, `setPrQmsFromWinIsd`,
`setPrVasFromWinIsd` and `prCanonicalFromDatasheet` call those instead of hand-deriving
`Math.sqrt(...)`/`1/((2π·f)²·Cms)` inline — verified: `grep -n "Math.sqrt\|Math.PI"
packages/ui/src/logic/prWinIsdFields.ts` returns nothing, and `grep -n "1.20095\|343.68"
packages/ui/src/logic/useDesignIO.ts` (the other half, resolved earlier) also returns nothing.
So the math itself is confined to the engine and called from exactly one file outside it.

**Not satisfied: the ruling's literal requirement is a GETTER ON A DOMAIN CLASS**
("reachable ONLY as a getter on the relevant domain class... never called directly as a free
function sprinkled through UI logic"). `prCmsFromWinIsdVas` etc. are free functions exported
from `openisdProject.ts`, called directly from `prWinIsdFields.ts` — the same shape the ruling
named as insufficient ("deduplicating into a shared engine function that's then still called
ad hoc from prWinIsdFields.ts... would not satisfy this"), just with the free function moved
one package over. `PREditModal`/`PRDefineModal` edit a plain `UiParams` object directly, not
an `OpenISDProject` instance, so there is no live domain-class instance in this call path to
hang a getter off without a larger restructuring of PR editing than this task's scope covers.
Needs a human ruling: accept this as the resolution, or require the deeper restructuring.

## Symptom

Three passive-radiator formulas, and the air-physics constants `RHO`/`C`, are duplicated across
`packages/ui/src/logic/prWinIsdFields.ts` and `packages/ui/src/logic/useDesignIO.ts` instead of
living once in `@openisd/engine` and being called — the same class of violation as
`BUG_20260818_vent_area_formula_duplicated_four_times_no_engine_source_of_truth.md`, found in
the same review pass. One of the duplicate copies (`useDesignIO.ts`) uses **truncated**
constants instead of the engine's full-precision values — a real numeric-drift risk, not just
style, since it means `.wpr` export/whatever else `useDesignIO.ts` computes can silently diverge
from every other computation in the app that uses the engine's `RHO`/`C`.

## Evidence

**Mmd-from-Fs/Cms** (`1/(4π²·Fs²·Cms)`), duplicated 4 times, 2 files:
```
packages/ui/src/logic/prWinIsdFields.ts:39   (setPrFsFromWinIsd)
packages/ui/src/logic/prWinIsdFields.ts:56   (setPrVasFromWinIsd)
packages/ui/src/logic/prWinIsdFields.ts:84   (prCanonicalFromDatasheet)
packages/ui/src/logic/useDesignIO.ts:245     — differently spelled: 1 / (4 * Math.PI * Math.PI * prFs * prFs * prCms)
```

**Rms-from-Mmd/Cms/Qms** (`sqrt(Mmd/Cms) / Qms`), duplicated 5 times:
```
packages/ui/src/logic/prWinIsdFields.ts:41,47,58,85
packages/ui/src/logic/useDesignIO.ts:246
```

**Cms-from-Vas/Sd** (`Vas / (Sd² · RHO · C²)`), duplicated 3 times:
```
packages/ui/src/logic/prWinIsdFields.ts:53,82
packages/ui/src/logic/useDesignIO.ts:244
```

**RHO/C re-declared locally, truncated**, instead of importing the engine's own values
(`packages/engine/src/constants.ts:19-20`, full precision `1.20095217714682` /
`343.684120962153`):
```
packages/ui/src/logic/useDesignIO.ts:242-243:
  const RHO = 1.20095;
  const C = 343.68;
```

## Cause

Same root cause as the vent-area bug: formulas got reimplemented at each call site as needed
instead of written once in the engine. The `RHO`/`C` truncation compounds it — a second,
independent source of the same "constant," hand-typed to fewer significant figures than the
authoritative one, with no mechanism keeping them in sync.

## Fix

**RULED (human, 2026-08-18) — the fix is not "dedupe the formula," it's "expose it in exactly
one place: a getter method on the owning domain class."** Deduplicating into a shared engine
function that's then still called ad hoc from `prWinIsdFields.ts`, `useDesignIO.ts`, and
wherever else needs a PR value would not satisfy this — the formula's RESULT must be reachable
ONLY as a getter on the relevant domain class (e.g. `ManagedOpenISDProject`'s PR-related API, or
whatever class ends up owning PR state), never called directly as a free function sprinkled
through UI logic. Not applied — reported per bug-first rule. Scope: (1) work out which domain
class legitimately owns PR T/S state, (2) add `Mmd`/`Rms`/`Cms` (and whatever `RHO`/`C`-derived
values are needed) as getter methods on it, computed internally via the engine's formulas
(checking first whether `prVas`/`prQms`/`prFsWithMass`, already used by `wprMapping.ts`, already
cover this — duplicating a duplicate would compound the problem), (3) delete every inline
call/re-implementation in `prWinIsdFields.ts`/`useDesignIO.ts` and replace with the getter call.

## Verification

Both files' inline formulas/constants are gone (`grep -n "1.20095\|343.68"
packages/ui/src/logic/useDesignIO.ts` and `grep -n "Math.sqrt\|Math.PI"
packages/ui/src/logic/prWinIsdFields.ts` both return nothing), and the math lives once in
`@openisd/engine`. The getter-on-a-domain-class requirement is not met — see Status above.
