import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '../../fields/defaults.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** John, 2026-10-09 (bugs/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md): a cleared Rg
 *  goes back to 0.1 ohm. */
describe('clearing Rg', () => {
  it('goes back to 0.1 ohm', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFromSpec(engine, { Fs_hz: 30, Re_ohm: 8 }), engine).sealed().volume_m3(0.03).build();
    p.Rs_ohm.set(4);

    p.Rs_ohm.clear();

    expect(DEFAULT_SOURCE_RESISTANCE_OHM).toBe(0.1);
    expect(p.Rs_ohm.value).toBe(DEFAULT_SOURCE_RESISTANCE_OHM);
  });
});
