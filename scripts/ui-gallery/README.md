# UI gallery

Deterministic screenshots of every screen, desktop (1440x900) and Pixel 9 phone (411x923, x2.6), before vs after. No AI, starts no server.

Run (app already up, e.g. `bash scripts/preview-4000.sh`):

    node scripts/ui-gallery/capture.mjs

`scripts/release.sh` runs it for every release: the snapshot (`https://openisd.app/snap/<stamp>/`) after, the current Latest before; a failed capture stops the release.

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--after <url>` | `http://localhost:4000` | build under test |
| `--before <url\|dir\|none>` | `https://openisd.app/v/20261015T1542Z/` | live build, or the `after/` dir of an earlier run, or `none` |
| `--root <dir>` | `/home/john/work/winisd/ui-gallery` | all runs are kept here |

Output: `<root>/<UTC stamp>_<build id>/` with `before/`, `after/`, `index.html`, `run.json`; and `<root>/index.html` listing every run (newest first).

- The run page is written before the first capture and rewritten after every screenshot; cells not yet captured say "pending".
- A run folder is never deleted or renamed. An interrupted run stays, with status `aborted`.
- Per screenshot: scrollWidth/clientWidth, scrollHeight/clientHeight, and the count of buttons clipped by the viewport or an overflow-hidden parent (hover the count for names). Red = clipped or horizontal overflow; pink row = after worse than before. A screen absent from a build shows "not in before"/"not in after".
- Each after-screen has a verdict, GOOD or NOT GOOD, with plain sentences saying why. Source 1: the measurements (clipped buttons, sideways scroll, screen not reachable, worse than before). Source 2: optional `<run>/review.json`, `{"<viewport>-<screen>": ["sentence", ...]}` (viewport is `desktop` or `phone`), written by a reviewer; `index.html` fetches it on load, so a later review shows without a rerun (serve the folder over http; `file://` blocks the fetch). The run header shows "N of M screens NOT GOOD".
- `--rebuild <run dir>` rewrites a finished run's `index.html` from its `run.json`, no capture.
- The storage banner is its own screen (`welcome-banner`); it is dismissed with its close control before every later screen. A build with no banner shows "not in before" there.
- Start the dev server and let it finish its first load before running; a cold Vite answers 504 "Outdated Optimize Dep" and the app stays on its splash.
- Screens are listed in `screens.mjs`; each acts only through clicks and keys. Desktop toolbar icons have no accessible name and are clicked by position (`TOOLBAR` in `screens.mjs`).
- Build id is read from the phone menu header; fallback is the git short sha.
