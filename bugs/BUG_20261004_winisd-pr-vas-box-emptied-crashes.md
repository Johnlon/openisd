# BUG_20261004_winisd-pr-vas-box-emptied-crashes

**Status:** RECORDED — WinISD bug, found 2026-10-04. Not copied. Low priority: John does not empty fields
(types the new digits in front, then deletes the old ones), so it does not come up in manual testing.
OpenISD side checked: a zero in Fs, Qms, Vas or Sd leaves every derived value finite or absent
(`pr-spec-resolve.test.ts`).

## Symptom
Emptying the passive radiator's Vas box in WinISD makes WinISD die with a floating-point divide by zero.
Under Wine the main window vanishes and the log shows
`err:seh:dispatch_user_callback ignoring exception c000008e` (FLT_DIVIDE_BY_ZERO). Real Windows was not
tested, so it may show a dialog there instead.

## Steps to reproduce
1. Open WinISD under Wine with a project that has a passive radiator box (W5 driver, PR Vas 0.0048, Qms 3.3,
   Fs 30).
2. Open the Passive radiator pane and click the Vas box (it reads `0.0048`).
3. Press End, Left, Left, Delete, Delete. The box is empty.
4. WinISD exits. Evidence: `winisd_research/runs/pr-Vas-ui-crash1`.

The same class as the Box Volume field (see the `lib/wine_agent.py` docstring): the box's change handler
runs on every keystroke and divides by the value.

## Also
- Typing a value that starts with `0` or `.` into a Vas box whose text then reads 0 blanks the box at once and
  loses the next character. Select-all then typing `0.0096` does this.
- Workaround for a person: type the new digits in front of the old number, with no leading decimal point
  (for example `0.0048` becomes `0.00948`), then delete the old digits. The box never reads 0 or empty.
- A Vas edit does move the PR charts (7,926 px changed, no forced redraw), so editing is not otherwise broken.

## Rule
A crash is a trigger bug under the project rule: never copied, no switch. OpenISD must not crash or write
a bad value when a field is cleared.

## Done
- Recorded 2026-10-05: a row in `docs/research/ACCURACY_IMPROVEMENTS.md` ("fixed by default", broken links) and a section in `docs/research/WINISD_PARITY.md`.

## Ruling (John, 2026-10-07, bug walk)
Acked as recorded: trigger bug, no switch. OpenISD keeps an emptied PR Vas box blank with a warning (ruling 2026-10-06).
