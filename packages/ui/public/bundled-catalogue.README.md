AUTO-GENERATED FILES — DO NOT EDIT
==================================

Files:     drivers-index.json, passive-radiators-index.json, drivers/<brand>/<sku>.json
Generator: scripts/bundle-drivers.mjs (run by predev/prebuild; regenerate by hand: npx vite-node scripts/bundle-drivers.mjs)

These are build inputs. The build joins them into ONE file, catalogue.json (scripts/catalogueBundle.mjs).
catalogue.json is listed in the service worker's precache with the app's own files, so it is installed
with the app and changes only with a new app build. The app reads the stored copy after its screen is
up; nothing is downloaded at the moment of use.

Source: winisd_drivers/db/datasheets/**/<driver>/openisd.json, read-only. Every structurally readable
record bundles; one with neither a woofer nor a passive-radiator section fails the build (QO79/QO81).
