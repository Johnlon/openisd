---
description: Always typecheck and unit-test after any code change
globs: *
---
# Verify — always, no exceptions
- Type checking is seconds. ALWAYS run it after any code change, no matter how small.
- Unit tests are seconds. ALWAYS run them after any code change.
- A change is not "done" — and is not committed — until both pass. "It's only a rename/comment/one-line" is never a reason to skip them.
- `npm run typecheck` and `npx vitest run packages/design packages/persistence` are the minimal gate; run the affected package's suite too.