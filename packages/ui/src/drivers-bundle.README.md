AUTO-GENERATED FILE — DO NOT EDIT
==================================

File:    drivers-bundle.json
Generator: scripts/bundle-drivers.mjs
Rebuilt: automatically on every `npm run dev` and `npm run build` (prebuild hook)

Any manual edits to drivers-bundle.json will be silently overwritten on the next build.

SOURCE DATA
-----------
All driver content comes from:
  drivers/**/*.wdr          — Thiele/Small parameters and driver metadata
  drivers/**/_meta.yml      — sidecar fields (URLs, driver_type, freq range, etc.)

Federated driver data is produced by the sibling winisd_tools/winisd_drivers
repos — update it there and re-run link-driver-repo.sh, not here. drivers/matt/
in this repo is human-curated; do NOT edit any WDR or _meta.yml file directly
unless explicitly authorised — see CLAUDE.md.

TO REGENERATE MANUALLY
----------------------
  node scripts/bundle-drivers.mjs

The file is kept in git so the GitHub Actions deploy workflow can build without
needing to re-scrape. It is large (~5 MB) and will differ between branches if
driver data has changed.
