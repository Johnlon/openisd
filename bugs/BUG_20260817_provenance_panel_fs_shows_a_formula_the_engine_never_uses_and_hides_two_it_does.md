# The provenance panel's declared paths diverge from the engine's actual routes

## Status
OPEN — `Fs` fixed and guarded 2026-08-22; the same divergence stands on other fields.

## Symptom

`PROVENANCE_MAP` is a hand-maintained literal with no link to `driver.ts`, so the panel's claimed
derivations drift from the solver's real ones. Two instances on `Fs`:

**A route was missing.** The engine derives `Fs` five ways; the panel declared four, omitting
`Fs = EBP × Qes`.

**A declared route named the wrong inputs.** The panel declared

    Fs = (Rms × Qms) / (2π × Mms)      inputs: Rms, Qms, Mms

while `driver.ts` computes `r.Rme * r.Qes / (TAU * r.Mms)`. `Rme` is not `Rms` and `Qes` is not
`Qms`, so a user inspecting why `Fs` filled in was told it came from mechanical resistance and
mechanical Q when it came from motional resistance and electrical Q.

## Cause

Two independent declarations of one fact: the solver's routes live in `driver.ts` control flow,
the panel's list in `provenance.ts` data. Nothing related them, so they drifted silently.

## Fix

`packages/ui/src/logic/provenance.ts` — the `Rme`/`Qes` route corrected, and `Fs = EBP × Qes`
declared, giving five paths against the engine's five routes.

`packages/ui/test/logic/provenance-matches-engine.test.ts` — reads the engine's routes from
`driver.ts`'s AST and holds the panel to them. Two details make it faithful rather than a text
count:

- Both assignment forms count as routes: `setVal('Fs', …)` inside the consistency group, and a
  plain `r.Znom = …` assignment in the passes outside it. Reading only the first reports a field
  derived by the second as having no route at all.
- A route's inputs are read from its enclosing `if (r.Fs == null && r.Mms != null && …)` guard,
  not from the assigned expression, because the expression reaches some inputs through locals and
  helper calls. Reading the guard also collapses the same formula implemented in two passes into
  one route, which is what the panel should declare.

## Two divergences this fix does NOT close

`SPL`. The panel declares `SPL = K + 10·log₁₀(η₀)` from `no`; the engine derives `SPLref` from
`no` by that same formula (`driver.ts:288-289`) and never assigns `SPL`. Closing it means
collapsing the two names — see
`bugs/BUG_20260813_wdr-spl-is-discarded-on-import-and-openisd-substitutes-its-own-computed-sensitivity.md`
— which is an engine-wide rename, not a change to this list.

The other 31 fields in `PROVENANCE_MAP`. Measured against the engine, most diverge in route
count. Only `Fs` is held by the test above; extending it is per-field work, since each field's
routes must be read off the solver and confirmed before they can be pinned.

## Related, and separate: WinISD parity (QO50)

Whether the engine's five routes are the RIGHT five is a different question, tracked in
`bugs/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md`.
This record is about the panel describing the routes that exist.

## Verification

Red-first: with `provenance.ts` at its pre-fix state the `Fs` assertion fails ("the panel must
name these five Fs routes and no others"); with the fix it passes. The test also pins the ENGINE
side to the same five signatures, so adding a sixth route to `driver.ts` fails here until it is
declared in `PROVENANCE_MAP` in the same commit.

`npx vitest run packages/ui/test/logic/provenance-matches-engine.test.ts` — 2 passed, no skips.
`vue-tsc -p packages/ui` and `eslint` clean.
