# Bundled passive radiators have no producer, so that browser section is always empty

Status: OPEN

## Symptom

The PR browser's "bundled" list is always empty, although 77 passive radiators ARE present in
the bundle the app already loads.

## Evidence, gathered 2026-08-29

- `packages/ui/src/drivers-bundle.json` (14.7 MB, generated 2026-08-28) has top-level keys
  `['_generated', 'sources']`. There is **no `passiveRadiators` key**.
- Its one driver source, `winisd-drivers`, carries 1970 driver files.
- `grep -rn passiveRadiators scripts packages` finds hits ONLY on the reading side:
  `packages/ui/src/main.ts:33` (the optional type), `main.ts:48` (the read), and the type
  module. `scripts/bundle-drivers.mjs` and `scripts/bundleProjection.mjs` do not mention it.
- So `bundle.passiveRadiators ?? []` at `main.ts:48` evaluates to `[]` on every run, and
  `PRBrowser.vue`'s bundled section renders nothing.

## Cause

THE DATA IS BUNDLED. Only the projection the reader expects is missing.

Verified in `drivers-bundle.json`: of the 1970 bundled files, **77 carry
`record.driver_type.value == 'passive-radiator'`, every one of them tagged
`driverType: 'passive-radiator'`**, each with a `passive-radiator` specs section.
`dayton-audio/e150he-pr` is present and correct — "Dayton Audio - Epique Series - E150HE-PR".
That matches the corpus exactly: 77 of the 1970 `openisd.yml` records under
`winisd_drivers/db/datasheets` declare `value: passive-radiator`.

So `scripts/bundle-drivers.mjs` bundles radiators correctly, as ordinary files in
`sources[].files`. What does not exist is the SEPARATE top-level `passiveRadiators` array,
in the flattened `BundledPR` shape, that `main.ts:48` reads. Two shapes of one thing were
assumed: the bundler emits records, and the reader wants a projection nobody writes.

`?? []` is what makes it silent — an absent key reads exactly like an empty collection, so
the UI shows an empty list rather than reporting that the projection is missing.

## Impact

Users see an empty "bundled" section in the Browse-PR popup while 77 usable radiators sit in
the bundle they already downloaded. They cannot tell the difference between "none exist" and
"the projection is missing". The user's OWN saved radiators are unaffected — those come from
`myPassiveRadiatorRepo` and localStorage, which works.

## Fix

NOT APPLIED — the choice is John's:

1. **Derive it at the composition root** — filter the already-bundled files on
   `driverType === 'passive-radiator'` and project them to `BundledPR`. No bundler change,
   no new data, no second copy in the JSON.
2. **Emit it from the bundler** — add a `passiveRadiators` array to the bundle output. This
   writes the same records twice into a 14.7 MB file, so it costs size for no new information.

(1) is the smaller change and avoids a second shape of the same records.

Whichever is chosen, `?? []` should not survive as-is: an absent key and an empty collection
must not read the same, or the next such failure is equally silent.

## Verification

Not yet verified — no fix applied. When applied: if (1), the bundle JSON must contain a
non-empty `passiveRadiators` array and the browser must list them; if (2), no reference to
`BundledPR` remains and the PR browser shows only saved radiators.
