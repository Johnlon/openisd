---
paths:
  - "packages/ui/src/**/*.vue"
  - "packages/ui/src/hooks/**"
---

# UI is ultra-thin — logic lives in an injectable hook

A `.vue` file is template + prop/event wiring only: no business logic, no direct calls into
`@openisd/design`/`@openisd/engine`, no reactive state construction beyond wiring the hook's
returned refs to the template. If a line isn't reading a hook's ref, calling a hook's method, or
declaring props/emits, it doesn't belong in the component.

**One hook file per Vue component.** `ComponentName.vue` pairs with exactly one
`ComponentName-hooks.ts` (`packages/ui/src/hooks/`) holding all of that component's state,
computed values, and calls into the domain/engine. Coarse-grained: one hook exposes the whole
surface the component needs, not a pile of small composables the component has to wire together
itself.

**Injectable, not imported as a singleton.** The hook is a factory (`createXHook(deps)` /
`useX(deps)`) called by the component (or its composition root) and passed its dependencies —
never a module-level instance the component reaches for by import. This is what lets a test swap
in a fake hook.

Why: this is what makes layers 2 and 3 of `tdd.md` possible — testing the hook's logic with
`vitest` and no DOM (layer 2), and testing the component's template/event wiring with the hook
mocked (layer 3) — without ever paying for a browser. A component that calls the domain directly,
or reaches for a hook via import instead of injection, can only be tested at layer 4 (full
browser) — slow, and the wrong layer for proving logic.
