# Six vent/PR group-solve methods on OpenISDProject throw, so no project can be opened

Status: OPEN — interim applied, real fix is QO126

## Symptom

`OpenISDProject` declares six group-solve methods whose bodies throw. One of them,
`solveVentGroup()`, is called by the store on EVERY project change, so creating or opening any
project raises:

```
Error: OpenISDProject.solveVentGroup(): not implemented
```

That is not confined to vented boxes. `appState.ts` runs the solve watcher for whatever project is
focused, so a sealed project — and a brand-new blank one — throws on creation.

## Evidence

`packages/design/domain/openisdDomain.ts:2265` and following, all six:

```ts
// ── vent-group / PR-group solve, ledger 2026-09-06 — STUBS, not yet implemented ───────────
//
// The Helmholtz group-solve and reachability logic these six answer never existed on this
// class; only the raw volume_m3/tuning_hz FieldHandles do. Stubbed to unblock migrating
// useVentGroup.ts/usePrGroup.ts off ManagedProject onto this type — real logic is a separate
// follow-up.

/** @stub not yet implemented */
solveVentGroup(): void {
    throw new Error('OpenISDProject.solveVentGroup(): not implemented');
}
```

The others: `ventAchievedFb()`, `ventMaxReachableFb()`, `ventTargetUnreachable()`,
`solvePrGroup()`, `prTargetUnreachable()`.

`packages/ui/src/logic/appState.ts:249` calls the first on every change to the focused project:

```ts
try { solveVentGroup(p); } finally { solvingVent = false; }
```

Reproduced by `packages/ui/test/logic/newBlankProject.test.ts`, which failed on
`OpenISDProject.empty()` reaching the registry — the throw came from `addProject`, not from
anything vent-related in the test.

## Cause

The six were stubbed during the `packages/model` → `packages/design` migration to unblock moving
`useVentGroup.ts`/`usePrGroup.ts` onto `OpenISDProject`, with the real logic left as a follow-up
that was never done. The methods' own header comment says so.

The logic they need is exactly the tuning ↔ paired-quantity solve ruled in QO126 and recorded in
`BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md`: `solveVentGroup` would
derive vent length from tuning or vice versa, and `solvePrGroup` the same for added mass. The
`*Unreachable` pair is that bug's unreachable-target case.

## Fix

The real fix is QO126, deferred until the migration lands.

**Interim, applied now:** the two `solve*` methods do nothing and the four queries report "nothing
known" rather than throwing:

- `solveVentGroup()` / `solvePrGroup()` — no body. There is no relation wired between tuning and
  its paired quantity, so there is genuinely nothing to solve; doing nothing is what the app
  already did before the migration, when neither direction had a caller.
- `ventAchievedFb()` / `ventMaxReachableFb()` — return `null`, the value every other domain
  calculation returns when its inputs are not known.
- `ventTargetUnreachable()` / `prTargetUnreachable()` — return `false`. Nothing is known to be
  unreachable, and claiming otherwise would put a warning on screen with nothing behind it.

This restores the pre-migration behaviour exactly: a target the user types changes nothing, and no
unreachability warning appears. It is NOT the feature — it stops a stub throwing where the app
previously did nothing.

FIXME markers at all six name QO126 and this file.

## Verification

`packages/ui/test/logic/newBlankProject.test.ts` — 4 tests, watched failing with the throw above,
then passing.

The interim is deliberately not covered by tests asserting the returned values are CORRECT,
because they are not: `null`/`false` are placeholders for calculations that do not exist yet. The
tests that prove the real behaviour belong with the QO126 fix.
