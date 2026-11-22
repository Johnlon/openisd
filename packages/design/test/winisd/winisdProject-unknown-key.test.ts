import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {WinISDProject} from '@openisd/design/winisd';

describe('WinISDProject — an unknown key supplied to build() is rendered', () => {
  it('writes a key the template does not list, at the end of its section', () => {
    // A file-read instance returns the file verbatim, so only build() can exercise the
    // renderer's carry-through of unlisted keys.
    const out = WinISDProject.build('[Driver]\nParState=NNN', {
      Box: { BType: 0, Vr: 0.02, FutureKey: 7 },
    }).toWpr();
    assert.ok(out.includes('FutureKey=7'),
      'a supplied key the template does not list must still be written');
    const box = out.split('[Box]')[1]!.split('[VentFront]')[0]!;
    assert.ok(box.includes('FutureKey=7'), 'and it must land inside its own section');
  });
});
