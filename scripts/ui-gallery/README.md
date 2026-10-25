# UI gallery

Deterministic screenshots of every screen, desktop (1440x900) and Pixel 9 phone (374x705, x2.566: the Chrome page area John measured on his phone), before vs after. No AI, starts no server.

Run (after side defaults to the newest snapshot; for a local build start `bash scripts/preview-4000.sh` and pass `--after http://localhost:4000`):

    node scripts/ui-gallery/capture.mjs

`scripts/release.sh` runs it for every release: the snapshot (`https://snapshots.openisd.app/snap/<stamp>/`) after, the current Latest before; a failed capture stops the release.

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--after <url>` | `https://test.openisd.app/` | build under test; the default is the newest snapshot, a deployed build, so cloud sync shows as users see it. A local dev server (`http://localhost:4000`) has no Google client id and hides cloud sync. |
| `--before <url\|dir\|none>` | `https://snapshots.openisd.app/v/20261015T1542Z/` | live build, or the `after/` dir of an earlier run, or `none` |
| `--root <dir>` | `/home/john/work/winisd/ui-gallery` | all runs are kept here |

Output: `<root>/<UTC stamp>_<build id>/` with `before/`, `after/`, `index.html`, `run.json`; and `<root>/index.html` listing every run (newest first).

- The run page is written before the first capture and rewritten after every screenshot; cells not yet captured say "pending".
- A run folder is never deleted or renamed. An interrupted run stays, with status `aborted`.
- Per screenshot: scrollWidth/clientWidth, scrollHeight/clientHeight, and the count of buttons clipped by the viewport or an overflow-hidden parent (hover the count for names). Red = clipped or horizontal overflow; pink row = after worse than before. A screen absent from a build shows "not in before"/"not in after" in red; one the after build has and the before build lacks shows "New in this build" in grey.
- Each after-screen has a verdict, GOOD or NOT GOOD, with plain sentences saying why. Source 1: the measurements (clipped buttons, sideways scroll, screen not reachable, worse than before). Source 2: optional `<run>/review.json`, `{"<viewport>-<screen>": ["sentence", ...]}` (viewport is `desktop` or `phone`), written by a reviewer; `index.html` fetches it on load, so a later review shows without a rerun (serve the folder over http; `file://` blocks the fetch). The run header shows "N of M screens NOT GOOD".
- `--rebuild <run dir>` rewrites a finished run's `index.html` from its `run.json`, no capture.
- The storage popup (the shared confirm dialog, Close button) is its own screen (`storage-popup`); it is closed with its Close button before every later screen. Builds before the popup have a banner instead, so before shows "New in this build" there.
- Start the dev server and let it finish its first load before running; a cold Vite answers 504 "Outdated Optimize Dep" and the app stays on its splash.
- Screens are listed in `screens.mjs`, the one list. Each screen names the components it shows in `covers`; a component that looks like a dialog, tab, sheet, pane, menu or shell panel and is deliberately not pictured goes in `EXCLUDED` with its reason (now the crash screen and the storage gate: a user cannot cause either). `packages/ui/test/architecture/ui-gallery-covers-every-screen.test.ts` fails when such a component is neither covered nor excluded, or a name does not exist, so a new or missed screen cannot slip by.
- The driver editor is pictured on every tab (General, Parameters, Advanced, Dimensions) at the top and scrolled to the bottom, with Inspect Provenance on and the equation inspector open, from the Driver tab and from Manage drivers. Scrolling is a mouse wheel at the middle of the screen. Cloud sync shows only on a build with a Google client id, so on a local dev server it reads "not in after".
- Screens are listed in `screens.mjs`; each acts only through clicks and keys, reaching each control by something every build has: desktop toolbar icons by their tooltip ("Info", "Options", "Manage Drivers — …"), the phone Projects item by either name it has had ("Projects", "Open project…"), the storage popup by its alertdialog role, not its wording.
- Build id is read from the phone menu header; fallback is the git short sha.
