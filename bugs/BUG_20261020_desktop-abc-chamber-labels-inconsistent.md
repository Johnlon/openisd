# Desktop ABC Box tab: rear and front chamber labels inconsistent

**Status:** RESOLVED (T479). Front labels now "Volume" and "Tuning freq (Ffc)", matching the rear and WinISD ("Volume", "Tuning freq."); the Rear/Front chamber headings name the chamber.

## What is wrong
On the desktop Box tab with Box Type ABC, the two chamber columns name the same kind of setting
differently: rear "Volume" / "Tuning freq (Frc)", front "Front volume" / "Target Tuning Freq (Ffc)".
Different words ("Target"), different casing ("freq" vs "Freq"), and the front label wraps to three
lines. Reported by John, 20 Oct 2026, with a screenshot:
ui-gallery/fixes-20261019/abc-chamber-labels-john.png (workspace repo).

## Fix
1. Check WinISD's own labels for the ABC rear and front chambers (winisd-wine-probing skill or an
   existing capture); shared controls follow WinISD (CLAUDE.md "WinISD controls behave as native").
2. Make both columns consistent with that: same words, same casing. Labels live in packages/design
   (field titles), never in the skin. Same labels on the phone.
3. Test first: a unit test on the two field titles, plus before/after with
   `ui-gallery/bin/before-after.sh --mark` on the chamber labels.
