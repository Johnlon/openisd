Status: FIXED

# `syncedP`'s filters deep-copy is a reactivity workaround standing in for proper tracking

## Symptom

`packages/ui/src/logic/store.ts:491`:

```ts
p.filters = state.P.filters.map(f => ({ ...f }));
```

A copy whose only purpose is to make Vue's dependency tracker look inside each filter. It
produces no value the caller needs — `p.filters` would otherwise be the same data.

Delete the line and the defect it masks reappears: editing a filter's `fc`/`Q`/`gain` stops
re-running the sweep, silently, with no error.

## Evidence

`store.ts:486` builds the result with `const p: SyncedParams = { ...state.P, eg };` — a SHALLOW
spread, so `filters` crosses as the same array reference.

Vue's `computed` re-runs when a property it READ during evaluation changes. Reading
`state.P.filters` registers a dependency on the array binding only, not on any object inside it.
Filters are edited in place, so the array reference never changes and the computed is never
invalidated — `syncedP` feeds the sweep, so the graph would keep drawing the previous filter
settings.

The `.map(f => ({ ...f }))` reads every field of every filter, which is what registers the
per-field dependencies. The comment at `store.ts:487-490` states this explicitly.

## Cause

A `computed` in the store reaches directly into `state.P.filters`, a mutable array owned and
mutated elsewhere, and then hand-rolls the dependency tracking that the framework is supposed to
do automatically. The mechanism is invisible: nothing at the call site indicates that the
copy is load-bearing, so it reads as redundant and is a natural candidate for "cleanup" — at
which point the sweep silently goes stale.

## Fix

Landed as part of QO60 objective 2 (`state.P` deletion, `docs/design/REACTIVITY.md`).
`state.P` and its own `filters` array are gone; `managedProject.filters()` returns a fresh copy
on every call and `syncedP` (`store.ts`) now depends on `_version` — the domain's own
change-notification channel, bridged through `managedProject.subscribe()` — instead of
hand-walking the array. A caller edits the filter chain via `managedProject.setFilters(arr)`,
which calls `mutate()` and therefore bumps `_version` unconditionally; there is no more
in-place-mutation path that could bypass it, so the manual deep-copy is deleted along with the
mechanism it was working around.

## Verification

`packages/ui/test/logic/store-filters-reactivity.test.ts` — editing a filter's `fc` and adding a
filter, both through `managedProject.setFilters()`, each recompute `syncedP`.

## Note on a claim NOT being made

An earlier draft of this finding also cited the per-recompute allocation cost. That argument is
withdrawn: a design carries a handful of filters, so the allocation is negligible. The defect is
the fragile, undocumented tracking mechanism alone.
