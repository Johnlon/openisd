import {describe, expect, it} from 'vitest';
import {
  OVERLAY_HIDDEN_THRESHOLD_MS,
  OVERLAY_MIN_DISPLAY_MS,
  isOverlayDueToShow,
  mayOverlayHide,
  overlayRemainingDisplayMs,
} from '../../domain/loadingOverlay.js';

describe('loading overlay policy and decision functions', () => {
  describe('constants', () => {
    it('minimum display time is exactly 0.7 s (700 ms)', () => {
      expect(OVERLAY_MIN_DISPLAY_MS).toBe(700);
    });

    it('hidden threshold is exactly 30 s (30000 ms)', () => {
      expect(OVERLAY_HIDDEN_THRESHOLD_MS).toBe(30_000);
    });
  });

  describe('isOverlayDueToShow', () => {
    it('returns true when hidden duration strictly exceeds 30 s', () => {
      expect(isOverlayDueToShow(1_000, 31_001)).toBe(true);
      expect(isOverlayDueToShow(0, 45_000)).toBe(true);
    });

    it('returns false when hidden duration is exactly 30 s or less', () => {
      expect(isOverlayDueToShow(1_000, 31_000)).toBe(false);
      expect(isOverlayDueToShow(1_000, 20_000)).toBe(false);
      expect(isOverlayDueToShow(1_000, 1_000)).toBe(false);
      expect(isOverlayDueToShow(5_000, 2_000)).toBe(false);
    });
  });

  describe('mayOverlayHide', () => {
    it('cannot hide if the app is not mounted yet, even after 0.7 s', () => {
      expect(mayOverlayHide(0, 700, false)).toBe(false);
      expect(mayOverlayHide(0, 5_000, false)).toBe(false);
    });

    it('cannot hide if less than 0.7 s have passed, even if app is mounted', () => {
      expect(mayOverlayHide(0, 0, true)).toBe(false);
      expect(mayOverlayHide(0, 200, true)).toBe(false);
      expect(mayOverlayHide(1_000, 1_699, true)).toBe(false);
    });

    it('may hide once mounted and displayed for at least 0.7 s', () => {
      expect(mayOverlayHide(0, 700, true)).toBe(true);
      expect(mayOverlayHide(1_000, 1_700, true)).toBe(true);
      expect(mayOverlayHide(1_000, 2_000, true)).toBe(true);
    });
  });

  describe('overlayRemainingDisplayMs', () => {
    it('returns remaining ms up to the 0.7 s threshold', () => {
      expect(overlayRemainingDisplayMs(0, 0)).toBe(700);
      expect(overlayRemainingDisplayMs(1_000, 1_200)).toBe(500);
      expect(overlayRemainingDisplayMs(1_000, 1_699)).toBe(1);
    });

    it('returns 0 when 0.7 s or more have elapsed', () => {
      expect(overlayRemainingDisplayMs(0, 700)).toBe(0);
      expect(overlayRemainingDisplayMs(1_000, 2_000)).toBe(0);
    });
  });
});
