# BUG — vent-target-reachability's CEILING_HZ golden was missed by the air-constant rebaseline

## Symptom

`packages/ui/test/logic/vent-target-reachability.test.ts` > `names the true ceiling — the L = 0
tuning, not an arbitrary shortest vent`:

```
AssertionError: ceiling 80.7929 Hz, expected 80.7919
```

## Evidence

- `packages/engine/src/constants.ts`'s `RHO`/`C` were last touched by commit `988a83c`
  ("Checkpoint: air-constant fix, golden rebaseline and bug records in flight").
- `packages/ui/test/logic/vent-target-reachability.test.ts`'s hardcoded `CEILING_HZ` golden was
  last touched by the earlier commit `2ef9bd4` — it predates the constant fix and was not part of
  that commit's rebaseline.
- Recomputing `ventMaxReachableFb()` directly against the current, corrected `C`/`RHO`
  (`packages/engine/src/constants.ts:19-20`, both already "full precision" per their own comment)
  with the test's own trial geometry (Vb 30 L, round 5 cm vent, endCorrection 0.6) gives
  `80.79291711567242` — matching what the test's own failure output reports as the actual value,
  confirming the current engine computation is internally consistent and the golden is simply
  stale, not the engine.

## Cause

The `988a83c` air-constant fix's "golden rebaseline" did not cover this test's hardcoded
`CEILING_HZ` constant, which is derived from `C` (`Fb = C·sqrt(Sp/(4π²·V·k·d))` — linear in `C`, so
a corrected `C` shifts every golden ceiling computed from it).

## Fix

`CEILING_HZ` updated from `80.79194836403872` to `80.79291711567242` — the value
`ventMaxReachableFb()` itself now returns against the current, corrected constants.

## Verification

`npx vitest run packages/ui/test/logic/vent-target-reachability.test.ts` — 6/6 green after the fix.
