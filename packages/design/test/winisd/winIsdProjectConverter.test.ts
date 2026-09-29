/**
 * `OpenISDProject` <-> WinISD `.wpr` — the project-level counterpart to
 * `winIsdDriverConverter.ts`. Verified against the same WinISD-Pro-written goldens
 * `winisdProject.test.ts` uses (`packages/design/test/winisd/fixtures/winisd-parity/goldens/`),
 * so the values asserted here are traceable to files WinISD itself produced, not invented.
 *
 * Scope: sealed, vented, bandpass4, box-passive-radiator — the four `SimulatableBoxType`s, and
 * the four box types the golden corpus covers. `bandpass6`/`abc` (`BType` 3/5) are covered
 * separately, in `bp6-abc-wpr.test.ts`, against two real WinISD-written `.wpr` files each.
 */
import {describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {type Engine, createEngine} from '@openisd/design/engine';
import type {Filter} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject,} from '@openisd/design';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDENS_DIR = join(here, 'fixtures', 'winisd-parity', 'goldens');
const GOLDEN_SEALED_SMALL_WPR = join(GOLDENS_DIR, 'sealed-small.wpr');
const GOLDEN_VENTED_SMALL_WPR = join(GOLDENS_DIR, 'vented-small.wpr');
const GOLDEN_BANDPASS4_WPR = join(GOLDENS_DIR, 'bandpass4.wpr');
const GOLDEN_PASSIVE_RADIATOR_WPR = join(GOLDENS_DIR, 'passive-radiator.wpr');
// A real WinISD-written `.wpr` with a [Filters] section (2 entries): the sample this bridge's
// own doc points at.
const SAMPLE_PASSIVE_RADIATOR_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_passive-radiator.wpr');
// A real WinISD-written vented `.wpr`: dia1=0.102, endcorrection=0.732, Rg=0.1, Qlr=10/Qar=100/
// Qpr=100 — this task's own ground truth for the box-losses/vent-geometry/Rg import.
const SAMPLE_VENTED_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_vented.wpr');
// 20 filters, every WinISD type and every low/highpass subtype, none missing/malformed
// (winisd_research/runs/filt-all-1/w5.wpr — copied per this task's own brief).
const MANY_FILTERS_WPR = join(here, 'fixtures', 'filters', 'many-filters.wpr');

/** `[ProjectInfo]`/`[Driver]`/`[Box]` boilerplate for a filter-import test that only cares about
 *  `[Filters]` — a minimal sealed box, matching the other inline-text tests in this file. */
const FILTERS_TEST_BASE = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=0\nVr=0.02\n';

/** One `KEY=value` from a golden `.wpr`'s named section, as written by WinISD itself. The
 *  goldens ARE the oracle for these tests: an expected value transcribed into the test by hand
 *  is a value that can drift from the file without anything noticing. */
function goldenField(file: string, section: string, key: string): string {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const block = text.match(new RegExp(`\\[${section}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`));
  if (!block) throw new Error(`golden ${file} has no [${section}] section`);
  const line = block[1].match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!line) throw new Error(`golden ${file}'s [${section}] has no ${key}= line`);
  return line[1];
}

const scraped = <T,>(value: T) => ({ value });
const num = (read_value: number) => ({ state: 'E' as const, value: read_value, origin: 'test', readings: { test: { read_value } } });

/** The QO8/sealed-small etc. driver every golden's `[Driver]` block carries — same Fs/Sd/Cms/
 *  Qms/Mms/Rms/Xmax/Re/Le/BL/Qes values across all four goldens (only Brand/Model differ, and
 *  those are not asserted here — the bridge test compares [Box]/[PassiveRadiator]/[SignalSource]
 *  values, matching `winisdProject.test.ts`'s own scope, which also does not byte-match
 *  [Driver]). */
