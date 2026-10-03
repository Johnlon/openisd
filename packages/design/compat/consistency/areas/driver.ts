import type {CompatArea} from '../harness.js';

const FILE = 'sealed-small.wpr';

export const DRIVER_AREA: CompatArea = {
  name: 'driver',
  summary: 'Driver pane T/S fields (the .wpr carries calculated values beside the entered ones)',
  cases: [
    {label: 'driver Fs', wprFile: FILE, section: 'Driver', key: 'Fs', value: 42, hand: (p, v) => p.driver.specs.Fs_hz.set(v)},
    {label: 'driver Re', wprFile: FILE, section: 'Driver', key: 'Re', value: 5.5, hand: (p, v) => p.driver.specs.Re_ohm.set(v)},
    {label: 'driver Le', wprFile: FILE, section: 'Driver', key: 'Le', value: 0.001, hand: (p, v) => p.driver.specs.Le_H.set(v)},
    {label: 'driver BL', wprFile: FILE, section: 'Driver', key: 'BL', value: 8.5, hand: (p, v) => p.driver.specs.BL_Tm.set(v)},
    {label: 'driver Sd', wprFile: FILE, section: 'Driver', key: 'Sd', value: 0.016, hand: (p, v) => p.driver.specs.Sd_m2.set(v)},
    {label: 'driver Xmax', wprFile: FILE, section: 'Driver', key: 'Xmax', value: 0.01, hand: (p, v) => p.driver.specs.Xmax_m.set(v)},
    {label: 'driver Qes', wprFile: FILE, section: 'Driver', key: 'Qes', value: 0.5, hand: (p, v) => p.driver.specs.Qes.set(v)},
    {label: 'driver Qms', wprFile: FILE, section: 'Driver', key: 'Qms', value: 4.5, hand: (p, v) => p.driver.specs.Qms.set(v)},
    {label: 'driver Qts', wprFile: FILE, section: 'Driver', key: 'Qts', value: 0.45, hand: (p, v) => p.driver.specs.Qts.set(v)},
    {label: 'driver Vas', wprFile: FILE, section: 'Driver', key: 'Vas', value: 0.04, hand: (p, v) => p.driver.specs.Vas_m3.set(v)},
    {label: 'driver Mms', wprFile: FILE, section: 'Driver', key: 'Mms', value: 0.02, hand: (p, v) => p.driver.specs.Mms_kg.set(v)},
    {label: 'driver Cms', wprFile: FILE, section: 'Driver', key: 'Cms', value: 0.0009, hand: (p, v) => p.driver.specs.Cms_m_per_N.set(v)},
    {label: 'driver Pe', wprFile: FILE, section: 'Driver', key: 'Pe', value: 150, hand: (p, v) => p.driver.specs.Pe_W.set(v)},
    {label: 'driver voice coils', wprFile: FILE, section: 'Driver', key: 'numVC', value: 2, hand: (p, v) => p.driver.specs.numVC.set(v)},
  ],
};
