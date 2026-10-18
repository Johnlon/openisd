/**
 * bugs/BUG_20261018_dual-coil-wpr-re-halved.md (T401): a `.wdr` carries ONE Re and ONE BL, both
 * TERMINAL values (WINISD_PARITY.md section 11b, "Reading a .wdr back"). OpenISD stores them per
 * coil, so import divides by the wiring factor and export multiplies it back.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {createEngine} from '../../engine/Engine.js';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import type {OpenISDDriver} from '../../domain/driver/openISDDriver.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => readFileSync(join(here, '..', 'fixtures', 'dual-coil', name), 'utf8');

function importWdr(text: string): OpenISDDriver {
  const imported = new WinIsdDriverConverter(createEngine()).winIsdDriverToOpenIsdDriver(text);
  if (imported.value === null) throw new Error(imported.errors.map(e => e.message).join('; '));
  return imported.value;
}

function exportedRow(driver: OpenISDDriver, key: string): string {
  const out = driver.toWdrIniText();
  if (out.value === null) throw new Error(out.errors.map(e => e.message).join('; '));
  const match = new RegExp(`^${key}=(.*?)\\r?$`, 'm').exec(out.value);
  if (match === null) throw new Error(`no ${key} row`);
  return match[1];
}

describe('dual voice coil .wdr: Re and BL are terminal values', () => {
  it('parallel (VCCon=1): terminal Re and BL equal the file values', () => {
    const p = importWdr(fixture('e150he-44-parallel.wdr')).specs.solverParams();
    expect(p.Re_terminal_ohm.value).toBeCloseTo(6.6, 12);
    expect(p.BL_terminal_Tm.value).toBeCloseTo(9.8, 12);
  });

  it('series (VCCon=2): terminal Re and BL equal the file values', () => {
    const p = importWdr(fixture('e150he-44-series.wdr')).specs.solverParams();
    expect(p.Re_terminal_ohm.value).toBeCloseTo(6.6, 12);
    expect(p.BL_terminal_Tm.value).toBeCloseTo(9.8, 12);
  });

  it('parallel: export writes the terminal Re and BL back', () => {
    const d = importWdr(fixture('e150he-44-parallel.wdr'));
    expect(Number(exportedRow(d, 'Re'))).toBeCloseTo(6.6, 12);
    expect(Number(exportedRow(d, 'BL'))).toBeCloseTo(9.8, 12);
  });

  it('series: export writes the terminal Re and BL back', () => {
    const d = importWdr(fixture('e150he-44-series.wdr'));
    expect(Number(exportedRow(d, 'Re'))).toBeCloseTo(6.6, 12);
    expect(Number(exportedRow(d, 'BL'))).toBeCloseTo(9.8, 12);
  });
});

describe('dual voice coil .wdr: the file is consistent with itself', () => {
  it('parallel: Qes, Re, BL, Fs, Mms raise no inconsistency issue', () => {
    const issues = importWdr(fixture('e150he-44-parallel.wdr')).issues();
    expect(issues.map(i => JSON.stringify(i))).toEqual([]);
  });
});

describe('hand-entered dual voice coil driver', () => {
  const motor = {Fs_hz: 40, Mms_kg: 0.0266, Sd_m2: 0.009503, Qms: 2.94};
  const qesOf = (spec: Record<string, number | VoiceCoilWiring>): number => {
    const qes = driverFromSpec(createEngine(), spec).specs.Qes.value;
    if (qes === null) throw new Error('Qes not solved');
    return qes;
  };

  it('parallel: per-coil Re 6.6, BL 9.8 solves the Qes of a single coil with terminal Re 3.3, BL 9.8', () => {
    const dual = qesOf({...motor, numVC: 2, VCCon: VoiceCoilWiring.Parallel, Re_ohm: 6.6, BL_Tm: 9.8});
    const single = qesOf({...motor, numVC: 1, Re_ohm: 3.3, BL_Tm: 9.8});
    expect(dual).toBeCloseTo(single, 12);
  });

  it('series: per-coil Re 6.6, BL 9.8 solves the Qes of a single coil with terminal Re 13.2, BL 19.6', () => {
    const dual = qesOf({...motor, numVC: 2, VCCon: VoiceCoilWiring.Series, Re_ohm: 6.6, BL_Tm: 9.8});
    const single = qesOf({...motor, numVC: 1, Re_ohm: 13.2, BL_Tm: 19.6});
    expect(dual).toBeCloseTo(single, 12);
  });
});