function aDriver(engine: Engine, brand: string, model: string): OpenISDDriver {
  const record = {
    brand: scraped(brand), model: scraped(model), manufacturer: scraped(brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: num(37.2), Sd_m2: num(0.0132), Cms_m_per_N: num(0.00118092600256716),
        Mms_kg: num(0.0155), Rms_kg_per_s: num(0.953390696873618), Xmax_m: num(0.006),
        Re_ohm: num(6.4), Le_H: num(0.0005), BL_Tm: num(7.5), Qms: num(3.8),
        Qes: num(0.412203764408292), Qts: num(0.371865748278097),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(`fixture is not a conforming driver: ${driver.join('; ')}`);
  return driver;
}

function aProject(box: (p: ReturnType<typeof OpenISDProject.builder>) => OpenISDProject): OpenISDProject {
  const engine = createEngine();
  return box(OpenISDProject.builder(aDriver(engine, 'QO8', 'test'), engine));
}

describe('openIsdProjectToWinIsdProject — [Box]/[SignalSource] match the WinISD-written goldens', () => {
  it('[Box] alfaVC and dTVC carry the project\'s own thermal values, not the template defaults', () => {
    // BUG_20260817 F3: both were emitted as WinISD's defaults (alfaVC=0.0039, dTVC=0), so a
    // design exported and reopened came back with someone else's coil temperature behaviour.
    const project = aProject((p) => p.sealed().volume_m3(0.02).build());
    project.alfaVC_per_K.set(0.0041);
    project.vcTempRise_K.set(75);

    const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.ok(text.includes('alfaVC=0.0041'), `alfaVC must be the project's, got: ${/alfaVC=.*/.exec(text)?.[0]}`);
    assert.ok(text.includes('dTVC=75'), `dTVC must be the project's, got: ${/dTVC=.*/.exec(text)?.[0]}`);
  });

  it('sealed box: BType=0, rear chamber volume and lossless resonance match sealed-small.wpr', () => {
    const golden = readFileSync(GOLDEN_SEALED_SMALL_WPR, 'utf8').replace(/\r\n/g, '\n');
    // sealed-small.wpr's own [Box]: Vr=0.02, Fr=61.2670146589858 (docs/samples ground truth,
    // confirmed by grep above) — the volume this fixture project is built with.
    const SEALED_VOLUME_M3 = 0.02;
    const project = aProject((p) => p.sealed().volume_m3(SEALED_VOLUME_M3).build());
    project.Rs_ohm.set(0.1); // golden's [SignalSource] Rg=0.1
    project.powerDrive_W.set(1); // golden's [SignalSource] P=1

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=0\n/);
    assert.ok(text.includes('Vr=0.02'), 'rear chamber volume matches the golden');
    assert.ok(golden.includes('Fr=61.2670146589858'), 'ground truth: sealed-small.wpr\'s own Fr');

    // Fr is WinISD's own computed resonance, so this is the parity assertion of the sealed case
    // and it matches to floating point: 6e-14 Hz. The tolerance is tight on purpose — a loose one
    // here hid a 0.044 Hz error for weeks, the resonance being computed in CIPM-2007 air while
    // the project asked for WinISD's.
    const FR_TOLERANCE_HZ = 1e-9;
    const match = text.match(/\[Box\][\s\S]*?\nFr=([\d.]+)\n/);
    assert.ok(match, 'bridge output has a [Box] Fr= line');
    const bridgeFr = Number(match[1]);
    const goldenFr = 61.2670146589858;
    assert.ok(Math.abs(bridgeFr - goldenFr) < FR_TOLERANCE_HZ,
      `bridge Fr=${bridgeFr} should be within ${FR_TOLERANCE_HZ} Hz of golden Fr=${goldenFr} `
      + '(the project\'s own air must be what the resonance is computed in)');

    assert.ok(text.includes('[SignalSource]\nRg=0.1\nP=1'), 'signal source matches the golden');
  });

  it('[Box] T/p/phi carry the project\'s own environment, not WinISD\'s template default', () => {
    const project = aProject((p) => p.sealed().volume_m3(0.02).build());
    project.envTempK.set(300);
    project.envPressurePa.set(99000);
    project.envHumidityPct.set(50); // phi is a FRACTION in the file: 50% -> 0.5

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.ok(text.includes('T=300'), '[Box] T carries the project\'s entered temperature');
    assert.ok(text.includes('p=99000'), '[Box] p carries the project\'s entered pressure');
    assert.ok(text.includes('phi=0.5'), '[Box] phi carries the project\'s entered humidity, as a fraction');
  });

  it('vented box: BType=1, rear chamber volume/tuning match vented-small.wpr', () => {
    // Both read from vented-small.wpr's own [Box], never transcribed.
    const VENTED_VOLUME_M3 = Number(goldenField(GOLDEN_VENTED_SMALL_WPR, 'Box', 'Vr'));
    const VENTED_TUNING_HZ = Number(goldenField(GOLDEN_VENTED_SMALL_WPR, 'Box', 'Fr'));
    const project = aProject((p) => p.vented().volume_m3(VENTED_VOLUME_M3).tuning_goal_hz(VENTED_TUNING_HZ).build());
    project.powerDrive_W.set(1);

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=1\n/);
    assert.equal(goldenField(GOLDEN_VENTED_SMALL_WPR, 'Box', 'BType'), '1', 'ground truth: the golden is a vented box');
    assert.ok(text.includes(`Vr=${VENTED_VOLUME_M3}`), 'rear chamber volume matches the golden\'s own Vr');
    assert.ok(text.includes(`Fr=${VENTED_TUNING_HZ}`), 'rear chamber tuning matches the golden\'s own Fr');
  });

  it('vented box: [VentRear] Num carries the project\'s port count, not a constant 1', () => {
    const project = aProject((p) => p.vented().volume_m3(0.03).tuning_goal_hz(40).build());
    project.powerDrive_W.set(1);
    project.box.vented.vent.count.set(2);

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    assert.equal(wpr.number('VentRear', 'Num'), 2);
  });

  it('bandpass4 box: BType=2, rear (sealed) and front (vented) volumes/tuning match bandpass4.wpr', () => {
    // All three read from bandpass4.wpr's own [Box], never transcribed.
    const REAR_VOLUME_M3 = Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Vr'));
    const FRONT_VOLUME_M3 = Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Vf'));
    const FRONT_TUNING_HZ = Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Ff'));
    const project = aProject((p) => p.bandpass4()
      .rearVolume_m3(REAR_VOLUME_M3).frontVolume_m3(FRONT_VOLUME_M3).frontTuning_hz(FRONT_TUNING_HZ).build());
    project.powerDrive_W.set(1);

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=2\n/);
    assert.equal(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'BType'), '2', 'ground truth: the golden is a bandpass4 box');
    assert.ok(text.includes(`Vr=${REAR_VOLUME_M3}`), 'rear (sealed) chamber volume matches the golden');
    assert.ok(text.includes(`Vf=${FRONT_VOLUME_M3}`), 'front (vented) chamber volume matches the golden');
    assert.ok(text.includes(`Ff=${FRONT_TUNING_HZ}`), 'front chamber tuning matches the golden');

    // The one value in this golden WinISD COMPUTED rather than was given: the rear (sealed)
    // chamber's resonance. Volumes and Ff are inputs echoed back, so they agree with the golden
    // whatever the bridge does; Fr is the only field here that can disagree, which makes it the
    // actual parity assertion. Matches to 6e-14 Hz; tight for the same reason as the sealed case.
    const FR_TOLERANCE_HZ = 1e-9;
    const goldenRearFr = Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Fr'));
    const bridgeRearFr = Number(text.match(/\[Box\][\s\S]*?\nFr=([\d.]+)\n/)![1]);
    assert.ok(Math.abs(bridgeRearFr - goldenRearFr) < FR_TOLERANCE_HZ,
      `bridge rear Fr=${bridgeRearFr} should be within ${FR_TOLERANCE_HZ} Hz of WinISD's own `
      + `Fr=${goldenRearFr}`);
  });

  it('passive-radiator box: BType=4, [PassiveRadiator] matches passive-radiator.wpr exactly', () => {
    // Both read from passive-radiator.wpr's own [Box], never transcribed.
    const PR_VOLUME_M3 = Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'Box', 'Vr'));
    const PR_TUNING_HZ = Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'Box', 'Fr'));
    const engine = createEngine();
    const radiatorRecord = {
      brand: scraped('SB Acoustics'), model: scraped('test-pr'), manufacturer: scraped('SB Acoustics'),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      uuid: { value: '00000000-0000-4000-8000-000000000001' },
      sku: { value: 'TEST-PR-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR-SKU' }] },
      driver_type: scraped('passive-radiator'),
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/pr.pdf' } },
      authoritative: { value: 'manufacturer_datasheet' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: {
        'passive-radiator': {
          // Read out of passive-radiator.wpr's own [PassiveRadiator] block, not transcribed.
          Vas_m3: num(Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Vas'))),
          Qms: num(Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Qms'))),
          Fs_hz: num(Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Fs'))),
          Sd_m2: num(Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Sd'))),
          Xmax_m: num(Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Xmax'))),
        },
      },
    };
    const radiator = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorRecord);
    if (Array.isArray(radiator)) throw new Error(`fixture is not a conforming radiator: ${radiator.join('; ')}`);

    const driver = aDriver(engine, 'QO8', 'test');
    const project = OpenISDProject.builder(driver, engine).passiveRadiator()
      .volume_m3(PR_VOLUME_M3).tuning_goal_hz(PR_TUNING_HZ).count(1).radiator(radiator).build();
    project.powerDrive_W.set(1);

    const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=4\n/);
    assert.equal(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'Box', 'BType'), '4', 'ground truth: the golden is a PR box');
    assert.ok(text.includes(`Vr=${PR_VOLUME_M3}`), 'rear chamber volume matches the golden\'s own Vr');
    const goldenPr = ['Vas', 'Qms', 'Fs', 'Sd', 'Xmax']
      .map(k => `${k}=${goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', k)}`).join('\n');
    assert.ok(text.includes(`[PassiveRadiator]\n${goldenPr}\nMe=0`),
      '[PassiveRadiator] block matches the golden byte for byte on every T/S value');
  });
});

