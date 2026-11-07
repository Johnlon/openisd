# A phone turned sideways gets the desktop layout

Status: OPEN. John asked 5 Nov 2026; ask on QO418.

The app chooses its layout on window width alone: 600 px or less is the phone layout (`packages/ui/src/logic/viewport.ts`). A Pixel 9 turned sideways is 705 x 374, so it shows the desktop layout. Measured on the preview with touch and mobile emulation: at 374 x 705 the phone layout, at 705 x 374 the desktop layout.

The phone layout has not been checked sideways.
