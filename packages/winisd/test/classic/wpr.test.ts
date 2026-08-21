import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toWpr } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
/** The harness-generated PR golden — WinISD Pro wrote it under the wine harness from a scenario
 *  stated in explicit values (test/fixtures/winisd-parity/scenarios.json, `passive-radiator`),
 *  so every value in it is traceable to an input this repo controls and can regenerate. */
const SAMPLE_WPR_PATH = join(here, '..', 'fixtures', 'winisd-parity', 'goldens', 'passive-radiator.wpr');

/** Substring assertions carry the needle in the message, so a failure names the missing line. */
function contains(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label}: expected to contain ${JSON.stringify(needle)}`);
}
function omits(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), `${label}: expected NOT to contain ${JSON.stringify(needle)}`);
}

// A minimal driver section as Driver.toWdr() would emit it (header + fields + ParState).
const DRIVER_SECTION = '[Driver]\nBrand=Dayton Audio\nModel=E150HE-44\nParState=EEEEEE';

// A passive-radiator project modelled on docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr.
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

describe('toWpr — [Box] environment, and the percent/fraction boundary', () => {
  /* WinISD's `phi` is a FRACTION (0.3 = 30 %) while openisd carries a PERCENTAGE everywhere
   * else — engine `humidityPct`, store, UI. This writer is the ONE place the two meet, so it
   * is the one place the ÷100 may appear. `T` and `p` are the same units on both sides.
   * Evidence for the fraction: winisd_research/CALC_FINDINGS_FOR_REVIEW.md §"WinISD persists
   * temperature, air pressure and relative humidity". */
  it('writes the project\'s own T / p / phi, with humidity converted percent → fraction', () => {
    const s = toWpr({
      project: {}, driverSection: DRIVER_SECTION,
      box: { bType: 1, Vr: 0.030, Fr: 35 }, signal: { P: 1 },
      environment: { tempK: 303.15, pressurePa: 90000, humidityPct: 80 },
    });
    contains(s, 'T=303.15', 'temperature');
    contains(s, 'p=90000', 'pressure');
    contains(s, 'phi=0.8', 'humidity as a fraction');
    omits(s, 'phi=80', 'humidity must not be written as a percentage');
  });

  it('defaults to WinISD\'s own ambient when the caller supplies no environment', () => {
    const s = toWpr({
      project: {}, driverSection: DRIVER_SECTION,
      box: { bType: 1, Vr: 0.030, Fr: 35 }, signal: { P: 1 },
    });
    contains(s, 'T=293.15', 'default temperature');
    contains(s, 'p=101325', 'default pressure');
    contains(s, 'phi=0.3', 'default humidity');
  });
});

describe('toWpr — WinISD .wpr project serializer', () => {
  it('[SimulatorOptions] reflects the design\'s real flags, not a fixed placeholder', () => {
    const on = toWpr({
      project: {}, driverSection: DRIVER_SECTION,
      box: { bType: 1, Vr: 0.030, Fr: 35 }, signal: { P: 1 },
      simulatorOptions: { vcInductance: true, flatResponse: false, tlPorts: true },
    });
    contains(on, 'VCInd=1', 'voice-coil inductance flag');
    contains(on, 'FlatResponse=0', 'flat-response flag');
    contains(on, 'TLPorts=1', 'transmission-line ports flag');
  });

  it('[SimulatorOptions] defaults to WinISD\'s own all-off when the caller supplies nothing', () => {
    const s = toWpr({
      project: {}, driverSection: DRIVER_SECTION,
      box: { bType: 1, Vr: 0.030, Fr: 35 }, signal: { P: 1 },
    });
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
    const s = toWpr({
      project: { creator: 'x', createDate: '20260101', modifyDate: '20260101' },
      driverSection: DRIVER_SECTION,
      box: { bType: 1, Vr: 0.03, Fr: 32, SdRear: 0.00196349540849362 },
      ventRear: { dia: 0.05, len: 0.12, endCorrection: 0.732 },
      signal: { P: 40 },
    }).replace(/\r\n/g, '\n');
    assert.match(s, /\[Box\]\nBType=1\n/);
    contains(s, 'Sdrport=0.00196349540849362', 'rear port area');
    contains(s, '[VentRear]\nNum=1\nShape=1', '[VentRear] header');
    contains(s, 'dia1=0.05', 'vent diameter');
    contains(s, 'len=0.12', 'vent length');
    contains(s, 'endcorrection=0.732', 'vent end correction');
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

    const s = toWpr({
      project: { creator: 'johnl', createDate: '20260621', modifyDate: '20260703' },
      driverSection: DRIVER_SECTION,
      box: { bType: 4, Vr: 0.04, Fr: 31.7490157327751, npr: 1 },
      signal: { P: 1 },
      pr: { Vas: 0.0048, Qms: 3.3, Fs: 30, Sd: 0.0095, Xmax: 0.019, Me: 0 },
    }).replace(/\r\n/g, '\n');
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

    // [VentFront]/[VentRear] boilerplate defaults for a PR project — real file vs ours.
    // `Num`/`dia1`/`dia2`/`endcorrection` are NOT in this list: openisd writes a phantom vent
    // (Num=1, dia1=0.102, dia2=0.102, endcorrection=0.732) where WinISD wrote an empty one
    // (Num=0, dia1=0, dia2=0, endcorrection=0.6) — a real defect, not a fixture quirk, tracked
    // in bugs/BUG_20260820_wpr_writer_emits_phantom_vent_for_a_passive_radiator_project.md and
    // asserted as a bounded divergence immediately below so it cannot silently widen or vanish.
    for (const line of ['Shape=1', 'Fb=0', 'Vb=0', 'carea=0', 'len=0', 'crosscalc=1']) {
      contains(sampleLf, line, 'WinISD sample vent boilerplate');
      contains(s, line, 'our vent boilerplate output');
    }

    // The phantom-vent divergence, asserted as a BOUND rather than deleted. Each row states
    // what WinISD wrote and what openisd writes instead; the test fails if either side changes
    // — including if openisd is fixed, at which point this block is deleted and the four keys
    // move into the invariant list above.
    for (const [key, winisd, ours] of [
      ['Num', '0', '1'], ['dia1', '0', '0.102'], ['dia2', '0', '0.102'],
      ['endcorrection', '0.6', '0.732'],
    ] as const) {
      contains(sampleLf, `${key}=${winisd}`, `WinISD's own [VentFront] ${key}`);
      contains(s, `${key}=${ours}`,
        `openisd's [VentFront] ${key} — if this now matches WinISD's ${winisd}, the phantom-vent ` +
        `defect is FIXED: delete this block and move ${key} into the invariant list above ` +
        `(bugs/BUG_20260820_wpr_writer_emits_phantom_vent_for_a_passive_radiator_project.md)`);
    }
  });

  it('sealed box (BType=0) has no ports and no PR body', () => {
    const s = toWpr({
      project: { creator: 'x', createDate: '20260101', modifyDate: '20260101' },
      driverSection: DRIVER_SECTION,
      box: { bType: 0, Vr: 0.02, Fr: 58 },
      signal: { P: 40 },
    }).replace(/\r\n/g, '\n');
    assert.match(s, /\[Box\]\nBType=0\n/);
    contains(s, 'Sdfport=0', 'front port area');
    contains(s, 'Sdrport=0', 'rear port area');
  });
});
