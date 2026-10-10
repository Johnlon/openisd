/**
 * Pure loading-overlay policy and decision functions (T030).
 *
 * Enforces the application-wide overlay timings:
 * - Minimum display duration of 0.7 s (700 ms) from initial display or redisplay.
 * - Hidden threshold of 30 s (30,000 ms) after which becoming visible redisplays the overlay.
 *
 * Keeps all arithmetic, thresholds, and visibility decisions in the domain layer
 * so the UI layer remains purely wiring with zero magic numbers or calculation logic.
 */

export const OVERLAY_MIN_DISPLAY_MS = 700;
export const OVERLAY_HIDDEN_THRESHOLD_MS = 30_000;

/**
 * Decides whether the overlay is due to be shown again upon the page becoming visible.
 * Returns true if and only if the duration the page was hidden strictly exceeds 30 s.
 */
export function isOverlayDueToShow(hiddenAt: number, visibleAt: number): boolean {
  return visibleAt - hiddenAt > OVERLAY_HIDDEN_THRESHOLD_MS;
}

/**
 * Decides whether the overlay may hide yet.
 * Returns true if and only if the app has mounted AND the elapsed display time is at least 0.7 s.
 */
export function mayOverlayHide(shownAt: number, now: number, isMounted: boolean): boolean {
  return isMounted && now - shownAt >= OVERLAY_MIN_DISPLAY_MS;
}

/**
 * Calculates how many milliseconds remain before the overlay reaches its minimum 0.7 s display duration.
 * The UI layer uses this value to schedule timers without performing arithmetic.
 */
export function overlayRemainingDisplayMs(shownAt: number, now: number): number {
  return Math.max(0, OVERLAY_MIN_DISPLAY_MS - (now - shownAt));
}
