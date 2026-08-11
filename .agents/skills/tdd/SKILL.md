---
name: tdd
description: MANDATORY red→green TDD loop for openisd. Load and FOLLOW it BEFORE editing any source under packages/*/src to fix a bug or add a feature — write the failing test FIRST, run it and watch it fail, then write only enough code to pass. Covers what a good test is, seams, the anti-patterns (tautological, horizontal-slicing, implementation-coupled), the functional-vs-unit test split, and the rules of the loop. Triggers on: fixing a bug, adding or implementing a feature, changing calculation logic, "test-first", "red-green", "red-green-refactor", "TDD".
---

# Test-Driven Development

Write a failing test before writing the code that makes it pass. For bug fixes, reproduce the
bug with a test before attempting a fix. Tests are proof — "seems right" is not done, and
neither is "I traced the math by hand." A codebase with good tests is an agent's superpower; a
codebase without them is a liability, because nothing stops the next edit from re-breaking what
this one just fixed.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface
vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## When to use it

- Fixing any bug — reproduce it with a failing test FIRST (the Prove-It Pattern below)
- Implementing any new logic or behavior
- Modifying existing functionality
- Adding edge-case handling
- Any change that could break existing behavior, including a calculation-logic change

**Not required for:** pure configuration, documentation, or static-content changes with no
behavioral impact (this file is an example of such a change).

## 🔒 Functional test required for every user-visible behavior — hard rule

**Any change that is visible or usable through the UI MUST have a UI functional (browser/
Playwright) test proving the basic functionality is in place.** This is not optional and it is
not satisfied by a unit test, however thorough. A calculation can be unit-tested to the ninth
decimal and still ship broken to a user if nothing ever drove the actual control, read the
actual DOM, or exercised the actual wiring between the store and the component — which is
exactly how the `findImpedancePeak` regression (20 kHz / Qtc 0 on the Original skin) shipped
undetected: the engine had a correct unit-tested function that no functional test ever proved
was actually connected to the screen.

- **Unit and component tests** exist to refine and verify a component's OWN internal behavior
  and special/edge cases — as long as those cases do not themselves constitute a *different*
  user-facing behavior. A unit test proves the formula; it does not prove the formula is wired
  to what the user sees.
- **A user-facing behavior always needs its own functional test**, even if a unit test already
  covers the underlying calculation. If a change alters what appears on screen, what a control
  does, or what value a readout shows, a Playwright test must drive that control/readout and
  assert on it — not merely assert on the function that (supposedly) feeds it.
- **The pairing, not either/or:** unit tests are for depth (many cases, fast, isolated); the
  functional test is for truth (does the seam from store → component → DOM actually work). Ship
  both when a change touches both layers; never ship only the unit test for something the user
  can see or click.

## Discover the stack first

The TDD cycle is universal; the commands are not. In openisd:

- **Engine (`packages/engine/src`)** — `npx vitest run packages/engine/test/<file>.test.ts` for
  one file, `npm run test:unit` for the full JS unit suite.
- **UI unit/component (`packages/ui/test/**/*.test.ts`)** — same vitest commands.
- **UI functional (`packages/ui/test/**/*.browser.spec.ts`)** — Playwright. Run ONE spec while
  iterating: `npx playwright test packages/ui/test/ui/<file>.browser.spec.ts --workers=1`. See
  `openisd-ui-tests.md` for the fixture import rule and the background/single-suite rule before
  running the full suite.
- Never assume `npm test` — check `package.json`'s `scripts` block for this repo's real names.

## The TDD cycle

```
    RED                GREEN              REFACTOR
 Write a test    Write minimal code    Clean up the
 that fails  ──→  to make it pass  ──→  implementation  ──→  (repeat)
      │                  │                    │
      ▼                  ▼                    ▼
   Test FAILS        Test PASSES         Tests still PASS
```

**Red before green.** Write the failing test first, run it, and read the failure — confirm it
fails for the reason you expect (a missing feature, a wrong value), not for an unrelated setup
error. Only then write the minimal code to pass it. Don't anticipate future tests or add
speculative behavior beyond what the current test demands.

> [!CAUTION]
> **PROHIBITED:** Never edit or write any implementation/source code (including type signatures, helper functions, layout markup, or CSS styles) BEFORE writing the reproducing/specifying test and watching it fail (Red). Doing so violates the core TDD constraint of this project.

**One slice at a time.** One seam, one test, one minimal implementation per cycle. Work in
**vertical slices** — one test → one implementation → repeat — not **horizontal slicing**
(writing every test up front, then every implementation): bulk-written tests verify *imagined*
behavior and go insensitive to what the code actually does, because you commit to test
structure before the implementation has taught you anything.

**Refactoring is not part of the red→green loop.** It is a separate stage, done with tests
green, never mixed into the cycle that is proving new behavior.

## The Prove-It Pattern (bug fixes)

A bug report is a claim. Before touching the fix:

1. Write a test that reproduces the reported bug with the reported inputs.
2. Run it and confirm it fails **the way the bug report describes** — right symptom, not a
   stray error.
3. Only then change the implementation.
4. Run the test again and confirm it now passes.
5. Run the broader suite for the touched area to confirm nothing else broke.

Skipping step 1–2 and going straight to "I see the bug, here's the fix" is exactly the failure
mode this skill exists to stop — the fix might be right, but nothing PROVES it, and nothing
stops a future edit from reintroducing the same bug silently.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change
entirely; tests shouldn't. A good test reads like a specification — "sealed box in 6 L reports
WinISD's own Fsc" tells you exactly what capability exists — and survives refactors because it
doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams — where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without
reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and
confirm them with the user if the scope is non-obvious. You can't test everything — agreeing
the seams up front is how testing effort lands on the critical paths and complex logic instead
of every edge case.

Ask: "What's the public interface, and which seams should we test?" — and per the functional-
test rule above, if the seam is user-visible, one of those seams is the DOM/browser, not just
the function signature.

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or verifies
  through a side channel (querying the database instead of using the interface). The tell: the
  test breaks when you refactor but behavior hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does
  (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted
  equal to itself), so it passes by construction and can never disagree with the code. Expected
  values must come from an independent source of truth — a known-good literal, a worked
  example, the spec, or (for this project) WinISD's own measured readout.
- **Horizontal slicing** — writing all tests first, then all implementation. See "vertical
  slices" above.
- **Unit-only for a user-facing change** — shipping a unit test for the calculation while
  leaving the actual UI wiring unverified. See the hard rule above; this is the specific
  anti-pattern that caused the Original-skin Fsc regression.
