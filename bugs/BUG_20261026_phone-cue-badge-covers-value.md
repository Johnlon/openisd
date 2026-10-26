# Phone Box page: the ≠W badge covers the Fsc and Qtc values

- Status: fixed (T606)
- Reported: John, 26 Oct 2026, from test.openisd.app on a Pixel 9 (Firefox and Chrome): "the buttons are corrupt on firefox, things overlap"; "it's bad on chrome too"; critical.

## What is wrong

On the phone Box page with a closed box, the Fsc box shows "22≠W9" and the Qtc box "0.3≠W6": the
≠W difference badge, a button laid over the right end of the value box, sits on top of the digits.

## Cause

The classic phone field pads the box's text only past the unit chip. The ≠W badge sits left of
the chip, inside the box, and nothing stops the text short of it. The measured text area ended
25 px under the badge in Chromium (the spec's red run); Firefox lays the row out the same way.

## Fix

`PhoneRowColumns` gains a cue column (24 px). When a classic field carries a badge, its box pads
the text past the chip and the badge. Spec: `closed-box-typing-cue.browser.spec.ts`, "the cue never
covers the value".
