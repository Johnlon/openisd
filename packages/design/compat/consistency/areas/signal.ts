import type {CompatArea} from '../harness.js';

const FILE = 'vented-small.wpr';

export const SIGNAL_AREA: CompatArea = {
  name: 'signal',
  summary: 'Signal tab: source power and source resistance (voltage is not in the .wpr)',
  cases: [
    {label: 'signal power', wprFile: FILE, section: 'SignalSource', key: 'P', value: 50, hand: (p, v) => p.powerDrive_W.set(v)},
    {label: 'signal Rg', wprFile: FILE, section: 'SignalSource', key: 'Rg', value: 0.5, hand: (p, v) => p.Rs_ohm.set(v)},
  ],
};
