# Phone driver editor, General tab: the text boxes are too narrow

Status: FIXED — T418 round 3 (pending John's "go T418"). John, 20 Oct 2026, on the round 2 General picture: "text fields should be wider", "the text fields are too narrow".

## What is wrong

On the phone, the General tab's text boxes (Manufacturer, Brand, Model, SKU, Provided by, Added) stop short of the right edge of the content.

## Fix

General is a plain form, as 7.0.951 had it: each label above a box that runs the full width (`fieldStacked` row in `driverEditorSkin.ts`). A spec measures every General text box against the content's edges at 374x705.

## Round 3 (John, 20 Oct 2026: "terrible wtf")

Round 3 made General a stacked form: each label on its own line over a full-width box. Every text row went from one 41 px line to two (label line, 6 px top and 8 px bottom padding, 4 px gap, 32 px box, about 70 px), so General looked unlike every other tab, whose rows are label-left, box-right on one line. Round 2's boxes were narrow because its grid kept a 48 px unit column and a 10 px warning column even on rows with no unit.

## Fix (round 4)

General text rows use the same one-line row as the other tabs (`skin.field`: 128 px label column, then a box filling to the content's right edge, the unit column gone from the grid). Only the Comment stays a label-over-box row. Spec: each General label is level with its box, the box is right of the label and within 4 px of the row's content right edge, and the page does not scroll sideways. Measured at 374x705: manufacturer label ends 143, box 143 to 359, content right edge 359, row 40 px.
