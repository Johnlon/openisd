import {describe, expect, it} from 'vitest';
import {announceUpgradeRefused} from '../../src/logic/upgradeRefusedNotice.js';
import type {ConfirmPort, ConfirmRequest} from '../../src/logic/confirmPort.js';

function confirmPort(): {port: ConfirmPort; asked: ConfirmRequest[]} {
  const asked: ConfirmRequest[] = [];
  return {asked, port: {ask: request => { asked.push(request); return Promise.resolve(true); }}};
}

describe('announceUpgradeRefused', () => {
  it('asks nothing when the update was done or there was nothing to do', async () => {
    const {port, asked} = confirmPort();
    await announceUpgradeRefused({kind: 'nothingToDo'}, port);
    await announceUpgradeRefused({kind: 'rewritten', charsBefore: 10, charsAfter: 5}, port);
    expect(asked).toEqual([]);
  });

  it('shows a notice with a Close button, answered only by it, when the update was refused', async () => {
    const {port, asked} = confirmPort();
    await announceUpgradeRefused({kind: 'refused'}, port);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({title: 'Saved projects not updated', confirmLabel: 'Close', dismissal: 'buttonsOnly'});
    expect(asked[0].message).toContain('Nothing was changed');
  });
});
