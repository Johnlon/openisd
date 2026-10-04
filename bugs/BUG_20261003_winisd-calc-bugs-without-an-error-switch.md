# BUG_20261003_winisd-calc-bugs-without-an-error-switch

**Status:** OPEN — todo, follows from the rule John set 2026-10-03

## Symptom
The rule: every WinISD calculation bug can be reproduced. OpenISD does the correct thing by
default and a yellow error switch brings WinISD's calculation back. The switches are also how
users see what is wrong in WinISD. These rows of `docs/research/ACCURACY_IMPROVEMENTS.md` have no
switch yet:

| Row | WinISD behaviour | Switch today |
|-----|------------------|--------------|
| 2   | VA with "Rg is at driver side" on counts Rg twice | DONE 2026-10-03: covered by the "WinISD VA model" switch; off counts Rg once (`winisdVaModel.test.ts`) |
| 3   | Maximum SPL and Maximum power leave the filter chain out | STOPPED: needs a decision, see below |
| 4   | Bessel high-pass is not the mirror of its low-pass | DONE 2026-10-03: yellow switch "WinISD Bessel high-pass", off by default, active while an enabled Bessel high-pass exists |
| 5   | Allpass `t` is not the group delay; orders above 2 ignored | DONE 2026-10-04: yellow switch "WinISD allpass order", off by default (order-n Bessel allpass, delay t), active while an enabled allpass of order 2 or more exists |
| 6   | Linkwitz-Riley and SOS ignore the order field | STOPPED: needs a decision, see below |
| 9   | PR box ωr multiplies the branch mass by Npr | DONE 2026-10-03: yellow switch "PR Npr resonance", off by default, PR boxes only |
| 10  | ABC intra-port velocity omits a leak term | DONE 2026-10-03: yellow switch "WinISD ABC intra-port velocity", ticked (WinISD) by default, unticked = exact current, ABC boxes only |

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

## Stopped: decisions needed (2026-10-03)
- **Row 3, Max SPL and Max power.** A linear filter in front of the driver scales the SPL at a given
  amplifier voltage by |Hf| and the voltage the driver limit allows by 1/|Hf|. The two cancel, so the
  limit "with the filter chain in" is the same curve unless another bound on the input is chosen (an
  amplifier voltage limit, say). Which bound is the decision.
- **Row 6, Linkwitz-Riley and SOS.** A Linkwitz-Riley of even order n is Butterworth(n/2) squared and
  is well defined; an odd order and an SOS of order other than 2 are not. What OpenISD does for those
  is the decision.
