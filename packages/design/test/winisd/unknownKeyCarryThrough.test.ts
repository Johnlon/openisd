/**
 * `WinISDDriver`'s scope is exactly the 48 `INI_ROWS` keys plus the 7 header lines — nothing
 * else. A key outside that set is discarded on read (John, 2026-09-02): `.wdr` has no
 * extension mechanism, so a foreign key is evidence of a corrupt or non-WinISD file, not a
 * field to preserve. This SUPERSEDES the class's older no-drop guarantee.
 *
 * `WinISDProject` (`.wpr`) is unrelated and keeps its own no-drop guarantee — see
 * `bugs/BUG_20260823_wpr_import_discards_vent_cross_section_provenance.md` — because `.wpr`
 * sections have no fixed key count the way a `.wdr`'s 48 numeric rows do.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver, WinISDProject } from '@openisd/design/winisd';

describe('WinISDDriver — a key outside INI_ROWS and the header lines is discarded on read', () => {
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
