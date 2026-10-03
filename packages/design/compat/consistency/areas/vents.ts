import type {CompatArea} from '../harness.js';

const VENTED = 'vented-small.wpr';
const BP4 = 'bandpass4.wpr';
const BP6 = '../../bp6-w5-1.wpr';
const ABC = '../../abc-w5-1.wpr';

export const VENTS_AREA: CompatArea = {
  name: 'vents',
  summary: 'Port diameter, count, length and end correction (vented, bandpass4, bandpass6, abc)',
  cases: [
    {label: 'vented port diameter', wprFile: VENTED, section: 'VentRear', key: 'dia1', value: 0.08, hand: (p, v) => p.box.vented.vent.diameter_m.set(v)},
    {label: 'vented port count', wprFile: VENTED, section: 'VentRear', key: 'Num', value: 2, hand: (p, v) => p.box.vented.vent.count.set(v)},
    {label: 'vented end correction', wprFile: VENTED, section: 'VentRear', key: 'endcorrection', value: 0.6, hand: (p, v) => p.box.vented.vent.endCorrection_m.set(v)},
    {label: 'vented port length', wprFile: VENTED, section: 'VentRear', key: 'len', value: 0.25, hand: (p, v) => p.box.vented.vent.length_m.set(v)},
    {label: 'bp4 front port diameter', wprFile: BP4, section: 'VentFront', key: 'dia1', value: 0.09, hand: (p, v) => p.box.bandpass4.vents.front.diameter_m.set(v)},
    {label: 'bp4 front port count', wprFile: BP4, section: 'VentFront', key: 'Num', value: 2, hand: (p, v) => p.box.bandpass4.vents.front.count.set(v)},
    {label: 'bp4 front end correction', wprFile: BP4, section: 'VentFront', key: 'endcorrection', value: 0.6, hand: (p, v) => p.box.bandpass4.vents.front.endCorrection_m.set(v)},
    {label: 'bp4 front port length', wprFile: BP4, section: 'VentFront', key: 'len', value: 0.1, hand: (p, v) => p.box.bandpass4.vents.front.length_m.set(v)},
    {label: 'bp6 front port diameter', wprFile: BP6, section: 'VentFront', key: 'dia1', value: 0.07, hand: (p, v) => p.box.bandpass6.vents.front.diameter_m.set(v)},
    {label: 'bp6 front port count', wprFile: BP6, section: 'VentFront', key: 'Num', value: 2, hand: (p, v) => p.box.bandpass6.vents.front.count.set(v)},
    {label: 'bp6 rear port diameter', wprFile: BP6, section: 'VentRear', key: 'dia1', value: 0.07, hand: (p, v) => p.box.bandpass6.vents.rear.diameter_m.set(v)},
    {label: 'bp6 rear port count', wprFile: BP6, section: 'VentRear', key: 'Num', value: 2, hand: (p, v) => p.box.bandpass6.vents.rear.count.set(v)},
    {label: 'abc front port diameter', wprFile: ABC, section: 'VentFront', key: 'dia1', value: 0.07, hand: (p, v) => p.box.abc.vents.front.diameter_m.set(v)},
    {label: 'abc front port count', wprFile: ABC, section: 'VentFront', key: 'Num', value: 2, hand: (p, v) => p.box.abc.vents.front.count.set(v)},
    {label: 'abc rear port diameter', wprFile: ABC, section: 'VentRear', key: 'dia1', value: 0.07, hand: (p, v) => p.box.abc.vents.rear.diameter_m.set(v)},
    {label: 'abc rear port count', wprFile: ABC, section: 'VentRear', key: 'Num', value: 2, hand: (p, v) => p.box.abc.vents.rear.count.set(v)},
    {label: 'abc intra port count', wprFile: ABC, section: 'VentIntra', key: 'Num', value: 1, hand: (p, v) => p.box.abc.vents.intra.count.set(v)},
    {label: 'abc intra port length', wprFile: ABC, section: 'VentIntra', key: 'len', value: 0.2, hand: (p, v) => p.box.abc.vents.intra.length_m.set(v)},
  ],
};
