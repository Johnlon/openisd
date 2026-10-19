# BUG_20261019_phone-toolbar-project-name-cut

**Status:** OPEN

Recorded 19 Oct 2026 by fable, from bob's sweep of test.openisd.app at 374x705.

## Symptom
On the phone the project name in the top toolbar is cut with an ellipsis: "W5-1138SM…". The
text is 147 px wide in a 98 px box. The user cannot read which project is open.

Picture: left panel of ui-gallery/QO268/header-name-before-after.png (workspace repo,
http://lap:8000/winisd/ui-gallery/QO268/header-name-before-after.png).

## Cause
Not yet found. The toolbar gives the name a fixed narrow box between the logo and the cloud
and save buttons.

## Fix
Design accepted direction (phone mock, QO268 4a3a9b4): the name wraps to two lines inside the
same toolbar height. A browser spec at 374x705 that fails on an ellipsis in the toolbar name
for a 16-character project name. Phone UI freeze applies: the fix lands only when John lifts it.
