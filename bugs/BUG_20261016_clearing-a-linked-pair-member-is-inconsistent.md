# BUG_20261016_clearing-a-linked-pair-member-is-inconsistent

**Status:** OPEN

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
- 16 Oct 2026, a "Was calculated" field state: logged as an idea in BACKLOG.md, not for
  execution (John). The fix here uses E and C only: the kept partner becomes E.

## Evidence (code read 16 Oct 2026)
| Pair | Clearing the entered member does | Fits the rule |
|---|---|---|
| Drive power ↔ voltage, clear power | voltage becomes E at its current value (`packages/design/domain/project/projectSignal.ts:70-74`) | yes |
| Sealed Qtc ↔ volume, clear Qtc | Qtc becomes C from the volume | yes |
| PR tuning ↔ added mass, clear tuning | added mass becomes 0 E (`packages/design/domain/box/openISDBox.ts:354`) | no |
| Vented tuning ↔ length, clear either | box volume and tuning overwritten with the starting alignment (`openISDBox.ts:208`, `resetVentedAlignment` `openISDBox.ts:625-631`) | no |
| Bandpass / ABC tuning ↔ length, clear either | both blank (`openISDBox.ts:65`, settle does nothing) | no; see BUG_20261016_abc-rear-vent-cleared-tuning-blanks-length.md |
| Port diameter / height ↔ area, clear diameter or height | goes back to the 50 mm (or driver-sized slot) starting port (`packages/design/domain/box/ventWindow.ts:68-86`) | no (John, 16 Oct) |
| Port area, clear area | port goes back to the starting port, area C from it | no |

Not ruled yet under this rule (they follow the 9 Oct "settle to a default" ruling):
- Clear added mass: becomes 0 E.
- Clear drive voltage: power becomes 1 W E, voltage C.
- Clear sealed volume: goes blank; the 16 Oct "box volumes go back to the alignment volume"
  ruling listed vented, PR, bandpass and ABC, not sealed.

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
