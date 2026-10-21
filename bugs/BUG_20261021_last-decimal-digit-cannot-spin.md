# BUG_20261021_last-decimal-digit-cannot-spin

**Status:** FIXED (T535)

## Symptom
In a number box with two or more decimals, the last digit cannot be chosen for spinning. With 1.05 in
System input power, selecting the 5 (or putting the caret after it) and pressing ↑ or ▲ gives 1.15,
not 1.06: the tenths digit spins instead of the hundredths.

## Evidence
- Found by opi while landing T534 (21 Oct 2026); fable ruled it a bug the same day.
- Browser specs in `packages/ui/test/ui/original-signal-tab.browser.spec.ts` and
  `packages/ui/test/ui/mobile-signal-tab.browser.spec.ts`: select the 5 of 1.05, spin up, expect 1.06.

## Cause
NumInput turns a one-digit selection into a caret just right of that digit. For the last digit that
caret is at the end of the text, and `steppingCaret` (T522) reads a caret at the end as no chosen
digit, so the step goes to the tenths default.

## Fix
The design takes where the box says to step as a sum type: nothing, a bare caret, or a selected
digit. A selected digit always chooses its own place, wherever it sits. A bare caret at the end keeps
T522's tenths default; a bare caret elsewhere chooses the digit to its left, as before.

## Verification
`bash scripts/test.sh packages/design/test/fields/caret-spin.test.ts` and the two Signal tab browser
specs above.
