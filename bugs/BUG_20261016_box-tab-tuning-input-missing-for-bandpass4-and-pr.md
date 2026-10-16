# BUG_20261016_box-tab-tuning-input-missing-for-bandpass4-and-pr

**Status:** OPEN

## Symptom
John, 16 Oct 2026: "why does 6th have a [tuning] input for tuning freq; 4th does not; vented does;
pr does not; closed does not".

On the Box tab (both skins), the tuning target can be entered for vented, bandpass 6 and ABC, but
not for bandpass 4 or passive radiator. Bandpass 4 shows a calculated rear resonance only, and PR
shows Fh as a read-only value. Both can enter their tuning only on the Vents / PR tab.

Sealed: John, 16 Oct 2026, "the bug is that f v q should be interdependent". Fsc, Vb and Qtc
each fix the other two for a given driver, but only Vb can be entered; Fsc and Qtc are read-only.

Sealed clear rule (John, 16 Oct 2026, "ok E"): Fsc and Qtc are each tied to Vb by their own
equation. Deleting an entered Qtc or Fsc makes Vb E at its current value. Deleting an entered Vb
makes Qtc E at its current value, Vb C from it, and Fsc C from Vb. Leaving Qtc C would leave the
box with no input and all three N.

## Evidence (code read 16 Oct 2026)
- Mobile: `packages/ui/src/ui/shells/mobile/MobileBoxTab.vue:50-55`: the tuning UIField shows
  for bandpass6/abc (rear and front) and vented; everything else gets a read-only Fsc or Fh row.
  Lines 76-78: the front chamber tuning shows only for bandpass6/abc.
- Desktop: `packages/ui/src/ui/shells/original/OriginalShell.vue:365-400`, the same conditions.
- Sealed Fsc and Qtc are read-only rows on both skins.

## Cause
Each box type's Box tab was laid out separately, and bandpass 4 and PR never got the tuning input.

## Fix
- Every box type with a tuning target shows it, enterable, on the Box tab: vented, bandpass 4,
  bandpass 6, ABC. It is the same field as on the Vents tab. PR: John, 16 Oct 2026, "not sure
  about pr"; held until he rules.
- Sealed: Vb, Fsc and Qtc are all enterable. One is entered, and the other two are calculated
  from it. This depends on the sealed picker ruling in
  BUG_20261016_clearing-a-linked-pair-member-is-inconsistent.md.
- What WinISD's Box tab shows for bandpass 4 and PR is not established. Probe it before the fix,
  so a difference from WinISD is known.

## Verification
A browser spec per skin: for each box type, the Box tab has an enterable tuning field exactly when
the type has a port or radiator. For sealed, entering any of Vb, Fsc or Qtc updates the other two.
