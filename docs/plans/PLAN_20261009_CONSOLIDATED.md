# Consolidated plan — all agents, 9 Oct 2026

Give this file to one agent. It runs bucket R first, then the other buckets. Buckets A, I and T touch disjoint files and repos, so they can run in parallel when credit allows; when only one agent runs, the order is R → A → I → T.

## State at 10 Oct (lots keeps this section current — John: "the work list it MUST maintain")

### Done since 9 Oct
- T024 open-once (3fcd2261), T025 plans, T027 deploy from main + GitHub CI deleted (0b542728). A release = the GitHub Pages deploy on every push to main; no release branch, no tags (John). Buckets R1/R2 are moot.

### In flight
- **F3/F4** (post-land red after T024: mobile-project-list spec opened the same project twice): fix in `openisd-f4`, being landed/run by maryu (217ddec3). Blocks every other landing until closed.
- **T026** (worktree `openisd-t024`, reviewed, committed c7a51e67): stored copies merged into one (backup keeps all), retired front Qicl dropped silently at start-up, mobile file-open shows files. Lands after F3/F4 close.
- maryu: remove the release-branch push and NO_RELEASE_PUSH from post-land/run.sh (an opencode run in `openisd-norel`, branch drop-release); the clear-defaults rulings job (re-briefing on another model).

### Pure-extractor plan: NOT agreed by John; nothing decided. Work it touches is held, not killed

### Waiting on John
- **PLAN_20261010_HIGH_FIDELITY_EXTRACTION.md** (author unknown, 46e31b58): go/no-go. lots' review: right direction; schema must keep every reading (a list, not one per source role), every URL, a locator and the printed label on each reading, and drop sku/manufacturer per QT93; Phase 4 test = per-reading SI match or listed change, not bit-for-bit. If go: stop Python lib batches and QT93 step 2 for good; split the plan into tools tasks and openisd tasks.
- "Restore from backup" action: add or not.

