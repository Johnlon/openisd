/** projectSweep's free functions over a sweep source: blank boxes of every type, and a source whose
 *  engine stops the sweep. */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import type {Air} from '../../../engine/index.js';
import {ProjectBuilder} from '../../../domain/openisdTransforms.js';
import type {OpenISDProject} from '../../../domain/project/openISDProject.js';
import {sweepPlanOf} from '../../../domain/project/projectSweep.js';
import type {ProjectSweepSource} from '../../../domain/project/projectSweep.js';

const GRID = {fmin: 20, fmax: 2000, N: 20};

/** The source `OpenISDProject` builds for a sweep, over the project's public fields, with `air` and `engine` as given. */
function sourceOf(p: OpenISDProject, engine: ReturnType<typeof createEngine>, air: Air = p.air): ProjectSweepSource {
  return {
    driver: p.driver, box: p.box, nDrivers: p.nDrivers, wiring: p.wiring, Rs_ohm: p.Rs_ohm, circuitModel: p.circuitModel,
    winisdDriverModel: p.winisdDriverModel, winisdVaModel: p.winisdVaModel, winisdWrapPhase: p.winisdWrapPhase,
    winisdDriverCountModel: p.winisdDriverCountModel, winisdFlatModel: p.winisdFlatModel,
    winisdAbcIntraPortVelocity: p.winisdAbcIntraPortVelocity, winisdPrNprResonance: p.winisdPrNprResonance,
    winisdBesselHighpass: p.winisdBesselHighpass, winisdAbcGroupDelay: p.winisdAbcGroupDelay,
    winisdTlPortNoEndCorrection: p.winisdTlPortNoEndCorrection, rgAtDriverSide: p.rgAtDriverSide,
    useTransmissionLinePortModel: p.useTransmissionLinePortModel, forceFlatResponse: p.forceFlatResponse,
    filters: p.filters, driverAddedMass_kg: p.driverAddedMass_kg, vcTempRise_K: p.vcTempRise_K, loading: p.loading,
    alfaVC_per_K: p.alfaVC_per_K, sweepN: p.sweepN, driveVoltage_V: 2.83, air, airIssues: [], engine,
    ventIssues: [], prIssues: [],
  };
}

describe('a box with nothing stated', () => {
  it.each(['sealed', 'vented'] as const)('%s: the enclosure check names what is missing and no sweep runs', type => {
    const p = ProjectBuilder.empty(createEngine());
    p.box.boxType.set(type);
    p.driver.specs.Vas_m3.clear();
    p.box.volumeOf(type).clear();
    expect(p.box.volumeOf(type).value).toBeNull();
    expect(p.boxParamsIssues().length).toBeGreaterThan(0);
    expect(p.sweepPlan(GRID).kind).toBe('blocked');
  });
});

describe('a source that cannot sweep', () => {
  it('blocks on a blank box volume with the engine\'s own issues', () => {
    const engine = createEngine();
    const p = ProjectBuilder.empty(engine);
    p.driver.specs.Vas_m3.clear();
    p.box.volumeOf('sealed').clear();
    const plan = sweepPlanOf(sourceOf(p, engine), GRID);
    expect(plan).toEqual({kind: 'blocked', issues: p.boxParamsIssues()});
  });
});
