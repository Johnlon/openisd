# BUG_20261019_desktop-wizard-ebp-no-space-after-colon

**Status:** OPEN

Recorded 19 Oct 2026 by bob, from the QO269 prod capture.

## Symptom
On desktop wizard step 3 (Type of design) the recommendation line reads
"Efficiency Bandwidth Product (EBP):78.9" with no space after the colon.

Picture: ui-gallery/QO269/prod-desktop-wizard3.png (served at
http://lap:8000/winisd/ui-gallery/QO269/prod-desktop-wizard3.png).

## Fix
Put a space after the colon, with a spec that reads the line on screen.
