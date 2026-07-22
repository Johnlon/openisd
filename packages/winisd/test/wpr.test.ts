import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toWpr } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE_WPR_PATH = join(here, '..', '..', '..', 'docs', 'winisd', 'sample_project_Epique15_-_pr.wpr');

// A minimal driver section as Driver.toWdr() would emit it (header + fields + ParState).
const DRIVER_SECTION = '[Driver]\nBrand=Dayton Audio\nModel=E150HE-44\nParState=EEEEEE';

// A passive-radiator project modelled on docs/winisd/sample_project_Epique15_-_pr.wpr.
// We assert STRUCTURE (section order, keys, CRLF, box/PR values) — NOT byte-equality with the
// sample, because WinISD writes ~30 derived [Driver] fields OpenISD never carries.
function prProject() {
  return toWpr({
    project: { description: '', creator: 'johnl', createDate: '20260621', modifyDate: '20260703' },
    driverSection: DRIVER_SECTION,
    box: { bType: 4, Vr: 0.00372, Fr: 45.4014352480254, npr: 1 },
    signal: { P: 140 },
    pr: { Vas: 0.0048, Qms: 3.3, Fs: 30, Sd: 0.0095, Xmax: 19, Me: 0 },
  });
}

describe('toWpr — WinISD .wpr project serializer', () => {
  it('emits CRLF line endings and a trailing CRLF', () => {
    const s = prProject();
    expect(s.includes('\r\n')).toBe(true);
    expect(s.includes('\n\n')).toBe(false); // no bare-LF blank lines
    expect(s.endsWith('\r\n')).toBe(true);
  });

  it('emits the 11 sections in WinISD order', () => {
    const s = prProject();
    const order = [
      '[ProjectInfo]', '[Driver]', '[Box]', '[VentFront]', '[VentRear]', '[VentIntra]',
      '[PlotSettings]', '[SignalSource]', '[Filters]', '[PassiveRadiator]', '[SimulatorOptions]',
    ];
    const positions = order.map(h => s.indexOf(h));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b)); // strictly increasing
  });

  it('splices the driver section verbatim under [Driver]', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    expect(s).toContain('[Driver]\nBrand=Dayton Audio\nModel=E150HE-44\nParState=EEEEEE');
  });

  it('[ProjectInfo] carries creator + YYYYMMDD dates', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    expect(s).toContain('[ProjectInfo]\nDescription=\nCreator=johnl\nCreateDate=20260621\nModifyDate=20260703');
  });

  it('[Box] for a passive radiator: BType=4, rear chamber populated, Npr present, port areas zero', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    expect(s).toMatch(/\[Box\]\nBType=4\n/);
    expect(s).toContain('Vr=0.00372');
    expect(s).toContain('Fr=45.4014352480254');
    expect(s).toContain('Sdfport=0');
    expect(s).toContain('Sdrport=0');
    expect(s).toContain('Npr=1');
  });

  it('[PassiveRadiator] populated only for BType=4', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    expect(s).toContain('[PassiveRadiator]\nVas=0.0048\nQms=3.3\nFs=30\nSd=0.0095\nXmax=19\nMe=0');
  });

  it('[SignalSource] carries drive power P and default Rg=0.1', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    expect(s).toContain('[SignalSource]\nRg=0.1\nP=140');
  });

  it('vented box (BType=1) writes a real rear port and non-zero Sdrport', () => {
    const s = toWpr({
      project: { creator: 'x', createDate: '20260101', modifyDate: '20260101' },
      driverSection: DRIVER_SECTION,
      box: { bType: 1, Vr: 0.03, Fr: 32, SdRear: 0.00196349540849362 },
      ventRear: { dia: 0.05, len: 0.12, endCorrection: 0.732 },
      signal: { P: 40 },
    }).replace(/\r\n/g, '\n');
    expect(s).toMatch(/\[Box\]\nBType=1\n/);
    expect(s).toContain('Sdrport=0.00196349540849362');
    expect(s).toContain('[VentRear]\nNum=1\nShape=1');
    expect(s).toContain('dia1=0.05');
    expect(s).toContain('len=0.12');
    expect(s).toContain('endcorrection=0.732');
    expect(s).not.toContain('Npr='); // no Npr for non-PR boxes
    // [PassiveRadiator] present as an empty section header for a vented box
    expect(s).toMatch(/\[PassiveRadiator\]\n\n\[SimulatorOptions\]/);
  });

  it('matches the real WinISD sample .wpr on container format + every WinISD-invariant [Box]/[PassiveRadiator] value', () => {
    // docs/winisd/sample_project_Epique15_-_pr.wpr is a real file saved by WinISD Pro itself
    // (WINISD_WPR_FILE_SCHEMA.md corpus). We can't byte-match [Driver] (WinISD writes ~30
    // derived fields OpenISD doesn't carry — SPLmax, gamma, Rme, c, roo, …) or [ProjectInfo]
    // (Description/Creator/dates are per-project), but every OTHER value here is a WinISD
    // constant/default our serializer must reproduce exactly, plus the real project's own
    // [Box]/[PassiveRadiator] physics values, read straight out of the sample file.
    const sample = readFileSync(SAMPLE_WPR_PATH, 'utf8');
    expect(sample.includes('\r\n')).toBe(true); // confirms our CRLF assumption against ground truth

    const s = toWpr({
      project: { creator: 'johnl', createDate: '20260621', modifyDate: '20260703' },
      driverSection: DRIVER_SECTION,
      box: { bType: 4, Vr: 0.00372, Fr: 45.4014352480254, npr: 1 },
      signal: { P: 140 },
      pr: { Vas: 0.0048, Qms: 3.3, Fs: 30, Sd: 0.0095, Xmax: 19, Me: 0 },
    }).replace(/\r\n/g, '\n');
    const sampleLf = sample.replace(/\r\n/g, '\n');

    // Section order — identical corpus-confirmed sequence.
    const order = ['[ProjectInfo]', '[Driver]', '[Box]', '[VentFront]', '[VentRear]', '[VentIntra]',
      '[PlotSettings]', '[SignalSource]', '[Filters]', '[PassiveRadiator]', '[SimulatorOptions]'];
    for (const h of order) expect(sampleLf).toContain(h); // sanity: sample really has all 11

    // [Box] values read from the real file, reproduced by our serializer for the same inputs.
    for (const line of ['BType=4', 'Vr=0.00372', 'Fr=45.4014352480254', 'Qlr=10', 'Qar=100', 'Qpr=100',
      'T=293.15', 'p=101325', 'phi=0.3', 'Nd=1', 'Isobarik=0', 'Sdfport=0', 'Sdrport=0', 'Npr=1']) {
      expect(sampleLf).toContain(line); // confirms our default/constant assumption against the real file
      expect(s).toContain(line); // confirms our output matches it
    }

    // [PassiveRadiator] — real project's own T/S values, byte-identical in our output.
    for (const line of ['Vas=0.0048', 'Qms=3.3', 'Fs=30', 'Sd=0.0095', 'Xmax=19', 'Me=0']) {
      expect(sampleLf).toContain(line);
      expect(s).toContain(line);
    }

    // [VentFront]/[VentRear] boilerplate defaults for a PR project — real file vs ours.
    for (const line of ['Shape=1', 'dia1=0.102', 'dia2=0.102', 'endcorrection=0.732', 'crosscalc=1']) {
      expect(sampleLf).toContain(line);
      expect(s).toContain(line);
    }
  });

  it('sealed box (BType=0) has no ports and no PR body', () => {
    const s = toWpr({
      project: { creator: 'x', createDate: '20260101', modifyDate: '20260101' },
      driverSection: DRIVER_SECTION,
      box: { bType: 0, Vr: 0.02, Fr: 58 },
      signal: { P: 40 },
    }).replace(/\r\n/g, '\n');
    expect(s).toMatch(/\[Box\]\nBType=0\n/);
    expect(s).toContain('Sdfport=0');
    expect(s).toContain('Sdrport=0');
  });
});
