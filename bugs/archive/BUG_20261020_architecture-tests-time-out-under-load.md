# BUG_20261020_architecture-tests-time-out-under-load

**Status:** FIXED

Fixed by T492.

Recorded 20 Oct 2026 by maryu.

## Symptom
`land.sh T487` (20 Oct 01:48Z) was refused by the architecture gate: 3 of 45 files failed and the gate ran
577 s (normally about 45 s). A rerun at load 35 timed out `architecture-no-globals.test.ts` ("declares no
module-scoped mutable state anywhere in its shipped source") after 197 s against a 60 s limit, and
`no-domain-value-through-component.test.ts` timed out the same way. The checks are deterministic, so a
timeout is a defect in the test, not a finding.

## Cause
Two costs, both multiplied by load:
1. `architecture-no-globals`: `isWrittenTo` asked the language service for every reference to each of the
   ~214 module-scoped bindings, one project-wide search per binding (6 s alone).
2. `import-from-declarer-only`, `no-domain-value-through-component`, `no-persistence-vocabulary-drift`: a
   source file was added to the ts-morph project, then a type-checker question was asked about it, once per
   file. Adding a file invalidates the type checker, so the program was rebuilt 262 times (29 s alone).

## Fix
1. `architecture-no-globals`: one walk finds the identifiers in a write position and resolves each (through
   an import alias) to its declaration; same answer, no per-binding search.
2. The other three add every file first, then ask their questions, so the program is built once.
3. No timeout raised, no retry, no skip, no assertion loosened. Each changed guard was broken in a scratch
   edit (a `let`, a bare `new Map`, a frozen table written through an import alias, a push through a cast, a
   re-export relay, a domain type on a component prop, a `*Bucket` type, a `*Storage` class in repos/) and
   failed; the scratch edits were removed.

## Measured alone (s, includes ~5 s vitest start)
| file | before | after |
|---|---|---|
| import-from-declarer-only | 34.2 | 8-13 |
| no-domain-value-through-component | 18.0 | 10.6 |
| architecture-no-globals | 15.6 | 5-8 |
| no-persistence-vocabulary-drift | 10.4 | 8.9 |
