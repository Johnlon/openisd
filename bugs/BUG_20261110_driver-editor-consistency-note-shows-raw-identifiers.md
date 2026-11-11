# BUG_20261110_driver-editor-consistency-note-shows-raw-identifiers

**Status:** CLOSED
**Fix:** T744. The disagreement popup names the boxes by their screen labels (`domain/driver/disagreementNote.ts`); air density and speed of sound have plain names in `engine/issueText.ts`. Test: packages/ui/test/ui/driver-editor-cms-note.browser.spec.ts (no raw identifier in the Cms popup).

## Symptom
- The driver editor's generic consistency note on the Vas, Sd, rho and c boxes names fields by their
  code identifiers, for example "roo_kg_per, c_m_per_s disagree by 4.7%".
- A user sees names that appear nowhere on screen (the boxes are labelled Vas, Sd, air density, speed of sound).

## Wanted
- The note names the boxes as the screen labels them, in plain words.
- Found in T744 while checking the Cms note.
