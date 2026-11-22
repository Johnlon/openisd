import type {CompatArea} from '../harness.js';

const FILE = 'sealed-small.wpr';

export const SEALED_AREA: CompatArea = {
  name: 'sealed',
  summary: 'Sealed box',
  cases: [
    {label: 'sealed volume', wprFile: FILE, section: 'Box', key: 'Vr', value: 0.05, hand: (p, v) => p.box.sealed.volume_m3.set(v)},
    {label: 'sealed Ql', wprFile: FILE, section: 'Box', key: 'Qlr', value: 5, hand: (p, v) => p.box.sealed.losses.Ql.set(v)},
    {label: 'sealed Qa', wprFile: FILE, section: 'Box', key: 'Qar', value: 20, hand: (p, v) => p.box.sealed.losses.Qa.set(v)},
  ],
};
