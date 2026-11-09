/**
 * T744 (QO463): one rule for Cms on drivers and radiators.
 *  - A typed Cms always moves the charts, and typing Cms works out Vas (typed last wins).
 *  - A datasheet that states both Cms and Vas and they disagree: the option "Cms from Vas"
 *    (CompatSwitch.CMS_FROM_VAS, ticked by default) decides which the charts use.
 *    Ticked: Cms worked out from Vas. Unticked: the stated Cms. Either way a warning shows.
 *  - The Cms the box shows is the Cms the sweep uses, in every case.
 * Red until T744 steps 2-7 land; the switch does not exist yet.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {driverSpecsOf} from '../../domain/openisdSchema.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';
import {fixedAppContext} from '../fixtures/domainBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 2000, N: 40};

/** Driver figures that leave Cms and Vas open (Cms is added or worked out per case). */
const DRIVER_BASE = {Fs_hz: 30, Qes: 0.4, Qms: 4, Re_ohm: 6.4, Sd_m2: 0.02, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100};
const RADIATOR_BASE = {Fs_hz: 30, Qms: 3.3, Sd_m2: 0.0095};

type Kind = 'driver' | 'radiator';

interface Rig {
  readonly project: OpenISDProject;
  readonly cms: () => number | null;
  readonly vas: () => number | null;
  readonly cmsNotes: () => readonly string[];
  readonly cmsWarned: () => boolean;
  readonly setCms: (v: number) => void;
  readonly spl: () => readonly number[];
}

/** The switch, reached through CompatSwitch so a missing switch fails with a clear message at run time. */
function cmsFromVasSwitch(): CompatSwitch {
  const found = Reflect.get(CompatSwitch, 'CMS_FROM_VAS');
  if (!(found instanceof CompatSwitch)) throw new Error('CompatSwitch.CMS_FROM_VAS does not exist yet (T744 step 2)');
  return found;
}

function rig(kind: Kind, stated: Record<string, number>, engine: Engine = createEngine()): Rig {
  const driverSpec = kind === 'driver' ? {...DRIVER_BASE, ...stated} : {...DRIVER_BASE, Vas_m3: 0.05};
  const project = new ProjectBuilder(driverFromSpec(engine, driverSpec), engine).sealed().volume_m3(0.03).build();
  if (kind === 'radiator') {
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {...RADIATOR_BASE, ...stated}));
    project.box.passiveRadiator.count.set(1);
  }
  const spec = () => kind === 'driver' ? project.driver.specs : project.box.passiveRadiator.radiator.spec;
  return {
    project,
    cms: () => spec().Cms_m_per_N.value,
    vas: () => spec().Vas_m3.value,
    cmsNotes: () => spec().Cms_m_per_N.dq.map(i => i.text),
    cmsWarned: () => spec().Cms_m_per_N.dq.some(i => i.kind === 'inconsistent-inputs'),
    setCms: v => spec().Cms_m_per_N.set(v),
    spl: () => {
      const r = project.sweep(GRID);
      if (r.values === null) throw new Error(JSON.stringify(r.issues.map(i => i.text)));
      return r.values.spl;
    },
  };
}

const worst = (a: readonly number[], b: readonly number[]): number => Math.max(...a.map((x, i) => Math.abs(x - b[i]!)));
const VAS = {driver: 0.05, radiator: 0.0048};

/** Vas -> Cms ratio the engine uses, read off a rig that states Vas only. */
function cmsOfVas(kind: Kind, vas: number): number {
  const c = rig(kind, {Vas_m3: vas}).cms();
  if (c === null) throw new Error('Cms not worked out from Vas');
  return c;
}

/** (f) The sweep uses the box's Cms: a project stating that Cms and the matching Vas sweeps identically. */
function expectBoxIsSweep(kind: Kind, r: Rig): void {
  const boxCms = r.cms();
  expect(boxCms).not.toBeNull();
  const k = VAS[kind] / cmsOfVas(kind, VAS[kind]);
  const agreeing = rig(kind, {Cms_m_per_N: boxCms!, Vas_m3: boxCms! * k});
  expect(worst(r.spl(), agreeing.spl()), 'sweep uses the Cms the box shows').toBeLessThan(1e-9);
}

