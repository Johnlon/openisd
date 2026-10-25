# BUG_20261017_ui-toolbar-icons-no-accessible-name

**Status:** FIXED (T383)

## Symptom
On desktop the toolbar icons (Open, New, Save, Save all, Revert, Manage Drivers, Options, Info)
are not buttons. A keyboard user cannot tab to them, and a screen reader does not announce them as
buttons. The UI gallery could not click them by name and had to click by screen position.

## Evidence
- `packages/ui/src/ui/shells/original/OriginalShell.vue:99-132` (main at a0637813): each icon is
  `<div class="tb-btn" title="..." @click=...>`: no `<button>`, no `role`, no `tabindex`, no key
  handler. Only the `title` tooltip carries the name.
- UI gallery review 20261017T215443Z_01e96564, item 19: "toolbar icons unlabelled (no accessible
  name)". `scripts/ui-gallery/screens.mjs:13` clicks them by position for this reason.

## Cause
The toolbar was built from clickable divs.

## Fix
Make each toolbar icon a `<button type="button">` (or role=button with tabindex and Enter/Space)
whose accessible name is its short label (e.g. "Options", "Info"); keep the long tooltip. The look
stays the same. Disabled icons are disabled buttons.

## Verification
A browser spec finds every toolbar icon with `getByRole('button', { name })`, tabs to Options and
opens it with Enter. UI gallery desktop screens unchanged.

## Fixed
Each toolbar icon is a `<button type="button">` with an `aria-label` (Open project, New project,
Save, Save all, Revert, Manage Drivers, Options, Info); Save, Save all and Revert are disabled
buttons when they have nothing to do. Info is a button beside its menu, not around it. The cloud
icon's wrapper no longer has its own click (its badge is already a button). Look unchanged.
Guarded by `packages/ui/test/architecture/toolbar-icons-are-buttons.test.ts` and
`packages/ui/test/ui/toolbar-buttons.browser.spec.ts`.
