# A stored box type is CAST, not parsed, so an unknown string reaches the simulation as NaN

**Where:** `packages/persistence/src/repos/projectRepo.ts`, `boxTypeOfWireBox()`.

**Status:** OPEN — found 2026-08-28 by the api-design session reviewing my BoxType collapse.
Introduced by me in the same collapse. Fix below.

## Symptom

Two failures, from one line:

```ts
function boxTypeOfWireBox(box: string): BoxType {
  return (box === STORED_PR ? 'box-passive-radiator' : box) as BoxType;
}
```

`box` arrives from a `.owpr` on disk, a localStorage autosave, or a share-link hash. The `as
BoxType` asserts it is valid without checking. Whatever the file says becomes a `BoxType`.

1. **A declared-but-unsimulatable type crashes.** A record carrying `box: "bandpass6"` or
   `"abc"` reaches `setActiveBoxType`, and the next `boxVolume_m3()` / `bTypeOfBoxType()` throws
   by design — those throws are correct, but the cast is what makes them reachable from a file.
2. **An UNKNOWN string is worse: it is silent.** `box: "banana"`, or a box type a future build
   writes, matches no `case` in `boxVolume_m3`'s switch, falls off the end, and the function
   returns `undefined` implicitly. `NaN` then propagates into the simulation and a chart is
   drawn. Nothing throws and nothing warns.

## Evidence

`boxVolume_m3` (`packages/model/src/openisdProject.ts`) switches over all six `BoxType` members
and has no `default`. TypeScript accepts that as exhaustive and does NOT require a return for
the fall-through, **because the cast already told it the value was a `BoxType`**. The type
checker was load-bearing here and the assertion disarmed it.

Reachability today: nothing in the app writes an invalid box string — `OriginalShell.vue` gates
on `SUPPORTED_BOX`, and `OgNewProject.vue`'s options list only the four simulatable types. So it
needs a hand-edited `.owpr`, a crafted share link, or a file from another build. Not
hypothetical: `.owpr` files and share links in the wild already carry `'pr'`, a spelling the
current code does not use natively — the same door, already carrying a value that needs
translating.

## Cause

A trust boundary treated as a type boundary. Bytes from disk are external input and must be
PARSED; `as` is an assertion that skips the check. Every other external-input path in this
package validates; this one was written as part of retiring the `'pr'` spelling and inherited
the cast from the code it replaced.

## Fix

`boxTypeOfWireBox` returns `BoxType | null` — a parse, not an assertion — validating against the
declared members and accepting `'pr'` as the legacy stored spelling. The caller decides what an
unreadable box type means rather than the parser inventing an answer.

## Verification

`packages/persistence/test/projectRepo-boxtype.test.ts`: every canon member round-trips; `'pr'`
still reads as `box-passive-radiator`; an unknown string and a declared-but-unsimulatable string
are both refused rather than cast. Full suite green.
