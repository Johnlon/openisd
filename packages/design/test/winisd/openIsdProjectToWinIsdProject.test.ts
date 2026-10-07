import {describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {WinISDProject} from '../../winisd/winisdProject.js';
import {winISDDriverToOpenISDDeviceJson} from '../../domain/winIsdDriverImport.js';

const here = dirname(fileURLToPath(import.meta.url));

const GOLDENS_DIR = join(here, 'fixtures', 'winisd-parity', 'goldens');

const GOLDEN_SEALED_SMALL_WPR = join(GOLDENS_DIR, 'sealed-small.wpr');

const GOLDEN_VENTED_SMALL_WPR = join(GOLDENS_DIR, 'vented-small.wpr');

const GOLDEN_BANDPASS4_WPR = join(GOLDENS_DIR, 'bandpass4.wpr');

const GOLDEN_PASSIVE_RADIATOR_WPR = join(GOLDENS_DIR, 'passive-radiator.wpr');

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

function aProject(box: (p: ProjectBuilder) => OpenISDProject): OpenISDProject {
  const engine = createEngine();
  return box(new ProjectBuilder(aDriver(engine, 'QO8', 'test'), engine));
}

const CAPTURE_BP6_WPR = join(here, 'fixtures', 'bp6-w5-1.wpr');

const CAPTURE_ABC_WPR = join(here, 'fixtures', 'abc-w5-1.wpr');

const SAMPLE_BP6_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_bandpass6.wpr');

const SAMPLE_ABC_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_abc.wpr');

/** Every key line `[section]key=` in a real `.wpr` section, in file order — for comparing an
 *  exported section's key SET against a real WinISD file's own, not just values. */
function sectionKeys(file: string, section: string): string[] {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const block = text.match(new RegExp(`\\[${section}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`));
  if (!block) throw new Error(`${file} has no [${section}] section`);
  return block[1].split('\n').filter(l => l.includes('=')).map(l => l.split('=')[0]!);
}

/** The capture's own `[Driver]` block, built through the same chain
 *  `winIsdProjectToOpenIsdProject` uses BEFORE its `BType` switch — driver-only, so it works
 *  whether or not this file's own `BType` (3/5) is one the switch reads yet. */
function driverFromCapture(engine: Engine): OpenISDDriver {
  const wpr = WinISDProject.fromWprIni(readFileSync(CAPTURE_BP6_WPR, 'utf8'));
  const wdrDriver = WinISDDriver.fromWdrIni(wpr.driverWdrText());
  const {record} = winISDDriverToOpenISDDeviceJson(wdrDriver);
  const driverOrErrors = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driverOrErrors)) throw new Error(`capture driver is not conforming: ${driverOrErrors.join('; ')}`);
  return driverOrErrors;
}

function aCaptureProject(box: (p: ProjectBuilder) => OpenISDProject): OpenISDProject {
  const engine = createEngine();
  return box(new ProjectBuilder(driverFromCapture(engine), engine));
}

