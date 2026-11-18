/** The feedback dialog's closed set of faces, its texts, and when the app may ask. */
import {describe, expect, it} from 'vitest';
import {
  FEEDBACK_ASK_NEVER, FEEDBACK_DAY_MS, FEEDBACK_TEXTS, FeedbackFace, MAX_FEEDBACK_COMMENT,
  feedbackAskAfter, feedbackAskDue, parseFeedbackAskState, type FeedbackAskState,
} from '../../fields/feedback.js';

const NOW = Date.UTC(2026, 10, 17, 12);

/** A user who has started the app this many times. */
function launched(times: number): FeedbackAskState {
  let state = FEEDBACK_ASK_NEVER;
  for (let i = 0; i < times; i++) state = feedbackAskAfter(state, 'launched', NOW);
  return state;
}
const REGULAR = launched(3);

describe('FeedbackFace', () => {
  it('is exactly three faces, worst to best, each with its wire value and label', () => {
    expect(FeedbackFace.ALL.map(f => [f.value, f.label])).toEqual([
      ['not_really', 'Not really'], ['ok', 'It is OK'], ['yes', 'Yes, I like it'],
    ]);
  });
  it('draws each face in the app\'s own red, amber and green, with its own mouth', () => {
    expect(FeedbackFace.ALL.map(f => f.tone)).toEqual(['bad', 'mid', 'good']);
    expect(new Set(FeedbackFace.ALL.map(f => f.mouth)).size).toBe(3);
  });
  it('parses a wire value to its member and anything else to null', () => {
    expect(FeedbackFace.parse('ok')).toBe(FeedbackFace.Ok);
    expect(FeedbackFace.parse('great')).toBeNull();
    expect(FeedbackFace.parse('')).toBeNull();
  });
});

describe('feedback texts', () => {
  it('say what the user sees', () => {
    expect(FEEDBACK_TEXTS.menuLabel).toBe('Send feedback');
    expect(FEEDBACK_TEXTS.title).toBe('Do you like OpenISD?');
    expect(FEEDBACK_TEXTS.thanksSent).toBe('Thanks, sent');
    expect(FEEDBACK_TEXTS.savedOffline).toBe('Saved, will send when online');
    expect(FEEDBACK_TEXTS.commentPrompt).toBe('Anything to add?');
    expect(MAX_FEEDBACK_COMMENT).toBe(1000);
  });
});

describe('when the app may ask', () => {
  it('does not ask a new visitor: the first ask is on the 3rd launch (John, QO946.c238)', () => {
    expect(feedbackAskDue(FEEDBACK_ASK_NEVER, NOW)).toBe(false);
    expect(feedbackAskDue(launched(1), NOW)).toBe(false);
    expect(feedbackAskDue(launched(2), NOW)).toBe(false);
    expect(feedbackAskDue(launched(3), NOW)).toBe(true);
    expect(feedbackAskDue(launched(4), NOW)).toBe(true);
  });
  it('counts each launch and keeps the rest of the state', () => {
    const shown = feedbackAskAfter(REGULAR, 'shown', NOW);
    expect(feedbackAskAfter(shown, 'launched', NOW)).toEqual({...shown, launches: 4});
  });
  it('reads an old stored state without a launch count as 0 launches, never refuses it', () => {
    const old = parseFeedbackAskState(JSON.stringify({shownAtMs: NOW, quietUntilMs: NOW + 5}));
    expect(old).toEqual({shownAtMs: NOW, quietUntilMs: NOW + 5, launches: 0});
    expect(parseFeedbackAskState('{"shownAtMs":null,"quietUntilMs":0,"launches":"x"}').launches).toBe(0);
    expect(parseFeedbackAskState('{"shownAtMs":null,"quietUntilMs":0,"launches":-2}').launches).toBe(0);
    expect(parseFeedbackAskState('{"shownAtMs":null,"quietUntilMs":0,"launches":2.7}').launches).toBe(2);
  });
  it('asks at most once every 60 days from the last time it showed the prompt', () => {
    const shown = feedbackAskAfter(REGULAR, 'shown', NOW);
    expect(feedbackAskDue(shown, NOW + 59 * FEEDBACK_DAY_MS)).toBe(false);
    expect(feedbackAskDue(shown, NOW + 60 * FEEDBACK_DAY_MS)).toBe(true);
  });
  it('stays quiet 90 days after an answer', () => {
    const shown = feedbackAskAfter(REGULAR, 'shown', NOW);
    const answered = feedbackAskAfter(shown, 'answered', NOW);
    expect(feedbackAskDue(answered, NOW + 89 * FEEDBACK_DAY_MS)).toBe(false);
    expect(feedbackAskDue(answered, NOW + 90 * FEEDBACK_DAY_MS)).toBe(true);
  });
  it('stays quiet 30 days after Not now, and never sooner than the 60 days since it showed', () => {
    const shown = feedbackAskAfter(REGULAR, 'shown', NOW);
    const later = feedbackAskAfter(shown, 'not_now', NOW + 1000);
    expect(feedbackAskDue(later, NOW + 31 * FEEDBACK_DAY_MS)).toBe(false);
    expect(feedbackAskDue(later, NOW + 60 * FEEDBACK_DAY_MS + 1000)).toBe(true);
  });
  it('reads a stored state back, and a damaged one as never asked', () => {
    const shown = feedbackAskAfter(REGULAR, 'answered', NOW);
    expect(parseFeedbackAskState(JSON.stringify(shown))).toEqual(shown);
    expect(parseFeedbackAskState(null)).toEqual(FEEDBACK_ASK_NEVER);
    expect(parseFeedbackAskState('{oops')).toEqual(FEEDBACK_ASK_NEVER);
    expect(parseFeedbackAskState('{"shownAtMs":"x"}')).toEqual(FEEDBACK_ASK_NEVER);
  });
});
