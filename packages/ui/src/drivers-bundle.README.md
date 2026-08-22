AUTO-GENERATED FILE — DO NOT EDIT
==================================

File:    drivers-bundle.json
Generator: scripts/bundle-drivers.mjs
Rebuilt: automatically on every `npm run dev` and `npm run build` (prebuild hook)

Any manual edits to drivers-bundle.json will be silently overwritten on the next build.

WHAT IT HOLDS
-------------
Every driver record of every bundled source, so the app loads them with the page and
never calls the GitHub API for them. A source is bundled when its `path` in
drivers/sources.json resolves to a directory checked out inside this workspace
(`scripts/bundle-drivers.mjs::localPathOf`); any other source is federated and fetched
live from GitHub at runtime. The two are mutually exclusive.

Each entry is `{ path, name, driverType, record }` — `path` (relative to the source
folder, forward-slashed) plus the source key is the driver's identity; `driverType` is
the record's own `driver_type` when it states one; `record` is the parsed openisd
record itself, the canonical `_OpenISDDriverJson` shape, unmodified.

BUNDLING GATE (QO79/QO81, John, FINAL ruling: no driver is ever excluded for missing
spec params): every STRUCTURALLY READABLE record bundles — the only bar is
`recordConforms()` (`packages/model/src/driverConformance.ts`) finding no problem: the
record has a `specs` container (the one thing `OpenISDDriver` dereferences
unconditionally) AND a `quality` block with `missing`/`parse_errors` arrays (the one
thing `recordStandingIsOk` reads unconditionally) — the SAME check `myDrivers.ts::list()`
runs on browser-stored records, so both seams a record enters the app through enforce
one contract. Neither datasheet completeness nor simulatability
(`driverIsSimulatable`, `packages/model/src/driverSimulatability.ts`) gates bundling —
both are settled wrong, permanently. A record with no Fs, or no T/S fields at all,
still bundles, opens in the editor, and degrades in a design exactly like a
user-created driver with those fields left blank; the app flags it for the user
(`driverRepo.ts::driverHasDqIssues`, the ⚠ health-warning badge) rather than excluding
it.

MEASURED SIZE (2026-08-22, 1969 drivers — the full corpus, post-QO79/QO81):
14,880,109 bytes raw / 571,689 bytes gzipped — the accepted cost of shipping the
verbatim canonical record (John's ruling,
`bugs/BUG_20260820_drivers_bundle_ships_a_shape_openisddriver_cannot_read.md`).

SOURCE DATA
-----------
  drivers/**/<driver>/openisd.yml    — the driver record (ARCHITECTURE.md AD-8)

That file, and nothing else. `.owdr` is purely a UI concern — what the app writes and
reads when a user saves a driver to their own disk — and never appears in a collection.
`.wdr` is WinISD's file format, which the app reads and writes in memory from an openisd
record. A collection holding neither `openisd.yml` bundles nothing.

TO REGENERATE MANUALLY
----------------------
  npx vite-node scripts/bundle-drivers.mjs

The file is kept in git so the GitHub Actions deploy workflow can build without
fetching driver data.
