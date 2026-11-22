/**
 * THE FEEDBACK DIALOG'S VOCABULARY: the three faces (a closed set), every text the dialog and its
 * prompt show, and the rule for when the app may ask. The UI shows these and decides nothing.
 */

export type FeedbackTone = 'bad' | 'mid' | 'good';

/** How the user feels about OpenISD. `value` is the wire string the collector accepts; it is the only
 *  thing that crosses a boundary (storage, the network). Compare members with `===`. */
export class FeedbackFace {
  private constructor(
    readonly value: string,
    readonly label: string,
    /** Which of the app's own colours the face is drawn in: `bad` is its red, `mid` its amber, `good` its green. */
    readonly tone: FeedbackTone,
    /** The mouth, as an SVG path in a 40 x 40 box: sad, flat, smiling. */
    readonly mouth: string,
  ) {}

  static readonly NotReally = new FeedbackFace('not_really', 'Not really', 'bad', 'M12 30 Q20 23 28 30');
  static readonly Ok = new FeedbackFace('ok', 'It is OK', 'mid', 'M13 28.5 L27 28.5');
  static readonly Yes = new FeedbackFace('yes', 'Yes, I like it', 'good', 'M12 26.5 Q20 35 28 26.5');

  /** Worst to best, the order the faces are drawn. LAST in the class body. */
  static readonly ALL: readonly FeedbackFace[] =
    Object.values(FeedbackFace).filter((v): v is FeedbackFace => v instanceof FeedbackFace);

  /** The face with this wire value, or null: a stored or received string is never trusted. */
  static parse(value: string): FeedbackFace | null {
    return FeedbackFace.ALL.find(f => f.value === value) ?? null;
  }

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}

/** The longest comment sent; the collector refuses more. */
export const MAX_FEEDBACK_COMMENT = 1000;

export interface FeedbackTexts {
  readonly menuLabel: string;
  readonly title: string;
  readonly thanks: string;
  readonly thanksSent: string;
  readonly savedOffline: string;
  readonly commentPrompt: string;
  readonly commentPlaceholder: string;
  readonly sendComment: string;
  readonly notNow: string;
  readonly close: string;
  readonly privacy: string;
}

export const FEEDBACK_TEXTS: FeedbackTexts = {
  menuLabel: 'Send feedback',
  title: 'Do you like OpenISD?',
  thanks: 'Thanks!',
  thanksSent: 'Thanks, sent',
  savedOffline: 'Saved, will send when online',
  commentPrompt: 'Anything to add?',
  commentPlaceholder: 'Optional: what you like, what is missing, what is wrong',
  sendComment: 'Send',
  notNow: 'Not now',
  close: 'Close',
  privacy: 'Sent: your answer, comment, app version and screen name. No account, no email, no tracking.',
};

export const FEEDBACK_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_DAYS = 60;
const NOT_NOW_DAYS = 30;
const ANSWERED_DAYS = 90;

/** The first launch on which a user may be asked: a new visitor is not asked on the 1st or 2nd. */
const FIRST_ASK_LAUNCH = 3;

/** What the app remembers about asking: when it last showed the prompt, the earliest time it may
 *  show it again after the user's last reply, and how many times the app has been started. */
export interface FeedbackAskState {
  readonly shownAtMs: number | null;
  readonly quietUntilMs: number;
  readonly launches: number;
}

export type FeedbackAskEvent = 'launched' | 'shown' | 'not_now' | 'answered';

export const FEEDBACK_ASK_NEVER: FeedbackAskState = {shownAtMs: null, quietUntilMs: 0, launches: 0};

/** May the app show the prompt now? Not before the 3rd launch, at most once every 60 days from the last
 *  showing, and not before the quiet time the user's last reply set (Not now 30 days, an answer 90 days). */
export function feedbackAskDue(state: FeedbackAskState, nowMs: number): boolean {
  const gapEnds = state.shownAtMs === null ? 0 : state.shownAtMs + MIN_GAP_DAYS * FEEDBACK_DAY_MS;
  return state.launches >= FIRST_ASK_LAUNCH && nowMs >= gapEnds && nowMs >= state.quietUntilMs;
}

export function feedbackAskAfter(state: FeedbackAskState, event: FeedbackAskEvent, nowMs: number): FeedbackAskState {
  switch (event) {
    case 'launched': return {...state, launches: state.launches + 1};
    case 'shown': return {...state, shownAtMs: nowMs};
    case 'not_now': return {...state, quietUntilMs: nowMs + NOT_NOW_DAYS * FEEDBACK_DAY_MS};
    case 'answered': return {...state, quietUntilMs: nowMs + ANSWERED_DAYS * FEEDBACK_DAY_MS};
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A stored state read back; text that is not one is "never asked". A missing or bad launch count reads as 0. */
export function parseFeedbackAskState(json: string | null): FeedbackAskState {
  if (json === null) return FEEDBACK_ASK_NEVER;
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return FEEDBACK_ASK_NEVER; }
  if (!isRecord(raw)) return FEEDBACK_ASK_NEVER;
  const shown = raw['shownAtMs'];
  const quiet = raw['quietUntilMs'];
  if ((shown !== null && typeof shown !== 'number') || typeof quiet !== 'number') return FEEDBACK_ASK_NEVER;
  // A state stored before launches were counted has none: it is read as 0, not refused.
  const counted = raw['launches'];
  const launches = typeof counted === 'number' && Number.isFinite(counted) && counted > 0 ? Math.floor(counted) : 0;
  return {shownAtMs: shown, quietUntilMs: quiet, launches};
}
