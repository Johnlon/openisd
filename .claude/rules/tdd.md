---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.vue"
---

# TDD — pick the cheapest layer that proves the behavior

Never begin by editing a source file. Write the failing test first, at the lowest layer that can
actually observe the bug or the feature:

1. **Unit** (`vitest run <file>`, or `npm run test:unit` for all) — engine, design, persistence,
   any pure logic. No DOM, no Vue. Default choice.
2. **Hook** (`packages/ui/test/hooks/*.test.ts`) — call the `*-hooks.ts` composable directly
   (refs/computed in, assert on the returned refs). No mount, no DOM. Covers UI-adjacent logic
   without a browser.
3. **UI with the hook mocked** (`packages/ui/test/ui/*.test.ts`) — mount the component with a
   fake hook object injected in place of the real `*-hooks.ts` composable. Proves the component
   reads/writes the hook's surface correctly (template bindings, event wiring), not the hook's
   own logic — that's already covered at layer 2.
4. **Full browser** (`packages/ui/test/ui/*.browser.spec.ts` via `npx playwright test`) — real
   DOM, real hooks, real engine. High-value, proves actual end-to-end wiring, but slow. Add one
   sparingly per feature to prove the seams connect — not to re-verify logic already covered at
   layers 1-3.

Watch it fail for the right reason, implement, watch it pass, then run the domain suite before
declaring done.
