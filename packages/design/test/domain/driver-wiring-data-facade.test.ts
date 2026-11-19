/**
 * Several-driver wiring, slice 2 "Data, inert" (plan docs/plans/PLAN_20261116_DRIVER_WIRING.md section 4,
 * ticket 519; QO946.c129-c131): the project saves and loads `driverWiring` (parallel or series, in
 * `driverEmbedding`) and `winisdOneDriverImpedance` (a boolean, `advanced`). Nothing reads them yet.
 */
import {describe, expect, it} from 'vitest';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {sealedProject} from '../fixtures/domainBuilders.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function opened(text: string): OpenISDProject {
  const back = OpenISDProject.fromOwprText(text, createEngine());
  if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
  return back;
}

function sectionOf(text: string, name: 'driverEmbedding' | 'advanced'): Record<string, unknown> {
  const session: unknown = JSON.parse(text);
  const section = isRecord(session) && isRecord(session.saved) ? session.saved[name] : undefined;
  if (!isRecord(section)) throw new Error(`no ${name} in the saved project`);
  return section;
}

describe('driver wiring data (slice 2, inert)', () => {
  it('a new project is wired Parallel with "Impedance of one driver" off', () => {
    const p = sealedProject();
    expect(p.driverWiring.value).toBe('parallel');
    expect(p.winisdOneDriverImpedance.value).toBe(false);
  });

  it('both choices are saved in the .owpr text and read back (Series, one-driver impedance on)', () => {
    const p = sealedProject();
    p.nDrivers.set(4);
    p.driverWiring.set('series');
    p.winisdOneDriverImpedance.set(true);
    p.save();
    const text = p.toOwprText();
    expect(sectionOf(text, 'driverEmbedding').driverWiring).toBe('series');
    expect(sectionOf(text, 'advanced').winisdOneDriverImpedance).toBe(true);
    const back = opened(text);
    expect(back.driverWiring.value).toBe('series');
    expect(back.winisdOneDriverImpedance.value).toBe(true);
  });

  it('both choices survive browser storage text too', () => {
    const p = sealedProject();
    p.driverWiring.set('series');
    p.winisdOneDriverImpedance.set(true);
    p.save();
    const back = opened(p.toStoredText());
    expect(back.driverWiring.value).toBe('series');
    expect(back.winisdOneDriverImpedance.value).toBe(true);
  });

  it('a choice made at one driver is kept, so a later count change brings it back', () => {
    const p = sealedProject();
    p.nDrivers.set(1);
    p.driverWiring.set('series');
    p.save();
    expect(opened(p.toOwprText()).driverWiring.value).toBe('series');
  });

  it('every save writes both keys, also at one driver and also when nothing was chosen (plan 4.1)', () => {
    const p = sealedProject();
    p.save();
    for (const text of [p.toOwprText(), p.toStoredText()]) {
      expect(sectionOf(text, 'driverEmbedding').driverWiring).toBe('parallel');
      expect(sectionOf(text, 'advanced').winisdOneDriverImpedance).toBe(false);
    }
  });

  it('a file from before the keys existed (neither key) opens Parallel with the switch off', () => {
    const p = sealedProject();
    p.save();
    const text = p.toOwprText().replace(/,?\s*"driverWiring": "parallel"/, '').replace(/,?\s*"winisdOneDriverImpedance": false/, '');
    expect(text).not.toMatch(/driverWiring|winisdOneDriverImpedance/);
    const back = opened(text);
    expect(back.driverWiring.value).toBe('parallel');
    expect(back.winisdOneDriverImpedance.value).toBe(false);
  });

  it('a value that is not parallel or series is refused by the schema', () => {
    const p = sealedProject();
    p.save();
    const text = p.toOwprText().replace(/"driverWiring": "parallel"/, '"driverWiring": "star"');
    expect(text).toMatch(/"driverWiring": "star"/);
    expect(Array.isArray(OpenISDProject.fromOwprText(text, createEngine()))).toBe(true);
  });

  it('the old coil-wiring key is never read as Driver wiring (plan 4.3)', () => {
    const p = sealedProject();
    p.save();
    const text = p.toOwprText().replace(/"nDrivers": 1,/, '"nDrivers": 1, "VCCon": "series",');
    const back = opened(text);
    expect(back.driverWiring.value).toBe('parallel');
  });
});

describe('CompatSwitch per-switch default (QO946.c131)', () => {
  it('"Impedance of one driver" is an option that is OFF for a new project and a file that does not say', () => {
    const sw = CompatSwitch.ONE_DRIVER_IMPEDANCE;
    expect(sw.kind).toBe('option');
    expect(sw.winisdValue).toBe(false);
    expect(sw.of(sealedProject()).value).toBe(false);
  });

  it('it and "Chart from Fs, Vas, Qms" (John, QO539: picked B) are the only options off by default: every other option stays ticked, every bug unticked', () => {
    const off = CompatSwitch.OPTIONS.filter(s => !s.winisdValue);
    expect(off).toEqual([CompatSwitch.CHART_FROM_FS_VAS_QMS, CompatSwitch.ONE_DRIVER_IMPEDANCE]);
    for (const s of CompatSwitch.BUGS) expect(s.winisdValue, s.field.label).toBe(false);
  });
});

describe('CompatSwitch per-switch default (QO946.c131)', () => {
  it('"Impedance of one driver" is an option that is OFF for a new project and a file that does not say', () => {
    const sw = CompatSwitch.ONE_DRIVER_IMPEDANCE;
    expect(sw.kind).toBe('option');
    expect(sw.winisdValue).toBe(false);
    expect(sw.of(sealedProject()).value).toBe(false);
  });

  it('it and "Chart from Fs, Vas, Qms" (John, QO539: picked B) are the only options off by default: every other option stays ticked, every bug unticked', () => {
    const off = CompatSwitch.OPTIONS.filter(s => !s.winisdValue);
    expect(off).toEqual([CompatSwitch.CHART_FROM_FS_VAS_QMS, CompatSwitch.ONE_DRIVER_IMPEDANCE]);
    for (const s of CompatSwitch.BUGS) expect(s.winisdValue, s.field.label).toBe(false);
  });
});

describe('CompatSwitch per-switch default (QO946.c131)', () => {
  it('"Impedance of one driver" is an option that is OFF for a new project and a file that does not say', () => {
    const sw = CompatSwitch.ONE_DRIVER_IMPEDANCE;
    expect(sw.kind).toBe('option');
    expect(sw.winisdValue).toBe(false);
    expect(sw.of(sealedProject()).value).toBe(false);
  });

  it('it and "Chart from Fs, Vas, Qms" (John, QO539: picked B) are the only options off by default: every other option stays ticked, every bug unticked', () => {
    expect(CompatSwitch.OPTIONS.filter(s => !s.winisdValue)).toEqual([CompatSwitch.CHART_FROM_FS_VAS_QMS, CompatSwitch.ONE_DRIVER_IMPEDANCE]);
    for (const s of CompatSwitch.BUGS) expect(s.winisdValue, s.field.label).toBe(false);
  });
});
