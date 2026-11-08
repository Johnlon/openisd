import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const W5 = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
  Xmax_m: 0.00925, Pe_W: 40,
};

const engine = createEngine();
const build = (): OpenISDProject => new ProjectBuilder(driverFromSpec(engine, W5), engine).sealed().volume_m3(0.00448).build();
const reload = (p: OpenISDProject): OpenISDProject => {
  const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
  if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
  return back;
};

describe('winisdCmsFromVas (option "Cms from Vas")', () => {
  it('is a listed WinISD option, ticked by default', () => {
    expect(CompatSwitch.OPTIONS).toContain(CompatSwitch.CMS_FROM_VAS);
    expect(build().winisdCmsFromVas.value).toBe(true);
  });

  it('ticked round-trips', () => {
    const p = build();
    p.winisdCmsFromVas.set(true);
    expect(reload(p).winisdCmsFromVas.value).toBe(true);
  });

  it('unticked round-trips', () => {
    const p = build();
    p.winisdCmsFromVas.set(false);
    expect(reload(p).winisdCmsFromVas.value).toBe(false);
  });

  it('missing in the file reads as ticked', () => {
    const p = build();
    p.winisdCmsFromVas.set(false);
    const json = JSON.parse(p.toOwprText());
    const strip = (node: unknown): void => {
      if (typeof node !== 'object' || node === null) return;
      Reflect.deleteProperty(node, 'winisdCmsFromVas');
      Object.values(node).forEach(strip);
    };
    strip(json);
    const back = OpenISDProject.fromOwprText(JSON.stringify(json), engine);
    if (Array.isArray(back)) throw new Error(back.join(', '));
    expect(back.winisdCmsFromVas.value).toBe(true);
  });
});
