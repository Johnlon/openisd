// Keeps a number box where it is on the phone screen when its ▲▼ press closes the keyboard
// (bugs/BUG_20261019_phone-field-jumps-when-stepper-closes-keyboard.md).
//
// The phone shell is as tall as the visible screen, so the keyboard closing makes the form taller
// and its scroll moves the rows under the finger. `pin` adds a screen of space below the form at
// the press, while the keyboard is still up, so the form never runs out of room to scroll (John,
// 19 Oct 2026: "the event needs to temporarily add white space"); then each resize, scroll and
// frame for STEPPER_PIN_HOLD_MS scrolls the box back to where it was. After that the space only
// shrinks (John: "rachet to only allow it to be shrunk"): each scroll cuts off the part out of
// sight, which moves nothing on screen.

import type {InjectionKey} from 'vue';

/** The keyboard closes over several frames, and the browser can move the page late. */
export const STEPPER_PIN_HOLD_MS = 1500;

/** The scrolling form the pin works on. */
export interface PinSurface {
  screenHeightPx(): number;
  /** Scrolls the form's content up by `dy` px (down when negative). */
  scrollBy(dy: number): void;
  /** Sets the height of the space below the form. */
  setSpacePx(px: number): void;
  /** How much of the form's content, the space included, is out of sight below the screen. */
  belowViewPx(): number;
  now(): number;
  nextFrame(run: () => void): void;
}

interface Anchor {
  readonly screenTop: () => number;
  readonly top: number;
  readonly since: number;
}

export class StepperPin {
  private space = 0;
  private anchor: Anchor | null = null;

  constructor(private readonly surface: PinSurface) {}

  /** A ▲▼ press with the keyboard up. `screenTop` reads where the box is on the visible screen. */
  pin(screenTop: () => number): void {
    this.space = this.surface.screenHeightPx();
    this.surface.setSpacePx(this.space);
    this.anchor = {screenTop, top: screenTop(), since: this.surface.now()};
    this.surface.nextFrame(() => this.holdFrame());
  }

  onScroll(): void {
    if (this.holding()) this.hold();
    else this.trim();
  }

  private holding(): boolean {
    if (this.anchor !== null && this.surface.now() - this.anchor.since > STEPPER_PIN_HOLD_MS) this.anchor = null;
    return this.anchor !== null;
  }

  /** Scrolls a pinned box back to where it was on screen; nothing once the hold is over. */
  hold(): void {
    if (!this.holding() || this.anchor === null) return;
    const delta = this.anchor.screenTop() - this.anchor.top;
    if (Math.abs(delta) >= 1) this.surface.scrollBy(delta);
  }

  private holdFrame(): void {
    if (!this.holding()) return;
    this.hold();
    this.surface.nextFrame(() => this.holdFrame());
  }

  private trim(): void {
    if (this.space === 0) return;
    const hidden = Math.min(this.space, this.surface.belowViewPx());
    if (hidden <= 0) return;
    this.space = Math.max(0, this.space - hidden);
    this.surface.setSpacePx(this.space);
  }
}

/** The phone shell provides its pin; a box outside it (the desktop skin) gets none. */
export const STEPPER_PIN: InjectionKey<StepperPin> = Symbol('openisd.stepperPin');
