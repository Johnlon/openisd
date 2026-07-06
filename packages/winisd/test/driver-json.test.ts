/**
 * @openisd/winisd — Driver.toJSON / fromJSON full-state serialization (Phase 5).
 *
 * Seam: persistence (localStorage, share-link, project JSON) must carry the Driver's
 * COMPLETE state — the entered-marks (#inputs) AND the pass-through fields a loaded .wdr
 * carries for lossless export (dimensions, thermal, Hc/Hg, the source ParState). raw()
 * alone drops those (they live outside #inputs), so provenance + carried fields survive a
 * .wdr round-trip but not a reload/share. toJSON/fromJSON closes that gap.
 *
 * Independent oracle: the driver's own toWdr() output — if JSON round-trip is lossless,
 * fromJSON(toJSON()) must produce byte-identical toWdr() (all carried fields + ParState),
 * and every cell's E/C/N state must be unchanged.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(here, '..', '..', '..', 'drivers', 'sample', 'SEAS_Prestige_L19RNX1.wdr');
const text = readFileSync(SAMPLE, 'utf8');

// Every field whose E/C/N must be identical after a JSON round-trip.
const CELLS = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Le', 'Xmax', 'Pe', 'Cms', 'Mms', 'Bl', 'Z'];

describe('Driver.toJSON / fromJSON — lossless full-state round-trip', () => {
  it('a WDR-loaded driver survives JSON round-trip with byte-identical toWdr (carried fields + ParState)', () => {
    const src = Driver.fromWdr(text);
    const restored = Driver.fromJSON(src.toJSON());
    assert.equal(restored.toWdr(), src.toWdr(),
      'fromJSON(toJSON()) must reproduce every carried field and the ParState exactly');
  });

  it('E/C/N provenance is preserved for every modelled field', () => {
    const src = Driver.fromWdr(text);
    const restored = Driver.fromJSON(src.toJSON());
    for (const f of CELLS) {
      assert.equal(restored.cell(f).state, src.cell(f).state, `cell(${f}).state must survive JSON round-trip`);
    }
  });

  it('a pass-through field (Basket) that raw() drops is carried through JSON', () => {
    // Basket is a dimension slot — present in the .wdr, NOT in #inputs, so raw() omits it.
    const src = Driver.fromWdr(text);
    assert.ok(!('Basket' in (src.raw() as Record<string, unknown>)), 'precondition: raw() drops Basket');
    const restored = Driver.fromJSON(src.toJSON());
    assert.match(restored.toWdr(), /^Basket=/m, 'Basket must survive the JSON round-trip via carried state');
  });

  it('a fresh (fromRaw) driver with no carried WDR round-trips its entered bag', () => {
    const src = Driver.fromRaw({ name: 'X', Fs: 40, Qes: 0.4, Qms: 5, Vas: 0.02, Sd: 0.012, Re: 6 });
    const restored = Driver.fromJSON(src.toJSON());
    assert.deepEqual(restored.raw(), src.raw());
    assert.equal(restored.cell('Qts').state, 'C');   // still derived, not frozen into inputs
  });

  it('an OVERRIDE (entered Cms) stays E through JSON round-trip', () => {
    const src = Driver.fromRaw({ Fs: 37, Qes: 0.4, Qms: 7, Vas: 0.03, Sd: 0.0133, Re: 5.6 });
    src.enter('Cms', 0.001);
    const restored = Driver.fromJSON(src.toJSON());
    assert.equal(restored.cell('Cms').state, 'E');
    assert.equal(restored.cell('Cms').value, 0.001);
  });
});
