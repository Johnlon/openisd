/**
 * schemaVersion 3 → 4 (QO908 V4; bugs/BUG_20261114_saved-multicoil-projects-need-upgrade.md).
 * Version 3 stored a multi-coil driver's Re and BL per coil; version 4 stores them as published,
 * for the measured wiring (QO900 R1). For numVC ≥ 2:
 *   - VCCon entered: multiplied back to the measured figures. Series: Re × N, BL × N.
 *     Parallel: Re ÷ N, BL unchanged (the inverse of version 3's per-coil split).
 *   - VCCon calculated (version 3's parallel default, never stated): Re and BL are left as they
 *     are, and VCCon becomes unknown.
 * A single-coil driver's Re and BL are untouched.
 * Every section: VCCon becomes its name (QO914, #514): 1 → "parallel", 2 → "series", any other
 * number → absent (unknown); its precision goes. A calculated VCCon (version 3's default, never
 * stated) is absent, single coil included (QO906.c4: defaulted entries disappear).
 */
import {describe, expect, it} from 'vitest';
import {CURRENT_SCHEMA_VERSION, upgradeToCurrent} from '../../domain/schemaVersion.js';

interface Entry {
  readonly state: 'E' | 'C' | 'N';
  readonly value?: number;
  readonly precision?: number;
}

