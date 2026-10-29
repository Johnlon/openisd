# BUG_20261017_phone-box-sheets-ignore-escape

**Status:** RESOLVED (T370)

## Symptom
On the phone, Escape did not close the Box tab's sheets: Choose alignment (sealed and vented) and Box losses. Every other dialog closes on Escape.

## Evidence
- Probe (17 Oct 2026): open Box losses, press Escape, wait 500 ms: the sheet is still open.
- New specs "Escape closes the sheet like Cancel" (mobile-alignment-popup) and "Escape closes the sheet" (mobile-box-losses-popup) failed before the fix and pass after.
- Knock-on: the GitHub Actions candidate for T364 (run 39063017115) went red on "MobileBoxLossesPopup › edits Ql/Qa, and Qp only for a vented box". The test leaves Box losses open. The test teardown pressed Escape four times without waiting, did not know the sheet's own ✕ button (`.mob-x`), and failed with "overlays still open: Box losses". Locally the teardown only got through because its switch to a desktop window size removes the phone screen.

## Cause
`MobileBoxTab.vue` never registered its three sheets with `useEscToClose`, the one place Escape closes a dialog.

## Fix
- `MobileBoxTab.vue` registers each sheet with `useEscToClose`; Escape on an alignment sheet cancels it (draft discarded), on Box losses it closes it.
- Test teardown (`dismissOverlays` in `packages/ui/test/fixtures.ts`) also clicks `.mob-x`, and after each close waits up to 2 s for an overlay to go before the next try.

## Verification
`bash scripts/test.sh packages/ui/test/ui/mobile-alignment-popup.browser.spec.ts packages/ui/test/ui/mobile-box-losses-popup.browser.spec.ts`
