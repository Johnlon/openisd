/**
 * QO532 (John, 11 Nov 2026, on the blue dot picture: "do this"): the room a label column keeps for the blue dot after an accented
 * label, so the dot never runs into the warning mark or the box.
 */
import {describe, expect, it} from 'vitest';
import {ChartInputs, DesktopSizes, PhoneRowColumns} from '../../fields/index.js';

describe('the blue dot after an accented label', () => {
  it('is an 8 px dot 4 px after the text, with 2 px clear after it', () => {
    expect([ChartInputs.DOT_PX, ChartInputs.DOT_GAP_PX, ChartInputs.DOT_SPAN_PX]).toEqual([8, 4, 14]);
  });

  it('on the desktop, needs 12 px more than the warning slot, whose last 20 px a warning mark can take', () => {
    expect(ChartInputs.DESKTOP_DOT_ROOM_PX).toBe(12);
    expect(DesktopSizes.LABEL_SLOT_PX - ChartInputs.WARNING_MARK_PX + ChartInputs.DESKTOP_DOT_ROOM_PX).toBe(ChartInputs.DOT_SPAN_PX);
  });

  it('on the phone, needs only what the label margin and the column padding do not already leave', () => {
    expect(ChartInputs.phoneDotRoomPx(0)).toBe(ChartInputs.DOT_SPAN_PX - PhoneRowColumns.LABEL_PAD_PX);
    expect(ChartInputs.phoneDotRoomPx(22)).toBe(ChartInputs.DOT_SPAN_PX - 2 - PhoneRowColumns.LABEL_PAD_PX);
  });

  it('needs no room where the blank after the text already holds it', () => {
    expect(ChartInputs.dotRoomPx(40)).toBe(0);
  });
});
