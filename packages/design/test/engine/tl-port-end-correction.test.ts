/**
 * "TL port without end correction" (`winisdTlPortNoEndCorrection`): WinISD's transmission-line port
 * drops the port's end correction, so ticking "Use transmission line model" retunes the box
 * (W5 project, Fb 38 Hz: impedance minimum 39.13 Hz with the box lumped, 40.26 Hz with the line).
 * Unticked (the default) OpenISD keeps the end correction, so the line tunes where the Box tab says.
 * Capture: winisd_research runs/vented-w5-tlports and runs/vented-w5-tloff;
 * docs/research/TL_PORT_MODEL.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {createEngine} from '../../engine/Engine.js';
import {WinisdDeviation} from '../../fields/winisdDeviation.js';
import {ToggleField} from '../../fields/field.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';

const engine = createEngine();
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');
const GRID: FrequencyGrid = {fmin: 20, fmax: 80, N: 6001};

function w5Vented(): OpenISDProject {
  const text = readFileSync(join(FIXTURES, 'vented-w5-tlports.wpr'), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  value.winisdDriverModel.set(true);
  value.rgAtDriverSide.set(false);
  value.useTransmissionLinePortModel.set(false);
  return value;
}

/** Frequency of the impedance minimum between the two impedance peaks, Hz. */
function impedanceMinimumHz(p: OpenISDProject): number {
  const sw = p.sweep(GRID).values!;
  let best = -1;
  for (let i = 0; i < sw.fs.length; i++) {
    if (sw.fs[i]! < 32 || sw.fs[i]! > 55) continue;
    if (best < 0 || sw.zmag[i]! < sw.zmag[best]!) best = i;
  }
  return sw.fs[best]!;
}

describe('winisdTlPortNoEndCorrection', () => {
  it('is a bug switch, off in a .wpr import (WinISD has no such key)', () => {
    const p = w5Vented();
    expect(p.winisdTlPortNoEndCorrection.value).toBe(false);
    expect(CompatSwitch.TL_PORT_END_CORRECTION.kind).toBe('bug');
    expect(CompatSwitch.TL_PORT_END_CORRECTION.field).toBe(ToggleField.ADV_WINISDTLPORTNOENDCORRECTION);
    expect(CompatSwitch.TL_PORT_END_CORRECTION.field.label).toBe('TL port without end correction');
  });

  it('on: reproduces WinISD, the impedance minimum moves up to 40.26 Hz', () => {
    const p = w5Vented();
    p.useTransmissionLinePortModel.set(true);
    p.winisdTlPortNoEndCorrection.set(true);
    expect(Math.abs(impedanceMinimumHz(p) - 40.26)).toBeLessThan(0.1);
  });

  it('off (default): the line keeps the end correction, the impedance minimum stays at the lumped 39.13 Hz', () => {
    const lumped = w5Vented();
    lumped.useTransmissionLinePortModel.set(false);
    const line = w5Vented();
    line.useTransmissionLinePortModel.set(true);
    expect(Math.abs(impedanceMinimumHz(lumped) - 39.13)).toBeLessThan(0.1);
    // The pipe's tan() is a little heavier than the lumped mass, so the line sits ~0.4 Hz under the lumped
    // minimum; WinISD's own pipe sits 1.1 Hz over it.
    expect(Math.abs(impedanceMinimumHz(line) - impedanceMinimumHz(lumped))).toBeLessThan(0.5);
  });

  it('is saved with the project, and a file that does not say parses to off', () => {
    const p = w5Vented();
    p.winisdTlPortNoEndCorrection.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdTlPortNoEndCorrection.value).toBe(true);
    const plain = OpenISDProject.fromOwprText(w5Vented().toOwprText(), engine);
    if (Array.isArray(plain)) throw new Error('fromOwprText returned problems: ' + plain.join(', '));
    expect(plain.winisdTlPortNoEndCorrection.value).toBe(false);
  });

  it('the cue by the TL tickbox shows while the switch is off and goes when it is on', () => {
    const p = w5Vented();
    expect(WinisdDeviation.TL_PORT_END_CORRECTION.cueShown(p.errorSwitches)).toBe(true);
    p.winisdTlPortNoEndCorrection.set(true);
    expect(WinisdDeviation.TL_PORT_END_CORRECTION.cueShown(p.errorSwitches)).toBe(false);
  });

  it('applies only with the TL tickbox on and a box with a port the line reads', () => {
    const p = w5Vented();
    expect(p.errorSwitches.tlPortEndCorrection).toEqual({marked: true, applicable: false, inScope: true, reproducesError: false});
    p.useTransmissionLinePortModel.set(true);
    expect(p.errorSwitches.tlPortEndCorrection.applicable).toBe(true);
    for (const box of ['bandpass4', 'bandpass6', 'abc'] as const) {
      p.box.boxType.set(box);
      expect(p.errorSwitches.tlPortEndCorrection, box).toMatchObject({applicable: true, inScope: true});
    }
    for (const box of ['sealed', 'box-passive-radiator'] as const) {
      p.box.boxType.set(box);
      expect(p.errorSwitches.tlPortEndCorrection, box).toMatchObject({applicable: false, inScope: false});
    }
  });
});
