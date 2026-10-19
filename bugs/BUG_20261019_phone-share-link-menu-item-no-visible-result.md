# BUG_20261019_phone-share-link-menu-item-no-visible-result

**Status:** OPEN

Recorded 19 Oct 2026 by fable, from bob's sweep of test.openisd.app at 374x705.

## Symptom
Phone hamburger menu, Save As / Export, "Share Link to Project (http:)": tap it and nothing
visible happens. No message, the menu stays open. Breaks rule 4 of .claude/rules/general.md
(every button shows a visible result).

## Evidence
- packages/ui/src/ui/components/ExportMenu.vue:37: button calls `shareLink(); close()`; `close()` only closes the Export dropdown.
- packages/ui/src/logic/applicationIO.ts:279-288: `shareLink()` shows its only result via `flash('Share link copied to clipboard')` (or a `prompt()` fallback).
- packages/ui/src/ui/shells/mobile/MobileShell.vue:110 shows the flash in a banner; line 154 menu overlay is still open, so the banner is covered (same cause as BUG_20261019_phone-menu-stays-open-after-save-as-export).
- Not reproduced here; the clipboard promise and the `prompt()` fallback on prod are ⚠ unverified.

## Cause
Two things, the mobile menu overlay (MobileShell.vue) and the ExportMenu component. The Share
button's only result is a flash banner, and the overlay stays open over it. ⚠ unverified:
whether the clipboard write also fails or stalls on prod.

## Fix
Share Link shows a visible result the user can see: the menu closes (see the sibling bug) so the
"Share link copied" message shows; if the clipboard is refused, show a message with the link
rather than relying on `prompt()`.

## Verification
Browser spec at 374x705: open menu, Save As / Export, Share Link; the menu is closed and the
flash banner reads "Share link copied to clipboard".