### No worker today (tools)
- Complete-loudspeaker refusal (8 Visaton items) — killed on John's order, tree clean.
- Identity fixes (#105).
- QT93 step 2 — held for the pure-extractor decision.

### Delegated CLIs — what we know (10 Oct)
- **agy (Gemini)**: good output (batch 3 verify + 3 real defects; T026 code needed one review round for a data-loss bug). Quota per model, short: default model reset 4h42m, gemini-3.8-flash-high 2h12m, both used up in one morning. Throughput ≈ one agy job per quota window.
- **opencode**: big-pickle gave a sound T024 fix; one run died on "cannot connect to API"; one run timed out at 45 min (maryu). Other runs were killed by holds, untested.
- **freebuff**: never used.
- **Needed**: a quota-aware plan — one job per tool at a time, small briefs, rotate agy models → opencode free models → freebuff; record each quota reset time here.

## How every agent works

- The agent briefs, reviews the diff and lands. Coding, research and test runs go to a CLI:
  - `agy --model`: gemini-3.8-flash-high → gemini-3.1-pro-high → gemini-3.7-flash-high → gpt-oss-120b-medium;
  - `opencode -m`: free first (opencode/big-pickle, opencode/exo-free, opencode/nemotron-3-ultra-free, other `*-free`), then cheap (deepseek-v4-pro, glm-5.3, kimi-k3, qwen3.8-max, minimax-m3);
  - `freebuff`: free, no model choice.
  - Never a CLI's Claude models (they share the Claude limit).
- On a limit: switch model, then tool. Commit the WIP first. Never wait for a reset.
- Briefs are check-and-fix, test first. The agent reviews the diff before landing.
- Commit everything; stage by name; no stash/checkout/restore/reset; no `--no-verify`; no AI attribution.
- openisd main moves only through `bash scripts/land.sh T<nnn>`; each task needs `tasks/T<nnn>.yml` (id, owner, goal, done_test, files).
- Never write to `winisd_drivers/db` from openisd.

## Test policy (what runs when)

| When | openisd | winisd_tools |
|---|---|---|
| While coding | the one spec that observes the change: `bash scripts/test.sh <spec>` | the plugin's own test file: `pytest tests/<file> -q` |
| Before landing / committing | nothing extra: `land.sh` runs lint on changed files, typecheck and the task's `done_test` | the batch's before/after diff over every cached input (0 unexplained changes) + the arch test once |
| After landing | the post-land run (full unit + browser, coalesced to the latest sha) — automatic, never by hand | none |
| Before the final rebuild | — | the full tools suite, once |
| Never | a full suite while iterating; reruns of a red; a browser batch by hand | the full suite per batch |

Rules that save the most: one targeted spec per change; typecheck only through `land.sh`; a red post-land run is fixed by an F task (label `fixes`), never rerun; batch small landings so one post-land run covers several.

## Bucket R — release (do first, small)

Two things stop a release. The last published release is `v20261007T222530Z`.

1. **GitHub Pages refuses branch `release`.** The deploy job fails with "Branch release is not allowed to deploy to github-pages due to environment protection rules". Fix (John, in GitHub, 1 minute): Settings → Environments → github-pages → Deployment branches → add `release`. Agents cannot do this.
2. **CI on `release` is red**: `packages/ui/test/scripts/pre-push-browser-stage.test.ts`, 4 tests, "must run in Git Bash on Windows or WSL, not PowerShell/cmd" on the Linux runner. Task (F3, label fixes): the environment check accepts a plain Linux shell (CI); test: that spec. Land, let post-land move `release`, confirm the deploy run publishes a new `v<UTC stamp>` tag.

Done when: a new `v…` tag exists and the deploy run on it is green.

## Bucket A — openisd app (packages/design, packages/ui)

In order:

1. **T017** readings union (worktree `openisd-t017`, WIP 65da80bf): a read value is kept as printed — `Usable`, `RejectedParsed` (has a number), `RejectedUnparsed` (no number), `Unrecognised` (unknown reason, raw text, one issue raised); a `.wdr` text cell becomes a not-available entry that keeps its readings ("N/A" round-trips). done_test: `bash scripts/test.sh packages/design/test/domain/reads-schema.test.ts`. Remove the duplicate `bugs/BUG_20261009_post-land-unit-red-skips-browser-specs.md` from the branch before landing.
2. **T018** picker (`selectOrigin.ts`): drop impossible readings, then majority (more than half of the survivors), then precedence; rejected readings never picked. done_test: the selectOrigin test.
3. **Bridge accepts `printed`**: the driver.json parser accepts tools' `printed` list (typed) and leaves it out of openisd.json; rebuild `packages/design/dist/openisd-bridge.js` once, after T017. Test: the bridge-bundle test. Unblocks tools' `test_the_projection_ignores_printed`.
4. **Clear gives a default** (maryu's worktree `openisd-coal`, bug `BUG_20261009_pr-added-mass-can-be-cleared-to-blank`): ruled by John — PR added mass → 0; port size → 50 mm round (or a slot from the driver); port width → driver Dd; PR count and driver count → 1; Rg → 0.1 Ω. Not ruled, leave alone: PR/vented volumes, bandpass/ABC values, Ql/Qa/Qp/Qicl, end correction, filters. Test: the domain clear tests for each field.
5. **Loading icon overlay**: an OpenISD icon overlay in `packages/ui/index.html`, shown from first paint until the app mounts (at least ~0.7 s), shown again when the page becomes visible after > 30 s hidden; both skins. Today only Android's own launch screen shows it, on cold start only. Test: one browser spec (overlay present at load, gone after mount, back after a simulated hide/show).
6. Then `docs/plans/PLAN_20261009_APP_WORK.md`: section A bugs (verify the "probably fixed" ones, mark RESOLVED), then section B parity starting with drivers other than the W5-1138SMF.

## Bucket I — openisd infra (scripts/, workspace gates)

Keep small; only these.

1. **Gates scope fix live**: branch `gates-scope` (workspace `/home/john/work/winisd`, commit 6b26fbf) is approved by John. It is armed to ff when no post-land run holds its lock; confirm it went in (`git -C /home/john/work/winisd log -1`), and its smoke test passed. If not armed, ff it when the post-land lock is free, then run `tests/test_run_gates_tool_paths.py`.
2. **18 unresolved bug files verified against main** (maryu had this): each one fixed → RESOLVED with the commit; still open → stays, one line on what remains.
3. Later, not now: wire-admission.sh live; the vendored `land.sh` for tools (T005).

## Bucket T — winisd_tools (separate repo; touches nothing in openisd)

In order; each batch = one brief, before/after diff over every cached input, reviewed, committed.

1. **QT93 step 2** (running in agy): fill `printed` for Dayton Audio, Eminence, Tang Band, Faital Pro, B&C, then the rest; `published_roles` reads `printed` (roles identical before/after); remove each vendor's strict-xfail marker as it fills; fix Dayton nd13fa-4 / nd16fa-4 (full-range + tweeter in two sections).
2. **QT93 adds**: datasheet type word, size text, printed model code, parse errors / cross-source-only kept as rejected readings.
3. **QT93 deletions**: definition, dq_scraper, sku, manufacturer, provided_by, comment, pdf_corroboration, ts_xcheck, scraper_meta.manufacturer_datasheet, quality.*, dead code. Remove source_rank only with John's approval in the tools session.
4. **Common-rule batches 4+**: one shared dual-coil reader is done; continue the sweep list (`brain/REPORT_20261008_plugin_common_rules_sweep.md`), wrong values first, each batch deletes the plugin copy.
5. Widen the degarble rule (stray letter before a unit) to any unit.
6. Refuse complete loudspeakers (8 Visaton ceiling/cabinet speakers) from page text.
7. Remaining arch-test pending sites (9 absence, 6 encoding).
8. Dayton Audio rescan (382 → 0 absence readings lost).
9. Re-capture goldens through the real pipeline (accuton_c51_via_si, tests/fixtures/kit, coverage_allowlist/scan-speak.yml).
10. Full tools suite once → final-rebuild go/no-go report → **John clears the rebuild** → rebuild → swap.
11. After the swap, in openisd (bucket A task): `bash scripts/sync-driver-snapshot.sh` with a clean winisd_drivers checkout, land the new pin.

## Cross-bucket links

- A3 (bridge `printed`) needs T's step 1, which is done.
- T11 needs T10. A1–A5 and I do not depend on T.
- R2 must land before any other openisd landing tonight, so the next post-land run can release.
