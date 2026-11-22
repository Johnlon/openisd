import {describe, expect, it} from 'vitest';
import {createMemoryStorage, createUsageNoticeTab} from '@openisd/persistence';
import {flashStartupUse} from '../../src/logic/startupUsageNotice.js';

const mb = 1024 * 1024;

describe('flashStartupUse', () => {
  it('flashes the project count and storage used once per tab', () => {
    const tab = createUsageNoticeTab(createMemoryStorage({}));
    const flashed: string[] = [];
    const use = {projectCount: 12, localBytes: 1.4 * mb};
    flashStartupUse(use, tab, msg => flashed.push(msg));
    flashStartupUse(use, tab, msg => flashed.push(msg));
    expect(flashed).toEqual(['12 projects, 1.4 MB of 5 MB used.']);
  });

  it('says nothing, and keeps the tab\'s one notice, while no project is stored', () => {
    const tab = createUsageNoticeTab(createMemoryStorage({}));
    const flashed: string[] = [];
    flashStartupUse({projectCount: 0, localBytes: 200}, tab, msg => flashed.push(msg));
    expect(flashed).toEqual([]);
    flashStartupUse({projectCount: 1, localBytes: 20 * 1024}, tab, msg => flashed.push(msg));
    expect(flashed).toEqual(['1 project, 20.0 KB of 5 MB used.']);
  });
});
