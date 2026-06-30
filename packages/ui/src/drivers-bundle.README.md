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

To update driver data, modify the scrapers in scripts/scrapers/ and rerun them.
Do NOT edit WDR or _meta.yml files directly unless explicitly authorised — see CLAUDE.md.

TO REGENERATE MANUALLY
----------------------
  node scripts/bundle-drivers.mjs

The file is kept in git so the GitHub Actions deploy workflow can build without
needing to re-scrape. It is large (~5 MB) and will differ between branches if
driver data has changed.
