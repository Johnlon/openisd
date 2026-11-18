/**
 * Cloud sync sends the whole project, unsaved edits included, a few seconds after editing stops
 * (John, 18 Nov 2026, QO946.c247: "why are we sending on saved state and not entire project? why force
 * user to do anything"; c248: option A). Save stays the user's checkpoint, and syncs too.
 */

/**
 * How long after the last edit of an open project its unsaved edits are sent. 3 s: the gap between
 * the keystrokes and clicks of one change is under a second, so a pause of 3 s means the change is
 * done; it is the same wait a Save already has before its sync run, so one rule covers both; and a
 * phone put down mid-session has sent its last change within seconds.
 */
export const SYNC_AFTER_EDIT_MS = 3000;
