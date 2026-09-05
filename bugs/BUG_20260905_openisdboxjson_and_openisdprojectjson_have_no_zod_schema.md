# `OpenISDBoxJson` and `OpenISDProjectJson` have no zod schema — only `OpenISDDeviceJson` is runtime-validated

**Status:** OPEN. See ledger QO116 for the ruling this needs.

**Found:** 2026-09-05, scoping a split of `packages/design/domain/project.ts` (2750+ lines) into
driver/passiveRadiator/box/project/projectRepo files. The split was blocked by
`OpenISDDeviceJson`'s deliberate non-export (the file's own header, lines ~56-77: "nothing
outside this module can name them at all... that is what forces colocation"), which raised the
question of whether the file's other private record types have the same runtime-validation
story `OpenISDDeviceJson` has. They don't.

## Symptom

Every JSON-shaped record crossing a boundary in this app is meant to be validated by a zod
schema. Only one of the three private record types `project.ts` declares actually is:

- `OpenISDDeviceJson` — validated by `openISDDeviceJsonSchema`
  (`packages/design/domain/openisdRecordSchema.ts:145`).
- `OpenISDBoxJson` (`packages/design/domain/project.ts`, ~line 369) — **no schema anywhere.**
- `OpenISDProjectJson` (~line 411) — **no schema anywhere.**

Both are checked only by TypeScript's structural typing at compile time. Neither is validated
at runtime — a malformed box or project record built or read from disk/storage would pass
straight through with no validation error, unlike a malformed device record, which
`openISDDeviceJsonSchema.safeParse` would reject.

## Evidence

`command grep -n "z\.object\|z\.strictObject\|Schema\s*=" packages/design/domain/project.ts`
returns nothing — no zod import, no schema declaration anywhere in the file.
`command grep -rln "OpenISDBoxJson\|openISDBoxJsonSchema\|OpenISDProjectJsonSchema\|openISDProjectJsonSchema" packages/design`
returns only `project.ts` (the interface declarations themselves) and `domain/index.ts` (a
type-only re-export) — no schema file references either type.

## Cause

`OpenISDDeviceJson` got a zod schema when `openisdRecordSchema.ts` was built (it needs one to
validate driver.yml/openisd.yml records crossing the WinISD/scraper boundary). `OpenISDBoxJson`
and `OpenISDProjectJson` were never given the equivalent treatment — no schema file was ever
written for either.

## Impact

Any caller constructing or deserializing an `OpenISDBoxJson`/`OpenISDProjectJson` record from an
untrusted source (project file load, persistence layer, a future import path) gets no runtime
check that the shape is actually valid — a malformed value is only caught if and when it later
throws inside code that assumes a valid shape, rather than being rejected at the boundary with a
clear error.

## Not fixed here

Needs a ruling (QO116) on whether both should get zod schemas, and where those schemas live
given the same colocation/privacy constraint (`OpenISDBoxJson`/`OpenISDProjectJson` are
deliberately unexported, so a schema file outside `project.ts` cannot import the type to check
against — same problem that blocks splitting the file into pieces).

## Verification when fixed

A test asserting a malformed `OpenISDBoxJson`/`OpenISDProjectJson`-shaped object is rejected by
a `safeParse` call, matching the existing pattern for `openISDDeviceJsonSchema` in
`openisdRecordSchema.ts`'s own tests.