describe.each<Kind>(['driver', 'radiator'])('Cms from Vas: %s', (kind) => {
  const vas = VAS[kind];
  const consistentCms = () => cmsOfVas(kind, vas);
  const disagreeing = () => ({Vas_m3: vas, Cms_m_per_N: consistentCms() * 1.5});

  it('(a) a typed Cms moves the SPL sweep', () => {
    const r = rig(kind, {Vas_m3: vas, Cms_m_per_N: consistentCms()});
    const before = r.spl();
    r.setCms(consistentCms() * 1.5);
    expect(worst(before, r.spl())).toBeGreaterThan(1e-6);
    expectBoxIsSweep(kind, r);
  });

  it('(b) typing Cms drops the entered Vas: it is worked out again, and the typed Cms stands', () => {
    // WinISD keeps the entered Vas and ignores the typed Cms in its charts (runs/cms_mms_rms_bl_edit_e150he); OpenISD lets the typed Cms move the charts.
    const r = rig(kind, {Vas_m3: vas, Cms_m_per_N: consistentCms()});
    r.setCms(consistentCms() * 1.5);
    expect(r.cms()).toBeCloseTo(consistentCms() * 1.5, 12);
    expect(r.vas()).not.toBeNull();
  });

  it('(c) both stated and disagreeing, "Cms from Vas" ticked (default): charts and box use Cms from Vas, warning shown', () => {
    const r = rig(kind, disagreeing());
    const fromVasOnly = rig(kind, {Vas_m3: vas});
    expect(r.cms()).toBeCloseTo(consistentCms(), 9);
    expect(worst(r.spl(), fromVasOnly.spl())).toBeLessThan(1e-9);
    expect(r.cmsWarned()).toBe(true);
    expectBoxIsSweep(kind, r);
    expect(cmsFromVasSwitch().of(rig(kind, disagreeing()).project).value, 'default is ticked').toBe(true);
  });

  it('(d) both stated and disagreeing, "Cms from Vas" unticked: charts and box use the stated Cms, warning shown', () => {
    const r = rig(kind, disagreeing());
    cmsFromVasSwitch().of(r.project).set(false);
    const statedOnly = rig(kind, {Cms_m_per_N: consistentCms() * 1.5, Vas_m3: vas * 1.5});
    expect(r.cms()).toBeCloseTo(consistentCms() * 1.5, 9);
    expect(worst(r.spl(), statedOnly.spl())).toBeLessThan(1e-9);
    expect(r.cmsWarned()).toBe(true);
    expectBoxIsSweep(kind, r);
  });

  it('(g) the warning says the datasheet value, the value the charts use and what to untick', () => {
    const r = rig(kind, disagreeing());
    expect(r.cmsNotes()).toHaveLength(1);
    expect(r.cmsNotes()[0]).toMatch(/^Datasheet Cms is [\d.]+ mm\/N\. It does not agree with Vas, so the charts use [\d.]+ mm\/N, worked out from Vas\. Untick Cms from Vas to use the datasheet value\.$/);
  });

  it('(h) saved and reloaded, the datasheet Cms is still the stated, entered figure and the box still shows the charts\' Cms', () => {
    if (kind === 'radiator') return; // the radiator's record is read in step 6/7
    const r = rig(kind, disagreeing());
    const shown = r.cms();
    r.project.save();
    const reloaded = OpenISDProject.wrap(r.project.cloneSavedProject(), createEngine(), fixedAppContext('cms-from-vas'));
    const stored = driverSpecsOf(r.project.cloneSavedProject().driverEmbedding.device)?.woofer.Cms_m_per_N;
    expect(stored).toEqual({state: 'E', value: consistentCms() * 1.5});
    expect(reloaded.driver.specs.Cms_m_per_N.value).toBeCloseTo(shown!, 12);
    expect(reloaded.driver.specs.Cms_m_per_N.calculated).toBe(true);
  });
});

/** QO477 = A (John, 8 Nov 2026): a datasheet that states Vas and efficiency (η0), a Cms typed on top. */
describe('E150HE-style datasheet stating Vas and η0, Cms typed (QO477 = A)', () => {
  const E150HE = {Fs_hz: 40, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6, Sd_m2: 0.009503, Vas_m3: 0.007645536, no: 0.0010574424313046884, Xmax_m: 0.008, Pe_W: 100};
  const TYPED_CMS = 0.00069;

  function typed() {
    const engine = createEngine();
    const project = new ProjectBuilder(driverFromSpec(engine, E150HE), engine).sealed().volume_m3(0.03).build();
    project.driver.specField('Cms_m_per_N').set(TYPED_CMS);
    return project;
  }

  it('Vas follows the typed Cms (Vas = ρ·c²·Sd²·Cms) and is no longer an entered value', () => {
    const {Vas_m3, Cms_m_per_N, Sd_m2, roo_kg_per_m3, c_m_per_s} = typed().driver.specs;
    expect(Vas_m3.entered).toBe(false);
    expect(Vas_m3.value).toBeCloseTo(roo_kg_per_m3.value! * c_m_per_s.value! ** 2 * Sd_m2.value! ** 2 * Cms_m_per_N.value!, 9);
    expect(Vas_m3.dq).toEqual([]);
  });

  it('η0 is shown as calculated, not entered, and agrees with the Vas shown', () => {
    const {no} = typed().driver.specs;
    expect(no.entered).toBe(false);
    expect(no.calculated).toBe(true);
    expect(no.dq).toEqual([]);
  });

  it('the typed Cms stands in the box and the SPL sweep uses it', () => {
    const project = typed();
    expect(project.driver.specs.Cms_m_per_N.value).toBe(TYPED_CMS);
    const engine = createEngine();
    const stated = new ProjectBuilder(driverFromSpec(engine, {...E150HE, Cms_m_per_N: TYPED_CMS, Vas_m3: project.driver.specs.Vas_m3.value!}), engine).sealed().volume_m3(0.03).build();
    expect(worst(project.sweep(GRID).values!.spl, stated.sweep(GRID).values!.spl)).toBeLessThan(1e-9);
  });
});
