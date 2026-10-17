# BUG_20261017_phone-graph-page-shows-no-unsaved-mark

**Status:** OPEN

## Symptom
On the phone skin, the Graph page has no top bar, so nothing on screen says the project has
unsaved changes. Tuning a value in the Tune sheet changes the project, and the user sees no mark
until they leave the Graph page and open the menu (the Save item lights up there).

## Evidence (17 Oct 2026, T310)
- `MobileShell.vue:59`: the top bar, with the hamburger, is drawn only when
  `!projectOpen || destination !== 'graph'`.
- The only unsaved marks on the phone are the Save item in the menu (`.mob-menu-item.dirty`, needs
  the menu open) and the dot on a Projects-page row (`.mob-project-dot`).
- Found while moving the mobile-sheet specs to read the screen: they had to leave the Graph page to
  see the mark, and one assertion looked for a class (`.mob-open-project-dot`) that no component
  has, so it passed whatever the app did. Removed.

## Cause
The Graph page hides the top bar to give the charts the screen, and no other element carries the
unsaved state.

## Fix
Not decided: the look is John's call (a small dot on the Graph page, for example, or a mark on the
Tune pull-tab). Whatever is chosen shows on the Graph page in both Tune and Learn, and in Learn it
stays off because Learn never changes the project.

## Verification
Browser spec on the phone skin: open Graph, step a Tune value, the mark shows on the Graph page
itself; Close in Learn after stepping, no mark.
