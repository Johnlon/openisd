# BUG_20261108_phone-options-escape-on-help-sheet-may-close-options

**Status:** OPEN (unconfirmed: found by reading code, not yet reproduced)

## Symptom
Phone skin, Options dialog: with a band's (?) help sheet open, pressing Escape (hardware keyboard) may close the whole Options dialog instead of only the help sheet.

## Cause (suspected)
The Options dialog registers its Escape handler after its child bands, so it may handle the key before (or as well as) the help sheet. Present before T746.

## Next
A phone browser spec: open Options, open a band's (?) help, press Escape; expect the help closed and Options still open.
