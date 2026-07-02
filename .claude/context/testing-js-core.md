# JS core testing rules — packages/engine/src/

## Framework

Vitest + `node:assert/strict`. Run with `npm run test:unit` (watch: `npx vitest`).

## Rules

- **Direct unit tests required.** Every function in `packages/engine/src/` must have direct unit tests in `test/`. Tests are not optional.

- **Human-readable scenarios.** Every `it(...)` must describe its scenario in plain English — what physical situation is being tested and what the expected outcome is. A loudspeaker designer who has never seen the code must be able to read a test name and understand what it verifies.

- **No magic numbers in tests.** Every numeric literal (inputs, expected values, tolerances) must be a named constant with a comment explaining what it represents and why it has that value. No unexplained `0.1`, `37`, `2.83`, etc.

- **All tolerances documented.** Every comparison tolerance must be a named constant (e.g. `SPL_TOLERANCE_DB = 0.1`) with a comment explaining why that tolerance is physically appropriate.

- **Parameterised tests are allowed** as long as each scenario row has a clear human-readable label explaining what case it covers.

- **References must be verified.** Any citation (AES paper, Wikipedia URL, textbook) included in test or source code comments must be verified to exist before inclusion. Do not invent or assume URLs — check them. Flag unverified citations with `⚠ Unverified reference`.

- **No magic numbers in source code.** Every non-obvious numeric constant in `packages/engine/src/` must have a comment explaining its physical meaning and a source reference where applicable. Named constants are preferred over inline literals.

## Red→green TDD cycle

1. Write a test that reproduces the bug and drives the app into the state where the bug actually renders (a check that never renders the broken state cannot catch it).
2. Run `npm run test:unit` and watch it **fail** — confirm it fails for the right reason (wrong value, not a missing import).
3. Apply the fix.
4. Run again and watch it **pass**.
5. Run `npm run lint` — must be 0 errors.
6. Run `npx playwright test` — must be fully green before claiming done.

Never claim a bug is fixed without first seeing a test for it fail.

Also read: `.claude/context/engine-rules.md` before touching any formula.
