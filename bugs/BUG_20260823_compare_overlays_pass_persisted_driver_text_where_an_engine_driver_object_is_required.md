# Compare overlays hand `seriesFor` a persisted-driver TEXT string where it requires an `EngineDriver` object

Status: OPEN

## Symptom

`OriginalShell.vue`'s `overlays` computed builds `Design[]` for every open project other than
the active tab, so their curves can be drawn as compare traces on the graph. Its `driver` field
is populated straight from each project row's `driver` property:

```ts
const overlays = computed<Design[]>(() =>
  openProjects.value
    .filter(p => p.id !== activeProjectId.value && p.visible !== false)
    .map(p => ({
      driver: p.driver, box: p.box, P: p.P, ...
    })) as Design[],
);
```

`types.ts`'s `Design.driver` is declared `EngineDriver | null` — the parsed engine object
`buildPlotData`/`series.ts`'s `seriesFor(tabId, drv, ...)` reads driver-derived scalars from
(Fs, Vas-adjacent Thiele/Small figures used by several curve builders, not just the raw curve
line data already carried in `curves`/`maxCurves`).

But each `ProjectRow.driver` is populated from `persistedDriver.value`
(`onMounted` at ~line 379, the sync `watch` at ~line 399, `copyCurrentProject`/
`openNewProject`/`closeProject` at ~lines 484/507/560) — `appState.ts`'s own docstring for
`persistedDriver` states plainly: "the managed layer's own persisted TEXT... Never the record
value." It is a serialised `.owdr`-shaped string, not an `EngineDriver`.

The mismatch was invisible before this session because `openProjects` was `ref<any[]>` and the
`overlays` map result was forced with `as Design[]` — both erase the type, so nothing ever
checked that `p.driver` (a string) actually satisfies `EngineDriver | null`.

## Evidence

`packages/ui/src/ui/shells/original/OriginalShell.vue`: `ProjectRow.driver` assignments at
~379, ~399, ~484, ~507, ~560 all read `persistedDriver.value`; `overlays` computed at ~435-443
passes that same field straight through as `Design.driver`. `packages/ui/src/logic/appState.ts:227`
documents `persistedDriver` as text. `packages/ui/src/logic/series.ts`'s `seriesFor`/
`CURVE_BUILDERS` read scalar fields off the `drv: EngineDriver` parameter for curve types
beyond a plain line trace (found while giving `ProjectRow`/`overlays` real types in this
session, replacing the `any`/`as Design[]` erasure that had hidden the mismatch).

## Cause

The `driver` value crossing into an overlay's `Design` was never actually an `EngineDriver` —
it is the same persisted-text value the row keeps for reloading itself on tab switch
(`selectProject`'s `managedProject.loadDriverFromPersistedText(targetDesign.driver)`), reused
for a second purpose (feeding the graph) it does not have the right shape for. Nothing caught
this because `any`/`as Design[]` suppressed the type check that would have flagged it.

## Fix

Not fixed. The active design's `Design.driver` comes from `managedProject.toEngineDriver()` —
a method on the ONE live managed project. An overlay's driver is a DIFFERENT, non-active
project, so there is no existing licensed path to parse its persisted text into an
`EngineDriver` without going through (and disturbing) the live `managedProject`. Needs a real
API — most likely a driver-domain function that parses `.owdr`/`.wdr` text to an `EngineDriver`
without touching project state — added by whoever owns that construction boundary (containment
gate: only `managedProject.ts`/`managedDriver.ts`/`DriverEditorModal.vue` may hold an
`OpenISDDriver` value); this file cannot construct one itself.

## Verification

Closure = open 2+ projects with different drivers, show both as overlays, and confirm a curve
type that reads scalar driver fields (e.g. MaxSPL, Excursion) renders correctly for the
overlaid project rather than crashing or drawing garbage — ideally pinned by a test once the
new parse API exists.
