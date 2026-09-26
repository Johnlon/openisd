# Passive radiators cannot be favourited at all

Status: OPEN (re-verified 2026-09-26) — one favourites key; `PRBrowser.vue` has no star.

## Symptom

Drivers can be starred; passive radiators cannot. There is no favourites store for them, so a
user who works with a handful of radiators out of the bundled set has no way to mark them.

## Evidence

- `packages/persistence/src/repos/prefsRepo.ts:16` — `FAVORITES_KEY = 'openisd_favorite_drivers'`
  is the only favourites key in the package. `PrefsRepo` exposes `favorites()` /
  `setFavorites()` and nothing else.
- `packages/persistence/src/repos/myPassiveRadiatorRepo.ts` — the radiator library
  (`openisd_pr_lib`) has save/load/delete and no favourites surface.
- Both pools otherwise exist and are symmetric with drivers: `myPassiveRadiators`
  (`openisd_pr_lib`) and `bundledPassiveRadiators`
  (`packages/persistence/src/repos/bundledPassiveRadiatorRepo.ts`).

## Cause

Favourites were built for the driver picker and never extended when the passive-radiator
library was added.

## Fix

Widen `PrefsRepo` to hold a favourites set per kind — drivers and passive radiators — under
their own keys, and give the radiator picker the same star control the driver picker has.

Settle the identity scheme at the same time as
`BUG_20260909_a_saved_copy_of_a_bundled_driver_shares_its_favourite_key_so_one_star_stars_both.md`,
so radiators do not inherit the same bundled/saved collision.

## Verification

Not yet fixed.
