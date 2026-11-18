# Visual baselines

A committed picture of every screen, in both skins. A change that moves a pixel on any screen is
seen, named and approved; it is never a surprise.

| Thing | Where |
|---|---|
| Screens (name, skin, steps to reach it) | `packages/ui/test/visual/screens.ts` (`SCREENS`) |
| The spec | `packages/ui/test/visual/visual.browser.spec.ts`, one `toHaveScreenshot` per screen |
| Baselines | `packages/ui/test/visual/visual.browser.spec.ts-snapshots/<skin>-<screen>.png` |
| Windows | phone 390×844, desktop 1880×1000 (`VisualSkin`) |
| Tolerance | none; the build stamp is masked, and so is any part the machine decides, named per screen in `Screen.mask` (on dialogs only the phone About's build date; the storage quota is fixed by `VisualSkin.start`, and the pictures are taken at `https://openisd.app/`, the address a user sees, served from the test build by `packages/ui/test/fixtures/releaseSite.ts`: the "saved in this browser at" line never shows the test server's `localhost:4300`) |
| Who draws the baselines | CI's test machine only: `.github/workflows/visual-retake.yml`, in the same image as the suite's browser job. Never a developer machine (T799) |

## Rules

| Moment | What happens |
|---|---|
| Post-land run | The spec runs with the rest of the browser suite. A differing picture turns main red. The F names each screen (`visual screens: …`) and links a page of before, after and difference pictures. |
| A task changes a screen on purpose | Commit the work, then `bash scripts/visual/update.sh` (no arguments). It pushes your commit to a throwaway branch `visual-retake/<branch>-<sha>`; that runs `visual-retake.yml`, which draws every screen in the suite's test machine, draws them again against what it wrote (zero tolerance, so an unstable screen fails the run), and uploads the pictures that differ from the committed ones, each stamped with the run's id, a manifest of their hashes, and the UI sources' hash. `update.sh` waits (minutes), checks the sources hash and manifest, copies the pictures over the committed ones, and deletes the throwaway branch. Commit the result; the task file lists the changed screens under `visual:` and `files:` names the pictures. Needs a clean tree, network and `gh`. The wait polls every 20 s. If it stops with "could not read run N's state" (a GitHub API rate limit, a dropped network), the run is usually fine: take it with `bash scripts/visual/retake-ci.sh --run N` once GitHub answers (nothing is pushed). |
| Drawing on a machine that is not CI | There is no way to do it by design. `scripts/test.sh` refuses `--update-snapshots`/`-u` (also when npm swallowed the flag) and names `update.sh`. `scripts/visual/can-draw.sh` is true only inside the workflow (`OPENISD_VISUAL_DRAWER=ci-runner` and `GITHUB_ACTIONS=true`). |
| Comparing on a machine that is not CI | Allowed, and it is the check to run before shipping a UI change: `bash scripts/visual/compare-local.sh` (comparison only; add `-g "visual desktop tab-box"` to narrow it). Every character the app draws comes from its bundled fonts (`packages/ui/test/visual/visual-fonts.browser.spec.ts` fails when Chrome reports a system font for any glyph on any screen), the browser's time zone is pinned to UTC (`playwright.config.js`), and the script serves on port 4300 as CI does (the build is found by that port, so the pictures only match when it is 4300), so a native run matches CI pixel for pixel: on 15 Nov 2026 all 236 screens passed natively against CI-drawn pictures (T832). A difference is therefore real: read it. If one appears that you cannot explain, find which element differs (`test-results/**/*-diff.png`) and what drew it before calling it noise; a new kind of difference is a defect to fix, not a tolerance to raise. `scripts/test.sh packages/ui/test/visual/...` is not the way to compare: it serves on a pooled port 4100+ and the stand-in for the release address cannot find its build on a pooled port. |
| The gate that stops machine-drawn baselines | `check-task.sh` refuses any baseline picture a change adds or alters unless it carries the stamp (a PNG `tEXt` chunk `openisd-visual-run`, `run=<id>`; the pixels are untouched, so the comparison is unchanged; the reader takes the chunk's declared length, because the 4-byte CRC after the chunk can begin with a digit and a pattern read would take it as part of the run id, T833). `ship.sh` runs it before pushing (offline: the stamp must be there). The pull request's `task` job runs it with `VISUAL_VERIFY_RUN=1`: the stamp's run must be a successful `visual-retake.yml` run of this repo and the picture's hash must be in that run's `MANIFEST.sha256` artifact, so a forged stamp fails. Removing a picture needs no stamp. `scripts/land/test/visual-ci.test.sh` proves all of it. |
| The gate that decides whether the visual spec runs | `scripts/visual/pr-needs-visual.sh` (pr.yml's `visual` job) reads each list of changed paths whole before it answers, and a git failure fails the job instead of answering `false` (T833; `scripts/land/test/pr-needs-visual.test.sh`). |
| A task changes UI sources | There is no committed hash of the sources (T810: `SOURCES.sha256` conflicted between every two UI pull requests, and each conflict cost a merge plus a full CI re-take just to record a new hash). The guarantee, that the pictures committed are the ones CI draws for the sources committed, is proven by `pr.yml`'s `visual` job: when the change touches a source in `scripts/visual/sources.txt`, a picture, the visual spec, the fixtures, the Playwright config, the test machine's image or the lockfile (`scripts/visual/pr-needs-visual.sh`), it builds the suite's app on the merged result and runs the visual spec in the test machine with no tolerance. It runs on the pull request and again in the merge queue on the queue's merged result, so a picture another pull request made stale is caught before main. A change that touches none of those skips it in seconds. A pull request that changes a screen re-takes its pictures with `update.sh`; one that changes none (a logic change, a text the screens do not show) re-takes nothing, and is never made to conflict. `check-sources.sh` remains only for the retired `land.sh` path. |
| Two tasks re-took the same baselines | The second to merge conflicts on the pictures they both changed; merge main in, run `update.sh` again, and the `visual` job proves the result. |
| After a landing that changed baselines | `land.sh` prints `land: visual changes: <url>`, a before/after page for John to approve. |
| A new screen | Add it to `SCREENS`, take its baseline, list it under `visual:`. A picture must show the view it is named for: `architecture/visual-baselines-distinct.test.ts` fails on two equal pictures not declared in `packages/ui/test/visual/pictureSet.ts`, or on a popup picture equal to `<skin>-complete-project` (a popup that never opened). |

Pages are written under `/home/john/work/winisd/visual-pages/` and served at
`http://lap:8000/winisd/visual-pages/`.

The scripts are in `scripts/visual/`; `scripts/land/test/visual-ci.test.sh` proves the CI re-take, the stamp and the refusals, `scripts/land/test/visual.e2e.test.sh` proves the rest in a scratch
repo, `land.e2e.test.sh` proves the land gate and `post-land.e2e.test.sh` the red report.

## Who looks at the pictures

A pull request that adds or changes a baseline gets an automatic review of the pictures by Claude on GitHub's runners
(`docs/design/CLAUDE_REVIEW.md`): identical and near-identical pictures, a screen that shows less than its name says,
machine-specific text. It is advisory and reports on the pull request.

## Changing the test machine

The pictures are only as stable as the image. `.github/ci-image/Dockerfile` carries one fixed font set; `suite.yml` and
`visual-retake.yml` name the same image digest (a test checks it). A new digest means re-taking every picture with
`update.sh` in the same pull request, and putting the new digest in both workflows.

## What the re-take proves and does not

The run proves the drawing is stable within one run and that the stamped pictures are what that run drew. It does not
prove the next suite run draws the same: that is the post-merge visual spec, with no tolerance. A screen that draws
differently from run to run (as the phone wizard step 3 did, T795/T797) fails the re-take's second pass, not main.

## After changing a gate script

Run every shell test under `scripts/land/test` (the whole directory, `bash scripts/test-shell.sh`), not the tests you
think are related. T799 changed `check-task.sh` and ran three tests; two others (`land.e2e`, `land-visual-conflict.e2e`)
feed pictures to it, and went red on main. It is now mechanical: `pr.yml`'s `shell` job runs `test-shell.sh` on every
pull request that touches `scripts/`, `land.conf` or `.github/workflows/`, and is part of `pr-gate`.
