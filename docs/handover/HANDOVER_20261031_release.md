# Release handover — 31 October 2026

**What to do:** Resume the release work on `/tmp/openisd-t618`, branch `release/20261030-integrated`. Keep integrating on this branch; do not split release work into another branch or worktree.

## Current state

- The release goal is paused at John's request. The app is **not signed off** and the current integrated candidate has not been verified on test.
- The latest observed commit is `e13419c1e` (`T618: coverage-restore ticket is T631`). The current branch includes merges of the fetched `origin/main` tip `7e8247577`, T628's passive-radiator changes, and the T629 blocker record.
- T628 preserves entered Mms, Cms and Rms when choosing a passive radiator. Its targeted behavior suite passed as part of a 96-test run. The source-inventory test passed 10/10 after the two T628 bug reports were added to its index.
- The last verified full UI coverage run (`build/test-logs/20261031-033906-223152.log.filtered`) passed 937 tests but failed the coverage ratchet for the newly added `NumInput-hooks.ts`: 98% statements and 93% branches. Later branch changes have not had a complete coverage run.
- A later focused numeric-input run had 58 passing tests and one failing fixture. The fixture was corrected, but the follow-up command was interrupted before a result. Do not treat it as green.
- A broad field-visual browser run stopped without a final result; its log is `build/test-logs/20261031-034338-255985.log`.
- `https://test.openisd.app/build-info.json` reported `v20261031T0306Z` earlier. It could not be resolved during this handover, so the current test deployment and its source commit are unverified.
- CI run `41162450772` failed coverage, coverage-ui and browser shards. It tested `f70ded065e1dff28c413e7caba780ab1ff51244a`, not the latest integrated branch. Recheck current CI before using that result as the release candidate's status.

## Coverage gate and tracked work

T631 is open and records the request to restore the 100% coverage landing gates. The workflow change that temporarily removed those jobs is in commit `a7f7d1305`; verify the current workflow and gate scripts on resume.

The current worktree has these edits. Preserve and review them before making changes:

- Modified: `packages/ui/src/ui/field-catalogue.css`
- Modified: `packages/ui/src/ui/joined-fields.css`
- Modified: `packages/ui/src/ui/shells/original/OriginalNewProject.vue`
- Modified: `packages/ui/test/fixtures/numField.ts`
- Modified: `packages/ui/test/hooks/NumInput-hooks.test.ts`
- Modified: `packages/ui/test/ui/mobile-vented-tab.browser.spec.ts`

The shell checkout `/home/john/work/winisd/openisd` remains on `stray/20261025T131334Z` with unrelated untracked files and an uncommitted `CLAUDE.md` change recording John's integrated-release instruction. Do release work in the integrated worktree above and preserve that existing work.

## Next work when resumed

1. Inspect the current branch status and the in-progress edits listed above.
2. Finish the numeric-input test fixture, then run its focused tests and the full coverage gate. Do not bypass or lower the ratchet.
3. Reconcile the current T631/workflow state and rerun the relevant complete release gates on the integrated candidate.
4. Recheck the candidate build on `test.openisd.app`, compare its reported build identity to the integrated commit, and only then report it as available for review.

No test deployment, release landing or production deployment is claimed by this handover.
