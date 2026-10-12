import {describe, expect, it, vi} from 'vitest';
import type {LostKey} from '@openisd/persistence';
import {announceLostKeys, lostKeyText} from '../../src/logic/lostKeyNotice.js';
import type {ConfirmPort, ConfirmRequest} from '../../src/logic/confirmPort.js';

const DRIVERS: LostKey = {key: 'openisd_my_drivers', what: 'Saved drivers', plural: true, lastSeenAt: '20261012T213005Z'};
const STATE: LostKey = {key: 'openisd_state', what: 'The autosaved project', plural: false, lastSeenAt: '20261012T213005Z'};
const formatTime = (at: Date) => `shown ${at.toISOString()}`;

function confirmAnswering(answer: boolean): {port: ConfirmPort; asked: ConfirmRequest[]} {
  const asked: ConfirmRequest[] = [];
  return {asked, port: {ask: request => { asked.push(request); return Promise.resolve(answer); }}};
}

describe('lostKeyText', () => {
  it('says what was in this browser and when, in the words John asked for', () => {
    expect(lostKeyText(DRIVERS, formatTime)).toBe(
      'Saved drivers were in this browser at shown 2026-10-12T21:30:05.000Z, they are gone now.');
  });

  it('uses the singular for a single thing', () => {
    expect(lostKeyText(STATE, formatTime)).toBe(
      'The autosaved project was in this browser at shown 2026-10-12T21:30:05.000Z, it is gone now.');
  });

  it('shows the stored time as it is when it does not parse', () => {
    expect(lostKeyText({...DRIVERS, lastSeenAt: 'garbled'}, formatTime)).toContain('at garbled,');
  });
});

describe('announceLostKeys', () => {
  it('asks nothing when nothing was lost', async () => {
    const {port, asked} = confirmAnswering(true);
    await announceLostKeys([], {confirm: port, formatTime, exportLog: vi.fn()});
    expect(asked).toEqual([]);
  });

  it('waits for a click: Export log hands the user the storage log', async () => {
    const {port, asked} = confirmAnswering(true);
    const exportLog = vi.fn();
    await announceLostKeys([DRIVERS, STATE], {confirm: port, formatTime, exportLog});
    expect(asked).toHaveLength(1);
    expect(asked[0].confirmLabel).toBe('Export log');
    expect(asked[0].message).toContain('Saved drivers were in this browser');
    expect(asked[0].message).toContain('The autosaved project was in this browser');
    expect(exportLog).toHaveBeenCalledTimes(1);
  });

  it('OK closes it without exporting', async () => {
    const {port} = confirmAnswering(false);
    const exportLog = vi.fn();
    await announceLostKeys([DRIVERS], {confirm: port, formatTime, exportLog});
    expect(exportLog).not.toHaveBeenCalled();
  });
});
