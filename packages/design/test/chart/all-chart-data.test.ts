import {describe, it, expect} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {SweepDriver} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {OpenISDPassiveRadiatorStandalone} from '../../domain/passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {AllChartData, DEFAULT_REFERENCE_LINE_COLORS, TAB_META, type Design, type PlotParams} from '@openisd/design/chart';
import {exportedNotice} from '../../fields/exportedNotice.js';
import {whatIfSpec, prSpecSection, driverFrom, driverJson} from '../fixtures/domainBuilders.js';

const engine = createEngine();
const SPEC = whatIfSpec({Fs_hz: 37, Vas_m3: 0.03, Qes: 0.4, Qms: 7.0, Re_ohm: 5.6});

function finish(p: OpenISDProject) {
  const w = p.driver.specs;
  w.Sd_m2.set(0.0133); w.Le_H.set(0.70e-3); w.Xmax_m.set(0.005); w.Pe_W.set(60);
  return p;
}
function radiator() {
  const r = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
    brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
    spec: prSpecSection({Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015}),
  }));
  if (Array.isArray(r)) throw new Error(r.join(', '));
  return r;
}
function sealed() {
  return finish(new ProjectBuilder(driverFrom({brand: 'Dayton', model: 'RS225', section: 'woofer', spec: SPEC}), engine).sealed().volume_m3(0.03).build());
}
function passive() {
  return finish(new ProjectBuilder(driverFrom({brand: 'Dayton', model: 'RS225', section: 'woofer', spec: SPEC}), engine)
    .passiveRadiator().volume_m3(0.05).tuning_goal_hz(25).radiator(radiator()).build());
}

function exportOf(p: OpenISDProject, name: string, text: string): AllChartData {
  const P: PlotParams = {fmin: 10, fmax: 2000};
  const sp: FrequencyGrid = {fmin: P.fmin, fmax: P.fmax, N: 100};
  const swept = p.sweep(sp);
  if (!swept.values) throw new Error(JSON.stringify(swept.issues));
  const curves = swept.values;
  const maxCurves = p.maxCurves(sp).values;
  const driver: SweepDriver = p.driver.specs.sweepDriver();
  const design: Design = {driver, box: p.box.boxType.value, P, curves: curves ?? undefined, maxCurves: maxCurves ?? undefined, name, color: '#4fb0ff', sortIndex: 0};
  return AllChartData.of(name, p.charts, engine, P.fmin, P.fmax, design, [], DEFAULT_REFERENCE_LINE_COLORS, text);
}

const csvNames = (d: AllChartData) => d.files.map(f => f.name).filter(n => n.endsWith('.csv'));

describe('AllChartData: every chart of the open project in one ZIP', () => {
  it('a sealed project has one CSV per chart its box has, and project.json', () => {
    const p = sealed();
    const d = exportOf(p, 'My sub', '{"project":1}');
    expect(csvNames(d)).toEqual(p.charts.map(id => `My sub - ${TAB_META[id].name}.csv`).map(n => n.replace(/[\\/:*?"<>|]+/g, '_')));
    expect(d.files.at(-1)).toEqual({name: 'project.json', text: '{"project":1}'});
    expect(d.chartCount).toBe(p.charts.length);
    expect(d.zipName).toBe('My sub - all chart data.zip');
  });

  it('a CSV has the frequency column first and a name with its unit for every curve', () => {
    const d = exportOf(sealed(), 'My sub', '{}');
    const spl = d.files.find(f => f.name === 'My sub - SPL response.csv');
    expect(spl).toBeDefined();
    const head = (spl?.text ?? '').split('\r\n')[0];
    expect(head.startsWith('Frequency (Hz),')).toBe(true);
    expect(head).toContain('(dB)');
    const exc = d.files.find(f => f.name === 'My sub - Cone excursion.csv');
    expect((exc?.text ?? '').split('\r\n')[0]).toContain('(mm)');
  });

  it('a passive-radiator project also has the PR charts', () => {
    const p = passive();
    const d = exportOf(p, 'PR box', '{}');
    expect(p.charts).toContain('PRExcursion');
    expect(csvNames(d)).toContain('PR box - Cone excursion (PR).csv');
    expect(csvNames(d)).toContain('PR box - Transfer function magnitude (PR).csv');
    expect(d.chartCount).toBe(p.charts.length);
  });

  it('the file names are sanitized as a single chart download is', () => {
    const d = exportOf(sealed(), 'a/b: "c"', '{}');
    expect(d.zipName).toBe('a_b_ _c_ - all chart data.zip');
    expect(csvNames(d).every(n => !/[\\/:*?"<>|]/.test(n))).toBe(true);
  });

  it('the ZIP lists exactly those files, each with its stored text', () => {
    const d = exportOf(sealed(), 'My sub', '{"project":1}');
    const bytes = d.zip();
    const v = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    const count = v.getUint16(end + 10, true);
    let at = v.getUint32(end + 16, true);
    const read: {name: string; text: string}[] = [];
    for (let i = 0; i < count; i++) {
      const size = v.getUint32(at + 24, true);
      const nameLen = v.getUint16(at + 28, true);
      const local = v.getUint32(at + 42, true);
      const dec = new TextDecoder();
      const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
      const start = local + 30 + v.getUint16(local + 26, true);
      read.push({name, text: dec.decode(bytes.subarray(start, start + size))});
      at += 46 + nameLen;
    }
    expect(read).toEqual(d.files);
  });

  it('the notice says how many charts went into the file', () => {
    expect(exportedNotice({kind: 'allChartData', charts: 14}, 'My sub - all chart data.zip').message)
      .toBe('Exported 14 charts to "My sub - all chart data.zip".');
  });
});
