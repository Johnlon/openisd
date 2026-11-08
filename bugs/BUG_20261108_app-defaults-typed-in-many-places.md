# BUG_20261108_app-defaults-typed-in-many-places

**Status:** OPEN

## Symptom
The same app default is typed in several places and the copies disagree, so the app gives a
different value depending on which path sets it:

| Setting | Copies that disagree |
|---|---|
| Chart frequency range reset | X-axis double-click resets to 1 Hz; Options reset, presentation default and shell reset give 10 Hz (fixed in T725) |
| Sealed box volume | New Project wizard starts at 7 L; opening a bare driver file starts at 6 L |
| Vented starting alignment | Wizard opens on C4; a project's first-use starting values use QB3 |
| Vb plausibility band | The factory band allows 1000 L; the Vb box refuses above 100 L |
| Stored environment | A saved 1 K or 1 Pa loads as valid, then fails the field limits and the air solver |
| Plot start and end limits | Start may be 20000 and end 1; only the Options OK check stops the inverted pair |
| Engine sweep fallback | Engine, series and shell fall back to 10..1000 Hz when no range is given, which is not the app default |

And the same value typed as a bare literal in many places (box Q losses 10/100 in 9 places,
sealed Qtc 0.707 twice, end corrections 0.613/0.732 twice, FACTORY_* aliases of DEFAULT_*,
environment numbers retyped in help text).

## Evidence
Settings audit, 8 Nov 2026, 27 rows with file:line for every site, copied into the T726 brief
and summarised here. Spot checks this session: `GraphPanel.vue:213` `{min:1,max:20000}` vs
`presentationState.ts:137` 10..20000; `OriginalNewProject-hooks.ts:235` `toSI(7)` vs
`appState.ts:147` `DEFAULT_SEALED_VOLUME_L = 6`; `options.ts:72` `'c4'` vs `openISDBox.ts:34`
`'qb3'`; `appSettings.ts:18` `maxVb_m3 1.0` vs `field.ts` `BOX_VB_L` max 100 L.

## Cause
Defaults were added per feature, each author typing the literal where it was needed, with no
one home. `packages/design/fields/defaults.ts` exists for exactly this but holds only three
constants (Rs, Ql, Qa).

## Fix
T726: one constant per default in `packages/design/fields/defaults.ts`; the wizard, first-use
project values, engine, chart axis, settings repos and help text all read it. Stored values
outside the field limits are repaired to the default. The port velocity limit stays a per-project
field (John, 1 Oct 2026) and is not an app default.

Odd limit VALUES found by the same audit (port velocity max 340 m/s, air pressure min 1 kPa,
series resistance max 1000 ohm, listening distance min 0 m, Vb min 0.1 mL, Fb max 1000 Hz) are
not duplicates; they need John's ruling and are not part of this fix.

## Verification
A unit test asserts each former pair agrees (wizard sealed default equals bare-driver default;
STARTING.ventedAlignment equals DEFAULT_VENTED_ALIGNMENT; the Vb band max equals the Vb field
max; parseEnv repairs 1 Pa to the default). `grep` for the old literals finds none outside the
one constant.
