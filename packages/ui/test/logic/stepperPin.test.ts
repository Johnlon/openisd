import {describe, expect, it} from 'vitest';
import {STEPPER_PIN_HOLD_MS, StepperPin, type PinSurface} from '../../src/logic/stepperPin.js';

/** A form on a 900 px screen: a box whose screen top the test moves, and a frame queue it runs. */
class FakeForm implements PinSurface {
  boxTop = 600;
  scrolled = 0;
  space = 0;
  hidden = 0;
  time = 0;
  frames: (() => void)[] = [];
  screenHeightPx(): number { return 900; }
  scrollBy(dy: number): void { this.scrolled += dy; this.boxTop -= dy; }
  setSpacePx(px: number): void { this.space = px; }
  belowViewPx(): number { return this.hidden; }
  now(): number { return this.time; }
  nextFrame(run: () => void): void { this.frames.push(run); }
  runFrame(): void { const due = this.frames; this.frames = []; due.forEach(run => run()); }
}

interface Pressed {
  readonly form: FakeForm;
  readonly pin: StepperPin;
}

function pressed(): Pressed {
  const form = new FakeForm();
  const pin = new StepperPin(form);
  pin.pin(() => form.boxTop);
  return {form, pin};
}

describe('StepperPin', () => {
  it('adds a screen of space below the form at the press, before the keyboard closes', () => {
    const {form} = pressed();
    expect(form.space).toBe(900);
  });

  it('scrolls the box back to where it was when the screen resizes', () => {
    const {form, pin} = pressed();
    form.boxTop = 905; // the keyboard closed and the box slid down 305 px
    pin.hold();
    expect(form.scrolled).toBe(305);
    expect(form.boxTop).toBe(600);
  });

  it('holds the box on every frame after the press, and stops once the hold time is over', () => {
    const {form} = pressed();
    form.boxTop = 650;
    form.runFrame();
    expect(form.boxTop).toBe(600);
    form.time = STEPPER_PIN_HOLD_MS + 1;
    form.boxTop = 650;
    form.runFrame();
    expect(form.boxTop).toBe(650);
    expect(form.frames).toHaveLength(0);
  });

  it('leaves the space alone while it holds the box', () => {
    const {form, pin} = pressed();
    form.hidden = 400;
    pin.onScroll();
    expect(form.space).toBe(900);
  });

  it('only shrinks the space after the hold: each scroll cuts off the part out of sight', () => {
    const {form, pin} = pressed();
    form.time = STEPPER_PIN_HOLD_MS + 1;
    form.hidden = 300;
    pin.onScroll();
    expect(form.space).toBe(600);
    form.hidden = 0; // scrolled down into the space: none of it is hidden, so it stays
    pin.onScroll();
    expect(form.space).toBe(600);
    form.hidden = 1000; // more than the space is out of sight: the space goes, nothing else
    pin.onScroll();
    expect(form.space).toBe(0);
  });

  it('does nothing on a resize or scroll before any press', () => {
    const form = new FakeForm();
    const pin = new StepperPin(form);
    form.hidden = 100;
    pin.hold();
    pin.onScroll();
    expect(form.scrolled).toBe(0);
    expect(form.space).toBe(0);
  });
});
