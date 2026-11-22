import type {CompatArea} from '../harness.js';

const FILE = '../../bp6-w5-1.wpr';

export const BANDPASS6_AREA: CompatArea = {
  name: 'bandpass6',
  summary: '6th-order bandpass box: chamber volumes, tunings, per-chamber losses',
  cases: [
    {label: 'bp6 rear volume', wprFile: FILE, section: 'Box', key: 'Vr', value: 0.02, hand: (p, v) => p.box.bandpass6.chambers.rear.volume_m3.set(v)},
    {label: 'bp6 rear tuning', wprFile: FILE, section: 'Box', key: 'Fr', value: 38, hand: (p, v) => p.box.bandpass6.chambers.rear.tuning_goal_hz.set(v)},
    {label: 'bp6 front volume', wprFile: FILE, section: 'Box', key: 'Vf', value: 0.01, hand: (p, v) => p.box.bandpass6.chambers.front.volume_m3.set(v)},
    {label: 'bp6 front tuning', wprFile: FILE, section: 'Box', key: 'Ff', value: 70, hand: (p, v) => p.box.bandpass6.chambers.front.tuning_goal_hz.set(v)},
    {label: 'bp6 rear Ql', wprFile: FILE, section: 'Box', key: 'Qlr', value: 5, hand: (p, v) => p.box.bandpass6.chambers.rear.losses.Ql.set(v)},
    {label: 'bp6 rear Qa', wprFile: FILE, section: 'Box', key: 'Qar', value: 25, hand: (p, v) => p.box.bandpass6.chambers.rear.losses.Qa.set(v)},
    {label: 'bp6 rear Qp', wprFile: FILE, section: 'Box', key: 'Qpr', value: 20, hand: (p, v) => p.box.bandpass6.chambers.rear.losses.Qp.set(v)},
    {label: 'bp6 Qiclfr', wprFile: FILE, section: 'Box', key: 'Qiclfr', value: 30, hand: (p, v) => p.box.bandpass6.Qiclfr.set(v)},
    {label: 'bp6 front Ql', wprFile: FILE, section: 'Box', key: 'Qlf', value: 5, hand: (p, v) => p.box.bandpass6.chambers.front.losses.Ql.set(v)},
    {label: 'bp6 front Qa', wprFile: FILE, section: 'Box', key: 'Qaf', value: 25, hand: (p, v) => p.box.bandpass6.chambers.front.losses.Qa.set(v)},
    {label: 'bp6 front Qp', wprFile: FILE, section: 'Box', key: 'Qpf', value: 20, hand: (p, v) => p.box.bandpass6.chambers.front.losses.Qp.set(v)},
  ],
};
