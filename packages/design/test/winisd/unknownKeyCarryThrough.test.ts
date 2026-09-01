/**
 * The no-drop guarantee, exercised red-first: a key the format classes do not know survives a
 * round trip instead of being silently destroyed. This was the root cause behind
 * bugs/BUG_20260823_wpr_import_discards_vent_cross_section_provenance.md — the old readers
 * kept only the keys their narrow types named.
 *
 * Scope stated precisely: no-drop holds for a FILE-READ instance (which returns the file
 * verbatim) and for unknown keys SUPPLIED to build(). The DOMAIN path narrows to what OpenISD
 * models — a .wpr exported from OpenISDProject is a projection of the model, exactly as WinISD
 * itself rewrites files from its own model.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver, WinISDProject } from '@openisd/design/winisd';

describe('WinISDDriver — an unknown key read from a file is written back by toWdr()', () => {
  it('carries a key it does not know through read → write', () => {
    const text = [
      '[Driver]', 'Brand=x', 'Model=y', 'Manufacturer=', 'ProvidedBy=', 'Comment=',
      'DateAdded=', 'DateModified=', 'Qts=0.4', 'FutureKey=42',
      'ParState=' + 'N'.repeat(49), '',
    ].join('\r\n');
    const out = WinISDDriver.fromWdrIni(text).toWdr();
    assert.ok(out.includes('FutureKey=42'),
      'a key this class does not know must survive to the written file, never be dropped');
    // and the known key still round-trips beside it
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
