---
description: Always typecheck and unit-test after any code change
globs: *
---
# Verify — always, no exceptions
- Type checking is seconds. ALWAYS run it after any code change, no matter how small.
- Unit tests are seconds. ALWAYS run them after any code change.
- **Run every test, typecheck and gate through `bash scripts/quiet-test.sh <command>`** (e.g. `bash scripts/quiet-test.sh npx vitest run <file>`, `bash scripts/quiet-test.sh npm run typecheck`, `bash scripts/quiet-test.sh npx playwright test <spec>`). It drops every passing-test line, prints the failures and summary, and saves the full log under `build/test-logs/`. Never run bare vitest/playwright/typecheck in the foreground: passing traces flood context. Open the log only for a named failing test.
- A change is not "done" — and is not committed — until both pass. "It's only a rename/comment/one-line" is never a reason to skip them.
- `npm run typecheck` and `npx vitest run packages/design packages/persistence` are the minimal gate; run the affected package's suite too.
- **Never run the entire test suite while iterating: run only the targeted specs for the change.** The pre-commit hook is the only full run.
- **Prove a small change with the one test that observes it.** A one-line edit gets the single spec that covers it, never the suite. `bash scripts/health-check.sh` is the final gate before declaring a large change done — never a step in proving a small one.
- **Commit with the hooks on. Agents never use `--no-verify` (or `commit.sh --prose`) on their own.** Skip the hooks only when John says so for that commit, in his own words; his word covers that commit only. A prose-only change still goes through the hooks unless John says otherwise: run the one spec that renders it, then commit. If a hook blocks or the run is slow, report it to the coordinator or John; never bypass it. The AI-attribution guard is never skipped (John, 2026-10-07: "the ai shouldn't be doing no-verify - but I can tell it to do that").
