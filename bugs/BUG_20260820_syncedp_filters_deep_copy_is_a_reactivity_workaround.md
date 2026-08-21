Status: OPEN

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

Not fixed. The cause is the arrangement, not the line: the filters should arrive as a properly
tracked value from the object that owns them rather than being reached for and manually walked.
Deferred by John (2026-08-20) to a dedicated discussion, together with the broader reactivity
question this is one instance of.

## Verification

N/A — open. Whatever the fix, the regression test is: mutate one filter's `fc` in place and
assert `syncedP` recomputes and the sweep result changes.

## Note on a claim NOT being made

An earlier draft of this finding also cited the per-recompute allocation cost. That argument is
withdrawn: a design carries a handful of filters, so the allocation is negligible. The defect is
the fragile, undocumented tracking mechanism alone.
