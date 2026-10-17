# BUG_20261017_visual-library-size-text-varies

**Status:** OPEN

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
Not yet pinned. The size changes when the stored text of a project in the test browser differs in
length between runs, or when the number of stored projects differs. Which of the two it is, and
what in the saved text varies (a timestamp, a generated id, autosave timing), has to be found by
saving the same project twice and comparing the texts.

## Fix
Find the varying part. If it is in the saved text, make it the same every run; if it is the number
of stored projects, make the visual run start from the same store. Never mask the text in the
screenshot.

## Verification
Two runs of `scripts/visual/update.sh` on the same commit leave every PNG byte-identical.
