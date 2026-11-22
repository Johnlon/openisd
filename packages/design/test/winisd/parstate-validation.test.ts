/**
 * @openisd/design/winisd — a `.wdr` with a malformed ParState row is READ, never refused.
 *
 * ParState records who authored each value: E means a person or datasheet stated it, C means
 * WinISD computed it. But the VALUES live in the `Key=` lines, so a broken or missing ParState
 * must never reject the file — the marks are ignored and every present row reads presence ⇒ E,
 * the same shape a scraper-authored `.wdr` (no ParState at all) is read as.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {PARSTATE_LEN} from '../../winisd/parstate.js';

/** A `.wdr` carrying one numeric row and the ParState given. Slot 1 is Fs. */
function wdrWithParState(parState: string): string {
  return ['[Driver]', 'Brand=Acme', 'Model=Probe', 'Fs=37', `ParState=${parState}`].join('\r\n');
}

describe('a malformed ParState row is ignored, never a reason to refuse the file', () => {
  it('a well-formed row is read as stated — slot 1 C means WinISD computed Fs', () => {
    const parState = 'N'.repeat(PARSTATE_LEN).split('');
    parState[1] = 'C';
    const drv = WinISDDriver.fromWdrIni(wdrWithParState(parState.join('')));
    assert.equal(drv.cell('Fs').state, 'calculated');
  });

  it('a mark WinISD never writes falls back to presence ⇒ E — the file still reads', () => {
    const parState = 'N'.repeat(PARSTATE_LEN).split('');
    parState[20] = 'X';
    const drv = WinISDDriver.fromWdrIni(wdrWithParState(parState.join('')));
    assert.equal(drv.cell('Fs').state, 'entered', 'unusable marks must not be believed');
  });

  it('a lower-case mark falls back to presence ⇒ E — WinISD writes upper case only', () => {
    const parState = 'N'.repeat(PARSTATE_LEN).split('');
    parState[1] = 'e';
    const drv = WinISDDriver.fromWdrIni(wdrWithParState(parState.join('')));
    assert.equal(drv.cell('Fs').state, 'entered');
  });

  it('a row of the wrong length falls back to presence ⇒ E — the file still reads', () => {
    const drv = WinISDDriver.fromWdrIni(wdrWithParState('N'.repeat(PARSTATE_LEN - 1)));
    assert.equal(drv.cell('Fs').state, 'entered');
  });

  it('a file carrying NO ParState line at all is read presence ⇒ E', () => {
    // The scraper writes `.wdr` without a ParState row. That is a shape we author ourselves,
    // not a corrupt WinISD file, so it keeps its own documented reading.
    const drv = WinISDDriver.fromWdrIni(['[Driver]', 'Brand=Acme', 'Model=Probe', 'Fs=37'].join('\r\n'));
    assert.equal(drv.cell('Fs').state, 'entered');
  });
});
