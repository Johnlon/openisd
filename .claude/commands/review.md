---
description: Run the read-only code-reviewer subagent on a committed diff/commit-range (code quality — clarity, maintainability, CLEAN code)
argument-hint: "[commit-range | PR ref]  (default: main...HEAD)"
---

Launch the **code-reviewer** subagent (`.claude/agents/code-reviewer.md`, read-only:
`Bash, Read, Grep, Glob`) — a senior code reviewer — to review the code QUALITY of a
committed change in this repo (`/home/john/work/winisd/openisd`). Distinct from
`/arch-review` (design/structure conformance); this reviews how the code reads.

Commit range: **$ARGUMENTS** — if empty, default to `git diff main...HEAD` (`dev` is the
working branch). If the argument names a PR, resolve it to its commit range with `gh`
first, then pass that range.

Instruct the subagent to:
1. Get the diff (`git diff <range>`, `git diff --stat <range>`) and read the changed
   files in full where context matters.
2. Review for clarity, transparency, conciseness, maintainability, accuracy, and
   CLEAN-code principles — reading for the next developer. Challenge obscurity, magic
   numbers/literals, opaque assertions, hidden coupling, silent error handling, Vue
   reactivity traps. Respect the house rules in `CLAUDE.md`/`DEVELOPMENT.md` §8 "Standing coding patterns" (no
   `eslint-disable`, no `_foo` dodge, no delete-to-silence-lint, TS strict, no fabricated
   test data, no silent masking).
3. **Append** a new timestamped findings section to `CODE_REVIEW/CODE_REVIEW_LOG.md` AND
   return the findings (severity, file:line, the problem, why it costs a reader, suggested
   fix). Prefer few high-signal findings over a pile of nits; "no findings; reads clearly"
   is a valid result.

The reviewer is READ-ONLY — it never edits code and never touches the curated
`CODE_REVIEW/CODE_REVIEW.md`. After it returns, dispatch each confirmed finding to a
separate fix agent (the reviewer does not spawn fixers). Architecture-level issues it
spots should be deferred to `/arch-review`, not duplicated.
