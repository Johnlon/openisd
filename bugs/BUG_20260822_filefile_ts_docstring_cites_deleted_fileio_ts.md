# `fileFormat.ts` docstring cites `fileIO.ts`, a file that does not exist

Status: FIXED — citation changed from `fileIO.ts` to "this file's own" at
`packages/ui/src/fileFormat.ts:91`.

## Symptom

`packages/ui/src/fileFormat.ts:91` reads: `/** Either format family — a driver file or a
project file. \`fileIO.ts\`'s \`formatOf\`/\`sniff\` return this; ... */`. `fileIO.ts` names a
module that is not in the tree.

## Evidence

`find . -iname "fileIO.ts" -not -path "*/node_modules/*"` returns nothing under `packages/`.
The only other hit is `docs/plans/PROMPT_RELEASE_HARDENING.md:782`, itself describing the
module as already cleared by this in-flight rework. `formatOf`/`sniff` are both defined and
exported in `fileFormat.ts` itself (lines 107, 115) — the comment's own file, not a separate
`fileIO.ts`.

## Cause

Found incidentally while grepping every symbol `ARCHITECTURE.md`'s file-IO section names, per
task A6's FIX-1 (three prior misses of stale-doc defects in this same task). `fileFormat.ts`
was carved out of a formerly-larger `fileIO.ts` during the QO78/QO67 rework; this one
docstring line was not updated to name its own file.

## Fix

Change the citation from `` `fileIO.ts`'s `` to `` `fileFormat.ts`'s `` (its own module) —
or drop the file-name qualifier entirely, since `formatOf`/`sniff` are declared a few lines
below in the same file.

## Verification

`grep -rn "fileIO.ts" packages/ui/src/fileFormat.ts` returns nothing after the fix.
