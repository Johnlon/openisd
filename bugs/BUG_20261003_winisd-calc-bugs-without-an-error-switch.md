# BUG_20261003_winisd-calc-bugs-without-an-error-switch

**Status:** OPEN — todo, follows from the rule John set 2026-10-03

## Symptom
The rule: every WinISD calculation bug can be reproduced. OpenISD does the correct thing by
default and a yellow error switch brings WinISD's calculation back. The switches are also how
users see what is wrong in WinISD. These rows of `docs/research/ACCURACY_IMPROVEMENTS.md` have no
switch yet:

| Row | WinISD behaviour | Switch today |
|-----|------------------|--------------|
| 2   | VA with "Rg is at driver side" on counts Rg twice | unclear: "covered by #1's switch? — check" |
| 3   | Maximum SPL and Maximum power leave the filter chain out | none |
| 4   | Bessel high-pass is not the mirror of its low-pass | none |
| 5   | Allpass `t` is not the group delay; orders above 2 ignored | none |
| 6   | Linkwitz-Riley and SOS ignore the order field | none |
| 9   | PR box ωr multiplies the branch mass by Npr | Loss model tooltip only; becomes a yellow switch (error-switch group) |
| 10  | ABC intra-port velocity drops Ricl | in progress, new yellow switch |

Not covered by the rule: row 7 (a default value, not a calculation), row 11 (an overflow crash),
and rows that are trigger or linkage bugs. Row 8 (two BLs) and row 1 (VA uses Re) already have a switch
and get the yellow look.

## Steps to see it
1. Open `docs/research/ACCURACY_IMPROVEMENTS.md`, "Worth a switch" table.
2. Read the Switch column: the rows above say none or unclear.

## Fix
For each row, in this order of size of the visible effect:
1. Confirm the row is a calculation bug and not a design choice (ask John when unclear).
2. Add a yellow error switch in the "WinISD errors" group, off by default, editable only where it
   applies, tooltip naming the WinISD behaviour and its size.
3. Failing test first: switch on matches the WinISD capture, switch off gives the correct result.
4. Update the accuracy table, the equivalence register and the README gap list.

## Done
