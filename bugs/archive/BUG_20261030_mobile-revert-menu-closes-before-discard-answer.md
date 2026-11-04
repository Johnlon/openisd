# BUG_20261030_mobile-revert-menu-closes-before-discard-answer

Status: FIXED

**Closed 4 Nov 2026:** fixed on main — packages/ui/test/hooks/MobileShell-hooks.test.ts (passes)

On the phone, "Revert unsaved changes" in the menu started the reset without waiting for it.
The menu closed at once while the "Discard changes?" question was still open, and a failure in
the reset was an unhandled rejection that nothing reported.

The reset is now awaited: the menu closes after the question is answered, and a failure
reaches the caller. Low severity: the user saw the menu close early, no data was lost.
Test: packages/ui/test/hooks/MobileShell-hooks.test.ts.
