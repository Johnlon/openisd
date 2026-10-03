import type {CompatArea} from '../harness.js';

const FILE = 'vented-small.wpr';

export const VENTED_AREA: CompatArea = {
  name: 'vented',
  summary: 'Vented box',
  cases: [
    {label: 'vented volume', wprFile: FILE, section: 'Box', key: 'Vr', value: 0.05, hand: (p, v) => p.box.vented.volume_m3.set(v)},
    {label: 'vented tuning', wprFile: FILE, section: 'Box', key: 'Fr', value: 30, hand: (p, v) => p.box.vented.tuning_goal_hz.set(v)},
    {label: 'vented Ql', wprFile: FILE, section: 'Box', key: 'Qlr', value: 5, hand: (p, v) => p.box.vented.losses.Ql.set(v)},
    {label: 'vented Qa', wprFile: FILE, section: 'Box', key: 'Qar', value: 20, hand: (p, v) => p.box.vented.losses.Qa.set(v)},
    {label: 'vented Qp', wprFile: FILE, section: 'Box', key: 'Qpr', value: 20, hand: (p, v) => p.box.vented.losses.Qp.set(v)},
  ],
};
