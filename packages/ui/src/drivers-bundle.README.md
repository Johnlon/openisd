AUTO-GENERATED FILE — DO NOT EDIT
==================================

File:    drivers-bundle.json
Generator: scripts/bundle-drivers.mjs
Rebuilt: automatically on every `npm run dev` and `npm run build` (prebuild hook)

Any manual edits to drivers-bundle.json will be silently overwritten on the next build.

WHAT IT HOLDS
-------------
Every driver record of every bundled source, so the app loads them with the page and
never calls the GitHub API for them. A source is bundled when its `url` in
drivers/sources.json points at this repo; any other source is federated and fetched
live from GitHub at runtime. The two are mutually exclusive.

Each entry is `{ path, name, record }` — `path` (relative to the source folder,
forward-slashed) plus the source key is the driver's identity; `record` is the parsed
openisd record itself.

SOURCE DATA
-----------
  drivers/**/<driver>/openisd.yml    — the driver record (ARCHITECTURE.md AD-8)

That file, and nothing else. `.owdr` is purely a UI concern — what the app writes and
reads when a user saves a driver to their own disk — and never appears in a collection.
`.wdr` is WinISD's file format, which the app reads and writes in memory from an openisd
record. A collection holding neither `openisd.yml` bundles nothing.

TO REGENERATE MANUALLY
----------------------
  node scripts/bundle-drivers.mjs

The file is kept in git so the GitHub Actions deploy workflow can build without
fetching driver data.
