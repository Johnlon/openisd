# The engine exists twice, and the two copies drifted within one session

**Where:** `packages/engine/src/*.ts` and `packages/design/engine/*.ts`.

**Status:** OPEN. The duplication is deliberate and was ordered (copy, explicitly NOT a move). The
DRIFT is not, and it happened the same day the copy was made.

## The duplication

15 files, ~2,640 lines, every exported symbol present twice — `REQUIRED_BY_BOX`, `RELATIONS`,
`sweep`, `airFor`, `deriveEngineDriver`, `sealedResonance`, and the rest.

Measured 2026-08-27, comparing the two directories file by file:

| state                | files |
| -------------------- | ----- |
| byte-identical       | 13    |
| **already diverged** | 2     |

Diverged: `consistency.ts`, `params.ts`.

## How the drift happened — hours after the copy

Both edits were correct in the design copy and were not applied to the production one:

- **`params.ts`** — `VB`, `VF`, `SP`, `PR_SD`, `PR_CMS`, `PR_MMD`, `REQUIRED_BY_BOX` moved from
  module scope INTO `validateParams`, to satisfy the no-globals rule that governs
  `packages/design` and does not govern `packages/engine`.
- **`consistency.ts`** — `RELATIONS` became the function `relations()`, same reason.

So the two copies are now governed by DIFFERENT rules, which guarantees further divergence rather
than making it a risk.

One edit did go to both: `sealedFc` was deleted from each. That it had to be done twice, by hand,
is the whole problem in miniature.

## Why it matters

This is the "ONE model version" rule in `AGENTS.md` — two implementations of one thing, differing,
with nothing detecting the difference. A fix made in one place is silently absent from the other,
and a parity bug found against production cannot be reproduced against the design copy once the
two have moved apart.

There is no gate. Nothing fails when the copies differ.

## The resolution already agreed

`packages/engine` is to be gutted and made to delegate to `packages/design/engine`'s `Engine`
class (John, 2026-08-27: "in the legacy engine module delete practically everything as the new
engine class should do that job"). That collapses the two copies back into one and is the actual
fix.

It has NOT been done. It requires the `Engine` class to cover everything the app imports — 21
behaviours, all present on the class today — and then ~30 production files to compile against the
delegating barrel.

## Until then

Any engine change must be made in BOTH directories, and the no-globals divergence means a
mechanical copy is no longer safe: `params.ts` and `consistency.ts` must be merged by hand.
