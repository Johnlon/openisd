# The provenance panel's declared paths diverge from the engine's actual routes

## Status
OPEN — two live divergences on `Fs`, plus the WinISD parity question (QO50).

## Symptom

`PROVENANCE_MAP` is a hand-maintained literal with no link to `driver.ts`, so the panel's claimed
derivations drift from the solver's real ones and nothing detects it. Two instances are live now.

**One route is missing.** The engine has five `setVal('Fs', …)` sites; the panel declares four.

| `driver.ts` | route | in `provenance.ts`? |
|---|---|---|
| :191 | `Fs = 1 / (2π·√(Mms·Cms))` (rel 11) | yes |
| :194 | `Fs = ∛(no·Qes / (CONST_NO·Vas))` (rel 14) | yes |
| :197 | `Fs = Qes·BL² / (2π·Mms·Re)` (rel 2) | yes |
| :200 | `Fs = Rme·Qes / (2π·Mms)` (rel 4) | misstated, see below |
| :203 | `Fs = EBP·Qes` (rel 12) | **no** |

**One declared route names the wrong inputs.** `provenance.ts:48` declares

    Fs = (Rms × Qms) / (2π × Mms)      inputs: Rms, Qms, Mms

while `driver.ts:200` computes

    r.Rme * r.Qes / (TAU * r.Mms)

`Rme` is not `Rms` and `Qes` is not `Qms`. A user inspecting why `Fs` filled in is told it came
from mechanical resistance and mechanical Q when it came from motional resistance and electrical Q.

## Cause

Two independent declarations of one fact: the solver's routes live in `driver.ts` control flow,
the panel's list in `provenance.ts` data. They are written separately and drift silently because
no test relates them.

`Fs` is unlikely to be the only field affected. `Vas` declares 2 paths, `Mms` declares 2, `Qms`
declares 2, and none of those has been compared against its `setVal` sites.

## Fix

Derive the panel's paths from the routes the solver actually has, rather than restating them.

A cheaper interim step, which would have caught both divergences above: a test asserting that
every field's `PROVENANCE_MAP.paths.length` equals its number of `setVal` sites in `driver.ts`,
and that each path's `inputs` matches that site's guard.

## Related, and separate: WinISD parity (QO50)

The engine's routes are not WinISD's. That comparison is tracked in
`BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md` and is a
question about which routes should exist, not about whether the panel describes the ones that do.

## Verification

Every `setVal` site in `driver.ts` has exactly one matching `PROVENANCE_MAP` path with matching
inputs, held by a test that fails when either side changes alone.
