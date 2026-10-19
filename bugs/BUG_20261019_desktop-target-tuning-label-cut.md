# BUG_20261019_desktop-target-tuning-label-cut

**Status:** OPEN

Recorded 19 Oct 2026 by fable, from bob's QO269 prod capture.

## Symptom
On the desktop Box tab at 1280x800 (test.openisd.app, W5-1138SMF vented project) the field label
"Target Tuning Freq (Fb)" is cut to "Target …". The user cannot read which field it is. The Vented tab cuts "Number of Vents" to "Number of Ve…" the same way.

Picture: ui-gallery/QO269/prod-desktop-box.png (workspace repo, served at
http://lap:8000/winisd/ui-gallery/QO269/prod-desktop-box.png).

Also seen on the same capture, to settle with the fix:
- Two legends with different words: the bottom strip says "Not entered", the right-hand one says
  "Entered / App level / calculated / Normal". The phone legend says "Entered / Calculated / Not
  Available". One legend, one wording.

## Cause
Not yet found. The label column is narrower than the longest label the Box tab shows.

## Fix
1. A browser spec at 1280x800 that measures every Box tab label and fails on any ellipsis or
   overflow.
2. Widen the label column or wrap the label (two lines are fine, John 19 Oct 2026) so no label is
   cut at 1280x800.
3. One legend component with one wording for both skins.