function v3Driver(woofer: Readonly<Record<string, Entry>>): Record<string, unknown> {
  return {
    schemaVersion: 3,
    uuid: {value: '00000000-0000-4000-8000-000000000788'},
    manufacturer: {value: 'Visaton'}, brand: {value: 'Visaton'}, model: {value: 'GF 250 2 X 4 OHM'},
    sku: {value: ''}, driver_type: {value: ['woofer']}, data_sources: {value: {}},
    specs: {woofer},
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function at(v: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((cur, key) => (isRecord(cur) ? cur[key] : undefined), v);
}

function upgraded(value: unknown): unknown {
  const result = upgradeToCurrent(value);
  if ('refusal' in result) throw new Error(result.refusal);
  return result.value;
}

const woofer = (v: unknown): unknown => at(v, 'specs', 'woofer');

describe('schemaVersion 4: multi-coil Re and BL as published', () => {
  it('the current version is 5 (4 was current until QO941; a version 4 file still upgrades through step 3 to 4)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('VCCon entered series (Visaton GF 250, stored per coil 3.1 Ω / 6.5 Tm): 3.1×2 = 6.2 Ω, 6.5×2 = 13 Tm, precision kept', () => {
    const out = woofer(upgraded(v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'E', value: 2},
      Re_ohm: {state: 'E', value: 3.1, precision: 0.05}, BL_Tm: {state: 'E', value: 6.5, precision: 0.5},
      Fs_hz: {state: 'E', value: 24, precision: 0.5},
    })));
    expect(at(out, 'Re_ohm')).toEqual({state: 'E', value: 6.2, precision: 0.05});
    expect(at(out, 'BL_Tm')).toEqual({state: 'E', value: 13, precision: 0.5});
    expect(at(out, 'VCCon')).toEqual({state: 'E', value: 'series'});
    expect(at(out, 'Fs_hz')).toEqual({state: 'E', value: 24, precision: 0.5});
  });

  it('VCCon entered parallel (E150HE-44 .wdr, file Re 6.6 stored per coil as 13.2): 13.2÷2 = 6.6 Ω, BL 9.8 unchanged', () => {
    const out = woofer(upgraded(v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'E', value: 1},
      Re_ohm: {state: 'E', value: 13.2}, BL_Tm: {state: 'E', value: 9.8},
    })));
    expect(at(out, 'Re_ohm')).toEqual({state: 'E', value: 6.6});
    expect(at(out, 'BL_Tm')).toEqual({state: 'E', value: 9.8});
    expect(at(out, 'VCCon')).toEqual({state: 'E', value: 'parallel'});
  });

  it('VCCon\'s precision goes: a wiring is a name, not a measurement', () => {
    const out = woofer(upgraded(v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'E', value: 2, precision: 0.5},
      Re_ohm: {state: 'E', value: 3.1}, BL_Tm: {state: 'E', value: 6.5},
    })));
    expect(at(out, 'VCCon')).toEqual({state: 'E', value: 'series'});
  });

  it('a VCCon number other than 1 or 2 becomes unknown (absent), Re and BL left as they are', () => {
    const out = woofer(upgraded(v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'E', value: 3},
      Re_ohm: {state: 'E', value: 3.1}, BL_Tm: {state: 'E', value: 6.5},
    })));
    expect(at(out, 'VCCon')).toBeUndefined();
    expect(at(out, 'Re_ohm')).toEqual({state: 'E', value: 3.1});
    expect(at(out, 'BL_Tm')).toEqual({state: 'E', value: 6.5});
  });

  it('a calculated Re or BL is converted the same way as an entered one', () => {
    const out = woofer(upgraded(v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'E', value: 2},
      Re_ohm: {state: 'C', value: 3.1}, BL_Tm: {state: 'C', value: 6.5},
    })));
    expect(at(out, 'Re_ohm')).toEqual({state: 'C', value: 6.2});
    expect(at(out, 'BL_Tm')).toEqual({state: 'C', value: 13});
  });

  it('VCCon calculated (the old parallel default, MX6-22): Re 4.7 and BL 12.3 kept, VCCon unknown', () => {
    const out = woofer(upgraded(v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'C', value: 1},
      Re_ohm: {state: 'E', value: 4.7, precision: 0.05}, BL_Tm: {state: 'E', value: 12.3, precision: 0.05},
    })));
    expect(at(out, 'Re_ohm')).toEqual({state: 'E', value: 4.7, precision: 0.05});
    expect(at(out, 'BL_Tm')).toEqual({state: 'E', value: 12.3, precision: 0.05});
    expect(at(out, 'VCCon')).toBeUndefined();
  });

  it('a single-coil driver: Re and BL untouched; an entered VCCon named; the defaulted VCCon C=1 gone (QO906.c4)', () => {
    const series = {
      numVC: {state: 'E', value: 1}, VCCon: {state: 'E', value: 2},
      Re_ohm: {state: 'E', value: 6.2}, BL_Tm: {state: 'E', value: 13},
    } as const;
    expect(woofer(upgraded(v3Driver(series)))).toEqual({...series, VCCon: {state: 'E', value: 'series'}});
    const defaulted = {
      numVC: {state: 'C', value: 1}, VCCon: {state: 'C', value: 1}, Re_ohm: {state: 'E', value: 6.2},
    } as const;
    expect(woofer(upgraded(v3Driver(defaulted)))).toEqual({numVC: {state: 'C', value: 1}, Re_ohm: {state: 'E', value: 6.2}});
  });

  it('a driver embedded in a project is upgraded, in the saved and the edited state', () => {
    const device = v3Driver({
      numVC: {state: 'E', value: 2}, VCCon: {state: 'E', value: 2},
      Re_ohm: {state: 'E', value: 3.1}, BL_Tm: {state: 'E', value: 6.5},
    });
    const {schemaVersion, ...embedded} = device;
    void schemaVersion;
    const project = {
      schemaVersion: 3, id: 'p1', label: 'GF 250',
      saved: {driverEmbedding: {device: embedded, nDrivers: 1}},
      edited: {driverEmbedding: {device: embedded, nDrivers: 1}},
    };
    const out = upgraded(project);
    for (const state of ['saved', 'edited']) {
      const w = at(out, state, 'driverEmbedding', 'device', 'specs', 'woofer');
      expect(at(w, 'Re_ohm', 'value')).toBe(6.2);
      expect(at(w, 'BL_Tm', 'value')).toBe(13);
      expect(at(w, 'VCCon')).toEqual({state: 'E', value: 'series'});
    }
    expect(at(out, 'schemaVersion')).toBe(5);
  });

  it('a version 2 file goes through 2 → 3 → 4', () => {
    const v2 = {
      ...v3Driver({}),
      specs: {woofer: {
        numVC: {state: 'E', value: 2, origin: 'manufacturer_datasheet', readings: {manufacturer_datasheet: {read_value: 2, read_precision: 0.5}}},
        VCCon: {state: 'E', value: 2, origin: 'manufacturer_datasheet', readings: {manufacturer_datasheet: {read_value: 2}}},
        Re_ohm: {state: 'E', value: 3.1, origin: 'manufacturer_datasheet', readings: {manufacturer_datasheet: {read_value: 6.2, read_precision: 0.05}}},
        BL_Tm: {state: 'E', value: 6.5, origin: 'manufacturer_datasheet', readings: {manufacturer_datasheet: {read_value: 13, read_precision: 0.5}}},
      }},
    };
    const unversioned = Object.fromEntries(Object.entries(v2).filter(([key]) => key !== 'schemaVersion'));
    const out = upgraded(unversioned);
    expect(at(out, 'schemaVersion')).toBe(5);
    expect(at(woofer(out), 'Re_ohm')).toEqual({state: 'E', value: 6.2, precision: 0.05});
    expect(at(woofer(out), 'BL_Tm')).toEqual({state: 'E', value: 13, precision: 0.5});
    expect(at(woofer(out), 'VCCon')).toEqual({state: 'E', value: 'series'});
  });

  it('a version 4 file is not upgraded again', () => {
    const v4 = {...v3Driver({numVC: {state: 'E', value: 2}, Re_ohm: {state: 'E', value: 6.2}}), schemaVersion: 4};
    const w = woofer(v4);
    if (isRecord(w)) w.VCCon = {state: 'E', value: 'series'};
    expect(at(woofer(upgraded(v4)), 'Re_ohm', 'value')).toBe(6.2);
    expect(at(woofer(upgraded(v4)), 'VCCon')).toEqual({state: 'E', value: 'series'});
  });

  it('a version 6 file is refused with the update message (5 is current since QO941)', () => {
    const result = upgradeToCurrent({...v3Driver({}), schemaVersion: 6});
    expect('refusal' in result && result.refusal).toMatch(/update the app/i);
  });
});
