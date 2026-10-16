# BUG_20261016_mobile-vent-stepper-jumps-focus-ignores-caret-no-digit-marker

**Status:** OPEN

## Symptom
John, 16 Oct 2026, mobile, vent editor. Port diameter E, length C, Fb C, Fb 27.50.

1. Cursor after the decimal point in 27.50, press up: focus jumps to the volume box, and Fb
   becomes 27.60.
2. Cursor after the 2 in 27.60, press up: focus jumps again, and Fb becomes 27.70, not 28.60.
3. The step always changes the tenths digit, wherever the cursor is.
4. Nothing shows which digit the step will change.

## Expected
- Focus stays in Fb.
- The step changes the digit at the cursor: cursor after the 2 steps the units, so 27.60 gives
  28.60.
- The digit that will change is marked while the field has focus (T222 ruling: "stepped digit
  marked").

## Evidence
John's report on his phone, on the /test/ build. Not yet reproduced by an agent.

## Cause
⚠ unverified. Possibly: tapping the up button takes focus from the input, so the cursor position
is lost, the step falls back to a fixed digit, and focus moves on to the next field. The digit
marker from T222 does not show on the mobile vent editor.

## Fix
- The up/down buttons do not take focus from the input, and read the cursor position.
- The step uses the digit at the cursor (`packages/design` caret-spin rule).
- The mobile vent editor shows the digit marker.

## Verification
Browser spec, mobile skin, vent editor, Fb 27.50 calculated: put the cursor after the 2, press up.
Fb reads 28.50, Fb still has focus, and the units digit is marked. Same with the cursor after the
decimal point: 27.60. Then the same on the desktop skin.
