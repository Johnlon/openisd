# The provenance panel's Fs paths show a formula the engine never uses and hide two it does

# Status
- panel entry: FIXED 2026-08-17
- engine/WinISD parity (QO50): OPEN

## Symptom

Inspecting provenance on `Fs` offers exactly two paths:

- Primary — `Fs = 1 / (2π × √(Cms × Mms))`
- Alternative — `Fs = 1 / (2π × √(Vas × Mms / (ρ × c² × Sd²)))`

The engine derives `Fs` by **four** routes, and the "Alternative" shown is **not one of them**.
So the panel advertises a derivation the app will never perform, and conceals two it performs
routinely. A user reading the panel to understand why `Fs` filled in gets a wrong answer
whenever the value came from `Bl`/`Qes` or from `η₀`/`Vas`.

## Evidence

`packages/ui/src/logic/provenance.ts:39-43` — the declared paths, two entries.

`packages/engine/src/driver.ts` — the routes actually implemented, four `setVal('Fs', …)`:

| line | route | in the panel? |
|---|---|---|
| 167 | `Fs = 1 / (2π·√(Mms·Cms))` | yes (Primary) |
| 181 | `Fs = Rms·Qms / (2π·Mms)` | **no** |
| 188 | `Fs = Qes·BL² / (2π·Mms·Re)` | **no** |
| 229 | `Fs = ∛(no·Qes / (CONST_NO·Vas))` | **no** |

Nothing in `driver.ts` computes `Fs` from `Vas`, `Mms` and `Sd` together, which is what the
panel's "Alternative" states. That expression is `Cms = Vas/(ρ₀·c²·Sd²)` substituted into the
primary form — algebraically valid, but the engine does not fuse those two steps: it derives
`Cms` first and then reaches `Fs` through the primary route.

`PROVENANCE_MAP` is a hand-maintained literal with no link to `driver.ts`, so nothing detects
the divergence. The full three-layer picture — WinISD 5 routes, engine 4, panel 2, with only
one route common to all three — is tabulated in
`BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md`. `Fs` is unlikely to be the only field affected — `Mms` declares 2 paths,
`Qms` declares 2, and the engine's coverage of each has not been compared.

## Cause

Two independent declarations of the same fact: the solver's routes live in `driver.ts` control
flow, the panel's list in `provenance.ts` data. They were written separately and drift silently
because no test relates them.

## Fix

Not applied — the human asked for no app changes while this was investigated.

The shape of the fix is to derive the panel's paths from the routes the solver actually has,
rather than restating them. A cheaper interim step is a test asserting that every field's
`PROVENANCE_MAP.paths.length` equals its number of `setVal` sites in `driver.ts`, and that each
path's `inputs` matches that site's guard — which would have caught this.

## Related: parity with WinISD

Separately from the panel, the engine's four routes are not WinISD's five. WinISD's calculation
engine writes `Fs` at five sites (`winisd_research/scripts/relation_routes.py`):

| WinISD relation | form | in the engine? |
|---|---|---|
| 11 | `Fs = 1 / (2π·√(Mms·Cms))` | yes |
| 14 | `Fs = ∛(no·c³·Qes / (4π²·Vas))` | yes |
| 2 | `Fs = Qes·BL² / (2π·Mms·Re)` | yes |
| 4 | `Fs = Rme·Qes / (2π·Mms)` | **no** |
| 12 | `Fs = EBP·Qes` | **no** |

And the engine has one WinISD does not: `Fs = Rms·Qms / (2π·Mms)` (`driver.ts:181`). WinISD's
corresponding group solves only `Qms` and `Rms`, never `Fs`.

Consequence: a driver stating `EBP` + `Qes`, or `Rme` + `Qes` + `Mms`, gets an `Fs` in WinISD
and a blank in openisd. That is a separate decision, tracked as **QO50**, not fixed here.

## Fix applied

`packages/ui/src/logic/provenance.ts` `Fs` entry replaced 2026-08-17: removed the
`Vas·Mms/Sd`-fused formula the engine never runs, added the two the engine does run
(`Rms·Qms/(2π·Mms)` at `driver.ts:181`, `∛(no·Qes/(CONST_NO·Vas))` at `:229`). All four paths
now match `driver.ts`'s actual `setVal('Fs', ...)` sites, in file order.

Deliberately NOT set to WinISD's own 5-route priority order (11 > 14 > 2 > 4 > 12,
`docs/design/WDR_SCHEMA.md` relation 11) — the engine does not implement that order yet
(**QO50**, ruled but not built). Setting the panel to the target order now would recreate this
exact bug in reverse: a panel describing code that doesn't exist. A comment in the source marks
this and says to update the list when the engine changes.
