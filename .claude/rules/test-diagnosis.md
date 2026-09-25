---
paths:
  - "packages/**/*"
---

# Diagnosing a failure — target the test, not the suite

Reproduce and verify at the narrowest scope that can show the failure. Widen only when the
narrow scope can't reproduce it.

1. Run the single target file: `vitest run <path/to/file.test.ts>` (or the one
   `.browser.spec.ts` under Playwright: `npx playwright test <file>`). Never the whole suite
   while iterating.
2. If the bug is in logic, reproduce it at the unit or hook layer first (see `tdd.md`) — same
   symptom, seconds instead of minutes, and it pinpoints the actual broken function instead of
   "the page looks wrong."
3. Escalate to a mocked-hook UI test only if the failure is in wiring (component not reading or
   calling the hook correctly), not logic.
4. Escalate to a full browser test only if the failure doesn't reproduce below that layer — real
   timing, real DOM, real integration.
5. Run the full suite (`bash scripts/health-check.sh`) only as the final gate before declaring
   done, never as a diagnostic step.

"It fails in the full suite but I can't reproduce it narrower" is itself a finding — the bug is
in integration, timing, or ordering, not logic. Say so; don't shrug and rerun the slow suite
repeatedly hoping it narrows itself.
