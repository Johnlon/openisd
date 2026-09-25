import {describe, expect, it} from 'vitest';
import {selectOrigin} from '../../domain/selectOrigin.js';

/** Every value plausible — most tests are not exercising tier 1, so the collaborator says yes
 *  unconditionally unless a test overrides it. */
const alwaysPlausible = () => true;

describe('selectOrigin (D9) — which source wins a field, three tiers', () => {
  it('tier 1: excludes a physically impossible reading even when it outranks the alternative', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 999999}, // impossible — e.g. Fs 999999 Hz
      distributor_datasheet: {read_value: 40},
    };
    const isPlausible = (_field: string, value: number) => value !== 999999;
    expect(selectOrigin(readings, 'Fs_hz', isPlausible)).toBe('distributor_datasheet');
  });

  it('tier 1 fallback: every reading impossible — an origin is still named (highest rank)', () => {
    const readings = {
      distributor_datasheet: {read_value: 999999},
      manufacturer_datasheet: {read_value: 888888},
    };
    expect(selectOrigin(readings, 'Fs_hz', () => false)).toBe('manufacturer_datasheet');
  });

  it('tier 1 fallback: every survivor rejected — falls back to every reading, ranked', () => {
    const readings = {
      distributor_datasheet: {read_value: 40, rejected: 'glyph'},
      manufacturer_datasheet: {read_value: 41, rejected: 'glyph'},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('manufacturer_datasheet');
  });

  it('a rejected reading never wins over a usable one, whatever its rank', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 40, rejected: 'glyph'},
      manual: {read_value: 41},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('manual');
  });

  it('tier 2: a strict majority on read_value wins over a lone higher-ranked outlier', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 40},
      distributor_datasheet: {read_value: 41},
      distributor_product_page: {read_value: 41},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('distributor_datasheet');
  });

  it('a tie in counts is not a majority — falls through to rank', () => {
    const readings = {
      manufacturer_datasheet: {read_value: 40},
      distributor_datasheet: {read_value: 41},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('manufacturer_datasheet');
  });

  it('tier 3: no majority — the most authoritative rank wins', () => {
    const readings = {
      manufacturer_product_page: {read_value: 41},
      manufacturer_datasheet: {read_value: 40},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('manufacturer_datasheet');
  });

  it('tie-break: equal rank (both unranked) sorts alphabetically on role name', () => {
    const readings = {
      beta_role: {read_value: 41},
      alpha_role: {read_value: 40},
    };
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('alpha_role');
  });

  it('a single reading is trivially its own origin', () => {
    const readings = {manual: {read_value: 40}};
    expect(selectOrigin(readings, 'Fs_hz', alwaysPlausible)).toBe('manual');
  });
});
