import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {WinISDDriver} from '@openisd/design/winisd';

describe('WinISDDriver — a key outside WDR_DRIVER_INI_ROWS and the header lines is discarded on read', () => {
  it('a foreign key does not survive read -> write', () => {
    const text = [
      '[Driver]', 'Brand=x', 'Model=y', 'Manufacturer=', 'ProvidedBy=', 'Comment=',
      'DateAdded=', 'DateModified=', 'Qts=0.4', 'FutureKey=42',
      'ParState=' + 'N'.repeat(49), '',
    ].join('\r\n');
    const out = WinISDDriver.fromWdrIni(text).toWdrIni();
    assert.ok(!out.includes('FutureKey'),
      'a key outside the 48 .wdr keys and the 7 header lines is discarded, not carried through');
    // the known key still round-trips
    assert.ok(out.includes('Qts=0.4'));
  });
});
