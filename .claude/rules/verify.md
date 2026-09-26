---
description: Always typecheck and unit-test after any code change
globs: *
---
# Verify — always, no exceptions
- Type checking is seconds. ALWAYS run it after any code change, no matter how small (`npm run typecheck`).
- Unit tests are seconds. ALWAYS run them after any code change.
- **Targeted spec execution & output filtering**: Run only the affected test files (e.g. `npx vitest run packages/design/test/engine/circuit.test.ts`). When running broader test suites, filter output (`--reporter=dot` or `grep -E "FAIL|Error"`) to avoid context bloat. Never dump bare passing test traces into context.
- A change is not "done" — and is not committed — until both pass. "It's only a rename/comment/one-line" is never a reason to skip them.