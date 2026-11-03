# Handover — fable (coordinator), 3 Nov 2026

Written: 2026-11-03T02:33:10Z
Nudged: 2026-11-03T02:31:04Z

## 1. Role and peers

- Role: fable, the coordinator session (release manager, approves delegations, lands tasks). Peers to message by name: `fable [6c3aa9]` (the other fable: T649/T651 work, QO334/QO391), `cover` (voice-coil back-out owner on the release branch; winisd_tools model gate), `tools` (zoo jobs, winisd_tools and winisd_drivers merges, snapshot commits), `sources` (JL Audio / QT128 / QO390), `bob`, `maryu`, `learn`, `opi`, `aiscrape`.
- Plan John approved (3 Nov, chat): `/home/john/.claude/plans/memoized-jingling-valley.md`: openisd first, scraper second, nothing else.

## 2. Open work

- **T654 (openisd, mine): converter derives per-coil Re/BL from flat numVC/VCCon; voice_coil key refused; Qes cap and sub-watt Pe limits.** Worktree `/home/john/work/winisd/openisd-t654`, head 56041e427, three refusals fixed (surface index, visual sources hash, accuton snapshot fixture + pin). Next command: `cd /home/john/work/winisd/openisd-t654 && bash scripts/land.sh T654` (foreground, ~25 min). Test: `bash scripts/test.sh packages/design/test/winisd/driverRecordConverter.coverage.test.ts packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts packages/design/test/engine/physicalRange.test.ts packages/design/test/winisd/bridge-bundle.test.ts packages/design/test/scripts/driver-snapshot-pin.test.ts`. On exit 0 tell cover and John (QO392 thread is closed; a chat line is enough), then remove the worktree.
- **Scraper back-out (winisd_tools), Sonnet worker running in my session** on brief `/home/john/work/winisd/zoo/briefs/winisd_tools-vc-flat.md`: fresh branch `vc-flat` off main in `/home/john/work/winisd/winisd_tools-vc`, codex scraper fixes cherry-picked minus the tuple. Next command when it reports green: `git -C /home/john/work/winisd/winisd_tools-vc log --oneline main..HEAD | head` then message tools to push, merge to winisd_tools main, re-emit every driver.json from saved sources (count of `"voice_coil"` must be 0) and commit the snapshot to winisd_drivers; then re-project openisd.json with the bridge built from openisd main; then a small openisd task regenerates the catalogue. Test: the brief's pytest line plus pyright and mypy. If the worker died with my session, re-run the brief with a fresh Sonnet worker.
- **After T654 lands, one board item for John:** `'undeclared-pair'` rejection reason and `quality.cross_references[]` both change the gated `openisdSchema.ts`; and the release branch's catalogue rewrite replaced landed T650 (recommend keep T650). Next command: `python3 ~/.claude/bin/inbox.py add QO "openisd.json: undeclared-pair reason and cross_references need your ruling"`. Test: `python3 ~/.claude/bin/inbox.py list open | grep -c QO`.
- **Garmin manual walker (QT128), last:** `winisd_tools/toys/toy_garmin_manual_links.py` needs a visible Chrome; try plain HTTP for the manuals JSON first; John may run it himself (`! cd /home/john/work/winisd/winisd_tools && .venv/bin/python3 toys/toy_garmin_manual_links.py`). Next command: `curl -sL 'https://support.garmin.com/en-US/?partNumber=010-03209-00&tab=manuals' | grep -o 'pumac/[^"]*pdf' | head`. Test: 010-03209-00 resolves to 10W6v3_MAN.pdf.
- **Release branch `release/20261030-integrated`** (`/tmp/openisd-t618`, cover): not to be integrated; its usable pieces are reapplied as fresh tasks (the plan lists them: check-commit.sh gate fix, validateBundledCatalogue pointed at catalogue.json, decimalProduct after a failing test). Next command: `git -C /tmp/openisd-t618 log --oneline -1`. Test: nothing of it lands through land.sh.

## 3. Briefs received

- cover, 3 Nov 00:5x, chat message: approve two zoo briefs `/home/john/work/winisd/zoo/briefs/winisd_tools-t037.md` and `/home/john/work/winisd/zoo/briefs/openisd-t618-vc.md` (approved, passed to tools; both superseded by the fresh-reapply plan).
- answerer hook, 3 Nov 00:59: QO392 actions (model-file gates), done: T653 landed 9a1e8b1f2; winisd_tools model gate merged 3d18a874 and pushed.
- John, 3 Nov chat: write a plan to selectively reapply individual edits; figure out line by line what reapplies to main; scraper in the background, delegated.

