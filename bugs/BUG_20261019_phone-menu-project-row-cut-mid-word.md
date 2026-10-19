# BUG_20261019_phone-menu-project-row-cut-mid-word

**Status:** FIXED (T450): the name is its own span and wraps onto more lines, whole name shown (John, 20 Oct 2026: "use multi line there for the project name"); test mobile-project-list.browser.spec.ts "a long open-project name in the phone menu wraps onto more lines, nothing cut". Before/after: ui-gallery/fixes-20261019/phone-menu-project-row-cut-mid-word

Recorded 19 Oct 2026 by fable, from bob's button sweep of test.openisd.app at 374x705
(ui-gallery/screens/buttons/README.md in the workspace repo).

## Symptom
In the phone menu's open projects list a long project name ("W5-1138SMF vented 30 L tuned low
for the car door") is cut to "W5-1138SMF vented 3", mid-word, with no ellipsis. Text 374 px
in a 152 px box. The user cannot tell where the name ends or that it is cut.

## Cause
Not yet found. The row clips its text with overflow hidden and no text-overflow rule.

## Fix
A browser spec at 374x705 with that project name open that fails when the menu row shows no
ellipsis or a cut word. Then the row either wraps to two lines or ends in an ellipsis with the
full name in its title. Phone UI freeze applies: lands when John lifts it.