describe('openIsdProjectToWinIsdProject — null-fallback and unsupported-type branches', () => {
  it('pre: Re none, P N, V 1 C | export .wpr | post: SignalSource has no P, a warning says why', () => {
    const engine = createEngine();
    const driver = OpenISDDriver.empty(engine);
    driver.brand.set('Test');
    driver.model.set('NoRe');
    const project = OpenISDProject.builder(driver, engine).sealed().volume_m3(0.02).build();
    assert.equal(project.powerDrive_W.value, null);

    const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
    if (!wpr) throw new Error('expected a WinISDProject: ' + JSON.stringify(errors));
    assert.equal(wpr.number('SignalSource', 'P'), undefined);
    assert.ok(errors.some(e => e.level === 'warn' && e.field === 'SignalSource P'), JSON.stringify(errors));
  });

  it('pre: created and modified blank | export .wpr | post: CreateDate and ModifyDate are today', () => {
    vi.useFakeTimers({now: new Date('2026-05-06T12:00:00')});
    try {
      const engine = createEngine();
      const project = OpenISDProject.builder(OpenISDDriver.empty(engine), engine).sealed().volume_m3(0.02).build();
      project.created.set('');
      project.modified.set('');

      const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
      if (!wpr) throw new Error('expected a WinISDProject: ' + JSON.stringify(errors));
      assert.equal(wpr.value('ProjectInfo', 'CreateDate'), '20260506');
      assert.equal(wpr.value('ProjectInfo', 'ModifyDate'), '20260506');
    } finally {
      vi.useRealTimers();
    }
  });

  it('[PassiveRadiator] omits Vas/Qms/Fs/Sd/Xmax when the radiator states none of them', () => {
    const engine = createEngine();
    const radiator = OpenISDPassiveRadiatorStandalone.empty();
    const driver = aDriver(engine, 'QO8', 'test');
    const project = OpenISDProject.builder(driver, engine).passiveRadiator()
      .volume_m3(0.03).tuning_goal_hz(35).count(1).radiator(radiator).build();

    const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    const block = text.match(/\[PassiveRadiator\]\n([\s\S]*?)(?=\n\[|$)/);
    assert.ok(block, 'has a [PassiveRadiator] block');
    for (const key of ['Vas', 'Qms', 'Fs', 'Sd', 'Xmax']) {
      assert.ok(!block![1].includes(`${key}=`), `block should omit ${key} when the radiator states none`);
    }
    assert.ok(block![1].includes('Me=0'));
  });

  it('bandpass6/abc box types export with BType 3/5 — see bp6-abc-wpr.test.ts for the full coverage', () => {
    const engine = createEngine();
    const driver = aDriver(engine, 'QO8', 'test');
    const project = OpenISDProject.builder(driver, engine).bandpass6()
      .rearVolume_m3(0.01).rearTuning_hz(40).frontVolume_m3(0.02).frontTuning_hz(60).build();

    const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    assert.match(wpr.toWpr(), /\[Box\]\r?\nBType=3\r?\n/);
  });

  it('sealed [Box] Fr falls back to WinISD\'s own template default (0) when resonance is not computable', () => {
    // `WinISDProject`'s own `TEMPLATE` (winisdProject.ts) already defaults Fr to '0', so an
    // omitted key and an explicit 0 are indistinguishable in the rendered text — this asserts
    // the branch's actual, observable effect: no NaN/garbage value leaks through.
    const project = aProject((p) => p.sealed().volume_m3(0).build());

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    assert.match(text, /\[Box\][\s\S]*?\nFr=0\n/);
  });

  it('bandpass4 [Box] Fr falls back to WinISD\'s own template default (0) when the rear chamber volume is 0', () => {
    const project = aProject((p) => p.bandpass4()
      .rearVolume_m3(0).frontVolume_m3(0.01).frontTuning_hz(50).build());

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    assert.match(text, /\[Box\][\s\S]*?\nFr=0\n/);
  });

  it('vented [Box]/[VentRear] Fr/Fb fall back to 0 once tuning_goal_hz is cleared', () => {
    const project = aProject((p) => p.vented().volume_m3(0.03).tuning_goal_hz(40).build());
    project.box.vented.tuning_goal_hz.clear();

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    assert.ok(text.includes('Fr=0'), '[Box] Fr falls back to 0 once tuning_goal_hz is cleared');
    // `WinISDProject`'s own template already defaults [VentRear] Fb to '0', so this only proves
    // the branch does not leak a stale/garbage value once fb_hz is null.
    const ventBlock = text.match(/\[VentRear\]\n([\s\S]*?)(?=\n\[|$)/);
    assert.ok(ventBlock && ventBlock[1].includes('Fb=0'));
  });

  it('bandpass4 [Box]/[VentFront] Ff/Fb fall back to 0 once the front tuning is cleared', () => {
    const project = aProject((p) => p.bandpass4()
      .rearVolume_m3(0.01).frontVolume_m3(0.02).frontTuning_hz(60).build());
    project.box.bandpass4.chambers.front.tuning_goal_hz.clear();

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    assert.ok(text.includes('Ff=0'), '[Box] Ff falls back to 0 once the front tuning is cleared');
    const ventBlock = text.match(/\[VentFront\]\n([\s\S]*?)(?=\n\[|$)/);
    assert.ok(ventBlock && ventBlock[1].includes('Fb=0'));
  });

  it('[VentFront] Sdfport carries the bandpass4 front vent\'s own area once its geometry is stated', () => {
    const project = aProject((p) => p.bandpass4()
      .rearVolume_m3(0.01).frontVolume_m3(0.02).frontTuning_hz(60).build());
    project.box.bandpass4.vents.front.diameter_m.set(0.05);
    project.box.bandpass4.vents.front.length_m.set(0.1);

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    assert.ok(text.includes('Sdfport='), '[Box] Sdfport is present once the front vent has an area');
    assert.ok(!/Sdfport=0(\r?\n|$)/.test(text), 'Sdfport carries the vent\'s real area, not a fallback');
  });

  it('[VentRear] reports carea/len/Shape=1 once the vent geometry is stated, and slotted when shaped so', () => {
    const project = aProject((p) => p.vented().volume_m3(0.03).tuning_goal_hz(40).build());
    project.box.vented.vent.diameter_m.set(0.05);
    project.box.vented.vent.length_m.set(0.15);

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    assert.ok(text.includes('Sdrport='), '[Box] Sdrport is present once the vent has an area');
    const ventBlock = text.match(/\[VentRear\]\n([\s\S]*?)(?=\n\[|$)/);
    assert.ok(ventBlock, 'has a [VentRear] block');
    assert.ok(ventBlock![1].includes('Shape=1'), 'round vent reports Shape=1');
    assert.ok(ventBlock![1].includes('carea='), '[VentRear] carea is present once the vent has an area');
    assert.ok(ventBlock![1].includes('len=0.15'), '[VentRear] len is present once length_m is stated');
  });

  it('[VentRear] does not throw and takes WinISD\'s own template default Shape once the vent is slotted', () => {
    // `WinISDProject`'s own template also defaults Shape to '1' (winisdProject.ts TEMPLATE), the
    // same code this bridge writes for round — so a slotted vent's output is not distinguishable
    // from round's here (the file's own comment at this line already flags slotted's real WinISD
    // code as unconfirmed). This proves the branch runs cleanly, not a distinguishable output.
    const project = aProject((p) => p.vented().volume_m3(0.03).tuning_goal_hz(40).build());
    project.box.vented.vent.shape.set('slotted');

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    const ventBlock = text.match(/\[VentRear\]\n([\s\S]*?)(?=\n\[|$)/);
    assert.ok(ventBlock && ventBlock[1].includes('Shape=1'));
  });

  it('passive-radiator [Box] reports Fr once the system tuning is computable', () => {
    const engine = createEngine();
    const radiatorRecord = {
      brand: scraped('SB Acoustics'), model: scraped('test-pr'), manufacturer: scraped('SB Acoustics'),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      uuid: { value: '00000000-0000-4000-8000-000000000001' },
      sku: { value: 'TEST-PR-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR-SKU' }] },
      driver_type: scraped('passive-radiator'),
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/pr.pdf' } },
      authoritative: { value: 'manufacturer_datasheet' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: {
        'passive-radiator': {
          Vas_m3: num(0.02), Qms: num(3), Fs_hz: num(30), Sd_m2: num(0.02), Xmax_m: num(0.01),
          Cms_m_per_N: num(0.001), Mms_kg: num(0.03),
        },
      },
    };
    const radiator = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorRecord);
    if (Array.isArray(radiator)) throw new Error(`fixture is not a conforming radiator: ${radiator.join('; ')}`);
    const driver = aDriver(engine, 'QO8', 'test');
    const project = OpenISDProject.builder(driver, engine).passiveRadiator()
      .volume_m3(0.03).tuning_goal_hz(35).count(1).radiator(radiator).build();

    const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');
    const block = text.match(/\[Box\]\n([\s\S]*?)(?=\n\[|$)/);
    assert.ok(block && block[1].includes('Fr='), '[Box] Fr is present once systemTuning_hz is computable');
  });
});

describe('winIsdProjectToOpenIsdProject — .wpr text back to a project (round trip)', () => {
  it('sealed golden imports to a project whose box volume matches the file', () => {
    // This direction is exercised once here to prove the seam exists; the full round-trip
    // (OIDP -> WPR -> OIDP, field-for-field) is Chain 2 of the two round-trip chains — see the
    // gap noted in this session's report about the OWPR-native chain (Chain 1) not existing yet.
    const text = readFileSync(GOLDEN_SEALED_SMALL_WPR, 'utf8');
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.boxType.value, 'sealed');
    assert.equal(project.box.sealed.volume_m3.value, 0.02);
  });

  it('vented import reads [VentRear] Num into the port count; a file without it reads as the calculated one port', () => {
    const base = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=1\nVr=0.03\nFr=40\n';
    const engine = createEngine();
    const two = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(base + '[VentRear]\nNum=2\n');
    assert.equal(two.errors.length, 0, JSON.stringify(two.errors));
    assert.equal(two.value?.box.vented.vent.count.value, 2);
    assert.equal(two.value?.box.vented.vent.count.entered, true);
    const none = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(base);
    assert.equal(none.value?.box.vented.vent.count.value, 1);
    assert.equal(none.value?.box.vented.vent.count.calculated, true);
  });

  it('reports a clean user-facing error when BType is missing or unsupported', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(project, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'BType');
    assert.equal(
      errors[0].message,
      'Unsupported or missing box type (BType=undefined): WinISD import supports sealed (0), vented (1), 4th-order bandpass (2), passive radiator (4), 6th-order bandpass (3) and ABC (5) boxes.'
    );
  });

  it('reports a driver error when a [Driver] spec is stated but not numeric', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\nQts=notanumber\n[Box]\nBType=0\nVr=0.02\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(project, null);
    assert.ok(errors.length > 0, 'expected at least one driver error');
    assert.ok(errors.every((e) => e.field === 'driver'));
  });

  it('reports a clean error when a sealed box is missing Vr', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=0\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(project, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'Vr');
    assert.equal(errors[0].message, 'sealed box: [Box] Vr is missing or not numeric');
  });

  it('reports a clean error when a vented box is missing Vr/Fr', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=1\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(project, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'Vr/Fr');
    assert.equal(errors[0].message, 'vented box: [Box] Vr and/or Fr is missing or not numeric');
  });

  it('bandpass4 golden imports to a project whose chamber volumes/tuning match the file, [VentFront] Num carries the port count', () => {
    const text = readFileSync(GOLDEN_BANDPASS4_WPR, 'utf8');
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.boxType.value, 'bandpass4');
    assert.equal(project.box.bandpass4.chambers.rear.volume_m3.value,
      Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Vr')));
    assert.equal(project.box.bandpass4.chambers.front.volume_m3.value,
      Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Vf')));
    assert.equal(project.box.bandpass4.chambers.front.tuning_goal_hz.value,
      Number(goldenField(GOLDEN_BANDPASS4_WPR, 'Box', 'Ff')));
  });

  it('bandpass4 import: [VentFront] Num carries the front port count; a file without it reads as the calculated one port', () => {
    const base = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=2\nVr=0.01\nVf=0.02\nFf=60\n';
    const engine = createEngine();
    const two = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(base + '[VentFront]\nNum=2\n');
    assert.equal(two.errors.length, 0, JSON.stringify(two.errors));
    assert.equal(two.value?.box.bandpass4.vents.front.count.value, 2);
    const none = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(base);
    assert.equal(none.value?.box.bandpass4.vents.front.count.value, 1);
    assert.equal(none.value?.box.bandpass4.vents.front.count.calculated, true);
  });

  it('reports a clean error when a bandpass4 box is missing Vr/Vf/Ff', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=2\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(project, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'Vr/Vf/Ff');
    assert.equal(errors[0].message, 'bandpass4 box: [Box] Vr, Vf and/or Ff is missing or not numeric');
  });

  it('passive-radiator golden imports to a project whose radiator T/S values match the file', () => {
    const text = readFileSync(GOLDEN_PASSIVE_RADIATOR_WPR, 'utf8');
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.boxType.value, 'box-passive-radiator');
    assert.equal(project.box.passiveRadiator.volume_m3.value,
      Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'Box', 'Vr')));
    assert.equal(project.box.passiveRadiator.radiator.spec.Vas_m3.value,
      Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Vas')));
    assert.equal(project.box.passiveRadiator.count.value,
      Number(goldenField(GOLDEN_PASSIVE_RADIATOR_WPR, 'Box', 'Npr')));
  });

  it('passive-radiator import: Npr defaults to 1 when absent', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=4\nVr=0.03\nFr=35\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(project?.box.passiveRadiator.count.value, 1);
  });

  it('reports a clean error when a passive-radiator box is missing Vr/Fr', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=4\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(project, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'Vr/Fr');
    assert.equal(errors[0].message, 'passive-radiator box: [Box] Vr and/or Fr is missing or not numeric');
  });

  it('imports [Box] T/p/phi into the project\'s environment, entered', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + '[Box]\nBType=0\nVr=0.02\nT=300\np=99000\nphi=0.5\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.envTempK.value, 300);
    assert.equal(project.envTempK.entered, true);
    assert.equal(project.envPressurePa.value, 99000);
    assert.equal(project.envHumidityPct.value, 50); // phi is a fraction in the file: 0.5 -> 50%
  });

  it('a file with no [Box] T/p/phi leaves the project\'s environment calculated, at the app default', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=0\nVr=0.02\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.envTempK.calculated, true);
  });

  it('a [Box] T/p/phi equal to the app default stays calculated; a differing one is entered', () => {
    const engine = createEngine();
    const {tempK, pressurePa, humidityPct} = engine.environment.defaults();
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + `[Box]\nBType=0\nVr=0.02\nT=${tempK}\np=${pressurePa + 100}\nphi=${humidityPct / 100}\n`;
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.envTempK.calculated, true);
    assert.equal(project.envHumidityPct.calculated, true);
    assert.equal(project.envPressurePa.entered, true);
    assert.equal(project.envPressurePa.value, pressurePa + 100);
  });

  it('imports [SignalSource] P and [ProjectInfo] Description/Creator/CreateDate/ModifyDate when stated', () => {
    const text = '[ProjectInfo]\nDescription=A test project\nCreator=Test Creator\n'
      + 'CreateDate=20260101\nModifyDate=20260102\n[Driver]\nBrand=Test\nModel=Driver\nRe=8\n'
      + '[Box]\nBType=0\nVr=0.02\n[SignalSource]\nP=50\n';
    const engine = createEngine();
    const { value: project, errors } = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.powerDrive_W.value, 50);
    assert.equal(project.description.value, 'A test project');
    assert.equal(project.creator.value, 'Test Creator');
    assert.equal(project.created.value, '20260101');
    assert.equal(project.modified.value, '20260102');
  });
});

