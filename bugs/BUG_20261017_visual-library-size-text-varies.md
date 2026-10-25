# BUG_20261017_visual-library-size-text-varies

**Status:** FIXED (cause: misread; no run-to-run variance exists)

## Symptom
The visual baselines desktop-box-bandpass6, desktop-box-vented and desktop-tab-box differ between
two runs of `scripts/visual/update.sh` on the same code: a 2 px speck where the footer text next
to the Bin icon ("5.8 KB · ...") changes. Seen in T351, 17 Oct 2026. Each run re-baselines them
with nothing changed on screen that a user could see.

## Where the text comes from
- The footer is `projectRowsFooter` (`packages/design/fields/projectRows.ts`): the sum of every
  stored project's size, formatted by `formatByteSize` (`packages/design/fields/format.ts`).
- Each size is `textBytes(entry.text)` in `packages/persistence/src/repos/projectRepo.ts`: the
  byte length of the stored `.owpr` text of that project.

## Cause
The text does not vary. The footer reads "1 project · 5.8 KB · 1 open" in every run, and the stored
text is 5941 bytes every time (36 runs over all six box types, with and without a wait; the same
length whether read once or five times). What differs in the T351 baselines is 15 pixels, 2 px wide,
at the right edge of the Bin icon (x 80-81, y 679-690), pixel values off by one level (0x9a against
0x99). The icon sits at a fractional position (x 68.03, y 674.11) because the footer is laid out
from fractions of a pixel, so a layout change of a fraction of a pixel above it (T351 changed the Box
tab readouts on exactly these three screens) re-draws the icon's anti-aliased edge. That was a real
change made by T351, not run-to-run variance: at HEAD, 6 runs of the whole visual spec (one and six
workers, update and compare) and 45 repeats of the three screens leave every PNG byte-identical.

## Fix
No app change: nothing varies. A unit test now pins that a project's stored text has the same byte
length every time it is stored, read back and stored again, or re-created
(`packages/design/test/domain/project/stored-text.test.ts`), so the footer size cannot drift.

## Verification
Two runs of `scripts/visual/update.sh` on the same commit leave every PNG byte-identical.
