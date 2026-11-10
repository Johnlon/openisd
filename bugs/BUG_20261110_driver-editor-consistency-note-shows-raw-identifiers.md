# BUG_20261110_driver-editor-consistency-note-shows-raw-identifiers

**Status:** OPEN

## Symptom
- The driver editor's generic consistency note on the Vas, Sd, rho and c boxes names fields by their
  code identifiers, for example "roo_kg_per, c_m_per_s disagree by 4.7%".
- A user sees names that appear nowhere on screen (the boxes are labelled Vas, Sd, air density, speed of sound).

## Wanted
- The note names the boxes as the screen labels them, in plain words.
- Found in T744 while checking the Cms note; not fixed there.
