import {it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDPassiveRadiatorStandalone} from '../../domain/passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

for (const name of ['p173', 'asp190', 'p220']) it(name, () => {
  const engine = createEngine();
  const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100});
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  const rec = JSON.parse(readFileSync(`../ui/public/drivers/accuton/${name}.json`, 'utf8'));
  const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(rec);
  if (Array.isArray(pr)) throw new Error(pr.join());
  project.box.passiveRadiator.configurePR(pr);
  const s = project.box.passiveRadiator.radiator.spec;
  for (const k of ['Fs_hz', 'Qms', 'Vas_m3', 'Sd_m2', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s'] as const)
    console.log(name, k, s[k].value, 'E=', s[k].entered, 'dq=', JSON.stringify(s[k].dq.map(d => d.kind)));
});
