import type {StepAt} from './caretSpin.js';

/**
 * Drag to spin (John, 19 Oct 2026: "the existing UI should be allowing spin by dragging any field";
 * QO299.c24: left and right only; 22 Oct: "stretch and digit selection ... with same with mouse
 * drag"). Press on a digit of a number box and drag: right steps up, left steps down. The digit
 * pressed sets the step, as the caret digit does for the arrow keys. Past a small dead zone the value
 * keeps changing while the press is held, faster the further from the start, and stops on release.
 * This is the maths only; the box forwards pointer events and clock ticks here.
 */

/** Nothing moves until the pointer is this far from where it was pressed. */
export const DRAG_SPIN_THRESHOLD_PX = 8;
/** Steps a second just past the dead zone. */
const BASE_STEPS_PER_S = 3;
/** Extra steps a second for each pixel past the dead zone. */
const STEPS_PER_S_PER_PX = 0.3;
/** The fastest the value runs, however far the pointer is pulled. */
const MAX_STEPS_PER_S = 60;

/** Steps a second at `distancePx` from the press (negative = left of it): signed, 0 in the dead zone. */
export function dragSpinRate(distancePx: number): number {
  const far = Math.abs(distancePx);
  if (far < DRAG_SPIN_THRESHOLD_PX) return 0;
  const speed = Math.min(MAX_STEPS_PER_S, BASE_STEPS_PER_S + (far - DRAG_SPIN_THRESHOLD_PX) * STEPS_PER_S_PER_PX);
  return distancePx < 0 ? -speed : speed;
}

/** A tick that arrives later than this (the page was busy) counts as this long, so a stall never lurches the value. */
const MAX_TICK_MS = 100;

/** One press-and-drag: turns the pointer's distance and the time passed into whole steps. */
export class DragSpin {
  private engaged = false;
  private owed = 0;

  /**
   * Whole steps (signed) to take now: `distancePx` is the pointer's offset from the press, `dtMs` the
   * time since the last call. The first call past the dead zone takes one step at once; after that
   * steps arrive at `dragSpinRate`, so holding still keeps the value running. Back inside the dead
   * zone nothing runs until it is left again.
   */
  advance(distancePx: number, dtMs: number): number {
    const rate = dragSpinRate(distancePx);
    if (rate === 0) {
      this.engaged = false;
      this.owed = 0;
      return 0;
    }
    if (!this.engaged) {
      this.engaged = true;
      this.owed = rate < 0 ? -1 : 1;
    }
    this.owed += rate * Math.min(dtMs, MAX_TICK_MS) / 1000;
    const whole = Math.trunc(this.owed);
    this.owed -= whole;
    return whole;
  }
}

/** Where the pressed text sits and how wide it is drawn. */
export interface TextBox {
  /** The width of the box's content area (inside padding), in px. */
  readonly contentWidth: number;
  readonly align: 'left' | 'right' | 'center';
}

/**
 * The digit of `text` under a press at `x` px from the left of the content area, as the step choice
 * for a spin: that digit, or `none` when the press is on the sign, the point, or outside the text
 * (the box then steps as its normal step). `widthOf` is the drawn width of a string in the box's font.
 */
export function pressedDigit(text: string, x: number, box: TextBox, widthOf: (s: string) => number): StepAt {
  const textWidth = widthOf(text);
  const free = box.contentWidth - textWidth;
  const origin = box.align === 'right' ? free : box.align === 'center' ? free / 2 : 0;
  const into = x - origin;
  if (into < 0 || into > textWidth) return {kind: 'none'};
  for (let i = 0; i < text.length; i++) {
    if (widthOf(text.slice(0, i + 1)) >= into) {
      return /\d/.test(text[i]) ? {kind: 'digit', at: i} : {kind: 'none'};
    }
  }
  return {kind: 'none'};
}
