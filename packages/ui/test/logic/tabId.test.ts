import {describe, expect, it} from 'vitest';
import {isTabId} from '../../src/logic/tabId.js';

describe('tabId', () => {
  describe('isTabId', () => {
    it('accepts every tab the rail shows', () => {
      for (const id of ['box', 'driver', 'enclosure', 'filters', 'signal', 'advanced', 'project']) {
        expect(isTabId(id)).toBe(true);
      }
    });

    it('rejects anything else, whatever its type — including the Settings tab the rail no longer has (moved to Options, 2026-09-24)', () => {
      for (const junk of ['', 'Box', 'setting', 'settings', 'settings ', null, undefined, 0, {}]) {
        expect(isTabId(junk)).toBe(false);
      }
    });
  });
});
