import type {OpenISDProject} from '../../../domain/index.js';
import type {CompatArea} from '../harness.js';

const FILE = 'passive-radiator.wpr';
const spec = (p: OpenISDProject) => p.box.passiveRadiator.radiator.spec;

export const PR_AREA: CompatArea = {
  name: 'pr',
  summary: 'Passive radiator pane and the passive radiator box',
  cases: [
    {label: 'PR Vas', wprFile: FILE, section: 'PassiveRadiator', key: 'Vas', value: 0.012, hand: (p, v) => spec(p).Vas_m3.set(v)},
    {label: 'PR Qms', wprFile: FILE, section: 'PassiveRadiator', key: 'Qms', value: 1.5, hand: (p, v) => spec(p).Qms.set(v)},
    {label: 'PR Fs', wprFile: FILE, section: 'PassiveRadiator', key: 'Fs', value: 20, hand: (p, v) => spec(p).Fs_hz.set(v)},
    {label: 'PR Sd', wprFile: FILE, section: 'PassiveRadiator', key: 'Sd', value: 0.02, hand: (p, v) => spec(p).Sd_m2.set(v)},
    {label: 'PR Xmax', wprFile: FILE, section: 'PassiveRadiator', key: 'Xmax', value: 0.03, hand: (p, v) => spec(p).Xmax_m.set(v)},
    {label: 'PR added mass', wprFile: FILE, section: 'PassiveRadiator', key: 'Me', value: 0.02, hand: (p, v) => p.box.passiveRadiator.addedMass_kg.set(v)},
    {label: 'PR count', wprFile: FILE, section: 'Box', key: 'Npr', value: 2, hand: (p, v) => p.box.passiveRadiator.count.set(v)},
    {label: 'PR box Ql', wprFile: FILE, section: 'Box', key: 'Qlr', value: 4, hand: (p, v) => p.box.passiveRadiator.losses.Ql.set(v)},
    {label: 'PR box Qa', wprFile: FILE, section: 'Box', key: 'Qar', value: 15, hand: (p, v) => p.box.passiveRadiator.losses.Qa.set(v)},
    {label: 'PR box volume', wprFile: FILE, section: 'Box', key: 'Vr', value: 0.02, hand: (p, v) => p.box.passiveRadiator.volume_m3.set(v)},
  ],
};
