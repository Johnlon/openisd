# The PR auto-solve lower-bound test is red while its eight siblings are skipped

Status: RESOLVED 2026-09-09

## Symptom

```
FAIL |ui| test/logic/vent-group-solve-coalescing.test.ts
  > PR-group auto-solve watch fires on every requireFocusedProject() notification
  > a raw prFp write outside enterPrField/suspension re-solves prMadd
AssertionError: prMadd was not re-solved after a live prFp write — the store's PR-group
auto-solve watch did not fire
```

The message names the wrong cause. The watch is not dead —
`BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md` is RESOLVED. The
watch fires and calls `solvePrGroup()`, which does nothing.

## Example

```ts
/** Derives whichever of the passive-radiator box's tuning/added-mass the user did not state.
 *  Does nothing until that relation is wired — see the FIXME above. */
solvePrGroup(): void {
}
```

The test then asserts the calculated member moved:

```ts
requireFocusedProject().box.passiveRadiator.tuning_hz.set(55);
const after = requireFocusedProject().box.passiveRadiator.addedMass_kg.get().value;
assert.notEqual(after, before, 'prMadd was not re-solved ...');
```

Nothing can write `addedMass_kg`, so the assertion cannot pass until QO126 wires the
tuning ↔ added-mass relation.

## Impact

One permanent red in every `npm run test:unit`. Its eight siblings covering the same unwired
relation are marked `BLOCKED: QO126` and skip; this one was missed, so the suite is red for a
reason already ruled deferred — and a red that is always red is a red nobody reads.

The failure message also misdirects: it accuses a watch that a resolved bug proved works.

## Fix

Two parts, neither of which weakens the assertion:

1. Mark it blocked the same way its eight siblings are (`BLOCKED: QO126` in the describe name,
   skipped), so the suite tells the truth about what is unwired.
2. Correct the message to name the real blocker — the empty `solvePrGroup()` stub — instead of
   the watch.

It un-skips with the rest of the QO126 set when the relation is wired.

## Verification

```
npx vitest run packages/ui/test/logic/vent-group-solve-coalescing.test.ts
  4 passed | 1 skipped
```

`describe.skip(... '(BLOCKED: QO126)')`, matching `vent-group.test.ts:73` exactly. The assertion
is unchanged — it un-skips with the rest of the QO126 set when the relation is wired. The failure
message now names `solvePrGroup()`'s empty stub instead of the watch.

It now joins the QO126 skip list the suite already prints ("Make them run, or delete them"),
rather than sitting apart from it as a red.
