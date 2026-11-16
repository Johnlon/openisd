# BUG_20261115_unit-gate-misses-the-built-bridge-test

**Status:** FIXED by T826 (small change in `scripts/land/unit-changed.sh`; lead may prefer a precise one)

## Symptom
PR 121 (T823) changed `driverRecordConverter.ts`, passed `pr-gate`, merged, and turned main red: `bridge-bundle.test.ts` "returns a warn
entry ALONGSIDE a good wdr..." failed ("expected a 'warn' on field Re_ohm, got: []"). Its fixture fed a printed zero, which by
QO935 no longer warns.

## Steps to reproduce
1. Edit any source the bridge is built from, e.g. `packages/design/domain/driverRecordConverter.ts`.
2. `bash scripts/land/unit-changed.sh packages/design/domain/driverRecordConverter.ts`.
3. Observed: `bridge-bundle.test.ts` is not among the files run. Expected: it runs, since it drives the bundle built from that source.

## Cause
`unit-changed.sh` selects tests by `vitest --changed origin/main` (import graph) plus `typeReach.mjs` (tests naming an edited
type). `bridge-bundle.test.ts` imports no source: its `beforeAll` runs `vite build --config packages/design/vite.bridge.config.ts`
in a child process and evaluates the output in `node:vm`. Nothing in vitest's module graph (or in `typeReach.mjs`) links it to
`winisd/bridge.ts` or anything the bundle contains, so no source change selects it. The local run of the whole winisd folder, which
would have caught it, timed out queued behind `suite-lock` and was not seen before the PR merged.

## Fix
`unit-changed.sh` adds `packages/design/test/winisd/bridge-bundle.test.ts` to the run when any non-test `.ts` source under
`packages/design` is among the changed files. It is broader than the true dependency (the bundle's transitive imports from
`winisd/bridge.ts`), which costs one extra ~5 s test per design change; a precise fix would compute that import closure
(`vite build --metafile` or the bridge entry's graph) and is left for the lead if wanted. Other tests that build or load a built
artefact have the same blind spot; none else was checked.

## Verification
`bash scripts/land/unit-changed.sh packages/design/domain/driverRecordConverter.ts` lists the bundle test among the files it runs.
