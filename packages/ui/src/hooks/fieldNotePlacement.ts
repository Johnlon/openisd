/**
 * Where a field's note popup sits so it never leaves the window: shifted left when the field is near
 * the right edge, opened above the box when it is near the bottom. Pure rect maths; the field opens
 * the popup and applies the offsets.
 */

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Offsets of the popup from the field's top-left corner, in px. */
export interface NoteOffset {
  readonly left: number;
  readonly top: number;
}

/** The gap between the field and the popup. */
export const NOTE_GAP = 2;

/** The part of `a` that is also in `b`. */
export function intersect(a: Rect, b: Rect): Rect {
  return {left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)};
}

/**
 * The popup's offset from `field`: under it, left edges aligned, then pulled inside `bounds`. It
 * opens above the field when it does not fit under it and does fit above.
 */
export function placeNote(field: Rect, note: Size, bounds: Rect): NoteOffset {
  const alignedLeft = Math.min(field.left, bounds.right - note.width);
  const left = Math.max(alignedLeft, bounds.left);
  const below = field.bottom + NOTE_GAP;
  const above = field.top - NOTE_GAP - note.height;
  const fitsBelow = below + note.height <= bounds.bottom;
  const fitsAbove = above >= bounds.top;
  const top = !fitsBelow && fitsAbove ? above : below;
  return {left: left - field.left, top: top - field.top};
}
