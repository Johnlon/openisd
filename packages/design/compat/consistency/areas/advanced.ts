import type {CompatArea} from '../harness.js';

const FILE = 'sealed-small.wpr';

export const ADVANCED_AREA: CompatArea = {
  name: 'advanced',
  summary: 'Advanced tab and Project tab options the .wpr carries',
  cases: [
    {label: 'voice coil inductance model', wprFile: FILE, section: 'SimulatorOptions', key: 'VCInd', value: 1, hand: (p, v) => p.circuitModel.set(v === 1 ? 'gyrator' : 'winisd')},
    {label: 'force flat response', wprFile: FILE, section: 'SimulatorOptions', key: 'FlatResponse', value: 1, hand: (p, v) => p.forceFlatResponse.set(v === 1)},
    {label: 'transmission line port model', wprFile: 'vented-small.wpr', section: 'SimulatorOptions', key: 'TLPorts', value: 1, hand: (p, v) => p.useTransmissionLinePortModel.set(v === 1)},
    {label: 'driver count', wprFile: FILE, section: 'Box', key: 'Nd', value: 2, hand: (p, v) => p.nDrivers.set(v)},
    {label: 'driver added mass', wprFile: FILE, section: 'Box', key: 'Med', value: 0.005, hand: (p, v) => p.driverAddedMass_kg.set(v)},
    {label: 'isobaric loading', wprFile: FILE, section: 'Box', key: 'Isobarik', value: 1, hand: (p, v) => p.loading.set(v === 1 ? 'isobaric' : 'standard')},
    {label: 'voice coil resistance TC', wprFile: FILE, section: 'Box', key: 'alfaVC', value: 0.005, hand: (p, v) => p.alfaVC_per_K.set(v)},
    {label: 'voice coil temperature rise', wprFile: FILE, section: 'Box', key: 'dTVC', value: 20, hand: (p, v) => p.vcTempRise_K.set(v)},
  ],
};