describe('openIsdProjectToWinIsdProject', () => {
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
      // here hid a 0.044 Hz error for weeks, the resonance being computed in air other than the
      // project's.
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
      const project = new ProjectBuilder(driver, engine).passiveRadiator()
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
      const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.02).build();
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
        const project = new ProjectBuilder(OpenISDDriver.empty(engine), engine).sealed().volume_m3(0.02).build();
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
      const project = new ProjectBuilder(driver, engine).passiveRadiator()
        .volume_m3(0.03).tuning_goal_hz(35).count(1).radiator(radiator).build();
      // The build gave the radiator its chart-ready Sd/Fs/Vas; this test is about one stating none.
      project.box.passiveRadiator.radiator.spec.Sd_m2.clear();
      project.box.passiveRadiator.radiator.spec.Fs_hz.clear();
      project.box.passiveRadiator.radiator.spec.Vas_m3.clear();
      project.box.passiveRadiator.radiator.spec.Xmax_m.clear();

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

    it('bandpass6/abc box types export with BType 3/5 — see the bandpass6 and ABC block below for the full coverage', () => {
      const engine = createEngine();
      const driver = aDriver(engine, 'QO8', 'test');
      const project = new ProjectBuilder(driver, engine).bandpass6()
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
      const project = aProject((p) => p.sealed().build());
      project.box.sealed.volume_m3.set(0);   // after the build: a builder fills an unstated volume

      const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!wpr) throw new Error('expected a WinISDProject');
      const text = wpr.toWpr().replace(/\r\n/g, '\n');
      assert.match(text, /\[Box\][\s\S]*?\nFr=0\n/);
    });

    it('bandpass4 [Box] Fr falls back to WinISD\'s own template default (0) when the rear chamber volume is 0', () => {
      const project = aProject((p) => p.bandpass4()
        .frontVolume_m3(0.01).frontTuning_hz(50).build());
      project.box.bandpass4.chambers.rear.volume_m3.set(0);   // after the build: a builder fills an unstated volume

      const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!wpr) throw new Error('expected a WinISDProject');
      const text = wpr.toWpr().replace(/\r\n/g, '\n');
      assert.match(text, /\[Box\][\s\S]*?\nFr=0\n/);
    });

    it('vented [Box]/[VentRear] Fr/Fb fall back to 0 once tuning_goal_hz is cleared', () => {
      // A driver with a design falls back to the starting alignment on clear (John, 2026-10-01);
      // a driver that states nothing has none, so the tuning stays cleared.
      const engine = createEngine();
      const project = new ProjectBuilder(OpenISDDriver.empty(engine), engine).vented().volume_m3(0.03).tuning_goal_hz(40).build();
      project.driver.specs.Re_ohm.set(6);
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
      const project = new ProjectBuilder(driver, engine).passiveRadiator()
        .volume_m3(0.03).tuning_goal_hz(35).count(1).radiator(radiator).build();
      // The build gave the radiator its chart-ready Sd/Fs/Vas; this test is about one stating none.
      project.box.passiveRadiator.radiator.spec.Sd_m2.clear();
      project.box.passiveRadiator.radiator.spec.Fs_hz.clear();
      project.box.passiveRadiator.radiator.spec.Vas_m3.clear();

      const { value: wpr, errors } = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!wpr) throw new Error('expected a WinISDProject');
      const text = wpr.toWpr().replace(/\r\n/g, '\n');
      const block = text.match(/\[Box\]\n([\s\S]*?)(?=\n\[|$)/);
      assert.ok(block && block[1].includes('Fr='), '[Box] Fr is present once systemTuning_hz is computable');
    });
  });

  describe('bandpass6 and ABC boxes', () => {
  for (const [label, kind, , bType, captureWpr] of [
    ['bandpass6', 'bandpass6', 'bandpass6', 3, CAPTURE_BP6_WPR, SAMPLE_BP6_WPR],
    ['ABC', 'abc', 'abc', 5, CAPTURE_ABC_WPR, SAMPLE_ABC_WPR],
  ] as const) {
    describe(`openIsdProjectToWinIsdProject — ${label} (BType=${bType}) export`, () => {
      it(`writes BType=${bType} and every [Box]/[VentFront]/[VentRear] key WinISD's own capture writes, in the template's order`, () => {
        const REAR_VOLUME_M3 = Number(goldenField(captureWpr, 'Box', 'Vr'));
        const REAR_TUNING_HZ = Number(goldenField(captureWpr, 'Box', 'Fr'));
        const FRONT_VOLUME_M3 = Number(goldenField(captureWpr, 'Box', 'Vf'));
        const FRONT_TUNING_HZ = Number(goldenField(captureWpr, 'Box', 'Ff'));
        const project = aCaptureProject((p) => p[kind]()
          .rearVolume_m3(REAR_VOLUME_M3).rearTuning_hz(REAR_TUNING_HZ)
          .frontVolume_m3(FRONT_VOLUME_M3).frontTuning_hz(FRONT_TUNING_HZ).build());

        const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
        assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
        if (!wpr) throw new Error('expected a WinISDProject');
        const text = wpr.toWpr().replace(/\r\n/g, '\n');

        assert.match(text, new RegExp(`\\[Box\\]\\nBType=${bType}\\n`));
        assert.ok(text.includes(`Vr=${REAR_VOLUME_M3}`));
        assert.ok(text.includes(`Fr=${REAR_TUNING_HZ}`));
        assert.ok(text.includes(`Vf=${FRONT_VOLUME_M3}`));
        assert.ok(text.includes(`Ff=${FRONT_TUNING_HZ}`));

        // Key SET, not values: every key the capture's own [Box]/[VentFront]/[VentRear] state,
        // including the unused Vc/Fc/Qlc/Qac/Qpc slot and Sdfport/Sdrport, must exist in the
        // export too — WinISDProject's own template (winisdProject.ts) already carries this set
        // for every box type; this proves it, rather than assuming it.
        for (const section of ['Box', 'VentFront', 'VentRear'] as const) {
          const wantKeys = sectionKeys(captureWpr, section);
          for (const key of wantKeys) {
            assert.ok(new RegExp(`\\n${key}=`).test(`\n${text.split(`[${section}]`)[1]!.split('\n\n')[0]}`),
              `[${section}] ${key} missing from the export`);
          }
        }
      });

      it(`round-trips ${label} rear/front losses and vent geometry through .wpr text`, () => {
        const project = aCaptureProject((p) => p[kind]()
          .rearVolume_m3(0.011).rearTuning_hz(41).frontVolume_m3(0.0051).frontTuning_hz(59).build());
        const b = project.box[kind];
        b.chambers.rear.losses.Ql.set(6);
        b.chambers.rear.losses.Qa.set(29);
        b.chambers.rear.losses.Qp.set(11);
        b.chambers.rear.losses.Qicl.set(18);
        b.chambers.front.losses.Ql.set(8);
        b.chambers.front.losses.Qa.set(38);
        b.chambers.front.losses.Qp.set(14);
        b.vents.rear.diameter_m.set(0.048);
        b.vents.rear.endCorrection_m.set(0.7);
        b.vents.front.diameter_m.set(0.052);
        b.vents.front.endCorrection_m.set(0.71);

        const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
        assert.equal(errors.length, 0, JSON.stringify(errors));
        if (!wpr) throw new Error('expected a WinISDProject');

        const {value: reimported, errors: importErrors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
        assert.equal(importErrors.length, 0, JSON.stringify(importErrors));
        if (!reimported) throw new Error('expected a project');
        const rb = reimported.box[kind];

        assert.equal(rb.chambers.rear.volume_m3.value, 0.011);
        assert.equal(rb.chambers.rear.tuning_goal_hz.value, 41);
        assert.equal(rb.chambers.front.volume_m3.value, 0.0051);
        assert.equal(rb.chambers.front.tuning_goal_hz.value, 59);
        assert.equal(rb.chambers.rear.losses.Ql.value, 6);
        assert.equal(rb.chambers.rear.losses.Qa.value, 29);
        assert.equal(rb.chambers.rear.losses.Qp.value, 11);
        assert.equal(rb.chambers.rear.losses.Qicl.value, 18);
        assert.equal(rb.chambers.front.losses.Ql.value, 8);
        assert.equal(rb.chambers.front.losses.Qa.value, 38);
        assert.equal(rb.chambers.front.losses.Qp.value, 14);
        assert.equal(rb.vents.rear.diameter_m.value, 0.048);
        assert.equal(rb.vents.rear.endCorrection_m.value, 0.7);
        assert.equal(rb.vents.front.diameter_m.value, 0.052);
        assert.equal(rb.vents.front.endCorrection_m.value, 0.71);
      });
    });
  }
  });

  describe('winIsdProjectToOpenIsdProject/openIsdProjectToWinIsdProject — ABC intra port', () => {
    it('imports [VentIntra] and round-trips it through .wpr text', () => {
      const project = aCaptureProject((p) => p.abc()
        .rearVolume_m3(0.011).rearTuning_hz(41).frontVolume_m3(0.0051).frontTuning_hz(59).build());
      project.box.abc.vents.intra.diameter_m.set(0.045);
      project.box.abc.vents.intra.endCorrection_m.set(0.72);

      const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!wpr) throw new Error('expected a WinISDProject');
      const text = wpr.toWpr().replace(/\r\n/g, '\n');
      assert.match(text, /\[VentIntra\]/);
      assert.ok(text.includes('dia1=0.045'));
      assert.ok(text.includes('endcorrection=0.72'));

      const {value: reimported, errors: importErrors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
      assert.equal(importErrors.length, 0, JSON.stringify(importErrors));
      if (!reimported) throw new Error('expected a project');
      assert.equal(reimported.box.abc.vents.intra.diameter_m.value, 0.045);
      assert.equal(reimported.box.abc.vents.intra.endCorrection_m.value, 0.72);
    });

    it('a bandpass6 export writes [VentIntra] at the template default (no intra port on that box)', () => {
      const project = aCaptureProject((p) => p.bandpass6()
        .rearVolume_m3(0.011).rearTuning_hz(41).frontVolume_m3(0.0051).frontTuning_hz(59).build());
      const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!wpr) throw new Error('expected a WinISDProject');
      // `WinISDProject.build()`'s own accessors only see keys this bridge explicitly supplied;
      // the template default is filled in at render, so read it back off the rendered text.
      const rendered = WinISDProject.fromWprIni(wpr.toWpr());
      assert.equal(rendered.number('VentIntra', 'carea'), 0);
      assert.equal(rendered.number('VentIntra', 'len'), 0);
    });
  });
});
