import {describe, expect, it} from 'vitest';
import {simpleField} from '../../domain/cell.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {OpenIsdDriverSpec} from '../../domain/driver/openIsdDriverSpec.js';
import type {DriverDeviceJson} from '../../domain/openisdSchema.js';
import {createEngine} from '../../engine/Engine.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();

/** A spec window straight over `record`, with no resolve run on it. */
function specOver(record: DriverDeviceJson): OpenIsdDriverSpec {
  let current = record;
  const slot = simpleField(() => current, next => { current = next; });
  return new OpenIsdDriverSpec(slot, 'woofer', engine.driver, engine.issues, () => REFERENCE_AIR);
}

function blankRecord(): DriverDeviceJson {
  return OpenISDDriver.empty(engine).toOpenIsdDeviceJson();
}

describe('OpenIsdDriverSpec — reads of a record no resolve has touched', () => {
  it('a wiring number the encoding does not define reads as absent', () => {
    const record = blankRecord();
    record.specs.woofer.VCCon = {state: 'E', value: 5};
    const spec = specOver(record);
    expect(spec.VCCon.value).toBeNull();
    expect(spec.VCCon.entered).toBe(false);
    expect(spec.VCCon.calculated).toBe(false);
  });

  it('an unstated coil count is taken as one coil in the terminal Re', () => {
    const record = blankRecord();
    delete record.specs.woofer.numVC;
    const spec = specOver(record);
    expect(spec.numVC.value).toBeNull();
    spec.Re_ohm.set(6);
    expect(spec.solverParams().Re_terminal_ohm.value).toBe(6);
  });
});

describe('OpenIsdDriverSpec.resolve — a range mark on a quantity with no field of its own', () => {
  it('marks the driver\'s Re when its terminal Re is out of range', () => {
    const driver = OpenISDDriver.empty(engine);
    driver.specs.Re_ohm.set(1_000_000);
    expect(driver.specs.Re_ohm.dq.some(issue => issue.kind === 'out-of-range')).toBe(true);
  });
});
