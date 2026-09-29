---
description: Always typecheck and unit-test after any code change
globs: *
---
# Verify — always, no exceptions
- Type checking is seconds. ALWAYS run it after any code change, no matter how small (`npm run typecheck`).
- Unit tests are seconds. ALWAYS run them after any code change.
- **Run every test, typecheck and gate through `bash scripts/quiet-test.sh <command>`** (e.g. `bash scripts/quiet-test.sh npx vitest run <file>`, `bash scripts/quiet-test.sh npm run typecheck`, `bash scripts/quiet-test.sh npx playwright test <spec>`). It drops every passing-test line, prints the failures and summary, and saves the full log under `build/test-logs/`. Never run bare vitest/playwright/typecheck in the foreground: passing traces flood context. Open the log only for a named failing test.
- **Targeted spec execution & output filtering**: Run only the affected test files (e.g. `npx vitest run packages/design/test/engine/circuit.test.ts`). Never dump bare passing test traces into context.
- A change is not "done" — and is not committed — until both pass. "It's only a rename/comment/one-line" is never a reason to skip them.
- **Never run the entire test suite while iterating: run only the targeted specs for the change.** The pre-commit hook is the only full run.
- **Prove a small change with the one test that observes it.** A one-line edit gets the single spec that covers it, never the suite. `bash scripts/health-check.sh` is the final gate before declaring a large change done — never a step in proving a small one.
- **A prose-only change skips the hook's suite: commit with `.claude/skills/git-actions/commit.sh --prose`.** Prose is text a reader sees and no code reads — a `.vue` template sentence, a comment, a doc. It cannot change behaviour, so run the one spec that renders it and stop. `--prose` passes `--no-verify` and runs the AI-attribution guard itself, so that guard still holds; the test run is the only thing dropped. The hooks have their own doc-only exception but it recognises `*.md` alone, so without `--prose` a reworded splash sentence pays for the full browser suite — 4 minutes (2026-09-26).
