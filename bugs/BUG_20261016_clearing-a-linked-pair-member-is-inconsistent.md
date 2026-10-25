# BUG_20261016_clearing-a-linked-pair-member-is-inconsistent

**Status:** FIXED (T245 for the vent, PR, bandpass, ABC and port pairs; T275 for drive voltage and sealed volume)

## Symptom
Some fields come in linked pairs: entering one makes the other calculated. Clearing the entered
one does something different in each pair. Some keep the partner, some reset to a default, one
overwrites the box volume, and one blanks both.

## John's rule
- 16 Oct 2026, vent: "target should become the actual caused by the area and current Len and be C".
  The length becomes E at its current value.
- 16 Oct 2026, port: "a clearer dia should go to calculated". This replaces the 9 Oct ruling
  (a cleared diameter goes back to the 50 mm starting port).
- The rule: clearing the entered member of a pair keeps the partner at its current value as E.
  The cleared member becomes C, calculated from it.

- 16 Oct 2026, general: "openisd default is that deleting a entered value transforms it to
  calculated if a value is calculable". Precedent: driver T/S values (Mms etc.) already work so.
- 16 Oct 2026, sealed alignment picker, OpenISD default: accepting a pick stores the target
  (sealed Qtc; vented the alignment) and the volume (and vented tuning) are calculated from it.
  Typing the volume makes it entered and the target calculated. A cleared sealed volume is then
  calculated from Qtc. WinISD instead writes the volume as a plain value (wine probe, 16 Oct).
- 16 Oct 2026, the app rule (John): "only one value in a group may be C; any C may be converted
  to E (misrepresentation) by deleting any of the E; the deleted E becomes the sole C".
  So: delete an entered value, it becomes the group's one C, and the C it replaces becomes E at
  its current value. Showing that value as E though nobody typed it is accepted.
- 16 Oct 2026, John: "the conversion to C is only if it is currently Calculatable otherwise it
  becomes N". A deleted E that the rest of the group cannot calculate becomes N (NotAvailable),
  and the other values keep their state.
- 16 Oct 2026, a "Was calculated" field state: logged as an idea in BACKLOG.md, not for
  execution (John). The fix here uses E and C only: the kept partner becomes E.

## State after T275 (17 Oct 2026, one design test per row: `packages/design/test/domain/field-clear-rule.test.ts`, `vent-pair-states.test.ts`)
| Pair | Clearing the entered member does | Follows the rule |
|---|---|---|
| Drive power, voltage | clear power: voltage becomes E at its value, power C | yes |
| Drive voltage, power | clear voltage: power becomes E at its value, voltage C (was: power reset to 1 W; fixed T275) | yes |
| Sealed Qtc, volume | clear Qtc: Qtc C, volume E at its value | yes |
| Sealed volume, Qtc | clear volume: Qtc becomes E at its value, volume C from it (was: blank; fixed T275) | yes |
| PR tuning, added mass | clear tuning: added mass E at its value, tuning C; with no mass stated, mass is entered as 0 and tuning is calculated (was: blank; fixed T275) | yes |
| PR added mass, tuning | clear added mass: tuning E at its value, mass C | yes |
| Vented, bandpass and ABC tuning, length | the other member keeps its value as E; the cleared one is C | yes |
| Port diameter, height, area | the other member keeps its value as E; the cleared one is C | yes |
| Driver Mms, Cms, Fs | clear Mms: C from Fs and Cms | yes |
| Counts, Rg | 1 and 0.1 ohm | yes |

## Cause
`pairedField` (`packages/design/domain/cell.ts:534-557`) clears both members, then runs a
per-pair `settle`. Each pair supplies its own settle: nothing, 0 mass, starting alignment,
starting port. None keeps the partner's current value.

## Fix
- One settle for every pair: write the partner's current value as E; the cleared member is
  then calculated.
- Apply it to the PR, vented, bandpass, ABC and port pairs.
- Fall back to the starting value only when the partner has no value.

## Verification
One unit test per pair in packages/design: enter A, read B, clear A; B is E at the same value
and A is C. Plus one browser spec per skin that clears the vented tuning and the port diameter.
