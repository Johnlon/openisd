---
description: All-in-one — figure it out, implement, then auto-run code + architecture review and ACTION the findings (impl → commit → review → fix → verify). One shortcut for reviewed implementation work.
argument-hint: "<what to implement / change>"
---

Do this end-to-end for: **$ARGUMENTS**

Work the full loop yourself as the orchestrator. Do NOT stop to ask which phase to run —
run them all, only pausing for a genuine design/scope decision that is the human's to make.

## 1. Figure it out & implement
- Scope the change: read the relevant code, find the right place (reuse existing
  helpers/patterns; obey `CLAUDE.md` + `CODING_PATTERNS.md` + `ARCHITECTURE.md`).
- Make the edits. Write the failing test FIRST (this repo is TDD, red→green). Work on
  `dev` (never commit/push `main`).
- Run the relevant tests + `npm run lint` + `npm run typecheck` on the change until GREEN
  and warning-free; final gate is `bash scripts/health-check.sh`. Never `--no-verify`,
  never `eslint-disable`, never hand-edit goldens to green.
- Commit with a clear message under the human git identity (no Claude attribution).

## 2. Review — both axes, READ-ONLY, on the commit range just made
Launch BOTH reviewers on `HEAD~N..HEAD` (the commits from step 1), ideally in parallel:
- **code-reviewer** — `.claude/agents/code-reviewer.md` (code QUALITY: clarity, magic
  numbers, opaque assertions, silent error handling, Vue traps, CLEAN-code). Appends to
  `CODE_REVIEW/CODE_REVIEW_LOG.md`.
- **arch-reviewer** — `.claude/agents/arch-reviewer.md` (DESIGN/STRUCTURE: runs the
  mechanical AD-3 guard, checks the diff against `ARCHITECTURE.md` + `CONTRACT.md`).
  Appends to `CODE_REVIEW/ARCH_REVIEW_LOG.md`, and emits `RCA_REQUIRED` on a mid-build bug.
If those custom agent types are not registered this session, launch `general-purpose`
agents and instruct each to READ and follow the corresponding agent-definition file. Both
are read-only and RETURN their findings.

## 3. Action the findings
Triage every returned finding:
- CONFIRMED + trivial/unambiguous → fix inline; re-run the relevant tests.
- CONFIRMED + larger/independent → dispatch a fix agent for it; verify after.
- Judgment-call findings you can't resolve → surface to the human, or record to
  `BACKLOG.md` if deferring. The reviewers never edit code — YOU make all edits/dispatches.
- **`RCA_REQUIRED: yes`** from the arch-reviewer (a bug surfaced/was fixed during THIS
  build, no RCA on record) → convene a Root Cause Analysis before reporting: prompt the
  human, then run it with the impl agent (why the bug arose) and the code-reviewer (the
  missing guard — why review/tests missed it), 5-whys to the systemic root, action the
  prevention at each level, append a `Root cause: …` entry to `CODE_REVIEW/POST_MORTEM.md`.
  See the `review-orchestration` skill "RCA on a mid-build bug".
Commit fixes under the human git identity.

## 4. Verify & report
- `bash scripts/health-check.sh` fully green (lint + typecheck + unit + golden + browser).
- Report: what was implemented, the review findings (per reviewer), what was fixed vs
  deferred (with `BACKLOG.md`/`POST_MORTEM.md` refs), and the final commit hashes.

Scale review depth to the change (a docs/mechanical edit may need only the mechanical
guard; a structural change warrants both LLM reviewers). See the `review-orchestration`
skill for the underlying setup.
