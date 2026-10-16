# BUG_20261016_abc-rear-vent-cleared-tuning-blanks-length

**Status:** OPEN

## Symptom
John, 16 Oct 2026, live app (7.0.952), mobile, ABC box, ABC tab, Rear vent (slotted duct 10 × 1 cm, one flanged end). He cleared the tuning frequency. Then:
- Vent length went blank, with a ⚠.
- A red message box opened over the "1st port resonance" row, covering it.
- The message names an internal key: "length_m cannot reach this target - the maximum this geometry can reach is 40.3 Hz."
- The same text shows a second time in orange below the panel.
Screenshot: bugs/assets/BUG_20261016_abc-rear-vent-cleared-tuning.png

## Problems
1. Clearing the tuning blanks the port length. Tuning and length are a pair: clearing one leaves the other entered (the PR added-mass rule, 9 Oct; box values settle, 16 Oct). A cleared tuning keeps the length as it was, and the tuning becomes calculated from it.
2. The message uses an internal key ("length_m"). User text comes from packages/design in plain English, e.g. "This port can't reach that tuning. The highest it can reach is 40.3 Hz."
3. The message box covers another field's row. A message must take layout space or sit by its own field, never over another row.
4. The same message shows twice. One place only.

## Fix
Test first, per problem. Check the same paths on every vent panel (vented, bp4, bp6 rear/front, ABC rear/front/intra) and both skins.
