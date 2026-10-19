# BUG_20261019_phone-field-jumps-when-stepper-closes-keyboard

**Status:** FIXED (T439), awaiting John on his phone

## Symptom
John, 19 Oct 2026, phone. Tap a number box: the keyboard opens. Tap ▲ or ▼ by it: the keyboard
closes, and the box moves to another place on the screen. The next tap lands on a different
row's spinner.

## Evidence
- `NumInput.vue` `startRepeat`: on a touch press the ▲▼ button takes focus, so the keyboard closes.
- `MobileShell-hooks.ts` `updateViewportHeight`: the shell height follows the visible screen,
  which the keyboard shrinks and then gives back.
- Demo (19 Oct): http://lap:8000/winisd/visual-pages/stepper-keyboard-demo/ — headless 374×705,
  with the keyboard shown as a 400 px viewport. Today: the row moves 48 px. With the scroll held: 0 px.

## Cause
There are two things, the keyboard and the shell height. Closing the keyboard makes the shell
taller again, and the content pane's scroll moves the rows under the finger.

## Fix
Ruling (John, 19 Oct): pin the field. On a touch ▲▼ press, take the box's position on screen.
At the same press, before the keyboard closes, add a screen of white space below the form (John,
19 Oct: "the event needs to temporarily add white space"). When the screen resizes, scroll the
pane so the box goes back to that position. The space is removed once it is out of sight below
the screen, so removing it moves nothing. The keyboard still closes.

Ratchet (John, 19 Oct): the space only ever shrinks. Every scroll cuts off the part of it that
is out of sight below the screen.

The shell box follows the phone's pan. With the keyboard up, the phone pans the page up. The
box is sized to the visible screen but stays at the top of the page, so the top bar goes off
screen, the focused row is cut off, and a grey band shows above the keyboard (John's Pixel 9
screenshot, 19 Oct). The box goes at the pan offset, and the focused box is scrolled into view
inside the pane.

Demo v1 added the space only after the resize. That failed on John's phone for the last rows,
because the scroll was clamped first.

## Verification
Browser spec, mobile skin 374×705: focus a lower box, shrink the viewport, tap ▲, restore the
viewport. The box's top is unchanged (±1 px), and a second tap at the same point steps the same
field. Then John checks it on his Pixel 9.

## Result (opi, 19 Oct 2026, T439)
- `packages/ui/src/logic/stepperPin.ts` `StepperPin`: the space, the 1.5 s hold, the ratchet. The phone shell
  provides it, and `NumInput` pins its box on a touch ▲▼ press while it has the keyboard.
- `MobileShell`: the shell moves down by the pan (`visibleViewportTopPx`), and on a resize the focused box is
  scrolled into view.
- `packages/ui/test/ui/mobile-stepper-keyboard-pin.browser.spec.ts`, Box tab, last box, 374×705: passes. With
  the pin call disabled it fails, because the box moves from 249 to 447 px.
- Unit: `stepperPin.test.ts`, `visibleViewport.test.ts`. The stepper and mobile shell specs (118 tests) pass.
