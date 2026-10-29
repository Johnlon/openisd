# A native caret after the final digit leaves the wrong spin highlight

Reported by John,27 October2026. Status: fixed in the rendition branch and published review gallery; not a deployment claim.

When the native vertical caret moves after the last displayed digit, the inverse marker can remain on an earlier digit or disappear. The shared stepping rule also deliberately converts an end caret to the default tenths place, so123.4500 can step123.5500 instead of123.4501. Neither UI adapter consistently updates its marker on native caret movement.

John's current instruction supersedes the older T522 bare-end-caret fallback: an explicitly positioned caret after the last digit must highlight and step that digit. No remembered caret still defaults to tenths. A held spin must retain its place through carries/borrows until the person moves the caret.

Required evidence: shared-rule signed/comma/trailing-zero/integer tests; gallery and actual NumInput move from another digit to End, show the last marker before spinning, and increment/decrement the last shown place.

Resolution: one shared digitAtCaret helper now maps native caret position to the displayed digit for both highlight adapters and caretSpin. An explicit end caret stays at the final digit; only StepAt.none retains the tenths fallback. Both adapters refresh the marker on native selection changes, and a human caret move clears an old held place while automatic carry/borrow keeps it.

Evidence:6 shared-rule failures before the change (050158) and2 actual gallery/app marker failures (050202). Final numeric-rule/field-validity specs86/86 pass (050555);37 other browser cases pass in050552, and its sole stale Escape precondition is corrected to the last digit and passes050632. Full typecheck050356 and lint050707 pass. The actual published phone gallery was checked with caret[8,8], selected digit index7 before spinning, and123.4500→123.4501, with zero page errors.
