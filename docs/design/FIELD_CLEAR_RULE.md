# Field states and the clear rule

John's rulings, 16 Oct 2026. Bugs: `bugs/BUG_20261016_clearing-a-linked-pair-member-is-inconsistent.md`,
`bugs/BUG_20261016_box-tab-tuning-input-missing-for-bandpass4-and-pr.md`,
`bugs/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md`.

## States

| State | Meaning |
|---|---|
| E, Entered | An input. Typed by the user, or kept as an input by the clear rule below. |
| C, Calculated | The output of exactly one equation, or a field's calculated default. |
| N, NotAvailable | No input it depends on has a value. |

A "Was calculated" state is logged as an idea only (BACKLOG.md), not for execution.

## Equations

- Each equation ties a few values together and has exactly one output, a C. Its other values
  are its inputs. An input is an E, or the C of another equation.
- Equations chain: one equation's C can be another's input. Example, sealed with Qtc entered:
  Qtc gives Vb, then Vb gives Fsc.
- Each value has one source: it is E, or the C of one equation. Never both, never two equations.
- Inputs to outputs form a chart of arrows with no circle. The resolve walks it once, in order,
  and never iterates, so it cannot oscillate.
- Only a user action (an edit or a clear) changes which values are E. The resolve never does.
  An action that would make a circle, or give a value two sources, is refused with a message.

## Entering a value

The entered value becomes E. The value that was the C of its equation stops being calculated
from it, and the equation's output becomes the old E. Example: enter the port length, and the
tuning becomes C.

## Clearing an entered value X

Take the first step that applies:

1. **X can be calculated from the inputs as they are.** X becomes C. Nothing else changes.
   Example: driver Mms, calculated from Fs and Cms.
2. **X is an input to an equation whose output Y is a C.** Swap them: Y becomes E at its
   current value, and X becomes C, the output of that equation. Showing Y as E although nobody
   typed it is accepted.
   - Examples: clear the vent tuning, and the port length becomes E. Clear the PR tuning, and the
     added mass becomes E. Clear the power, and the voltage becomes E. Clear the port diameter,
     and the area becomes E.
   - X feeds more than one such equation: the value's declared partner swaps. Sealed: Vb feeds
     the Fsc and Qtc equations, and its partner is Qtc.
3. **X has a calculated default.** X becomes C at the default. Driver, PR and port counts go to
   1; Rg goes to 0.1 ohm; Ql, Qa, Qp and Qicl go to the WinISD defaults.
4. **Otherwise** X becomes N, and every value calculated only from X becomes N. Nothing else
   changes, and no starting value is filled in.

## Checks

| Clear | Step | Result |
|---|---|---|
| Driver Mms (E), others E | 1 | Mms C |
| Vent tuning (E), length C | 2 | length E, tuning C |
| PR added mass (E), tuning C | 2 | tuning E, mass C |
| Drive power (E), voltage C | 2 | voltage E, power C |
| Sealed Qtc (E), Vb and Fsc C | 2 | Vb E, Qtc C, Fsc C |
| Sealed Fsc (E), Vb and Qtc C | 2 | Vb E, Fsc C, Qtc C |
| Sealed Vb (E), Fsc and Qtc C | 2, declared partner | Qtc E, Vb C, Fsc C |
| Port count (E) | 3 | 1, C |
| Rg (E) | 3 | 0.1 ohm, C |
| Filter frequency (E) | 4 | N, shown red (9 Oct ruling: filters stay empty) |
