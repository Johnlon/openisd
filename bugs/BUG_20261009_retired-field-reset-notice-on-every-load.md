# BUG_20261009_retired-field-reset-notice-on-every-load

**Status:** RESOLVED

## Symptom
John, 9 Oct 2026, mobile (openisd.app): every saved project shows, on every load, a notice that never goes away:
"“o1” loaded with 3 field(s) reset to the default — Reset: saved.box.bandpass4.front.losses.Qicl, saved.box.bandpass6.front.losses.Qicl, saved.box.abc.front.losses.Qicl", repeated per project.

## Evidence
- `packages/design/domain/project/retiredFrontQicl.ts` previously used Zod `recordSchema.safeParse` at each level of `session`, creating cloned objects that were modified while leaving the original input object untouched.
- Consequently, `parseOwprSessionRepairing` in `projectSerialization.ts` still encountered `front.losses.Qicl` as unrecognized schema keys and reported them in `repaired`, triggering `onRepaired` and raising the reset notice dialog.
- `projectRepo.ts` did not write migrated projects back to the stored database keys, causing the notice to reappear on every app load.

## Cause
`withoutFrontQicl` failed to mutate the source session in place before schema parsing, and stored database keys were never updated with migrated records at start-up.

## Fix
- `packages/design/domain/project/retiredFrontQicl.ts`: Replaced Zod copying with direct, typed in-place removal of `front.losses.Qicl`, allowing retired fields to be dropped silently without being reported as schema resets.
- `packages/persistence/src/repos/projectRepo.ts`: At start-up, every stored project, open session, and backup is migrated and written back, with existing backups updated first so nothing is lost.

## Verification
- Unit test in `packages/persistence/test/projectRepo.test.ts` ("retired field migration (BUG_20261009_retired-field-reset-notice-on-every-load)"):
  - Verified a stored project with `front.losses.Qicl` loads with no notice (`onRepaired` not called) and is stored without `Qicl`.
  - Verified a second load shows nothing.
  - Verified start-up migration updates open sessions, stored projects, and backup keys.
- `bash scripts/test.sh packages/persistence/test/projectRepo.test.ts` (32/32 passed).
- `bash scripts/test.sh packages/design/test/domain/front-chamber-qicl.test.ts` (7/7 passed).
