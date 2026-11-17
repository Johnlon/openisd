/** The feedback dialog's closed set of faces, its texts, and when the app may ask. */
import {describe, expect, it} from 'vitest';
import {
  FEEDBACK_ASK_NEVER, FEEDBACK_DAY_MS, FEEDBACK_TEXTS, FeedbackFace, MAX_FEEDBACK_COMMENT,
  feedbackAskAfter, feedbackAskDue, parseFeedbackAskState,
} from '../../fields/feedback.js';

const NOW = Date.UTC(2026, 10, 17, 12);

describe('FeedbackFace', () => {
  it('is exactly three faces, worst to best, each with its wire value and label', () => {
    expect(FeedbackFace.ALL.map(f => [f.value, f.label])).toEqual([
      ['not_really', 'Not really'], ['ok', 'It is OK'], ['yes', 'Yes, I like it'],
    ]);
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
  it('asks a user it has never asked', () => {
    expect(feedbackAskDue(FEEDBACK_ASK_NEVER, NOW)).toBe(true);
  });
  it('asks at most once every 60 days from the last time it showed the prompt', () => {
    const shown = feedbackAskAfter(FEEDBACK_ASK_NEVER, 'shown', NOW);
    expect(feedbackAskDue(shown, NOW + 59 * FEEDBACK_DAY_MS)).toBe(false);
    expect(feedbackAskDue(shown, NOW + 60 * FEEDBACK_DAY_MS)).toBe(true);
  });
  it('stays quiet 90 days after an answer', () => {
    const shown = feedbackAskAfter(FEEDBACK_ASK_NEVER, 'shown', NOW);
    const answered = feedbackAskAfter(shown, 'answered', NOW);
    expect(feedbackAskDue(answered, NOW + 89 * FEEDBACK_DAY_MS)).toBe(false);
    expect(feedbackAskDue(answered, NOW + 90 * FEEDBACK_DAY_MS)).toBe(true);
  });
  it('stays quiet 30 days after Not now, and never sooner than the 60 days since it showed', () => {
    const shown = feedbackAskAfter(FEEDBACK_ASK_NEVER, 'shown', NOW);
    const later = feedbackAskAfter(shown, 'not_now', NOW + 1000);
    expect(feedbackAskDue(later, NOW + 31 * FEEDBACK_DAY_MS)).toBe(false);
    expect(feedbackAskDue(later, NOW + 60 * FEEDBACK_DAY_MS + 1000)).toBe(true);
  });
  it('reads a stored state back, and a damaged one as never asked', () => {
    const shown = feedbackAskAfter(FEEDBACK_ASK_NEVER, 'answered', NOW);
    expect(parseFeedbackAskState(JSON.stringify(shown))).toEqual(shown);
    expect(parseFeedbackAskState(null)).toEqual(FEEDBACK_ASK_NEVER);
    expect(parseFeedbackAskState('{oops')).toEqual(FEEDBACK_ASK_NEVER);
    expect(parseFeedbackAskState('{"shownAtMs":"x"}')).toEqual(FEEDBACK_ASK_NEVER);
  });
});
