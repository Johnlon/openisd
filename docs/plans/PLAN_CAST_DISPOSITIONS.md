# Plan: the 21 casts (fixcast, 2026-09-04)

`packages/design/test/architecture-no-casts.test.ts` fails with **21** casts. My first sweep said
12, which was wrong. It missed `driverName.ts` ×5, `faultLog.ts:237`, `appState.ts:686`, and one in
`packages/design`. `appState.ts:686` holds a live `any`.

The gate rules that a cast is your decision, not mine. So this is a disposition list, not a rewrite.

## Step 0, blocker

`DriverEditorModal.vue` lines 13 and 16 have stray text pasted in (`/fieldRegistry.ts`, `git push `)
from an uncommitted edit. `vue-tsc` stops there and reports nothing else. Retype the two lines
forward, no checkout/restore/stash. Bug record first.

`test_dir/inner.txt` and `test_file.txt` are staged and unexplained. Yours? I'm not touching them.

## Dispositions

| # | Cast | Disposition |
| --- | --- | --- |
| 5 | `driverName.ts:20,20,22,26,32` | **Delete the file and its test.** `appState.ts:526` already derives the name from the driver's typed `brand()`/`model()`, and the design driver has these as `Field<string>` (`project.ts:1286-98`). `driverShort` has no production caller. Nothing to move onto `OpenISDDriverStandalone`, since it would duplicate what exists. Also correct the false comment at `driverRepo.ts:301`. |
| 5 | `DriverEditorModal.vue:167,226,293,354` `field as SpecField` plus `:415` Proxy | **Leave. No requirement exists.** Every call site passes a literal (`setNum('Fs', v)`), and 3 hand-written switches map the string back to a method. Under design's `Field`/`Cell` API the template binds `spec.Fs_hz`, so switches, casts and Proxy all go. Exporting `SpecField` to build a guard is what `PLAN_DELETE_PACKAGES_MODEL.md` §4 forbids. Note it in that plan. |
| 1 | `driverFileText.ts:48` `reader.result as ArrayBuffer` | **Fix now, real bug.** On an aborted read `result` is `null` and `new Uint8Array(null)` is empty, so the promise *resolves with empty text* instead of rejecting. `instanceof` guard plus reject, the `domEvents.ts` pattern. TDD, red first. |
| 3 | `faultLog.ts:87,101,237` | **Fix now.** Already guarded at `:82`. TypeScript just won't narrow `any`. One `isRecord(v): v is Record<string, unknown>` clears all three. No zod, because this is the diagnostic that reports corrupt storage. |
| 1 | `OptionsModal.vue:70` `'General' as Tab` | **Fix now.** `reactive<{v: Tab}>({v:'General'})`. |
| 1 | `OgFilters.vue:69` | **Fix now.** `patch<K extends keyof Filter>(id, field: K, value: Filter[K])`. Today `patch(id,'enabled',42)` typechecks. |
| 1 | `appState.ts:686` (holds `any`) | **Leave to the migration.** Parses a fingerprint *this module wrote*, so it needs a typed fingerprint, not validation. Asserts `UiParams` from the gutted package. Highest-priority migration item. `projectRepo.ts:40-53` has the commented-out fix for this exact bug class. |
| 1 | `OriginalShell.vue:369` `as TabId` | **Leave, blocked.** `UiState` is commented out (`projectRepo.ts:58`), so the field has no type to guard against. `?? 'box'` does not catch a stale non-empty string. |
| 1 | `driverYmlToOpenisdAndWdr.ts:154` | **The one place zod fits.** The schema is already in the same package. Your live WDR work is in this file, so wait for it to land. QO112 and QO113 touch it. |
| 2 | `liveProject.ts:45`, `managedProject.ts:906` | **Report only.** Vue typings, and the TS 5.7 `Uint8Array` generic. Try `shallowRef<T>(obj)`. If the widening spreads past `driverFileText.ts:59`, stop and ask. |

I verified the fixes compile under `--strict` with a probe in `build/`, now deleted.

## zod

Your seam ruling, applied honestly, lands on **one** cast: `driverYmlToOpenisdAndWdr.ts:154`, in
`packages/design` where zod already is. The others aren't untrusted boundaries. `faultLog` is
already guarded, and `appState.ts:686` validates data it wrote itself. I'm not adding a UI
dependency to look like I followed the instruction.

## Gate

**No change.** Red is correct here. 5 wait on the migration, 1 on your WDR work, 2 on your ruling.

One flag for later. Line 163 asserts that `packages/model/src/openisdDriver.ts` exists. When the
migration deletes it, that's a moved landmark, not a gate to loosen.

## Order

Step 0, then `driverFileText` (TDD), then `faultLog`, `OptionsModal` and `OgFilters`, then delete
`driverName.ts`, then note the 5 in the migration plan. Nothing else without your go-ahead.

**Net: 11 cleared, 10 remain**, each with an owner.

## Verify

Run `vue-tsc` before and after step 0. Parse errors giving way to model errors is the proof. The
arch gate list must shrink by exactly what was addressed and nothing else. Then `npm run lint`,
`test:unit`, `playwright`, `health-check.sh`.

Health-check **cannot go green**, because `packages/ui` doesn't typecheck against the gutted model
package. I'll record the before and after failure sets so this work neither hides behind that
failure nor adopts it.

Open questions touched: QO92, QO100, QO112, QO113. None decided here.
