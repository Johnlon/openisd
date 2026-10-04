/**
 * The error switches: controls that reproduce a known WinISD error. The design package says which
 * controls are marked, whether each applies to the open box, and whether it is reproducing the
 * error now; the UI only reads these.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {LossMode} from '../../fields/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();

function abcProject(): OpenISDProject {
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

describe('errorSwitches', () => {
  it('ABC velocity: marked, applicable on an ABC box only, reproducing the error while ticked (the default)', () => {
    const p = abcProject();
    expect(p.errorSwitches.abcIntraPortVelocity).toEqual({marked: true, applicable: true, reproducesError: true});
    p.winisdAbcIntraPortVelocity.set(false);
    expect(p.errorSwitches.abcIntraPortVelocity).toEqual({marked: true, applicable: true, reproducesError: false});
    p.box.boxType.set('vented');
    expect(p.errorSwitches.abcIntraPortVelocity.applicable).toBe(false);
    expect(p.errorSwitches.abcIntraPortVelocity.marked).toBe(true);
  });

  it('driver model and VA model: always marked and applicable, reproducing the error while ticked', () => {
    const p = abcProject();
    p.winisdDriverModel.set(true);
    p.winisdVaModel.set(false);
    expect(p.errorSwitches.driverModel).toEqual({marked: true, applicable: true, reproducesError: true});
    expect(p.errorSwitches.vaModel).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdVaModel.set(true);
    p.winisdDriverModel.set(false);
    expect(p.errorSwitches.vaModel.reproducesError).toBe(true);
    expect(p.errorSwitches.driverModel.reproducesError).toBe(false);
  });

  it('PR Npr resonance: marked and applicable on a passive radiator box only, reproducing the error only when ticked', () => {
    const p = abcProject();
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: false, reproducesError: false});
    p.box.boxType.set('box-passive-radiator');
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: true, reproducesError: false});
    p.winisdPrNprResonance.set(true);
    expect(p.errorSwitches.prNprResonance).toEqual({marked: true, applicable: true, reproducesError: true});
  });

  it('loss model: not an error switch, whatever the box and model', () => {
    const p = abcProject();
    p.lossMode.set(LossMode.parse('winisd-lossy'));
    p.box.boxType.set('box-passive-radiator');
    expect('prLossModel' in p.errorSwitches).toBe(false);
  });
});
