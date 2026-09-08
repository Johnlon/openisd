# The ts-morph architecture gate times out under full-suite load, so it reports a false failure

Status: OPEN

## Symptom

`packages/design/test/architecture-project-has-three-fields.test.ts` fails in a full
`npx vitest run packages/design`:

```
Error: Test timed out in 5000ms.
 ❯ test/architecture-project-has-three-fields.test.ts:37:3
```

Run alone it passes in about a second:

```
✓ OpenISDProject holds only #saved/#edited/#engine as stored fields > declares no property beyond the allowed set  1072ms
```

## Evidence

Both runs above are from 2026-09-08 against the same working tree. The full-suite run reports
the test taking 6511ms; the isolated run reports 1072ms for the identical assertion. Nothing
about `OpenISDProject`'s property list differs between them — raising the timeout
(`--testTimeout=60000`) makes the full-suite run green with no source change.

## Cause

The test builds a whole ts-morph `Project` from `tsconfig` inside the test body:

```ts
const project = new Project({ tsConfigFilePath: path.join(packageRoot, ...) });
```

That is a full TypeScript program load, and it competes with every other worker in the suite for
CPU. The 5000ms default is comfortable when the test runs alone and is not when 57 other files
are running, so the gate's verdict depends on machine load rather than on the code it guards.

## Fix

Not applied — a bare timeout bump would leave the same shape (a gate whose result depends on how
busy the box is), just with a larger number. Two honest options, and which one is right is a
call about how the architecture gates should run:

- Give the ts-morph gates an explicit generous timeout, on the grounds that loading a TS program
  is legitimately slow and the number is documentation, not a hack.
- Share one ts-morph `Project` across the architecture tests that need it, so the program is
  loaded once per file instead of once per test.

`test/architecture-no-casts.test.ts` builds a ts-morph project the same way and takes ~500ms, so
it is the same family and would move with whichever is chosen.

## Verification

When fixed: `npx vitest run packages/design` must show this test green, and running it under
artificial load (a parallel build) must not flip it back to red.
