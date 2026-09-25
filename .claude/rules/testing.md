---
description: Testing strategy pointer — TDD mandatory, skip-is-a-fail
paths:
  - "packages/**"
  - "test/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# Testing — the strategy is in TESTING_STRATEGY.md

Read [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) before touching any code. It is the single
authority: TDD (red→green first, never edit source first), the skip-is-a-fail rule, naming
files by the object under test, feature decoupling at the test level, and the tier structure.

> **TDD is mandatory.** Say you are doing TDD when you start. Never begin by editing a source
> file: write the failing test, watch it fail for the right reason, implement, watch it pass,
> run the domain suite. Reference: the `/test-driven-development` skill.

> **A skip is a fail.** Never delete, skip, weaken or corrupt a test to make the suite green.
> A failing test is information — fix the test to match the current UI, or raise an inbox
> item; do not delete it. The full removal rules are in `TESTING_STRATEGY.md`.

Fast-gate requirement (typecheck + unit tests after every change): `.claude/rules/verify.md`,
always active.
