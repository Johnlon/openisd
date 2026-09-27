# BUG_20260927_tuning-absent-when-port-length-entered

Status: RESOLVED (2026-09-28) — not reproducible; `tuning_goal_hz` was already carrying the
achieved tuning by the time `#boxSpecificParams` reads it. No production code changed; added the
ticket's own verification test as regression coverage.

## Symptom
A vented or bandpass 4th project whose port was set by LENGTH (tuning frequency blank) sweeps to
nothing under the default WinISD loss model: every value is NaN and the charts show an issue instead
of a curve. ⚠ unverified in the running app; follows from the code below.

## Evidence
packages/design/domain/project/openISDProject.ts `#boxSpecificParams`: vented feeds
`Fb: box.vented.tuning_goal_hz.value ?? undefined`, bandpass 4th feeds
`Ff: front.tuning_goal_hz.value ?? undefined`. packages/design/domain/cell.ts:445: tuning goal and
length are a solved pair; entering the length clears the tuning goal. VentedBox / Bandpass4Box
`winisd-lossy` read `P.Fb ?? NaN` / `P.Ff ?? NaN` for the port mass and the losses.

## Cause
The engine's WinISD form needs a tuning frequency; the domain passes only the entered goal, never
the tuning the entered length achieves (`ventAchievedFb` exists for vented).

## Investigation (2026-09-28)
`tuning_goal_hz.value` was checked directly against `ventAchievedFb.value` after entering diameter
+ length only (tuning cleared): both vented and bandpass4 already read back the achieved tuning
(`54.75127123619398` in the probe), not null. Cause: `solveVent` (`engine/solvers/solveVent.ts`,
run on every `#resolve()` for whichever box is active) already writes the length-achieved tuning
onto `tuning_goal_hz` itself via `setCalculated(tuningFromLength(...))` whenever length is entered
and the goal is not — the same formula `ventAchievedFb`/`tuningIn_hz` call through a different
door. `#boxSpecificParams`'s own comment already documents this as the expected invariant ("Null
only when the vent's tuning ↔ length pair is itself unsolved, which `#ventSweepIssues` already
refuses the sweep over before this is read").

A full sweep (complete driver, default winisd-lossy loss mode, diameter+length entered, tuning
blank) came back with zero issues and every SPL value finite, for both vented and bandpass4.

Secondary, narrower gap found and left unfixed (out of this ticket's scope, not the reported
symptom): entering LENGTH before DIAMETER — a genuinely incomplete port, not "a port set by
length" — leaves `tuning_goal_hz` null (area unknown, so neither `solveVent` nor `ventAchievedFb`
can derive anything) without `#ventSweepIssues` blocking the sweep. Self-heals the moment diameter
is entered too. Not filed separately — flagging here since it surfaced during this investigation.

## Fix
None needed — `ventAchievedFb`-style fallback would be a no-op: it and `tuning_goal_hz`'s own
calculated value use the identical `tuningFromLength`/`tuningIn_hz` formula and the identical
`Vb_m3`/`area_m2` inputs, so wherever one is null the other is too.

## Verification
`packages/design/test/engine-wiring.test.ts`, describe 'D — the vent': two tests, vented and
bandpass4, each building a project with the port set by length only (tuning blank) and comparing
its sweep against the same project entered by its own achieved tuning directly — both pass
unmodified against current code, SPL finite, matching to ≤1e-12 relative at every swept
frequency.
