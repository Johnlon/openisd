# Visual baselines

A committed picture of every screen, in both skins. A change that moves a pixel on any screen is
seen, named and approved; it is never a surprise.

| Thing | Where |
|---|---|
| Screens (name, skin, steps to reach it) | `packages/ui/test/visual/screens.ts` (`SCREENS`) |
| The spec | `packages/ui/test/visual/visual.browser.spec.ts`, one `toHaveScreenshot` per screen |
| Baselines | `packages/ui/test/visual/visual.browser.spec.ts-snapshots/<skin>-<screen>.png` |
| Windows | phone 390×844, desktop 1880×1000 (`VisualSkin`) |
| Tolerance | none; the build stamp is the one masked element |

## Rules

| Moment | What happens |
|---|---|
| Post-land run | The spec runs with the rest of the browser suite. A differing picture turns main red. The F names each screen (`visual screens: …`) and links a page of before, after and difference pictures. |
| A task changes a screen on purpose | `bash scripts/visual/update.sh [<screen>…]` re-takes the pictures. The task file lists the screens under `visual:` (one id per line). The baseline pictures are committed in the same commit. |
| Landing | `land.sh` runs the `visual` gate: the changed baselines and the `visual:` list must be the same set. A mismatch refuses the landing and names the screens. |
| After a landing that changed baselines | `land.sh` prints `land: visual changes: <url>`, a before/after page for John to approve. |
| A new screen | Add it to `SCREENS`, take its baseline, list it under `visual:`. |

Pages are written under `/home/john/work/winisd/visual-pages/` and served at
`http://lap:8000/winisd/visual-pages/`.

The scripts are in `scripts/visual/`; `scripts/land/test/visual.e2e.test.sh` proves them in a scratch
repo, `land.e2e.test.sh` proves the land gate and `post-land.e2e.test.sh` the red report.
