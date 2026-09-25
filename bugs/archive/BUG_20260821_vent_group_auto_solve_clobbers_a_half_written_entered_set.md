Status: RESOLVED

# The coarse `_version` auto-solve watch clobbered a half-written entered set mid-transaction

## Symptom

`packages/ui/test/logic/vent-group.test.ts` > "an over-determined set solves nothing and
rewrites nothing" failed after `state.P` was deleted (QO60 objective 2, task A3):

```
AssertionError: Expected values to be strictly equal:
+ actual - expected
+ 0.15358428954814143
- 0.999
```

`enterVentField(mp, 'ventL', 0.999, box)` was called with `Fb` already entered (an
over-determined pair — both members held, solver must do nothing). The written value should
have stayed `0.999`; instead it came back solved (`0.1536…`), as if `ventL` had never been
entered at all.

## Evidence

`store.ts` bridges `ManagedOpenISDProject.subscribe()` to Vue through one counter, `_version`,
and drives the vent/PR auto-solve watches off it:

```ts
watch(() => [_version.value, state.box], () => {
  if (_solvingVent || ventSolveSuspended()) return;
  _solvingVent = true;
  try { solveVentGroup(managedProject, state.box); } finally { _solvingVent = false; }
}, { flush: 'sync' });
```

`_version` bumps on EVERY `managedProject` mutation (`docs/design/REACTIVITY.md`'s design is
deliberately coarse). `useVentGroup.ts`'s (pre-fix) `enterVentField()` did two SEPARATE
mutations to enter one field:

```ts
mp.setActiveVentField('length_m', value);   // WRITE 1 — bumps _version
mp.setEntered('ventL', true);               // WRITE 2 — bumps _version
solveVentGroup(mp, box);                    // WRITE 3 (this function's own, intended, call)
```

`flush: 'sync'` means the store's watch runs SYNCHRONOUSLY inside WRITE 1, before WRITE 2 has
happened. At that instant `ventL` already holds `0.999` but `mp.isEntered('ventL')` is still
`false` — so the auto-solve watch's own `solveVentGroup` call sees an entered set of `{Vb,
ventD, Fb}` only, judges `ventL` derivable, and OVERWRITES the value the user just typed with
the solved one. `setEntered('ventL', true)` then runs, but the damage to the VALUE is already
done — provenance is correct, the number under it is not.

Found by TDD while repointing `useVentGroup.ts`/`usePrGroup.ts` off `state.P` onto
`ManagedOpenISDProject` for task A3 — the pre-existing test above is what caught it; nothing
was weakened to make it pass.

## Cause

Two mutations that must be seen as ONE transaction (a field's value and its provenance flag)
were expressed as two separate `managedProject` writes with a synchronous, unconditionally
coarse global side-effect (the auto-solve watch) sitting between them. The `_solvingVent` guard
protects against the solver'S OWN write re-entering itself; it does nothing for an unrelated
caller's multi-write sequence landing in between two of that caller's own writes.

## Fix

`useVentGroup.ts`'s `enterVentField()`/`clearVentField()` and `usePrGroup.ts`'s
`enterPrField()`/`clearPrField()` wrap their ENTIRE transaction — value write, provenance
write(s), AND the one explicit `solveVentGroup`/`solvePrGroup` call — inside a single
`suspendVentSolve()` block (the guard built for restores, reused for the same reason: a
multi-write transaction that must land atomically before anything re-solves). The store's
auto-solve watch therefore never fires for any write these functions make, and the solve
inside the suspension is the only one that runs: one user action, one solve.

```ts
export function enterVentField(mp, field, value, box) {
  suspendVentSolve(() => {
    /* the value write */
    mp.setEntered(field, true);
    /* the ventD/ventW/ventH → Fb-entered/ventL-cleared side effect */
    solveVentGroup(mp, box);   // inside the suspension — the only solve
  });
}
```

## Verification

`vent-group.test.ts` — all 10 cases pass, including the over-determined case that caught this.
`vent-target-reachability.test.ts` — 6 cases pass (same mechanism, same fix path).
`vent-group-solve-coalescing.test.ts` — 4 cases counting `managedProject.subscribe()`
notifications pin one-solve-per-action (3 notifications for `enterVentField('Fb')`: value +
provenance + one solve; 2 for `clearVentField`); red-verified against the pre-fix code.

## Live design risk — NOT closed by this fix, recorded per reviewer finding 8

Both auto-solve watches (vent group, PR group) key on `_version` ALONE — the domain's one
coarse invalidation counter. That counter is INTENTIONALLY coarse for READS
(`docs/design/REACTIVITY.md`: "one adapter... any change to the project re-evaluates
everything reading `liveProject`" is an accepted trade for computeds/templates).

**It was never sanctioned for a MUTATING solver.** A watch that WRITES back into the project
on every `_version` bump means ANY project mutation — a driver field scrub, an environment
edit, a filter tweak, none of them vent/PR-related — re-runs `solveVentGroup`/`solvePrGroup`.
Today those functions are cheap and idempotent-on-no-op (`ventDerivable`/`prIsDefined` guard
early), so the coarse trigger is currently harmless NOISE rather than a second observed
correctness bug — but it is the exact mechanism class that produced the race above:
"a write-back triggered by a global coarse counter, running between or around a caller's own
writes." The fix above closes the ONE instance TDD caught (a multi-write caller racing its own
transaction); it does not narrow what fires the watch. A future solver that is NOT idempotent
on irrelevant state, or a future caller with a THIRD interleaved write inside its own
transaction the suspension doesn't cover, reopens the same class of bug.

**Not fixed here — needs its own design decision** (narrower dependency per watch — e.g. a
`liveBox`/`liveVent` sub-counter per `docs/design/REACTIVITY.md`'s own "if a hot path is ever
measured to suffer" escape hatch — or moving the solve out of a `watch` entirely and into the
mutation path itself). Tracked as follow-up; out of scope for task A3, which only had to make
the coarse channel not clobber a value it already knew how to catch via test.
