import type {CompatArea} from '../harness.js';

const FILE = 'sealed-small.wpr';

export const ENVIRONMENT_AREA: CompatArea = {
  name: 'environment',
  summary: 'Environment: temperature, humidity (a fraction in the file, percent in the app), pressure',
  cases: [
    {label: 'temperature', wprFile: FILE, section: 'Box', key: 'T', value: 303.15, hand: (p, v) => p.envTempK.set(v)},
    {label: 'humidity', wprFile: FILE, section: 'Box', key: 'phi', value: 0.7, hand: (p, v) => p.envHumidityPct.set(v * 100)},
    {label: 'pressure', wprFile: FILE, section: 'Box', key: 'p', value: 95000, hand: (p, v) => p.envPressurePa.set(v)},
  ],
};
