# BUG_20261017_driver-list-empty-with-no-hint

**Status:** FIXED (T309)

## Symptom
John, 17 Oct 2026: "empty wizard driver list with no hint"; "the list is empty but the favourite button is
selected visible". The driver list (New Project wizard, the picker and Manage Drivers, both skins) keeps its
filters between openings. A filter kept from last time, or Favorites with nothing starred, left the list
empty. The only words were a faint "No matching drivers.", and nothing said which filter caused it.

## Cause
- Favorites could be switched on with no favourites, so it could only empty the list.
- Un-starring the last favourite left Favorites on, so the list stayed empty.
- Nothing named the filters that were on. The search text and the Favorites button were the only clues, and
  the old "✕ clear" chip cleared types, Fs, Sd and Z only, not search, scope or Favorites.

## Fix
Ruling (John, via fable): keep the filters between openings, but show them.
- `activeFilterLabels` (driverDisplay.ts) names every filter that is on: search, types, Fs, Sd, Z, scope
  (when not All) and Favorites. The list shows them as "Filters on:" pills under the count, with a
  Clear filters button.
- `clearAllFilters` clears every filter: search, types, Fs, Sd, Z, scope back to All, and Favorites.
- An empty list says "No drivers match", with Clear filters below it when any filter is on.
- Favorites is disabled with no favourites. Un-starring the last favourite switches it off.
- Starred drivers do appear under Favorites (bundled rows and My Drivers both key on the record uuid);
  `driverFilters.test.ts` proves it.

Tests:
- `packages/ui/test/logic/driverFilters.test.ts`
- `packages/ui/test/ui/driver-browser.browser.spec.ts` ("filters on")
- `packages/ui/test/ui/mobile-driver-browser.browser.spec.ts`
- `packages/ui/test/ui/mobile-menu.browser.spec.ts` now stars a driver before turning Favorites on.

Before and after, phone 411×923 and desktop:
[visual-pages/driver-filters](http://lap:8000/winisd/visual-pages/driver-filters/index.html).
