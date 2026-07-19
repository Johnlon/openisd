---
name: review-orchestration
description: Set up and run the read-only reviewer-agent loop for implementation work — a code-quality reviewer AND an architecture/design-conformance auditor that inspect each impl agent's committed diff, append findings to append-only logs, and whose confirmed findings the orchestrator dispatches to fix agents. On a bug surfaced during the build, the arch-reviewer emits RCA_REQUIRED and the orchestrator convenes a Root Cause Analysis. Use when the user wants "review agents", "code review + arch review", an "auditor", or a self-checking impl→review→fix loop. Read-only reviewers never edit code.
---

# Review orchestration — impl → review (code + architecture) → dispatch fixes

TWO read-only reviewer subagents plus a deterministic guard, run after each
implementation change in the `openisd` repo. The reviewers only inspect and report; the
**orchestrator** (the main agent) dispatches confirmed findings to separate fix agents.

## The three pieces

1. **`code-reviewer`** (subagent) — CODE QUALITY: clarity, transparency, conciseness,
   maintainability, accuracy, CLEAN-code. Reads for the next developer; challenges
   obscurity, magic numbers/literals, opaque assertions, hidden coupling, silent error
   handling, Vue reactivity traps. Appends findings to `CODE_REVIEW/CODE_REVIEW_LOG.md`.
2. **`arch-reviewer`** (auditor subagent) — DESIGN/STRUCTURE conformance: checks the diff
   against `ARCHITECTURE.md` (AD-1..AD-5 + four-layer refinement), `CONTRACT.md`, and the
   `driverType.ts` wire-contract. Runs the deterministic **mechanical guard** first, then
   judgment-level review. Appends to `CODE_REVIEW/ARCH_REVIEW_LOG.md`.
3. **Mechanical guard** — a no-LLM vitest test,
   `packages/engine/test/architecture.test.ts`, asserting AD-3 (the engine core imports no
   DOM/Vue). Wired into `npm run test:unit` and the git hooks (`scripts/hooks/`), so
   structural drift fails without an LLM.

Both reviewers: `model: sonnet`, tools `Bash, Read, Grep, Glob`, **read-only** (their ONLY
write is an append to their own `_LOG.md`). Logs are append-only, one timestamped section
per run. Neither reviewer touches the curated `CODE_REVIEW/CODE_REVIEW.md` (stable §N IDs).

## Run the loop (orchestrator protocol — "report + dispatch")

After an implementation agent **commits** a change:
1. Run BOTH reviewers on that commit range (default `git diff main...HEAD`, or an explicit
   `HEAD~N..HEAD`): `/arch-review <range>` and `/review <range>` — or launch the subagents
   directly. (If a custom agent type isn't registered mid-session, launch a
   `general-purpose` agent and tell it to READ and follow the agent-definition file.)
2. Each reviewer runs its checks, APPENDS a timestamped findings section to its log, and
   RETURNS the findings. An empty result ("reads clearly" / "no violations") is a valid,
   good outcome — reviewers must not manufacture nits.
3. The **orchestrator** triages: for each CONFIRMED finding, fix it inline (trivial,
   unambiguous) or dispatch a separate fix agent (the reviewers never spawn fixers).
   Re-run the relevant tests after fixing.

## RCA on a mid-build bug (arch-reviewer `RCA_REQUIRED` signal)

The `arch-reviewer` also reports whether a bug **surfaced or was fixed during the build**
(a bug/regression/revert commit in the range; a `CODE_REVIEW/POST_MORTEM.md` entry) with
no RCA on record — emitting `RCA_REQUIRED: yes` as the first line of its findings. The
reviewer cannot spawn agents; **the orchestrator convenes the RCA** when it sees the signal
(or when the impl agent's own report already told the orchestrator a bug was hit — either
source triggers it):

1. **Prompt the user to enter RCA** on the named bug (the user decides).
2. On agreement, **convene the RCA with two perspectives**, then synthesize:
   - the **impl agent** (continue it via SendMessage — it holds the build context): *why*
     the bug arose — the change, the assumption, the mechanical cause;
   - the **code-reviewer** (read-only): *why review/tests did not catch it* — the missing
     guard (the assertion/type-check/test that was absent). This is usually the real
     finding.
3. Run the **5-whys** to the systemic root (recurse "why" on every answer), action the Q2
   prevention **at every level** (a new guard test is the strongest prevention — add it to
   the mechanical guard where it fits), and append a dated entry to
   `CODE_REVIEW/POST_MORTEM.md` opening with a literal `Root cause: …` line. Record any
   deferred prevention to `BACKLOG.md`.

The reviewers stay read-only throughout — they supply perspective; the orchestrator drives
the RCA and makes all edits.

## When NOT to use
- Trivial conversational turns or one-line mechanical edits — just the mechanical guard.
- Don't run the LLM reviewers on an uncommitted, still-changing working tree (races);
  review a committed range.
