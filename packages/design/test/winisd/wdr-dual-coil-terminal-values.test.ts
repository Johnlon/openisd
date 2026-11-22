/**
 * A `.wdr` carries ONE Re and ONE BL, the whole driver's in the file's own `VCCon` wiring.
 * OpenISD stores them as they are (QO900 R1; supersedes the per-coil basis of T401,
 * bugs/BUG_20261114_engine-per-coil-basis.md): import takes Re/BL as-is and keeps VCCon as the
 * measured wiring, export writes the stored figures back. The round trip is exact.
 *
 * VCCon's mark (QO900 R1, bugs/BUG_20261114_wdr-default-vccon-marked-entered.md): E when the
 * wiring is stated, C (value 1) when it is not.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinISDDriver} from '@openisd/design/winisd';
import {createEngine} from '../../engine/Engine.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import type {OpenISDDriver} from '../../domain/driver/openISDDriver.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => readFileSync(join(here, '..', 'fixtures', 'dual-coil', name), 'utf8');

function importWdr(text: string): OpenISDDriver {
  const imported = new DriverRecordConverter(createEngine()).winIsdDriverToOpenIsdDriver(text);
  if (imported.value === null) throw new Error(imported.errors.map(e => e.message).join('; '));
  return imported.value;
}

function exported(driver: OpenISDDriver): WinISDDriver {
  const out = driver.toWdrIniText();
  if (out.value === null) throw new Error(out.errors.map(e => e.message).join('; '));
  return WinISDDriver.fromWdrIni(out.value);
}

describe('dual voice coil .wdr: Re and BL are stored as the file states them', () => {
  it.each(['e150he-44-parallel.wdr', 'e150he-44-series.wdr'])('%s: Re 6.6, BL 9.8 stored and read by the sweep as-is', (name) => {
    const d = importWdr(fixture(name));
    expect(d.specs.Re_ohm.value).toBe(6.6);
    expect(d.specs.BL_Tm.value).toBe(9.8);
    const p = d.specs.solverParams();
    expect(p.Re_terminal_ohm.value).toBe(6.6);
    expect(p.BL_terminal_Tm.value).toBe(9.8);
  });

  it('the file\'s VCCon is kept as the measured wiring, entered', () => {
    expect(importWdr(fixture('e150he-44-parallel.wdr')).specs.VCCon.value).toBe(VoiceCoilWiring.Parallel);
    const series = importWdr(fixture('e150he-44-series.wdr')).specs.VCCon;
    expect(series.value).toBe(VoiceCoilWiring.Series);
    expect(series.entered).toBe(true);
  });

  it.each(['e150he-44-parallel.wdr', 'e150he-44-series.wdr'])('%s: export writes Re 6.6 and BL 9.8 back, marked E', (name) => {
    const w = exported(importWdr(fixture(name)));
    expect(w.cell('Re')).toEqual({value: '6.6', state: 'entered'});
    expect(w.cell('BL')).toEqual({value: '9.8', state: 'entered'});
  });
});

describe('dual voice coil .wdr: the file is consistent with itself', () => {
  it.each(['e150he-44-parallel.wdr', 'e150he-44-series.wdr'])('%s: no issue at all', (name) => {
    expect(importWdr(fixture(name)).issues().map(i => JSON.stringify(i))).toEqual([]);
  });
});

describe('hand-entered dual voice coil driver', () => {
  const motor = {Fs_hz: 40, Mms_kg: 0.0266, Sd_m2: 0.009503, Qms: 2.94, Re_ohm: 6.6, BL_Tm: 9.8};
  const qesOf = (spec: Record<string, number | VoiceCoilWiring>): number => {
    const qes = driverFromSpec(createEngine(), spec).specs.Qes.value;
    if (qes === null) throw new Error('Qes not solved');
    return qes;
  };
  // Qes = 2π·Fs·Mms·Re/BL² = 2π·40·0.0266·6.6/9.8² = 0.4605, whatever the coil count or wiring.
  it.each([
    [VoiceCoilWiring.Parallel],
    [VoiceCoilWiring.Series],
  ])('%s, 2 coils: Qes from the stated Re and BL, 0.4605', (wiring) => {
    expect(qesOf({...motor, numVC: 2, VCCon: wiring})).toBeCloseTo(2 * Math.PI * 40 * 0.0266 * 6.6 / (9.8 * 9.8), 12);
    expect(qesOf({...motor, numVC: 2, VCCon: wiring})).toBeCloseTo(qesOf({...motor, numVC: 1}), 12);
  });
});

describe('.wdr VCCon mark', () => {
  const base = {Fs_hz: 40, Mms_kg: 0.0266, Sd_m2: 0.009503, Qms: 2.94, Re_ohm: 6.6, BL_Tm: 9.8, numVC: 2};

  it('wiring not stated: VCCon=1 marked C', () => {
    expect(exported(driverFromSpec(createEngine(), base)).cell('VCCon')).toEqual({value: '1', state: 'calculated'});
  });

  it.each([
    [VoiceCoilWiring.Parallel, '1'],
    [VoiceCoilWiring.Series, '2'],
  ])('wiring stated %s: VCCon=%s marked E', (wiring, value) => {
    expect(exported(driverFromSpec(createEngine(), {...base, VCCon: wiring})).cell('VCCon')).toEqual({value, state: 'entered'});
  });

  it('an unstated wiring exported as C reads back unstated, not as an entered parallel', () => {
    const back = importWdr(driverFromSpec(createEngine(), base).toWdrIniText().value ?? '');
    expect(back.specs.VCCon.entered).toBe(false);
    expect(back.specs.VCCon.value).toBeNull();
  });

  it('numVC not stated: numVC=1 marked C, and reads back unstated', () => {
    const {numVC, ...single} = base;
    void numVC;
    const d = driverFromSpec(createEngine(), single);
    expect(exported(d).cell('numVC')).toEqual({value: '1', state: 'calculated'});
    expect(importWdr(d.toWdrIniText().value ?? '').specs.numVC.value).toBeNull();
  });
});
