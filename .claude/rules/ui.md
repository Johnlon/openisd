---
paths:
  - "packages/ui/**"
---

# UI

There is ONE skin: Original. `packages/ui/src/ui/shells/` holds `original/` and nothing else.

Layers: `ui/` `logic/` `db/` `diagnostics/` `logging/`.

Browser tests are the only proof a curve was drawn — jsdom stubs prove only that the script did
not throw. Every `packages/ui/test/**/*.browser.spec.ts` imports from
`packages/ui/test/fixtures.js`, never `@playwright/test` directly: that module's `browserLog`
auto-fixture asserts on console errors, Vue warnings and failed network requests.

Contracts: `docs/spec/SPEC_UI.md` §4 (UI-1…UI-4).
