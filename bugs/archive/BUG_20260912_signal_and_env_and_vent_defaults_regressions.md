# BUG — signal, environment and vent defaults/regressions: blank fields, values that reset, and a broken chart

Date: 2026-09-12. Reported by the human after the domain-refactor commit (`a470c9e`).
Status: PARTIAL — the signal and vent items are fixed, but the environment defaults still have a
browser regression. TDD (failing test first) + UI functional test per item; 14 new
browser tests green, unit 2610/2610, lint 0, typecheck clean.

## Signal tab

1. **System input power is blank.** `signal.power_W` starts null, so the field renders empty.
   Expected: it shows a usable drive level (the 1 W reference) so the chart is obviously driven.
2. **Changing the power does not move the voltage.** Editing "System input power" should update
   "Driver input voltage (each)" via `V = √(P·Re)`.
3. **Series resistance shows 0 and cannot be changed — it keeps resetting to 0.** The `Rs_ohm`
   NumInput resets on blur instead of holding the typed value, and it should default to WinISD's
   0.100 Ω.
4. **Power / voltage / series resistance must all be > 0.** A zero/blank drive level is not a
   physical value.
5. **Power and voltage must never be decoupled.** Editing one must always recompute the other so
   the pair makes electrical sense (`P = V²/Re` ⇄ `V = √(P·Re)`); clearing one end must re-derive
   it from the other, never blank both.

## Advanced tab

6. **Temperature / humidity / air pressure all render blank.** They should show the application's
   environmental defaults (WinISD parity) rather than "not stated".
7. **Temperature / humidity / air pressure cannot be changed.** Typing a value writes it but the
   field resets to blank on blur — the env computeds are not reactive to the write
   (they read `project.value` only, missing the `projectChanged` tick).
8. **No DQ is shown for the missing drive/environment.** Blanking an input should be impossible —
   an app-level default flows through instead — and where a value is genuinely missing the chart
   must flag it, never silently stay blank.

## Regression

9. **Some settable values can no longer be set at all.** After the refactor, values that used to
   accept typing now reset to their old value (env fields, series resistance). The stale-computed
   class of bug (`get` not depending on `projectChanged`) is the same one already fixed for
   `boxVolume_m3`/`boxResonance`/`driveV` and must be eliminated everywhere a field is edited.

## Enclosure / vent

10. **Port end correction renders blank.** The empty box defaults `endCorrection_m` to `0.6`,
    which matches none of the select's options (`Two free ends` 0.613 / `One flanged end` 0.732 /
    `Two flanged ends` 0.849), so the select shows nothing. Expected default: **Two free ends**
    (0.613).
11. **No slotted input for the vent shape.** Verify the slotted (width×height) dimension inputs
    exist and are reachable when Shape = slotted on every vent surface that offers the choice.
