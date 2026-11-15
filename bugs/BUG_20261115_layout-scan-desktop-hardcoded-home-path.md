# layout-scan-desktop writes to a hardcoded /home/john/... gallery path

Found 15 Nov 2026 (T800). `packages/ui/test/ui/layout-scan-desktop.browser.spec.ts` makes the directory `/home/john/work/winisd/ui-gallery/T742-phone-clip`. On the other machine (`/home/johnl`) every one of its tests fails with `EACCES: permission denied, mkdir`, so the spec cannot be run there at all. The repo's rule is repo-relative paths in committed files (machines differ: `/home/john` and `/home/johnl`).

Next: derive the output directory from the repo root (or drop the gallery write from the test) and make the spec pass on both machines.
