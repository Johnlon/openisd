import {describe, expect, it} from 'vitest';
import {selectOrigin} from '../../domain/selectOrigin.js';

/** Every value plausible — most tests are not exercising tier 1, so the collaborator says yes
 *  unconditionally unless a test overrides it. */
const alwaysPlausible = () => true;

describe('selectOrigin — which source wins a field, four tiers', () => {
  it('impossible dropped: excludes a physically impossible reading even when it outranks the alternative', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 999999}, // impossible — e.g. Fs 999999 Hz
      distributor_datasheet: {read_value: 40},
    };
    const isPlausible = (_field: string, value: number) => value !== 999999;
    expect(selectOrigin(readings, 'Fs_hz', isPlausible)).toMatchObject({kind: 'winner', role: 'distributor_datasheet'});
  });

  it('rejected dropped: a rejected reading never wins over a usable one, whatever its rank', () => {
    const readings = {
      manufacturer_datasheet: {actual_reading: 'N/A', rejected: 'no-numeric-value'},
      manual: {read_value: 41},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'manual'});
  });

  it('3 readings 2 agree -> majority wins over rank', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 40},
      distributor_datasheet: {read_value: 41},
      distributor_product_page: {read_value: 41},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'distributor_datasheet'});
  });

  it('2/1/1 -> falls to rank (2 of 4 is not more than half)', () => {
    const readings = {
      manufacturer_product_page: {read_value: 41},
      distributor_datasheet: {read_value: 41},
      distributor_product_page: {read_value: 42},
      manual: {read_value: 43},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'manufacturer_product_page'});
  });

  it('4 survivors 2/2 -> rank (neither value has strict majority)', () => {
    const readings = {
      manufacturer_product_page: {read_value: 41},
      distributor_datasheet: {read_value: 41},
      distributor_product_page: {read_value: 42},
      manual: {read_value: 42},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'manufacturer_product_page'});
  });

  it('5 survivors 3/1/1 -> majority (3 of 5 is more than half)', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 40},
      distributor_datasheet: {read_value: 41},
      distributor_product_page: {read_value: 41},
      distributor_listing_page: {read_value: 41},
      manual: {read_value: 42},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'distributor_datasheet'});
  });

  it('one survivor -> it wins', () => {
    const readings = {manual: {read_value: 40}};
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'manual'});
  });

  it('all impossible -> none (old fallbacks deleted)', () => {
    const readings = {
      distributor_datasheet: {read_value: 999999},
      manufacturer_datasheet: {read_value: 888888},
    };
    expect(selectOrigin(readings, 'Fs_hz', () => false)).toEqual({kind: 'none'});
  });

  it('all rejected -> none (old fallbacks deleted)', () => {
    const readings = {
      distributor_datasheet: {actual_reading: 'N/A', rejected: 'no-numeric-value'},
      manufacturer_datasheet: {actual_reading: 'banana', rejected: 'no-numeric-value'},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toEqual({kind: 'none'});
  });

  it('mix impossible+rejected only -> none', () => {
    const readings = {
      distributor_datasheet: {read_value: 999999},
      manufacturer_datasheet: {actual_reading: 'banana', rejected: 'no-numeric-value'},
    };
    const isPlausible = (_field: string, value: number) => value !== 999999;
    expect(selectOrigin(readings, 'Fs_hz', isPlausible)).toEqual({kind: 'none'});
  });

  it('tier 3: no majority — the most authoritative rank wins', () => {
    const readings = {
      manufacturer_product_page: {read_value: 41},
      manufacturer_datasheet: {read_value: 40},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'manufacturer_datasheet'});
  });

  it('tie-break: equal rank (both unranked) sorts alphabetically on role name', () => {
    const readings = {
      beta_role: {read_value: 41},
      alpha_role: {read_value: 40},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'alpha_role'});
  });
});

describe('selectOrigin — ties on source rank', () => {
  it('unranked roles tie on rank and the alphabetically first wins when no value has a majority', () => {
    const readings = {
      zeta: {read_value: 1},
      alpha: {read_value: 2},
      mid: {read_value: 3},
      beta: {read_value: 4},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'alpha', reading: {read_value: 2}});
  });

  it('the best-ranked source carrying the majority value is the one named', () => {
    const readings = {
      manual: {read_value: 41},
      distributor_datasheet: {read_value: 41},
      manufacturer_datasheet: {read_value: 40},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toMatchObject({kind: 'winner', role: 'distributor_datasheet'});
  });
});
