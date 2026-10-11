import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** John, 2026-10-09 (bugs/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md): a cleared
 *  passive-radiator count or driver count goes back to 1. */
describe('clearing a count', () => {
  const project = () => {
    const engine = createEngine();
    return new ProjectBuilder(driverFromSpec(engine, { Fs_hz: 30, Re_ohm: 8 }), engine).sealed().volume_m3(0.03).build();
  };

  it('a cleared passive-radiator count is 1', () => {
    const p = project();
    p.box.passiveRadiator.count.set(3);

    p.box.passiveRadiator.count.clear();

    expect(p.box.passiveRadiator.count.value).toBe(1);
  });

  it('a cleared driver count is 1', () => {
    const p = project();
    p.nDrivers.set(4);

    p.nDrivers.clear();

    expect(p.nDrivers.value).toBe(1);
  });
});
