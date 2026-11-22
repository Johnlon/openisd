import type {Filter} from '../../../engine/index.js';
import type {OpenISDProject} from '../../../domain/index.js';
import type {CompatArea} from '../harness.js';

const FILE = '../../filters/many-filters.wpr';

function replaceAt(project: OpenISDProject, index: number, edit: (f: Filter) => Filter): void {
  project.filters.set(project.filters.value.map((f, i) => (i === index ? edit(f) : f)));
}

function wrongType(index: number, f: Filter): never {
  throw new Error(`filter ${index} is a ${f.type}, not the type this case edits`);
}

export const FILTERS_AREA: CompatArea = {
  name: 'filters',
  summary: 'Filters tab: one entry of the 20-filter project, edited the way the Filter Editor does',
  cases: [],
  textCases: [
    {label: 'lowpass fc', wprFile: FILE, section: 'Filters', key: 'filter0params', rawValue: '0;1;4;120;0.707',
      hand: (p, e) => replaceAt(p, 0, f => (f.type === 'lowpass' || f.type === 'highpass') ? e.filters.editPass(f, {fc: 120}) : wrongType(0, f))},
    {label: 'lowpass order', wprFile: FILE, section: 'Filters', key: 'filter0params', rawValue: '0;1;3;80;0.707',
      hand: (p, e) => replaceAt(p, 0, f => (f.type === 'lowpass' || f.type === 'highpass') ? e.filters.editPass(f, {order: 3}) : wrongType(0, f))},
    {label: 'lowpass disabled', wprFile: FILE, section: 'Filters', key: 'filter0params', rawValue: '0;0;4;80;0.707',
      hand: (p) => replaceAt(p, 0, f => ({...f, enabled: false}))},
    {label: 'highpass fc', wprFile: FILE, section: 'Filters', key: 'filter4params', rawValue: '0;1;5;35;0.707',
      hand: (p, e) => replaceAt(p, 4, f => (f.type === 'lowpass' || f.type === 'highpass') ? e.filters.editPass(f, {fc: 35}) : wrongType(4, f))},
    {label: 'parametric EQ gain', wprFile: FILE, section: 'Filters', key: 'filter11params', rawValue: '0;1;45;3;-8',
      hand: (p, e) => replaceAt(p, 11, f => f.type === 'peaking' ? e.filters.editParametricEq(f, {gain: -8}) : wrongType(11, f))},
    {label: 'static gain', wprFile: FILE, section: 'Filters', key: 'filter13params', rawValue: '0;1;-6',
      hand: (p, e) => replaceAt(p, 13, f => f.type === 'staticGain' ? e.filters.editStaticGain(f, {gain: -6}) : wrongType(13, f))},
  ],
};
