# BUG_20261017_diagnostics-ignores-escape

**Status:** FIXED (T282)

## Symptom
Press Escape with the Diagnostics dialog open and nothing happens. Every other dialog closes on
Escape. Diagnostics only closes with its X or its Dismiss button.

## Cause
DiagnosticsModal did not register with the shared Escape mechanism (`useEscToClose`) that the other
modals use.

## Fix
DiagnosticsModal registers with `useEscToClose`, so it closes on Escape and stays in the same
top-most-dialog stack as the others. Test: `no-project-app-menu.browser.spec.ts` closes Diagnostics
with Escape (mobile and desktop).
