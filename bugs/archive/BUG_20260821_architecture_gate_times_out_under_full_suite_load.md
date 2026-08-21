Status: RESOLVED

# An architecture gate fails only in the full suite — it is a 5 s TIMEOUT, not an assertion

## Symptom

`packages/ui/test/ui/architecture.test.ts` → "a service exports no mutable module-level
binding" FAILS in `npx vitest run` and PASSES when that file is run on its own. The other four
architecture failures are genuine, known-red QO60 gates; this one is not.

## Evidence

Run alone (2026-08-21):

```
✓ inversion of control … > a service exports no mutable module-level binding  1115ms
```

Run as part of the full suite, twice, reproducing both times:

```
FAIL |ui| test/ui/architecture.test.ts > … > a service exports no mutable module-level binding
Error: Test timed out in 5000ms.
 ❯ test/ui/architecture.test.ts:249:3
```

No assertion message, no offence list — the body never finished.

## Cause

The test walks `src/db`, `src/diagnostics`, `src/logging` and parses each file through
ts-morph. It is the first test in its `describe` to touch `src/db`, whose `driverRepo.ts` is
572 lines, so it pays that parse. 1.1 s idle is already 22% of vitest's 5 s default budget; the
full suite runs many workers concurrently, and under that contention it does not complete.

The 5 s default is calibrated for a unit test that exercises a function. An architecture gate
that walks a source tree and builds ASTs is I/O- and parse-bound work with no meaningful
5-second meaning attached to it.

## Fix

State the budget these gates actually need, at the file level, and say why:

```ts
describe('inversion of control — collaborators are injected, never reached for', () => {
  // AST gates walk and parse the source tree; vitest's 5 s default is a unit-test budget and
  // this work is parse-bound, so it is stated explicitly rather than left to contend for it.
```

applied as a per-test `timeout` argument on the AST-walking gates.

NOT fixed by weakening the assertion or narrowing the scanned set — the gate's coverage is the
point, and it reports zero offences when it is allowed to finish.

## Verification

`npx vitest run` → the gate passes; the remaining four architecture failures are the known-red
QO60 layering gates and are unchanged.
