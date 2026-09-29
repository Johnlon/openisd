/**
 * "Rear port - Gain" and "Front port - Gain" for the 6th-order bandpass and ABC boxes, matched to
 * WinISD's own plotted values. Golden data: `../fixtures/winisdBp6PortGainCapture.ts` and
 * `../fixtures/winisdAbcPortGainCapture.ts`, logged from the `.wpr` each block imports.
 * bugs/BUG_20260929_bp6-abc-port-gain-charts-missing.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_BP6_PORT_GAIN_CAPTURE as BP6, type WinIsdPlottedPoint} from '../fixtures/winisdBp6PortGainCapture.js';
import {WINISD_ABC_PORT_GAIN_CAPTURE as ABC} from '../fixtures/winisdAbcPortGainCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');

function project(wpr: string): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, wpr), 'utf8'));
  if (value === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  value.winisdDriverModel.set(true);
  value.rgAtDriverSide.set(false);
  return value;
}

function assertMatches(name: string, got: readonly number[] | null, want: readonly WinIsdPlottedPoint[], step: number): void {
  assert.ok(got !== null, `${name}: OpenISD has no such chart`);
  want.forEach((point, k) => {
    const v = got[k * step]!;
    assert.ok(Math.abs(v - point.v) <= 1e-12 * Math.max(1, Math.abs(point.v)), `${name} @ ${point.f} Hz: got ${v}, WinISD ${point.v}`);
  });
}

describe('6th-order bandpass port gains match WinISD (bp6-w5-base2)', () => {
  const sw = project('bp6-w5-base2.wpr').sweep(BP6.grid).values!;
  it('rear port gain', () => assertMatches('rear port gain', sw.rearPortGain, BP6.rearPortGain_dB, BP6.step));
  it('front port gain', () => assertMatches('front port gain', sw.frontPortGain, BP6.frontPortGain_dB, BP6.step));
});

describe('ABC port gains match WinISD (abc-w5-base2)', () => {
  const sw = project('abc-w5-base2.wpr').sweep(ABC.grid).values!;
  it('rear port gain', () => assertMatches('rear port gain', sw.rearPortGain, ABC.rearPortGain_dB, ABC.step));
  it('front port gain', () => assertMatches('front port gain', sw.frontPortGain, ABC.frontPortGain_dB, ABC.step));
});
