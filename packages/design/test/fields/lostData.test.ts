import {describe, expect, it} from 'vitest';
import {lostDataSentence} from '../../fields/lostData.js';

describe('lostDataSentence', () => {
  it('says plural things were there and are gone, in the words John asked for', () => {
    expect(lostDataSentence('Saved drivers', true, '2026-10-12 21:30'))
      .toBe('Saved drivers were in this browser at 2026-10-12 21:30, they are gone now.');
  });

  it('uses the singular for one thing', () => {
    expect(lostDataSentence('The autosaved project', false, '2026-10-12 21:30'))
      .toBe('The autosaved project was in this browser at 2026-10-12 21:30, it is gone now.');
  });
});
