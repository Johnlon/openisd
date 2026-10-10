import type {CompatArea} from '../harness.js';

const FILE = 'bandpass4.wpr';

export const BANDPASS4_AREA: CompatArea = {
  name: 'bandpass4',
  summary: '4th-order bandpass box: chamber volumes, front tuning, per-chamber losses',
  cases: [
    {label: 'bp4 rear volume', wprFile: FILE, section: 'Box', key: 'Vr', value: 0.03, hand: (p, v) => p.box.bandpass4.chambers.rear.volume_m3.set(v)},
    {label: 'bp4 front volume', wprFile: FILE, section: 'Box', key: 'Vf', value: 0.05, hand: (p, v) => p.box.bandpass4.chambers.front.volume_m3.set(v)},
    {label: 'bp4 front tuning', wprFile: FILE, section: 'Box', key: 'Ff', value: 50, hand: (p, v) => p.box.bandpass4.chambers.front.tuning_goal_hz.set(v)},
    {label: 'bp4 rear Ql', wprFile: FILE, section: 'Box', key: 'Qlr', value: 5, hand: (p, v) => p.box.bandpass4.chambers.rear.losses.Ql.set(v)},
    {label: 'bp4 rear Qa', wprFile: FILE, section: 'Box', key: 'Qar', value: 30, hand: (p, v) => p.box.bandpass4.chambers.rear.losses.Qa.set(v)},
    {label: 'bp4 Qiclfr', wprFile: FILE, section: 'Box', key: 'Qiclfr', value: 30, hand: (p, v) => p.box.bandpass4.Qiclfr.set(v)},
    {label: 'bp4 front Ql', wprFile: FILE, section: 'Box', key: 'Qlf', value: 5, hand: (p, v) => p.box.bandpass4.chambers.front.losses.Ql.set(v)},
    {label: 'bp4 front Qa', wprFile: FILE, section: 'Box', key: 'Qaf', value: 30, hand: (p, v) => p.box.bandpass4.chambers.front.losses.Qa.set(v)},
    {label: 'bp4 front Qp', wprFile: FILE, section: 'Box', key: 'Qpf', value: 30, hand: (p, v) => p.box.bandpass4.chambers.front.losses.Qp.set(v)},
  ],
};
