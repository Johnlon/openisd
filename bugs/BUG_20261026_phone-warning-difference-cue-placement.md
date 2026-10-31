# Phone warnings and WinISD difference cues use different rails

**Status:** OPEN — reported during T607 review; investigation pending.

During T607, the warning was deliberately moved beside the label to avoid numeric overlap, while the WinISD difference cue stayed inside the value box. John asks whether one outside and one inside is intentional. This was an implementation choice, not an agreed visual standard. Compare simultaneous-cue states with production and the approved design before declaring the placement beneficial. No user approval of the split is inferred.

## User proposal and precision trial

John proposed moving the model difference cue after the spinners and putting the warning
before the digits. A DOM-only 374px trial keeps the full field values and fonts unchanged;
closed box fits, but PR Fpr needs 91px in an 86px content area, and Cms needs 49px in 34px.
The current general checker fails both clipping and actual unit overlap. Both warnings
and difference cues are genuinely present on the PR rows; none were manufactured.
Before/after evidence: `build/ui-contract/cue-trial/`. No source implementation is applied.
The layout needs additional room; reducing stated precision is not accepted as the solution.

## Additional real precision regression and repair

A new normal-UI regression clears Qms to exercise both warning and model cues on Mms/Cms.
At 374px it passes; at 360px it exposes Cms glyphs x114–164.48 overlapping the model cue
x160.56–182 (`20261026-220840-2651336.log`). This is a real edge case in the current layout,
separate from the unapplied outside-cue prototype.

The wide chip rail is reduced from 64px to 60px (still glyph-tested) and the model-cue/unit
gap from 8px to 4px. Together these give the full value at least 4px clearance from the cue
while keeping 4px between cue and unit. No value, precision, font or control height is reduced.
The general checker now also rejects a sub-4px value-to-model-cue gap.

## Full entered precision and layout decision remain open

The final compact default/both-cue tests pass at 360/374px after the 60px/4px spacing repair
(`20261026-221250-2655880.log`, then 255/255 field/unit cases in `221350-2659020.log`).
This does not solve arbitrary full-precision entries. Entering Cms `0.123456789` through
the normal UI with Qms cleared still needs 90px inside a 78px compact content box and
intersects the model cue/unit. Actual failure evidence is
`build/ui-contract/precision/full-360.json` and `.png`; it is not described as passing.

A second DOM-only trial moves labels above the controls and places warning, digits, unit,
spinners, model cue in that order. It fits the exact same long entry and both cues at
360/374px, with 12/12 content and border checks passing. It uses 68px rows instead of40px.
Pictures and comments: `build/ui-contract/cue-trial/stacked.html`. John was asked which
layout to use through the preference tool; no answer or approval has been inferred. The
trial is not in the running app. This open design issue blocks a claim of universal
full-precision/cue correctness, not the separately verified selector, seed and unit fixes.

## Final independent critique

Gemini 4 Argon High inspected all10 final precision images and the actual source. It
approves the compact spacing repair in the tested states, explicitly confirms the still-open
long-entry failure, and confirms the taller trial fits full precision at360/374px. It notes
the40→68px density tradeoff and that select rows retain inline labels. Exact report:
`build/ui-contract/gemini-precision-review.txt`. The preference question remains unanswered;
no taller layout has been applied or represented as deployed.