## 4. Decisions

- John (board QO392.c1 and QO392.c4, not in the rulings file): driver model files are gated by a board ruling, driver.json too, and one ruling never covers the other. Why: a Codex commit changed the user-visible model unasked.
- John (rulings #5, #8, #10, #12): start fresh and reapply individual edits to main, line by line; openisd first, scraper in the background and delegated, not stuffed into my context. Why: two agy jobs churned for an hour on open-ended briefs.
- Mine: the openisd fix is only the converter plus field limits, copied from cover's finished commit 2f5cf1ea8; main never had the basis fields. Why: hunk-level classification of main vs the release branch.
- Mine: the accuton snapshot fixture is flattened by hand and the pin re-taken, until the scraper re-emits. Why: the converter now refuses the tuple and the fixture carried one.
- Mine: the winisd_tools fresh branch cherry-picks the 30 unrelated codex commits whole and removes the tuple from the 7 mixed ones by hunk; no renames; drop the three "VCCon = heading text, no number" paths. Why: the classifier found the t037 removal both too much and too little.
- cover (coordinator ruling): the release branch is held; nothing from it integrates.

## 5. Live state

- openisd main head: `git -C /home/john/work/winisd/openisd fetch -q && git -C /home/john/work/winisd/openisd log origin/main --oneline -3` (expected T653 9a1e8b1f2 until T654 lands; T649, T648 by the other fable are on it).
- Landed this session by me: T653 9a1e8b1f2 (told John on QO392, closed). T654 not yet landed: `gh run list --workflow=suite.yml --branch=land/T654 --limit 1` (last run 41565590949 failed on bridge-bundle; fixed in 56041e427).
- T654 worktree clean: `git -C /home/john/work/winisd/openisd-t654 status --short`.
- winisd_tools main has the model gate (3d18a874, pushed): `git -C /home/john/work/winisd/winisd_tools log --oneline main -1`.
- Scraper worker branch: `git -C /home/john/work/winisd/winisd_tools-vc log --oneline -3` (absent until the worker creates it).
- Board: QO379, QO382, QO392 done; QO391 closed by the other fable; QT128 and QO390 are sources'. `python3 ~/.claude/bin/inbox.py list open`.
- Stats dashboard Worker is live with the test-environment column (John ran the deploy on 2 Nov); its URL with the token is in /home/john/work/winisd/openisd-links.html: `curl -s -o /dev/null -w "%{http_code}" "$(grep -o "https://openisd-stats[^\"]*t=[A-Za-z0-9]*" /home/john/work/winisd/openisd-links.html | head -1)&env=test"`.
- Test site: `curl -s https://test.openisd.app/build-info.json` (v20261102T0041Z last seen; a newer one follows the other fable's landings).

## 6. Jobs

- Sonnet worker (my session, background): winisd_tools back-out on brief `zoo/briefs/winisd_tools-vc-flat.md`; check `git -C /home/john/work/winisd/winisd_tools-vc status --short 2>/dev/null | wc -l`; result to fable. Dies with this session's clear: re-brief if the branch is incomplete.
- No land.sh of mine is running: `ls /home/john/work/winisd/openisd/build/test-logs | grep -c land-T654` and `pgrep -c -u john -x bash` are not the check; use `gh run list --workflow=suite.yml --limit 3`.
- Zoo job winisd_tools-t037-r3 (tools, for cover; superseded by the fresh branch, let it end, do not wait): check `grep -E "t037-r3" /home/john/work/winisd/zoo/STATUS.md | head -1`; result to cover.
- Earlier zoo jobs t037, t037-r2, t618-vc (ended): `grep -E "t037|t618-vc" /home/john/work/winisd/zoo/STATUS.md | head`.

## 7. Messages sent, last hour

- cover: hold integrate and catalogue regen; John wants fresh reapply to main; keep 2f5cf1ea8.
- cover: why the back-out jobs take an hour (244 tool calls, open briefs); told to take the openisd side by hand.
- tools: push codex/20261026-scraper-fixes and main (done, 70015144 and 3d18a874); merge model-gate (done).
- sources: QT128 answers from John relayed (c1, c4, c7); QO390 answers relayed.
- fable [6c3aa9]: QO391 John's answer; stray files already on a branch.
