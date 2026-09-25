Status: RESOLVED

# The PR-tuning auto-solve watch never fires: a getter that returns an invariant reference

## Symptom

`packages/ui/src/logic/store.ts`'s PR-tuning group watch —

```ts
watch(
  () => live.value,
  () => {
    if (_solvingVent || ventSolveSuspended()) return;
    _solvingVent = true;
    try { solvePrGroup(managedProject); } finally { _solvingVent = false; }
  },
  { flush: 'sync', immediate: true },
);
```

— runs exactly ONCE, from `immediate: true` at module load, and never again. Every subsequent
`managedProject` notification (a PR field write, a box-volume write, anything) leaves the
callback un-run, so the passive-radiator group's CALCULATED member (added mass ↔ system tuning)
is never re-solved by the store. The vent group's watch immediately above it, whose getter
returns `[live.value, state.box]`, is unaffected.

## Evidence

Reproduced against the project's own Vue 3.5.38 in `packages/ui`'s vitest environment, using the
real `createLiveRef` from `packages/ui/src/logic/liveProject.ts` and a fake subscribable, with
both getter shapes watched side by side over two notifications:

```
scalarFires= 0 arrayFires= 2
```

`watch(() => live.value, cb)` fired 0 times over two notifications; `watch(() => [live.value,
other.value], cb)` fired 2 times.

## Cause

The same Vue short-circuit already recorded in
`BUG_20260821_reactivity_design_computed_short_circuits_on_unchanged_reference.md`, in its
`watch`-getter form rather than its `computed` form.

With a GETTER source, Vue's watcher re-runs the getter when a dependency invalidates, then gates
the callback on `deep || forceTrigger || hasChanged(newValue, oldValue)`. `forceTrigger` is set
only when the source is a shallow ref passed DIRECTLY, not when it is read inside a getter. So:

- `() => live.value` returns `managedProject` — the identical reference every evaluation, by
  `createLiveRef`'s explicit contract ("`.live` always returns the SAME subscribable object").
  `hasChanged` is always false, so the callback is never invoked.
- `() => [live.value, state.box]` allocates a FRESH array each evaluation, so `hasChanged` is
  always true and the callback always runs. The vent watch works by accident of its array
  literal, not by design.

The dependency IS registered and the getter DOES re-run — only the callback is skipped, which is
why nothing errors and no test that asserts "the solve did NOT run" can see it.

The construct this replaced, `watch(() => _version.value, cb)` over `ref(0)`, returned a
different NUMBER on every notification, so `hasChanged` was always true. The invariant-reference
contract is what removes that.

## Why the existing tests do not catch it

`packages/ui/test/logic/vent-group-solve-coalescing.test.ts` counts `managedProject.subscribe()`
notifications per user action and asserts the count is the number of deliberate writes (3, or 2),
i.e. that the store's auto-solve watch did NOT add an extra solve. A permanently dead watch
satisfies every one of those assertions — the test is a strict upper bound with no lower bound,
so it is structurally insensitive to this failure. It cannot be cited as evidence that the watch
still fires.

## Fix

Give the watcher a source Vue will act on — either pass the shallow ref itself, which sets
`forceTrigger` (`watch(live, cb, …)`), or make the getter's return value change per evaluation.
Passing the ref is the honest fix, since the intent is "run on every notification", and it should
be applied to BOTH watches so the vent watch stops depending on an array allocation for its
correctness. `state.box` remains a genuine second source for the vent watch and can be passed as
an array of sources (`watch([live, () => state.box], cb, …)`).

## Verification

`packages/ui/src/logic/store.ts`'s vent-group watch now sources `[live, () => state.box]` and
the PR-group watch sources `live` directly — neither reads `live.value` inside a getter, so
both set Vue's `forceTrigger` and fire on every `triggerRef`.

`packages/ui/test/logic/vent-group-solve-coalescing.test.ts`'s "PR-group auto-solve watch fires
on every managedProject notification" test writes `managedProject.setPrFp_hz(...)` directly —
outside `enterPrField` and outside any suspension — and asserts `prMadd` changed, which only the
store's own watch can produce. Confirmed red (`prMadd was not re-solved after a live prFp
write`) against `watch(() => live.value, cb, ...)`, green against `watch(live, cb, ...)`; the
four coalescing tests in the same file pass unchanged under both, confirming they cannot see
this failure on their own.
