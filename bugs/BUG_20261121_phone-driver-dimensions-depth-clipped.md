# Driver Depth is clipped in the phone Dimensions drawing

Open Edit My Driver and select Dimensions at 412 × 960. Scroll to the drawing. The bottom of the Driver Depth label is cut off at the toolbar, even though the label fits inside the SVG.

The phone editor keeps the drawing in normal block flow so the scroll area reserves space for its full height.
The browser regression in `driver-editor-dimensions-diagram.browser.spec.ts` checks that the scroll area can show every drawing label in full.
