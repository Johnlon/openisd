---
paths:
  - "packages/engine/test/**/*"
  - "packages/design/test/winisd/**/*"
---

# openisd — JS core test rules

Vitest + `node:assert/strict`. Run with `npm run test:unit` (watch: `npx vitest`). The suites
and the surrounding gates are in `openisd/AGENTS.md` §"Quality gates — non-negotiable".

- **Direct unit tests are required.** Every function in `packages/engine/src/` has direct unit
  tests in `test/`. Tests are not optional.
- **Human-readable scenarios.** Every `it(...)` describes its scenario in plain English — the
  physical situation under test and the expected outcome. A loudspeaker designer who has never
  seen the code must be able to read the test name and understand what it verifies.
- **No magic numbers.** Every numeric literal — input, expected value, tolerance — is a named
  constant with a comment stating what it represents and why it has that value. No unexplained
  `0.1`, `37`, `2.83`.
- **Every tolerance is named and justified**, e.g. `SPL_TOLERANCE_DB = 0.1`, with a comment
  explaining why that tolerance is physically appropriate.
- **Parameterised tests are allowed** provided each scenario row carries a clear
  human-readable label saying which case it covers.
- **Citations must be verified.** Any reference in a test comment — AES paper, Wikipedia URL,
  textbook — is checked to exist before it is written. Mark an unchecked one
  `⚠ Unverified reference`.

## Red→green cycle

1. Write a test that reproduces the bug and drives the app into the state where the bug
   actually renders — a check that never renders the broken state cannot catch it.
2. Run `npm run test:unit` and watch it **fail**, for the right reason (a wrong value, not a
   missing import).
3. Apply the fix.
4. Run again and watch it **pass**.
5. `npm run lint` — 0 errors.
6. `npx playwright test` — fully green before claiming done.

Never claim a bug is fixed without first seeing a test for it fail.
