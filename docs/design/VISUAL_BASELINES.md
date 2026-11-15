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
| Who draws the baselines | CI's test machine only: `.github/workflows/visual-retake.yml`, in the same image as the suite's browser job. Never a developer machine (T799) |

## Rules

| Moment | What happens |
|---|---|
| Post-land run | The spec runs with the rest of the browser suite. A differing picture turns main red. The F names each screen (`visual screens: …`) and links a page of before, after and difference pictures. |
| A task changes a screen on purpose | Commit the work, then `bash scripts/visual/update.sh` (no arguments). It pushes your commit to a throwaway branch `visual-retake/<branch>-<sha>`; that runs `visual-retake.yml`, which draws every screen in the suite's test machine, draws them again against what it wrote (zero tolerance, so an unstable screen fails the run), and uploads the pictures that differ from the committed ones, each stamped with the run's id, a manifest of their hashes, and the UI sources' hash. `update.sh` waits (minutes), checks the sources hash and manifest, copies the pictures over the committed ones, writes `SOURCES.sha256`, and deletes the throwaway branch. Commit the result; the task file lists the changed screens under `visual:` and `files:` names the pictures and `SOURCES.sha256`. Needs a clean tree, network and `gh`. The wait polls every 20 s. If it stops with "could not read run N's state" (a GitHub API rate limit, a dropped network), the run is usually fine: take it with `bash scripts/visual/retake-ci.sh --run N` once GitHub answers (nothing is pushed). |
| Drawing on a machine that is not CI | There is no way to do it by design. `scripts/test.sh` refuses `--update-snapshots`/`-u` (also when npm swallowed the flag) and names `update.sh`. `scripts/visual/can-draw.sh` is true only inside the workflow (`OPENISD_VISUAL_DRAWER=ci-runner` and `GITHUB_ACTIONS=true`). A local run of the visual spec compares against CI-drawn pictures and so shows differences that are font and anti-aliasing noise: do not read it; read the post-merge run or a retake's `failures` artifact. |
| The gate that stops machine-drawn baselines | `check-task.sh` refuses any baseline picture a change adds or alters unless it carries the stamp (a PNG `tEXt` chunk `openisd-visual-run`, `run=<id>`; the pixels are untouched, so the comparison is unchanged). `ship.sh` runs it before pushing (offline: the stamp must be there). The pull request's `task` job runs it with `VISUAL_VERIFY_RUN=1`: the stamp's run must be a successful `visual-retake.yml` run of this repo and the picture's hash must be in that run's `MANIFEST.sha256` artifact, so a forged stamp fails. Removing a picture needs no stamp. `scripts/land/test/visual-ci.test.sh` proves all of it. |
| A task changes UI sources | The sources are listed in `scripts/visual/sources.txt` (`packages/ui/src`, the CSS, `index.html`, `public`, and the design files that feed text, labels and curves (`fields`, `chart`, `engine`)). `update.sh` records a hash of them in `packages/ui/test/visual/SOURCES.sha256`; after a partial re-take it first compares every screen, so the hash means "every committed baseline matches these sources". The `visual-sources` gate in `land.sh` refuses a task that changes any of those files unless the recorded hash equals the hash of the sources after the rebase. No browser runs in the gate; the re-take is CI's (`update.sh`) and runs before shipping. A rebase (or the merge `ship.sh` does) onto a main that moved a source means re-taking again. The task lists `SOURCES.sha256` and the changed pictures in `files:`. |
| Two tasks re-took the same baselines | The pictures and `SOURCES.sha256` are generated, so a rebase conflict on them alone is never real. the old `land.sh` path took main's side and re-took the baselines (`VISUAL_RETAKE_CMD`, now `update.sh`, i.e. via CI); a pull request merges main in and runs `update.sh` again; the `visual` gates then check them. A conflict on any other file still blocks. `scripts/land/test/land-visual-conflict.e2e.test.sh` proves it. |
| After a landing that changed baselines | `land.sh` prints `land: visual changes: <url>`, a before/after page for John to approve. |
| A new screen | Add it to `SCREENS`, take its baseline, list it under `visual:`. |

Pages are written under `/home/john/work/winisd/visual-pages/` and served at
`http://lap:8000/winisd/visual-pages/`.

The scripts are in `scripts/visual/`; `scripts/land/test/visual-ci.test.sh` proves the CI re-take, the stamp and the refusals, `scripts/land/test/visual.e2e.test.sh` proves the rest in a scratch
repo, `land.e2e.test.sh` proves the land gate and `post-land.e2e.test.sh` the red report.

## Changing the test machine

The pictures are only as stable as the image. `.github/ci-image/Dockerfile` carries one fixed font set; `suite.yml` and
`visual-retake.yml` name the same image digest (a test checks it). A new digest means re-taking every picture with
`update.sh` in the same pull request, and putting the new digest in both workflows.

## What the re-take proves and does not

The run proves the drawing is stable within one run and that the stamped pictures are what that run drew. It does not
prove the next suite run draws the same: that is the post-merge visual spec, with no tolerance. A screen that draws
differently from run to run (as the phone wizard step 3 did, T795/T797) fails the re-take's second pass, not main.
