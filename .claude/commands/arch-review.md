---
description: Run the read-only arch-reviewer subagent on a committed diff/commit-range (design + structure conformance; emits RCA_REQUIRED on a mid-build bug)
argument-hint: "[commit-range | PR ref]  (default: main...HEAD)"
---

Launch the **arch-reviewer** subagent (`.claude/agents/arch-reviewer.md`, read-only:
`Bash, Read, Grep, Glob`) to review the architecture conformance of a committed change in
this repo (`/home/john/work/winisd/openisd`, a TS/Vue monorepo).

Commit range: **$ARGUMENTS** — if empty, default to `git diff main...HEAD` (`dev` is the
working branch). If the argument names a PR, resolve it to its commit range with `gh`
first, then pass that range.

Instruct the subagent to:
1. Run `npx vitest run --project engine packages/engine/test/architecture.test.ts` (the
   mechanical AD-3 engine-purity guard) and report mechanical failures.
2. Read `ARCHITECTURE.md` (AD-1..AD-5 + four-layer refinement, UI-1/2/3), `CONTRACT.md`,
   and `CODING_PATTERNS.md`.
3. Review the given commit range for design-intent violations: AD-3 boundary crossings
   (engine touching DOM/Vue, physics in components, core calling UI), CONTRACT.md drift,
   `driverType.ts` wire-contract drift vs the sibling `winisd_tools` Python enum, AD-4
   rewrite-instead-of-extract, per-device hardcoding, AI-LOCKED edits, `drivers/<collection>/`
   subdir naming.
4. **Detect a mid-build bug** from committed evidence (bug/regression/revert commit
   message in the range; a new `CODE_REVIEW/POST_MORTEM.md` entry) and emit
   `RCA_REQUIRED: yes|no` accordingly — placing a `yes` FIRST in the returned findings.
5. **Append** a new timestamped findings section to `CODE_REVIEW/ARCH_REVIEW_LOG.md` AND
   return the findings (severity, file:line, AD-#/rule, why, suggested fix, RCA_REQUIRED).

The reviewer is READ-ONLY — it never edits code, never spawns agents, and never touches
the curated `CODE_REVIEW/CODE_REVIEW.md`. After it returns, dispatch each confirmed
finding to a separate fix agent; on `RCA_REQUIRED: yes`, convene the Root Cause Analysis
per the `review-orchestration` skill ("RCA on a mid-build bug").