describe('winIsdProjectToOpenIsdProject — box losses, vent geometry and Rg', () => {
  it('sealed box: [Box] Qlr/Qar and [SignalSource] Rg import into losses.Ql/Qa and Rs_ohm', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + '[Box]\nBType=0\nVr=0.02\nQlr=7\nQar=55\n[SignalSource]\nRg=0.25\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.sealed.losses.Ql.value, 7);
    assert.equal(project.box.sealed.losses.Qa.value, 55);
    assert.equal(project.Rs_ohm.value, 0.25);
  });

  it('vented box: sample_project_vented.wpr\'s own losses, [VentRear] dia1/endcorrection and Rg import exactly', () => {
    const text = readFileSync(SAMPLE_VENTED_WPR, 'utf8');
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.vented.losses.Ql.value, 10);
    assert.equal(project.box.vented.losses.Qa.value, 100);
    assert.equal(project.box.vented.losses.Qp.value, 100);
    assert.equal(project.box.vented.vent.diameter_m.value, 0.102);
    assert.equal(project.box.vented.vent.endCorrection_m.value, 0.732);
    assert.equal(project.Rs_ohm.value, 0.1);
  });

  it('bandpass4 box: rear/front losses, [VentFront] dia1/endcorrection and Rg import exactly', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + '[Box]\nBType=2\nVr=0.01\nVf=0.02\nFf=60\nQlr=6\nQar=66\nQiclfr=44\nQlf=9\nQaf=88\nQpf=77\n'
      + '[VentFront]\nShape=1\ndia1=0.06\nendcorrection=0.55\n[SignalSource]\nRg=0.33\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    const rear = project.box.bandpass4.chambers.rear.losses;
    const front = project.box.bandpass4.chambers.front.losses;
    assert.equal(rear.Ql.value, 6);
    assert.equal(rear.Qa.value, 66);
    assert.equal(rear.Qicl.value, 44);
    assert.equal(front.Ql.value, 9);
    assert.equal(front.Qa.value, 88);
    assert.equal(front.Qp.value, 77);
    assert.equal(project.box.bandpass4.vents.front.diameter_m.value, 0.06);
    assert.equal(project.box.bandpass4.vents.front.endCorrection_m.value, 0.55);
    assert.equal(project.Rs_ohm.value, 0.33);
  });

  it('passive-radiator box: [Box] Qlr/Qar and Rg import into losses.Ql/Qa and Rs_ohm', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + '[Box]\nBType=4\nVr=0.03\nFr=35\nQlr=8\nQar=44\n[SignalSource]\nRg=0.5\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.passiveRadiator.losses.Ql.value, 8);
    assert.equal(project.box.passiveRadiator.losses.Qa.value, 44);
    assert.equal(project.Rs_ohm.value, 0.5);
  });

  it('a missing or non-numeric key leaves OpenISD\'s own default in place, no error', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + '[Box]\nBType=1\nVr=0.03\nFr=40\nQar=notanumber\n[VentRear]\nendcorrection=bogus\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.vented.losses.Ql.value, 10); // default, Qlr key absent
    assert.equal(project.box.vented.losses.Qa.value, 100); // default, Qar not numeric
    assert.equal(project.box.vented.vent.endCorrection_m.value, 0.613); // default, endcorrection not numeric
    assert.equal(project.Rs_ohm.value, 0.1); // default, Rg absent
  });

  it('[VentRear] Shape other than round: diameter is skipped with a warn, endcorrection still imports', () => {
    const text = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n'
      + '[Box]\nBType=1\nVr=0.03\nFr=40\n[VentRear]\nShape=2\ndia1=0.09\nendcorrection=0.4\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));
    assert.equal(project.box.vented.vent.endCorrection_m.value, 0.4);
    assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'VentRear Shape'
      && e.message === 'vent shape 2 not imported: only round vents are read'));
  });

  it('round-trips a vented project\'s losses, vent diameter/end correction and Rs through .wpr text', () => {
    const project = aProject((p) => p.vented().volume_m3(0.03).tuning_goal_hz(40).build());
    project.box.vented.losses.Ql.set(12);
    project.box.vented.losses.Qa.set(120);
    project.box.vented.losses.Qp.set(90);
    project.box.vented.vent.diameter_m.set(0.08);
    project.box.vented.vent.endCorrection_m.set(0.7);
    project.Rs_ohm.set(0.2);

    const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');

    const {value: reimported, errors: importErrors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
    assert.equal(importErrors.length, 0, JSON.stringify(importErrors));
    if (!reimported) throw new Error('expected a project');

    assert.equal(reimported.box.vented.losses.Ql.value, 12);
    assert.equal(reimported.box.vented.losses.Qa.value, 120);
    assert.equal(reimported.box.vented.losses.Qp.value, 90);
    assert.equal(reimported.box.vented.vent.diameter_m.value, 0.08);
    assert.equal(reimported.box.vented.vent.endCorrection_m.value, 0.7);
    assert.equal(reimported.Rs_ohm.value, 0.2);
  });
});

