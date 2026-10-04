import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDDriverStandalone} from '../../domain/index.js';

describe('OpenISDDriverStandalone.setAutoCalculate — freezes the resolve cascade (driver editor only)', () => {
  function standaloneEmpty(engine: Engine): OpenISDDriverStandalone {
    const d = OpenISDDriver.empty(engine);
    if (!(d instanceof OpenISDDriverStandalone)) throw new Error('OpenISDDriver.empty() always returns a standalone driver');
    return d;
  }

  it('defaults to on', () => {
    const d = standaloneEmpty(createEngine());
    expect(d.autoCalculate).toBe(true);
  });

  it('off freezes a calculated field at its last value when the input it depended on is cleared', () => {
    const d = standaloneEmpty(createEngine());
    d.specs.Fs_hz.set(40);
    d.specs.Cms_m_per_N.set(0.001);
    const derivedMms = d.specs.Mms_kg.value;
    expect(derivedMms).not.toBeNull();

    d.setAutoCalculate(false);
    d.specs.Cms_m_per_N.clear();

    expect(d.specs.Cms_m_per_N.value).toBe(null);
    expect(d.specs.Mms_kg.value).toBe(derivedMms);
  });

  it('turning back on immediately re-derives, dropping a value that can no longer be reached', () => {
    const d = standaloneEmpty(createEngine());
    d.specs.Fs_hz.set(40);
    d.specs.Cms_m_per_N.set(0.001);
    d.setAutoCalculate(false);
    d.specs.Cms_m_per_N.clear();

    d.setAutoCalculate(true);

    expect(d.specs.Mms_kg.value).toBe(null);
  });

  it('entering a new value while off is still accepted — off blocks the solver, not the owner', () => {
    const d = standaloneEmpty(createEngine());
    d.setAutoCalculate(false);
    d.specs.Fs_hz.set(55);
    expect(d.specs.Fs_hz.value).toBe(55);
    expect(d.specs.Fs_hz.entered).toBe(true);
  });
});
