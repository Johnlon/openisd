# Handover — claude session (openisd, manager)

Written: 2026-10-31T05:41:00Z
Nudged: 2026-10-31T04:19:13Z

## 1. Role and peers

- Role: `claude` — the Claude Code session whose cwd is `/home/john/work/winisd/openisd` (main checkout, branch `stray/20261025T131334Z`; the edit guard blocks writes there, so files go in worktrees), model Fable 5.1, session name `openisd-9d`. Manager only (rulings #2, #3): direct and check Sonnet agents, do no heavy lifting, log concerns on the board instead of asking in chat (ruling #9).
- Peers: no other live sessions; the earlier release and scraper sessions were ended by John (ruling #7). Their handover files: the release one sits beside this file (`ls /tmp/openisd-t618/docs/handover/`, committed) and the scraper status handover in the scraper repo (`ls /home/john/work/winisd/*_tools/*/HANDOVER_20261031_scraper_status.md`, uncommitted).

## 2. Open work

- **John's /goal, still active (rulings #6, #9):** build green with no skipped or failing tests; functional work and bug fixes (T607, T618, T628) on main and on test.openisd.app; the integrate.sh gate fix; then dead branches and worktrees cleaned up, only after the test site is sorted. Progress check: `cd /tmp/openisd-t618 && git log --oneline origin/main..HEAD | wc -l && gh run list --workflow=suite.yml --limit 3`.
- **T618 (label fixes, red-main repair), worktree `/tmp/openisd-t618`, branch `release/20261030-integrated`, head `07cdc8ecc` plus a baseline commit the running job makes.** The whole GitHub suite was down to ONE red case (ABC port columns) at candidate `f4f8d708a0`; that is fixed in `07cdc8ecc`. A background job is re-taking visual baselines, committing them, and running the gated integration; read it: `cat /tmp/claude-1000/-home-john-work-winisd-openisd/4c39e786-7bc1-4755-aad0-59580017720e/tasks/bsao5910j.output` (or `tail -8 /home/john/work/winisd/openisd-t630/build/test-logs/integrate-T618.out`). Why integrate.sh and not land.sh: land.sh refuses the branch as "mixed" (it carries T628 and T629 commits); integrate.sh squash-merges an integrated branch, and the T630 version (run from `/home/john/work/winisd/openisd-t630`) has the candidate gate the live one lacks. Green: main moved; go to the test-site step. Red: list failures with `gh run view $(gh run list --workflow=suite.yml --limit 1 --json databaseId -q '.[0].databaseId') --log-failed | grep status=failed | sed 's/.*TEST END //; s/ status=.*//' | sort -u`, give them to ONE Sonnet agent with the assertion text, one browser run per agent (ruling #14), re-take visuals (`cd /tmp/openisd-t618 && bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts --update-snapshots`, then `bash -c '. scripts/visual/lib.sh && visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE"'`, commit `packages/ui/test/visual`), then rerun `cd /home/john/work/winisd/openisd-t630 && bash scripts/integrate.sh T618 release/20261030-integrated`. Test: suite green on `land/T618-integrated`; `cd /tmp/openisd-t618 && bash scripts/land/post-land/run.sh` prints green; F56 closes.
- **Test site:** build.yml deploys test.openisd.app on every push to main (about 10 min). Check: `curl -s https://test.openisd.app/build-info.json`. Then post a comment on QO318 with the link and the build id; and set QO316 to done if F56 closed.
- **T630 (integrate.sh waits for a green suite), worktree `/home/john/work/winisd/openisd-t630`, branch `t630`, head `11b8552db`.** Done, tested, not landed; land.sh needs John's answer on gate item QO317 (`gates_approved: QO317`). Next: `cd /home/john/work/winisd/openisd-t630 && bash scripts/land.sh T630` once QO317 has a `by: John` entry. Test: `cd /home/john/work/winisd/openisd-t630 && bash scripts/quiet-test.sh bash scripts/land/test/integrate.e2e.test.sh`. Note for its task file: actions.sh returned exit 2 (not 1) on a red run twice; check `scripts/land/post-land/actions.sh` exit codes.
- **T631 (restore 100% coverage gate):** `tasks/T631.yml` in the T618 worktree, open, unassigned; it must also flip `scripts/land/test/coverage-*-gate.test.sh` back to "jobs present". Notes: `cat /tmp/claude-1000/-home-john-work-winisd-openisd/881f40c8-664d-49bb-9a1d-a64fc888caee/scratchpad/t630-notes.md`.
- **Cleanup after the test site:** stale worktrees and branches: `git -C /home/john/work/winisd/openisd worktree list` (t523…t629, `/tmp/openisd-integrate/T618`; t629 is empty, unused). Untracked files in the main folder: `cd /home/john/work/winisd/openisd && git status --short`.
- **winisd_tools scraper WIP:** uncommitted; the commit was blocked by a red architecture test (provenance liveness), stopped per the guard rule. Check: `cd /home/john/work/winisd/winisd_tools && git status --short | wc -l`.

## 3. Briefs received

- John, 31 Oct 2026, chat (rulings file #2–#15): manage with cheap agents; build clean, no skipped or failing tests; functional work onto the test site; coverage rule off with its own ticket; no separate browser runs; work efficiently; log concerns on the board; cleanup after the test site.

## 4. Decisions

- (ruling #4) Coverage 100% gate off for now: CI jobs deleted from suite.yml (`a7f7d1305`), the two shell tests assert the jobs are absent (`19ccb4123`); scripts and baseline kept; T631 restores. Board QO316. Why: the gate blocked the repair of the red main.
- (ruling #14) One combined browser run, not one per fix; agents get at most one or two runs and the brief says so. Why: wall time. Concern: a brief is not a gate (one agent ran three); talk idea logged.
- Red main cause, verified: `scripts/integrate.sh` pushed main after lint, typecheck and unit only. T630 shares `candidate_gate` (`scripts/land/core/candidate.sh`) between land.sh and integrate.sh, and builds the squash subject with `task_commit_message` so the commit-msg hook accepts it (`c35ad76af`, `11b8552db`). Why: no route to main may skip the green run on the exact sha.
- Layout calls to get green are on the board as QO320 with corrections: plot window 10–20000 Hz; options padding 2px; what-if box 124px; all driver-advanced/air rows 134px; all wizard labels 172px; driver editor Advanced grid wraps at 1100/900px; desktop panel 244px for every box type, achieved by the Box tab hint column scrolling inside the panel (`348f1dabb`; T607's 302px columns squeeze it to 152px); ABC port columns shrink to fit at 1280 with Shape/Number moving under Tuning (`07cdc8ecc`). Visual baselines re-taken each time; review page http://lap:8000/winisd/ui-gallery/reviews/T618-visual/ (QO318) is from the first re-take and is stale for tab-box, tab-driver, tab-advanced and the ABC/bandpass6 screens.
- Concern QO319: the unit-label-underline spec carries hand exceptions instead of a refreshed approved-paint reference.
- Guards blocked the winisd_tools WIP commit and the main-folder Write: stopped, no workaround; the handover lives in the T618 worktree.

## 5. Live state

- origin/main red at `d63db5def` (F56): `cd /home/john/work/winisd/openisd && git fetch -q && git log origin/main --oneline -2`.
- Nothing landed this session yet; the integration job may land T618 as a squash "(auto) T618: …" on main: `git -C /home/john/work/winisd/openisd fetch -q && git log origin/main --oneline -1`.
- Candidate runs: `72e78461ec` red (19 browser + shell), `f4f8d708a0` red (1 browser): `gh run list --workflow=suite.yml --limit 4`.
- Lint, typecheck, unit suite, attribution: all green in the last integrate gates: `grep "END gate" /home/john/work/winisd/openisd-t630/build/test-logs/integrate-T618.out`.
- T618 task file: `gates_approved: QO316`, `visual:` 33 ids, `visual_note:`, widened allowlist: `cd /tmp/openisd-t618 && grep -n "gates_approved\|^visual" tasks/T618.yml`.
- Board items this session: QO316 in_progress, QO317 needs_john, QO318 needs_john, QO319 parked, QO320 parked (with two correction notes): `python3 ~/.claude/bin/inbox.py show QO320 | head -5`.
- Workspace repo commits (talk ideas, board): `cd /home/john/work/winisd && git log --oneline -5`.

## 6. Jobs

- Background shell `bsao5910j`: visual re-take, baseline commit, then `integrate.sh T618` in `/home/john/work/winisd/openisd-t630`; result to this session: `cat /tmp/claude-1000/-home-john-work-winisd-openisd/4c39e786-7bc1-4755-aad0-59580017720e/tasks/bsao5910j.output`; GitHub side: `gh run list --workflow=suite.yml --limit 1`.
- No subagents running: `ListAgents`. No land.sh running: `ls -t /tmp/openisd-t618/build/test-logs/land-*.out 2>/dev/null | head -1`.

## 7. Messages sent, last hour

- Sonnet subagents (all reported, finished): unit test fixes (3 files); six regressed browser specs; coverage gate shell tests; shell panel height measurement; hint column scroll fix; ABC port columns fit.
- No messages to John; concerns went to QO319 and QO320.