describe('openIsdProjectToWinIsdProject — [Filters] export', () => {
  const ONE_OF_EVERY_EXPORTABLE_TYPE: Filter[] = [
    {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
    {type: 'highpass', enabled: false, family: 'bessel', order: 3, fc: 20, Q: 0.6},
    {type: 'allpass', enabled: true, order: 1, t: 0.001, Q: 0.707},
    {type: 'linkwitz', enabled: true, f0: 67.234, Q0: 0.49, fp: 20, Qp: 0.707},
    {type: 'peaking', enabled: true, fc: 30, Q: 2, gain: 6},
    {type: 'peakHighpass', enabled: true, fpk: 20, gainPk: 6},
    {type: 'staticGain', enabled: true, gain: -3},
    {type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0.333, gain: 6},
  ];

  it('writes Count and filter<i>type/params for every filter, in order', () => {
    const project = aProject((p) => p.sealed().volume_m3(0.02).build());
    project.filters.set(ONE_OF_EVERY_EXPORTABLE_TYPE);

    const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');

    assert.equal(wpr.number('Filters', 'Count'), 8);
    assert.equal(wpr.value('Filters', 'filter0type'), '0');
    assert.equal(wpr.value('Filters', 'filter0params'), '0;1;2;50;0.707');
    assert.equal(wpr.value('Filters', 'filter1type'), '1');
    assert.equal(wpr.value('Filters', 'filter1params'), '2;0;3;20;0.6'); // enabled=false -> 0
    assert.equal(wpr.value('Filters', 'filter7type'), '7');
    assert.equal(wpr.value('Filters', 'filter7params'), '0;1;100;0.333;6');
  });

  it('round-trips one of every exportable type through .wpr text back to the same Filter values', () => {
    const project = aProject((p) => p.sealed().volume_m3(0.02).build());
    project.filters.set(ONE_OF_EVERY_EXPORTABLE_TYPE);

    const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');

    const {value: reimported, errors: importErrors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
    const filterWarnings = importErrors.filter((e) => e.field === 'Filters');
    assert.equal(filterWarnings.length, 0, `expected no [Filters] warnings, got: ${JSON.stringify(filterWarnings)}`);
    if (!reimported) throw new Error('expected a project');

    assert.deepEqual(reimported.filters.value, ONE_OF_EVERY_EXPORTABLE_TYPE);
  });

  it('low/high shelf are skipped, each with its own warn, and do not gap Count\'s numbering', () => {
    const project = aProject((p) => p.sealed().volume_m3(0.02).build());
    project.filters.set([
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
      {type: 'lowshelf', enabled: true, fc: 150, Q: Math.SQRT1_2, gain: 6},
      {type: 'highpass', enabled: true, family: 'butterworth', order: 2, fc: 20, Q: 0.707},
      {type: 'highshelf', enabled: true, fc: 2000, Q: Math.SQRT1_2, gain: 6},
    ]);

    const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    if (!wpr) throw new Error('expected a WinISDProject');

    assert.equal(wpr.number('Filters', 'Count'), 2);
    assert.equal(wpr.value('Filters', 'filter0type'), '0');
    assert.equal(wpr.value('Filters', 'filter1type'), '1');
    assert.equal(wpr.value('Filters', 'filter2type'), undefined);
    assert.ok(errors.some((e) => e.level === 'warn' && e.message === 'low shelf not written: WinISD has no shelf filter'));
    assert.ok(errors.some((e) => e.level === 'warn' && e.message === 'high shelf not written: WinISD has no shelf filter'));
  });

  it('an empty filter chain writes Count=0 and no filter<i> keys', () => {
    const project = aProject((p) => p.sealed().volume_m3(0.02).build());

    const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    if (!wpr) throw new Error('expected a WinISDProject');
    assert.equal(wpr.number('Filters', 'Count'), 0);
    assert.equal(wpr.value('Filters', 'filter0type'), undefined);
  });
});

describe('winIsdProjectToOpenIsdProject — [Filters] import', () => {
  it('the real passive-radiator sample imports its own two filters exactly', () => {
    const text = readFileSync(SAMPLE_PASSIVE_RADIATOR_WPR, 'utf8');
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    const filterWarnings = errors.filter((e) => e.field === 'Filters');
    assert.equal(filterWarnings.length, 0, `expected no [Filters] warnings, got: ${JSON.stringify(filterWarnings)}`);
    if (!project) throw new Error('expected a project');

    assert.deepEqual(project.filters.value, [
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
      {type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0.333, gain: 6},
    ]);
  });

  it('a WinISD-written many-filter file imports every type and every low/highpass subtype', () => {
    const text = readFileSync(MANY_FILTERS_WPR, 'utf8');
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    const filterWarnings = errors.filter((e) => e.field === 'Filters');
    assert.equal(filterWarnings.length, 0, `expected no [Filters] warnings, got: ${JSON.stringify(filterWarnings)}`);
    if (!project) throw new Error('expected a project');

    assert.deepEqual(project.filters.value, [
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 4, fc: 80, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'linkwitzRiley', order: 4, fc: 80, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'bessel', order: 3, fc: 80, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'sos', order: 2, fc: 80, Q: 1.2},
      {type: 'highpass', enabled: true, family: 'butterworth', order: 5, fc: 25, Q: 0.707},
      {type: 'highpass', enabled: true, family: 'linkwitzRiley', order: 4, fc: 25, Q: 0.707},
      {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 25, Q: 0.707},
      {type: 'highpass', enabled: true, family: 'sos', order: 2, fc: 25, Q: 0.9},
      {type: 'allpass', enabled: true, order: 1, t: 0.002, Q: 0.707},
      {type: 'allpass', enabled: true, order: 2, t: 0.003, Q: 0.6},
      {type: 'linkwitz', enabled: true, f0: 67.234, Q0: 0.49, fp: 25, Qp: 0.6},
      {type: 'peaking', enabled: true, fc: 45, Q: 3, gain: -4},
      {type: 'peakHighpass', enabled: true, fpk: 22, gainPk: 4},
      {type: 'staticGain', enabled: true, gain: -3},
      {type: 'raisedCosine', enabled: true, fc: 120, bwOct: 0.5, gain: 5},
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 1, fc: 200, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 10, fc: 300, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'bessel', order: 10, fc: 300, Q: 0.707},
      {type: 'highpass', enabled: true, family: 'bessel', order: 1, fc: 15, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'sos', order: 4, fc: 150, Q: 0.8},
    ]);
  });

  it('an entry whose filter<i>type/params keys are both missing loads as WinISD\'s own default lowpass, with a warn', () => {
    const text = FILTERS_TEST_BASE
      + '[Filters]\nCount=2\nfilter0type=0\nfilter0params=0;1;2;50;0.707\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

    assert.deepEqual(project.filters.value, [
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
    ]);
    assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
      && e.message === 'filter 1 missing — WinISD loads it as its default lowpass'));
  });

  it('a params line with the wrong field count loads as that type\'s own default, enabled kept from the line, with a warn', () => {
    // Measured: runs/filter-allpass-1 — a 4-field allpass (missing Q) loads as n=1, t=0.001.
    const text = FILTERS_TEST_BASE
      + '[Filters]\nCount=1\nfilter0type=2\nfilter0params=0;1;3;2.0E-003\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

    assert.deepEqual(project.filters.value, [
      {type: 'allpass', enabled: true, order: 1, t: 0.001, Q: 0.707},
    ]);
    assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
      && e.message === 'filter 0: allpass params malformed — WinISD loads it as its default allpass'));
  });

  it('an unknown filter type number is skipped outright, with a warn', () => {
    const text = FILTERS_TEST_BASE
      + '[Filters]\nCount=1\nfilter0type=9\nfilter0params=0;1;2;50;0.707\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

    assert.deepEqual(project.filters.value, []);
    assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
      && e.message === 'filter 0: unknown filter type 9 — skipped'));
  });

  it('a low/highpass subtype above 3 is skipped outright, with a warn', () => {
    const text = FILTERS_TEST_BASE
      + '[Filters]\nCount=1\nfilter0type=0\nfilter0params=4;1;2;50;0.707\n';
    const engine = createEngine();
    const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

    assert.deepEqual(project.filters.value, []);
    assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
      && e.message === 'filter 0: unsupported lowpass subtype — skipped'));
  });
});
