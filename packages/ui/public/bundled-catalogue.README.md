AUTO-GENERATED FILES — DO NOT EDIT
==================================

Files:     drivers-index.json, passive-radiators-index.json, drivers/<brand>/<sku>.json
Generator: scripts/bundle-drivers.mjs (run by predev/prebuild through scripts/bundle-drivers-if-changed.mjs,
           which skips the rebuild when nothing the catalogue depends on has changed)
Design:    docs/design/BUNDLED_CATALOGUE_API.md

Any manual edit to these files is overwritten on the next build.

WHAT THEY HOLD
--------------
Every driver record from the bundled `winisd_drivers/db/datasheets` corpus, as a static catalogue
vite serves beside the app:

  drivers-index.json               BundledDriverIndexRow[]          — what the driver picker lists,
                                                                       filters and flags
  passive-radiators-index.json     BundledPassiveRadiatorIndexRow[] — what the PR browser lists
  drivers/<brand>/<sku>.json       the canonical openisd record, verbatim — fetched when a device
                                                                       is picked

The row types are declared once, in packages/persistence/src/repos/bundledIndex.ts, and each row
is computed at bundle time by the app's own functions (packages/ui/src/logic/bundledIndexRows.ts)
over the record opened as a domain object. A row's `uuid` is the record's own uuid — the list
key, the favourites key, and what the repo's `load()` takes; its `path` is `<brand>/<sku>`, which
locates the record file.

The app reaches the catalogue only through `createBundledDriverRepo` /
`createBundledPassiveRadiatorRepo` (packages/persistence): an index is fetched when a picker
opens, a record when a device is picked, and both are held for an hour and then fetched again.

The browser suite runs against a small selection of these records, cut by path with
scripts/test-bundle.mjs from packages/ui/test/fixtures/test-bundle-paths.json.

BUNDLING GATE (QO79/QO81, John, FINAL ruling: no driver is ever excluded for missing
spec params): every STRUCTURALLY READABLE record bundles — the only bar is
`recordConforms()` finding no problem: the record has a `specs` container. A record the
domain seam then refuses (neither a woofer/tweeter nor a passive-radiator section) fails the
build rather than shipping. Neither datasheet completeness nor simulatability gates bundling —
both are settled wrong, permanently. A record with no Fs, or no T/S fields at all, still
bundles, opens in the editor, and degrades in a design exactly like a user-created driver with
those fields left blank; the app flags it for the user (the row's `dq`, the ⚠ badge) rather
than excluding it.

SOURCE DATA
-----------
  ../winisd_drivers/db/datasheets/**/<driver>/openisd.json — the driver record

That file, and nothing else. `.owdr` is purely a UI concern — what the app writes and
reads when a user saves a driver to their own disk — and never appears in a collection.
`.wdr` is WinISD's file format, which the app reads and writes in memory from an openisd
record. A collection holding neither `openisd.json` bundles nothing.

TO REGENERATE MANUALLY
----------------------
  npx vite-node scripts/bundle-drivers.mjs

The file is kept in git so the GitHub Actions deploy workflow can build without
fetching driver data.
