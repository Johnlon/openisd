# A saved copy of a bundled driver shares its favourite key, so starring one stars both

Status: RESOLVED — see [BUG_20260922_favoriting-copied-driver-also-highlights-original.md](http://localhost:8000/winisd/openisd/bugs/BUG_20260922_favoriting-copied-driver-also-highlights-original.md?html) for the current Cause/Fix/Verification. The Evidence/Cause below are STALE: `driverId()` no longer does brand/model lower-casing (it reads `d.uuid()` now — [driverBrowsingState.ts:56](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L56)), so the pool-collapse cause described here no longer applies. The 2026-09-22 bug reproduced the same symptom via a different mechanism: save paths that never reassigned a driver's own record uuid.

## Symptom

Star a bundled driver, and an identically-named driver in My Drivers shows as starred too —
and vice versa. Unstar either and both lose the star. The two rows are different drivers and
the picker draws them in different sections, but the favourites set cannot tell them apart.

## Evidence

- `packages/ui/src/logic/driverBrowsingState.ts:44` — `driverId(d)` is
  `displayNameOf(d).toLowerCase()`, i.e. `<brand>/<model>` lower-cased. It is the ONLY identity
  function; both the bundled pool and My Drivers go through it.
- `:220` — `isFavorite(d)` is `favorites.value.includes(driverId(d))`, so membership is decided
  purely by that string.
- `:225` — `toggleFavorite` writes the same string.
- `packages/persistence/src/repos/prefsRepo.ts:16` — the set is a flat `string[]` under
  `openisd_favorite_drivers`, carrying no notion of which pool a key came from.

Reproduce: save a copy of any bundled driver WITHOUT renaming it (Clone renames to "Copy of …",
so this needs a save that keeps the name), then star either row.

## Cause

`driverId()` was introduced during the `packages/model` → `packages/design` migration to replace
`driverKey()`, which distinguished pools — `prefsRepo.ts:9` still describes the old scheme:
"the source plus bundled path for a library row". The replacement collapsed both pools onto
brand+model, and nothing carries the pool any more.

## Fix

Give the identity a pool prefix — `bundled:<brand>/<model>` versus the My Drivers row's own
storage uuid, which `reloadMyDrivers` already keeps. A saved driver's uuid is a real identity
and does not shift when the driver is renamed, which also removes the "editing brand/model
moves the star" behaviour `prefsRepo.ts` currently documents as deliberate.

Existing stored favourites are brand/model strings and will not match a new scheme — decide
whether to migrate them or let them lapse.

Also correct `prefsRepo.ts:9`, which names `driverKey()` in `driverRepo.ts`. That function no
longer exists.

## Verification

Not yet fixed.
