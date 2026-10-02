Status: FIXED (2026-09-27)

## Symptom

`packages/ui/src/logic/appState.ts:381-385` (`doSweep`) builds its own `Engine()` and calls
`engine.sweep(d, state.box, syncedP.value)` / `engine.maxCurves(...)` directly, using a driver
(`engineDriver()`) and params (`syncedP.value`) it derives itself in the UI layer, instead of
asking the focused `OpenISDProject` to sweep itself (`packages/design/domain/project.ts:2044`
`sweep(P)`, which already pulls `this.driver.solveConsistencyGroup()` and
`this.#engineBoxType()` from itself).

Separately, and more fundamentally: `sweep()` (`packages/design/engine/sweep.ts:357-358`)
hardcodes `Result.errors: []` and never calls `classifyFinite`/`classifyFlatClamp` on its own
output; `maxCurves()` (line 404) does the same and never calls `classifyMaxFinite`. Those three
postconditions exist specifically to catch a degenerate sweep result (all-NaN, flat-clamped,
infinite max curves) but are only ever invoked from OUTSIDE `sweep()`/`maxCurves()` — currently
via `OpenISDProject`'s thin delegate methods (`classifyFinite`, `classifyFlatClamp`,
`classifyMaxFinite` at project.ts:2082-2094), called from `appState.ts`'s `driverErrors()`.

Per the engine ownership rule: the engine (and `sweep()`/`maxCurves()` as its entry points) does
all validation of its own domain: no caller pre- or post-validates it. A classify call living
outside `sweep()`/`maxCurves()` means those functions are incomplete — their own `Result.errors`
should already carry whatever a caller currently gets by calling `classifyFinite` etc.
separately afterward.

`validateParams` (`project.ts:2062`, delegating to `Engine.validateParams`) is also redundant on
top of this: any bad box/param combination already shows up as a non-finite or clamped sweep
result, caught by the postconditions above once those are folded into `sweep()`/`maxCurves()`
themselves. A separate pre-check re-answers the same question before the sweep runs.

## Cause

Left over from the `ManagedProject` era. The postcondition functions were added as a
belt-and-braces check bolted on from outside `sweep()`/`maxCurves()` rather than folded into
those functions' own `Result`, and `appState.ts` grew its own direct `Engine()` calls instead of
going through the project.

## Fix

Applied, narrower than the numbered plan below. `appState.ts`'s `doSweep` already called
`p.sweep()`/`p.maxCurves()` by the 2026-09-26 re-verification — the one violation left was
`curveIssues` constructing `const eng = new Engine()` to call `classifyFiniteIssues`, because
`OpenISDProject` had delegates for its three siblings (`classifyFinite`/`classifyFlatClamp`/
`classifyMaxFinite`) but not for the per-output variant `curveIssues` actually needed. Fixed by
adding the missing delegate — `OpenISDProject.classifyFiniteIssues(sw)`, mirroring the other
three exactly (`domain/openisdDomain.ts`, class is no longer at `project.ts` — moved since this
was written) — and routing `curveIssues` through `live.value` (the focused project) instead of a
throwaway `Engine`.

NOT applied, and no longer this bug's scope — the broader restructure in the numbered plan below.
It does not type-check cleanly as written: `SweepSolveResult.issues` is typed `SweepIssue[]`
(`DriverIssue | EnvironmentIssue | BoxParamsIssue | VentIssue | PrIssue | SignalIssue` —
structured domain shapes), not `DriverError[]` (`{level, field, message}`, the flat shape the
classify functions return) — folding one into the other needs a real type unification, not
attempted here. `validateParams`'s redundancy against the postconditions is real but is not a
"UI layer decides a domain question" violation, so it does not block this bug; left as optional
separate cleanup.

Original proposal (superseded by the above; kept for context):

1. `sweep()` calls `classifyFinite`/`classifyFlatClamp` on its own result before returning, and
   folds any hit into its `Result.errors` — no caller calls them separately afterward.
2. `maxCurves()` calls `classifyMaxFinite` the same way.
3. `validateParams` is deleted from `OpenISDProject` and from `Engine` — its job is already done
   by the sweep/maxCurves postconditions above. `paramIssues` in `appState.ts` is deleted.
4. `appState.ts`'s `doSweep` calls `p.sweep(syncedP.value)` / `p.maxCurves(syncedP.value)` on the
   focused `OpenISDProject` — no direct `new Engine()` construction in the UI layer.
5. `curves.value`/`max.value` become the full `Result` (value + errors), so `GraphPanel.vue`
   reads each chart's own errors off its own design's sweep/maxCurves result — not one shared
   `allIssues` list reused across every tab.

`classifyFinite`/`classifyFlatClamp`/`classifyMaxFinite` become PRIVATE to `sweep.ts` (not
exported), called only from inside `sweep()`/`maxCurves()`. `Engine.classifyFinite`/
`classifyFlatClamp`/`classifyMaxFinite` (`Engine.ts:271-282`) and
`OpenISDProject.classifyFinite`/`classifyFlatClamp`/`classifyMaxFinite`
(`project.ts:2082-2094`) are deleted — no public surface for them anywhere.

There is no case where the engine is the wrong place for this and `sweep()` is a fallback:
`sweep()`/`maxCurves()` are plain functions in `engine/sweep.ts`; `Engine` (`Engine.ts:46`) is a
thin class that imports them from `sweep.js` and exposes them as methods (`Engine.sweep()` at
line 251 just calls the `sweep.ts` function directly). They are the same code. Folding the
classify calls into `sweep()`/`maxCurves()` in `sweep.ts` IS folding them into the engine.

## Verification

`packages/design/test/engine-wiring.test.ts` — new case pins `project.classifyFiniteIssues(sw)`
equal to `engine.classifyFiniteIssues(sw)`, alongside the three siblings' pre-existing equivalent
assertions. `grep -n "new Engine(" packages/ui/src/logic/appState.ts` leaves one hit — the
approved store's own canonical engine instance (`ARCHITECTURE.md`: "logic/appState.ts holds...
the engine"), not a throwaway construction. Full suite clean under WSL: every `packages/design` +
`persistence` + `ui` unit test, and the full Playwright browser suite —
`packages/ui/test/logic/store-issue-channel.test.ts`'s 11 cases (the `allIssues` wiring tests,
unchanged) still pass, proving the swap changed no observable behaviour.
