/**
 * The sealed box's three linked values, Vb, Fsc and Qtc: each fixes the other two for a driver, so
 * one is entered (E) and the other two are calculated (C). Entering one makes it the E; clearing
 * the E hands that role to Vb, or for a cleared Vb to Qtc (docs/design/FIELD_CLEAR_RULE.md, John
 * 16 Oct 2026, "ok E").
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

interface Cell {
  readonly value: number | null;
  readonly entered: boolean;
  set(v: number): void;
  clear(): void;
}

const letter = (c: Cell): 'E' | 'C' | 'N' => (c.value === null ? 'N' : c.entered ? 'E' : 'C');

const SPEC = {Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05};
const sealed = () => {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, SPEC), engine).sealed().volume_m3(0.03).build().box.sealed;
};

describe('sealed Vb, Fsc and Qtc', () => {
  it('a volume entered: Vb E, Fsc C, Qtc C', () => {
    const s = sealed();
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['E', 'C', 'C']);
  });

  it('Fsc entered: Fsc E at the typed value, Vb C and Qtc C from it', () => {
    const s = sealed();
    s.resonance_hz.set(70);
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['C', 'E', 'C']);
    expect(s.resonance_hz.value).toBe(70);
    expect(s.volume_m3.value).toBeGreaterThan(0);
  });

  it('Fsc cleared: Fsc C at the same value, Vb E at its value, Qtc C', () => {
    const s = sealed();
    s.resonance_hz.set(70);
    const vb = s.volume_m3.value;
    const qtc = s.q_tc.value;
    s.resonance_hz.clear();
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['E', 'C', 'C']);
    expect(s.volume_m3.value).toBe(vb);
    expect(s.resonance_hz.value).toBeCloseTo(70, 6);
    expect(s.q_tc.value).toBeCloseTo(qtc ?? NaN, 9);
  });

  it('a higher Fsc is a smaller box', () => {
    const s = sealed();
    s.resonance_hz.set(60);
    const big = s.volume_m3.value ?? NaN;
    s.resonance_hz.set(90);
    expect(s.volume_m3.value ?? NaN).toBeLessThan(big);
  });

  it('Qtc entered after Fsc: Qtc E, Vb and Fsc C', () => {
    const s = sealed();
    s.resonance_hz.set(70);
    s.q_tc.set(0.8);
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['C', 'C', 'E']);
    expect(s.q_tc.value).toBe(0.8);
  });

  it('Qtc cleared: Qtc C, Vb E at its value, Fsc C', () => {
    const s = sealed();
    s.q_tc.set(0.8);
    const vb = s.volume_m3.value;
    s.q_tc.clear();
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['E', 'C', 'C']);
    expect(s.volume_m3.value).toBe(vb);
  });

  it('a volume entered after Qtc: Vb E, Qtc and Fsc C', () => {
    const s = sealed();
    s.q_tc.set(0.8);
    s.volume_m3.set(0.04);
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['E', 'C', 'C']);
    expect(s.volume_m3.value).toBe(0.04);
  });

  it('Vb cleared: Vb C, Qtc E at its value, Fsc C', () => {
    const s = sealed();
    const qtc = s.q_tc.value;
    s.volume_m3.clear();
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['C', 'C', 'E']);
    expect(s.q_tc.value).toBe(qtc);
    expect(s.volume_m3.value).toBeCloseTo(0.03, 2);
  });

  it('an Fsc at or below the driver Fs fits no box: Fsc E, Vb N, Qtc N', () => {
    const s = sealed();
    s.resonance_hz.set(30);
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['N', 'E', 'N']);
  });
});

describe('a sealed box built from a target Qtc', () => {
  it('has Qtc E at the target, and the volume and Fsc calculated from it', () => {
    const engine = createEngine();
    const s = new ProjectBuilder(driverFromSpec(engine, SPEC), engine).sealed().qtc(0.8).build().box.sealed;
    expect([letter(s.volume_m3), letter(s.resonance_hz), letter(s.q_tc)]).toEqual(['C', 'C', 'E']);
    expect(s.q_tc.value).toBe(0.8);
    expect(s.volume_m3.value).toBeGreaterThan(0);
  });

  it('a stated volume wins over a target Qtc', () => {
    const engine = createEngine();
    const s = new ProjectBuilder(driverFromSpec(engine, SPEC), engine).sealed().volume_m3(0.03).qtc(0.8).build().box.sealed;
    expect([letter(s.volume_m3), letter(s.q_tc)]).toEqual(['E', 'C']);
  });
});
