import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDProject } from '@openisd/design/winisd';

const here = dirname(fileURLToPath(import.meta.url));
/** The harness-generated PR golden — WinISD Pro wrote it under the wine harness from a scenario
 *  stated in explicit values (test/fixtures/winisd-parity/scenarios.json, `passive-radiator`),
 *  so every value in it is traceable to an input this repo controls and can regenerate. */
const SAMPLE_WPR_PATH = join(here, 'fixtures', 'winisd-parity', 'goldens', 'passive-radiator.wpr');
const VENTED_SMALL_WPR_PATH = join(here, 'fixtures', 'winisd-parity', 'goldens', 'vented-small.wpr');
const BANDPASS4_WPR_PATH = join(here, 'fixtures', 'winisd-parity', 'goldens', 'bandpass4.wpr');
const VENTED_B4_WPR_PATH = join(here, 'fixtures', 'winisd-parity', 'goldens', 'vented-b4.wpr');

/** Substring assertions carry the needle in the message, so a failure names the missing line. */
function contains(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label}: expected to contain ${JSON.stringify(needle)}`);
}
function omits(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), `${label}: expected NOT to contain ${JSON.stringify(needle)}`);
}
/**
 * Extract one `[Header]…` block (up to the next blank line) from LF-normalised INI text, for
 * verbatim block comparison — a substring `contains()` check on a line like `dia1=0` also
 * matches `dia1=0.102`, so a whole-block `assert.equal` is the only check that can't pass on a
 * wrong value that happens to share a prefix.
 */
function extractSection(text: string, header: string): string {
  const start = text.indexOf(`${header}\n`);
  assert.ok(start >= 0, `section ${header} not found`);
  const rest = text.slice(start);
  const end = rest.indexOf('\n\n');
  return end === -1 ? rest : rest.slice(0, end);
}

// A minimal driver section as Driver.toWdr() would emit it (header + fields + ParState).
const DRIVER_SECTION = '[Driver]\nBrand=Dayton Audio\nModel=E150HE-44\nParState=EEEEEE';

// A passive-radiator project modelled on docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr.
// We assert STRUCTURE (section order, keys, CRLF, box/PR values) — NOT byte-equality with the
// sample, because WinISD writes ~30 derived [Driver] fields OpenISD never carries.
function prProject() {
  return WinISDProject.build(DRIVER_SECTION, {
      ProjectInfo: { Description: '', Creator: 'johnl', CreateDate: '20260621', ModifyDate: '20260703' },
      Box: { BType: 4, Vr: 0.00372, Fr: 45.4014352480254, Npr: 1 },
      SignalSource: { P: 140 },
      PassiveRadiator: { Vas: 0.0048, Qms: 3.3, Fs: 30, Sd: 0.0095, Xmax: 19, Me: 0 },
    }).toWpr();
}

describe('toWpr — [Box] environment, and the percent/fraction boundary', () => {
  /* WinISD's `phi` is a FRACTION (0.3 = 30 %) while openisd carries a PERCENTAGE everywhere
   * else. The ÷100 happens in the DOMAIN (`OpenISDProject.toWinISDProject`, the owner of the
   * meaning); this class writes what it is given. Evidence for the fraction:
   * winisd_research/CALC_FINDINGS_FOR_REVIEW.md §"WinISD persists temperature, air pressure
   * and relative humidity". */
  it('writes the project\'s own T / p / phi exactly as supplied', () => {
    const s = WinISDProject.build(DRIVER_SECTION, {
          Box: { BType: 1, Vr: 0.030, Fr: 35, T: 303.15, p: 90000, phi: 0.8 },
          SignalSource: { P: 1 },
        }).toWpr();
    contains(s, 'T=303.15', 'temperature');
    contains(s, 'p=90000', 'pressure');
    contains(s, 'phi=0.8', 'humidity as the fraction the builder supplied');
    omits(s, 'phi=80', 'no percentage can appear — the builder supplies the fraction');
  });

  it('defaults to WinISD\'s own ambient when the caller supplies no environment', () => {
    const s = WinISDProject.build(DRIVER_SECTION, {
          Box: { BType: 1, Vr: 0.030, Fr: 35 }, SignalSource: { P: 1 },
        }).toWpr();
    contains(s, 'T=293.15', 'default temperature');
    contains(s, 'p=101325', 'default pressure');
    contains(s, 'phi=0.3', 'default humidity');
  });
});

describe('toWpr — WinISD .wpr project serializer', () => {
  it('[SimulatorOptions] reflects the design\'s real flags, not a fixed placeholder', () => {
    const on = WinISDProject.build(DRIVER_SECTION, {
          Box: { BType: 1, Vr: 0.030, Fr: 35 }, SignalSource: { P: 1 },
          SimulatorOptions: { VCInd: 1, FlatResponse: 0, TLPorts: 1 },
        }).toWpr();
    contains(on, 'VCInd=1', 'voice-coil inductance flag');
    contains(on, 'FlatResponse=0', 'flat-response flag');
    contains(on, 'TLPorts=1', 'transmission-line ports flag');
  });

  it('[SimulatorOptions] defaults to WinISD\'s own all-off when the caller supplies nothing', () => {
    const s = WinISDProject.build(DRIVER_SECTION, {
          Box: { BType: 1, Vr: 0.030, Fr: 35 }, SignalSource: { P: 1 },
        }).toWpr();
    contains(s, 'VCInd=0', 'default voice-coil inductance flag');
    contains(s, 'FlatResponse=0', 'default flat-response flag');
    contains(s, 'TLPorts=0', 'default transmission-line ports flag');
  });

  it('emits CRLF line endings and a trailing CRLF', () => {
    const s = prProject();
    assert.ok(s.includes('\r\n'), 'must use CRLF line endings');
    assert.ok(!s.includes('\n\n'), 'must contain no bare-LF blank lines');
    assert.ok(s.endsWith('\r\n'), 'must end with a trailing CRLF');
  });

  it('emits the 11 sections in WinISD order', () => {
    const s = prProject();
    const order = [
      '[ProjectInfo]', '[Driver]', '[Box]', '[VentFront]', '[VentRear]', '[VentIntra]',
      '[PlotSettings]', '[SignalSource]', '[Filters]', '[PassiveRadiator]', '[SimulatorOptions]',
    ];
    const positions = order.map(h => s.indexOf(h));
    for (const [i, pos] of positions.entries()) {
      assert.ok(pos >= 0, `section ${order[i]} is missing`);
    }
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b),
      'sections must appear in WinISD order');
  });

  it('splices the driver section verbatim under [Driver]', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    contains(s, '[Driver]\nBrand=Dayton Audio\nModel=E150HE-44\nParState=EEEEEE', '[Driver] block');
  });

  it('[ProjectInfo] carries creator + YYYYMMDD dates', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    contains(s, '[ProjectInfo]\nDescription=\nCreator=johnl\nCreateDate=20260621\nModifyDate=20260703',
      '[ProjectInfo] block');
  });

  it('[Box] for a passive radiator: BType=4, rear chamber populated, Npr present, port areas zero', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    assert.match(s, /\[Box\]\nBType=4\n/);
    contains(s, 'Vr=0.00372', 'rear chamber volume');
    contains(s, 'Fr=45.4014352480254', 'rear chamber tuning');
    contains(s, 'Sdfport=0', 'front port area');
    contains(s, 'Sdrport=0', 'rear port area');
    contains(s, 'Npr=1', 'passive radiator count');
  });

  it('[PassiveRadiator] populated only for BType=4', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    contains(s, '[PassiveRadiator]\nVas=0.0048\nQms=3.3\nFs=30\nSd=0.0095\nXmax=19\nMe=0',
      '[PassiveRadiator] block');
  });

  it('[SignalSource] carries drive power P and default Rg=0.1', () => {
    const s = prProject().replace(/\r\n/g, '\n');
    contains(s, '[SignalSource]\nRg=0.1\nP=140', '[SignalSource] block');
  });

  it('vented box (BType=1) writes a real rear port and non-zero Sdrport', () => {
    const s = WinISDProject.build(DRIVER_SECTION, {
          ProjectInfo: { Creator: 'x', CreateDate: '20260101', ModifyDate: '20260101' },
          Box: { BType: 1, Vr: 0.03, Fr: 32, Sdrport: 0.00196349540849362 },
          // Fb/Vb are the rear chamber's OWN Fr/Vr just above — the redundant-copy relationship
          // confirmed against the golden corpus. carea is the same area as Sdrport above
          // (both come from one builder-computed port area).
          VentRear: { Num: 1, Fb: 32, Vb: 0.03, dia1: 0.05, dia2: 0.05,
            carea: 0.00196349540849362, len: 0.12, endcorrection: 0.732 },
          SignalSource: { P: 40 },
        }).toWpr().replace(/\r\n/g, '\n');
    assert.match(s, /\[Box\]\nBType=1\n/);
    contains(s, 'Sdrport=0.00196349540849362', 'rear port area');
    assert.equal(extractSection(s, '[VentRear]'),
      '[VentRear]\nNum=1\nShape=1\nFb=32\nVb=0.03\ndia1=0.05\ndia2=0.05\n'
      + 'carea=0.00196349540849362\nlen=0.12\nendcorrection=0.732\ncrosscalc=1',
      '[VentRear] whole block');
    omits(s, 'Npr=', 'no Npr for non-PR boxes');
    // [PassiveRadiator] present as an empty section header for a vented box
    assert.match(s, /\[PassiveRadiator\]\n\n\[SimulatorOptions\]/);
  });

  it('matches the WinISD-written PR golden on container format + every WinISD-invariant [Box]/[PassiveRadiator] value', () => {
    // The golden is a file WinISD Pro itself wrote under the wine harness, from the
    // `passive-radiator` scenario's explicit input values. We can't byte-match [Driver] (WinISD
    // writes ~30 derived fields OpenISD doesn't carry — SPLmax, gamma, Rme, c, roo, …) or
    // [ProjectInfo] (Description/Creator/dates are per-project), but every OTHER value here is
    // either a WinISD constant/default our serializer must reproduce exactly, or the scenario's
    // own [Box]/[PassiveRadiator] physics values, read straight out of the golden.
    const sample = readFileSync(SAMPLE_WPR_PATH, 'utf8');
    assert.ok(sample.includes('\r\n'), 'ground truth confirms the CRLF assumption');

    const s = WinISDProject.build(DRIVER_SECTION, {
          ProjectInfo: { Creator: 'johnl', CreateDate: '20260621', ModifyDate: '20260703' },
          Box: { BType: 4, Vr: 0.04, Fr: 31.7490157327751, Npr: 1 },
          SignalSource: { P: 1 },
          PassiveRadiator: { Vas: 0.0048, Qms: 3.3, Fs: 30, Sd: 0.0095, Xmax: 0.019, Me: 0 },
        }).toWpr().replace(/\r\n/g, '\n');
    const sampleLf = sample.replace(/\r\n/g, '\n');

    // Section order — identical corpus-confirmed sequence.
    const order = ['[ProjectInfo]', '[Driver]', '[Box]', '[VentFront]', '[VentRear]', '[VentIntra]',
      '[PlotSettings]', '[SignalSource]', '[Filters]', '[PassiveRadiator]', '[SimulatorOptions]'];
    // sanity: sample really has all 11
    for (const h of order) contains(sampleLf, h, 'WinISD sample section');

    // [Box] values read from the real file, reproduced by our serializer for the same inputs.
    for (const line of ['BType=4', 'Vr=0.04', 'Fr=31.7490157327751', 'Qlr=10', 'Qar=100', 'Qpr=100',
      'T=293.15', 'p=101325', 'phi=0.3', 'Nd=1', 'Isobarik=0', 'Sdfport=0', 'Sdrport=0', 'Npr=1']) {
      contains(sampleLf, line, 'WinISD sample [Box]');   // our default/constant assumption vs the real file
      contains(s, line, 'our [Box] output');             // our output matches it
    }

    // [PassiveRadiator] — real project's own T/S values, byte-identical in our output.
    for (const line of ['Vas=0.0048', 'Qms=3.3', 'Fs=30', 'Sd=0.0095', 'Xmax=0.019', 'Me=0']) {
      contains(sampleLf, line, 'WinISD sample [PassiveRadiator]');
      contains(s, line, 'our [PassiveRadiator] output');
    }

    // [VentFront]/[VentRear] for a PR project: WinISD writes an EMPTY vent (no vent of any
    // kind exists on a passive-radiator box). Whole-block comparison, not per-line substring
    // matches — `dia1=0` as a substring also matches `dia1=0.102`, which would pass even if
    // the writer regressed.
    assert.equal(extractSection(s, '[VentFront]'), extractSection(sampleLf, '[VentFront]'),
      '[VentFront] must match WinISD\'s empty-vent block exactly');
    assert.equal(extractSection(s, '[VentRear]'), extractSection(sampleLf, '[VentRear]'),
      '[VentRear] must match WinISD\'s empty-vent block exactly');
  });

  it('matches the WinISD-written vented-small golden on the populated [VentRear] block '
    + '(Fb/Vb/carea, not just dia1/len)', () => {
    // Scenario `vented-small` (test/fixtures/winisd-parity/scenarios.json): 20 L rear chamber
    // tuned to 45 Hz through a 60 mm round port. [Box].Vr/Fr and [VentRear].Fb/Vb carry the
    // SAME tuning — this is the redundant-copy case the bug asked to establish.
    const sample = readFileSync(VENTED_SMALL_WPR_PATH, 'utf8').replace(/\r\n/g, '\n');
    const s = WinISDProject.build(DRIVER_SECTION, {
          ProjectInfo: { Creator: 'johnl', CreateDate: '20260101', ModifyDate: '20260101' },
          Box: { BType: 1, Vr: 0.02, Fr: 45, Sdrport: 0.00282743338823081 },
          VentRear: { Num: 1, Fb: 45, Vb: 0.02, dia1: 0.06, dia2: 0.06,
            carea: 0.00282743338823081, len: 0.172879854593916 },
          SignalSource: { P: 1 },
        }).toWpr().replace(/\r\n/g, '\n');
    assert.equal(extractSection(s, '[VentRear]'), extractSection(sample, '[VentRear]'),
      '[VentRear] must match WinISD\'s populated-vent block exactly, including Fb/Vb/carea');
  });

  it('matches the WinISD-written bandpass4 golden on the populated [VentFront] block '
    + '(Fb/Vb/carea, not just dia1/len)', () => {
    // Scenario `bandpass4`: front chamber (35 L) is the vented one, tuned to 60 Hz through a
    // 75 mm round port. [Box].Vf/Ff and [VentFront].Fb/Vb carry the SAME tuning.
    const sample = readFileSync(BANDPASS4_WPR_PATH, 'utf8').replace(/\r\n/g, '\n');
    const s = WinISDProject.build(DRIVER_SECTION, {
          ProjectInfo: { Creator: 'johnl', CreateDate: '20260101', ModifyDate: '20260101' },
          Box: { BType: 2, Vr: 0.02, Fr: 58.3392371416399, Vf: 0.035, Ff: 60, Sdfport: 0.00441786466911065 },
          VentFront: { Num: 1, Fb: 60, Vb: 0.035, dia1: 0.075, dia2: 0.075,
            carea: 0.00441786466911065, len: 0.059906176972391 },
          SignalSource: { P: 1 },
        }).toWpr().replace(/\r\n/g, '\n');
    assert.equal(extractSection(s, '[VentFront]'), extractSection(sample, '[VentFront]'),
      '[VentFront] must match WinISD\'s populated-vent block exactly, including Fb/Vb/carea');
  });

  it('matches the WinISD-written vented-b4 golden on the populated [VentRear] block '
    + '(Fb/Vb/carea, not just dia1/len)', () => {
    // Scenario `vented-b4`: 35 L rear chamber tuned to 36 Hz through a 75 mm round port —
    // same port diameter as bandpass4 but a different tuning, so no row can be right by
    // coincidence of one scenario's numbers.
    const sample = readFileSync(VENTED_B4_WPR_PATH, 'utf8').replace(/\r\n/g, '\n');
    const s = WinISDProject.build(DRIVER_SECTION, {
          ProjectInfo: { Creator: 'johnl', CreateDate: '20260101', ModifyDate: '20260101' },
          Box: { BType: 1, Vr: 0.035, Fr: 36, Sdrport: 0.00441786466911065 },
          VentRear: { Num: 1, Fb: 36, Vb: 0.035, dia1: 0.075, dia2: 0.075,
            carea: 0.00441786466911065, len: 0.246406047145531 },
          SignalSource: { P: 1 },
        }).toWpr().replace(/\r\n/g, '\n');
    assert.equal(extractSection(s, '[VentRear]'), extractSection(sample, '[VentRear]'),
      '[VentRear] must match WinISD\'s populated-vent block exactly, including Fb/Vb/carea');
  });

  it('sealed box (BType=0) has no ports and no PR body', () => {
    const s = WinISDProject.build(DRIVER_SECTION, {
          ProjectInfo: { Creator: 'x', CreateDate: '20260101', ModifyDate: '20260101' },
          Box: { BType: 0, Vr: 0.02, Fr: 58 },
          SignalSource: { P: 40 },
        }).toWpr().replace(/\r\n/g, '\n');
    assert.match(s, /\[Box\]\nBType=0\n/);
    contains(s, 'Sdfport=0', 'front port area');
    contains(s, 'Sdrport=0', 'rear port area');
  });
});
