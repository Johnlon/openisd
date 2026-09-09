# A starred bundled driver loses its favourite mark on reload

Status: OPEN

## Symptom

`packages/ui/test/persistence/driver-favorites.browser.spec.ts:47` —
"starring a driver marks it, and the mark survives closing and reopening the picker" — fails on
both the run and the retry, ~1 min each (so it is timing out on the final assertion, not
erroring early). Server-clean run:

```
✘   5 driver-favorites.browser.spec.ts:47:1 › starring a driver marks it, and the mark
      survives closing and reopening the picker (1.0m)
✘   6 (retry #1) (1.0m)
$ grep -c ERR_CONNECTION_REFUSED <run output>   →  0
```

The two neighbouring favourites tests (`:66`, `:91`) PASS — they star, filter, and unstar
within one session and never reload.

## What the test does

```ts
const row = page.locator('.dlist .ditem:not(.my-ditem)').first();   // a BUNDLED driver
const star = row.locator('.fav-btn');
await star.click();
await expect(star).toHaveClass(/on/);        // passes — the mark appears in-session

await page.reload();
await page.locator('[title*="librar" i]').first().click();
const sameRow = page.locator(POOL_ROWS).filter({ hasText: name! }).first();
await expect(sameRow.locator('.fav-btn')).toHaveClass(/on/);   // TIMES OUT — mark is gone
```

## Cause

NOT established. It is NOT the My Drivers seed-shape bug
(`BUG_20260909_my_drivers_specs_seed_the_pre_migration_localstorage_shape.md`) — this test
stars a BUNDLED row and seeds no My Drivers at all.

The favourite is written on click (the in-session assertion passes) but is not present after
`page.reload()`. Candidates, none checked:

- the favourites store writes to a key that the model→design migration renamed or stopped
  reading on mount;
- the favourite is keyed by a driver identity that is not stable across a reload for a bundled
  driver (the picker's bundled-row identity is `<brand>/<model>` per the migration plan — if
  the store keyed on something else, or on a list index, the reloaded row would not match);
- the store is written but the picker's mount does not re-apply it to the rendered rows.

## Impact

Favourites do not persist for bundled drivers — the feature's whole point ("a favourite that
lives only in memory is not a favourite", the test's own words). Every bundled star is lost on
refresh.

One test red. Distinct from the 46 in batch 2 that share the seed-shape cause, so it must be
tracked on its own or it will be lost when those are fixed.

## Fix

Investigate in this order:
1. `command grep -rn "favourite\|favorite\|fav" packages/ui/src/logic packages/persistence/src`
   — find the store, its storage key, and its identity function.
2. Star a bundled row in the running app, read `localStorage` — confirm what key and what
   identity string is written.
3. Reload, check the same key survives and the picker's mount reads it.
4. If the identity string differs pre/post reload for a bundled driver, that is the bug —
   align it with the picker's `driverId` (the `<brand>/<model>` bundled identity).

## Verification

```
$ npx playwright test packages/ui/test/persistence/driver-favorites.browser.spec.ts --workers=1
  driver-favorites.browser.spec.ts:47  →  FAIL (times out on the post-reload class assertion)
  driver-favorites.browser.spec.ts:66  →  PASS
  driver-favorites.browser.spec.ts:91  →  PASS
```
