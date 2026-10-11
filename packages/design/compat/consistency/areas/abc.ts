import type {CompatArea} from '../harness.js';

const FILE = '../../abc-w5-1.wpr';

export const ABC_AREA: CompatArea = {
  name: 'abc',
  summary: 'ABC box: chamber volumes, tunings, per-chamber losses',
  cases: [
    {label: 'abc rear volume', wprFile: FILE, section: 'Box', key: 'Vr', value: 0.02, hand: (p, v) => p.box.abc.chambers.rear.volume_m3.set(v)},
    {label: 'abc rear tuning', wprFile: FILE, section: 'Box', key: 'Fr', value: 38, hand: (p, v) => p.box.abc.chambers.rear.tuning_goal_hz.set(v)},
    {label: 'abc front volume', wprFile: FILE, section: 'Box', key: 'Vf', value: 0.01, hand: (p, v) => p.box.abc.chambers.front.volume_m3.set(v)},
    {label: 'abc front tuning', wprFile: FILE, section: 'Box', key: 'Ff', value: 70, hand: (p, v) => p.box.abc.chambers.front.tuning_goal_hz.set(v)},
    {label: 'abc rear Ql', wprFile: FILE, section: 'Box', key: 'Qlr', value: 5, hand: (p, v) => p.box.abc.chambers.rear.losses.Ql.set(v)},
    {label: 'abc rear Qa', wprFile: FILE, section: 'Box', key: 'Qar', value: 25, hand: (p, v) => p.box.abc.chambers.rear.losses.Qa.set(v)},
    {label: 'abc rear Qp', wprFile: FILE, section: 'Box', key: 'Qpr', value: 20, hand: (p, v) => p.box.abc.chambers.rear.losses.Qp.set(v)},
    {label: 'abc Qiclfr', wprFile: FILE, section: 'Box', key: 'Qiclfr', value: 30, hand: (p, v) => p.box.abc.Qiclfr.set(v)},
    {label: 'abc front Ql', wprFile: FILE, section: 'Box', key: 'Qlf', value: 5, hand: (p, v) => p.box.abc.chambers.front.losses.Ql.set(v)},
    {label: 'abc front Qa', wprFile: FILE, section: 'Box', key: 'Qaf', value: 25, hand: (p, v) => p.box.abc.chambers.front.losses.Qa.set(v)},
    {label: 'abc front Qp', wprFile: FILE, section: 'Box', key: 'Qpf', value: 20, hand: (p, v) => p.box.abc.chambers.front.losses.Qp.set(v)},
  ],
};
