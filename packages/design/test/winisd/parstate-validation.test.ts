/**
 * @openisd/design/winisd — a `.wdr` whose ParState row is malformed is REFUSED, not quietly downgraded.
 *
 * ParState is the only place a `.wdr` records provenance: E means a person or datasheet stated
 * the value, C means WinISD computed it. A mark taken from a broken row is a claim about who
 * authored a number, made on the strength of an arbitrary byte — and nothing downstream can
 * tell it apart from a real one. So the read throws, naming the slot and field, and a person
 * edits the file (John, 2026-09-01).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver } from '../../winisd/winisdDriver.js';
import { PARSTATE_LEN, ParStateError } from '../../winisd/parstate.js';

/** A `.wdr` carrying one numeric row and the ParState given. Slot 1 is Fs. */
function wdrWithParState(parState: string): string {
  return ['[Driver]', 'Brand=Acme', 'Model=Probe', 'Fs=37', `ParState=${parState}`].join('\r\n');
}

describe('a ParState the file carries must be one WinISD could have written', () => {
  it('a well-formed row is read as stated — slot 1 C means WinISD computed Fs', () => {
    const parState = 'N'.repeat(PARSTATE_LEN).split('');
    parState[1] = 'C';
    const drv = WinISDDriver.fromWdrIni(wdrWithParState(parState.join('')));
    assert.equal(drv.cell('Fs').state, 'C');
  });

  it('a mark WinISD never writes is refused, and the message names the slot and field', () => {
    const parState = 'N'.repeat(PARSTATE_LEN).split('');
    parState[20] = 'X';
    assert.throws(
      () => WinISDDriver.fromWdrIni(wdrWithParState(parState.join(''))),
      (err: unknown) => {
        assert.ok(err instanceof ParStateError, 'a malformed ParState is a ParStateError');
        assert.match(err.message, /slot 20 \(Dia\) holds "X"/,
          'the reader must be told WHICH mark is wrong and which field it belongs to');
        assert.match(err.message, /Edit the ParState= line/,
          'the remedy is a person editing the file, so the message must say so');
        return true;
      });
  });

  it('a lower-case mark is refused — WinISD writes upper case only', () => {
    const parState = 'N'.repeat(PARSTATE_LEN).split('');
    parState[1] = 'e';
    assert.throws(() => WinISDDriver.fromWdrIni(wdrWithParState(parState.join(''))), ParStateError);
  });

  it('a row of the wrong length is refused, and the message states both lengths', () => {
    assert.throws(
      () => WinISDDriver.fromWdrIni(wdrWithParState('N'.repeat(PARSTATE_LEN - 1))),
      (err: unknown) => {
        assert.ok(err instanceof ParStateError);
        assert.match(err.message, new RegExp(`carries ${PARSTATE_LEN - 1} marks`));
        assert.match(err.message, new RegExp(`exactly ${PARSTATE_LEN}`));
        return true;
      });
  });

  it('a file carrying NO ParState line at all is read presence ⇒ E, not refused', () => {
    // The scraper writes `.wdr` without a ParState row. That is a shape we author ourselves,
    // not a corrupt WinISD file, so it keeps its own documented reading.
    const drv = WinISDDriver.fromWdrIni(['[Driver]', 'Brand=Acme', 'Model=Probe', 'Fs=37'].join('\r\n'));
    assert.equal(drv.cell('Fs').state, 'E');
  });
});
