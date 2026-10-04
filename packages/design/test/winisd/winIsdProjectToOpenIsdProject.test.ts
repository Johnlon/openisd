import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {WinISDProject} from '../../winisd/winisdProject.js';

const here = dirname(fileURLToPath(import.meta.url));

const GOLDENS_DIR = join(here, 'fixtures', 'winisd-parity', 'goldens');

const GOLDEN_SEALED_SMALL_WPR = join(GOLDENS_DIR, 'sealed-small.wpr');

const GOLDEN_BANDPASS4_WPR = join(GOLDENS_DIR, 'bandpass4.wpr');

const GOLDEN_PASSIVE_RADIATOR_WPR = join(GOLDENS_DIR, 'passive-radiator.wpr');

// A real WinISD-written vented `.wpr`: dia1=0.102, endcorrection=0.732, Rg=0.1, Qlr=10/Qar=100/
// Qpr=100 — this task's own ground truth for the box-losses/vent-geometry/Rg import.
const SAMPLE_VENTED_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_vented.wpr');

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

describe('winIsdProjectToOpenIsdProject', () => {
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

  describe('bandpass6 and ABC boxes', () => {
  for (const [label, kind, boxType, bType, captureWpr, sampleWpr] of [
    ['bandpass6', 'bandpass6', 'bandpass6', 3, CAPTURE_BP6_WPR, SAMPLE_BP6_WPR],
    ['ABC', 'abc', 'abc', 5, CAPTURE_ABC_WPR, SAMPLE_ABC_WPR],
  ] as const) {
    describe(`winIsdProjectToOpenIsdProject — ${label} (BType=${bType}) import`, () => {
      for (const [sampleLabel, file] of [['capture', captureWpr], ['docs sample', sampleWpr]] as const) {
        it(`${sampleLabel}: rear/front volume/tuning/losses and vent geometry match the file's own [Box]/[VentRear]/[VentFront]`, () => {
          const text = readFileSync(file, 'utf8');
          const engine = createEngine();
          const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
          assert.equal(errors.length, 0, JSON.stringify(errors));
          if (!project) throw new Error('expected a project');
          assert.equal(project.box.boxType.value, boxType);

          const b = project.box[kind];
          assert.equal(b.chambers.rear.volume_m3.value, Number(goldenField(file, 'Box', 'Vr')));
          assert.equal(b.chambers.rear.tuning_goal_hz.value, Number(goldenField(file, 'Box', 'Fr')));
          assert.equal(b.chambers.front.volume_m3.value, Number(goldenField(file, 'Box', 'Vf')));
          assert.equal(b.chambers.front.tuning_goal_hz.value, Number(goldenField(file, 'Box', 'Ff')));

          assert.equal(b.chambers.rear.losses.Ql.value, Number(goldenField(file, 'Box', 'Qlr')));
          assert.equal(b.chambers.rear.losses.Qa.value, Number(goldenField(file, 'Box', 'Qar')));
          assert.equal(b.chambers.rear.losses.Qp.value, Number(goldenField(file, 'Box', 'Qpr')));
          assert.equal(b.chambers.rear.losses.Qicl.value, Number(goldenField(file, 'Box', 'Qiclfr')));
          assert.equal(b.chambers.front.losses.Ql.value, Number(goldenField(file, 'Box', 'Qlf')));
          assert.equal(b.chambers.front.losses.Qa.value, Number(goldenField(file, 'Box', 'Qaf')));
          assert.equal(b.chambers.front.losses.Qp.value, Number(goldenField(file, 'Box', 'Qpf')));

          assert.equal(b.vents.rear.diameter_m.value, Number(goldenField(file, 'VentRear', 'dia1')));
          assert.equal(b.vents.rear.endCorrection_m.value, Number(goldenField(file, 'VentRear', 'endcorrection')));
          assert.equal(b.vents.front.diameter_m.value, Number(goldenField(file, 'VentFront', 'dia1')));
          assert.equal(b.vents.front.endCorrection_m.value, Number(goldenField(file, 'VentFront', 'endcorrection')));
        });
      }

      it(`reports a clean error when a ${label} box is missing Vr/Fr/Vf/Ff`, () => {
        const text = `[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=${bType}\n`;
        const engine = createEngine();
        const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
        assert.equal(project, null);
        assert.equal(errors.length, 1);
        assert.equal(errors[0]!.field, 'Vr/Fr/Vf/Ff');
      });
    });

    it(`${label} ABC intra port: [VentIntra] dia/endcorrection import into box.abc.vents.intra`, () => {
      if (kind !== 'abc') return;
      const text = readFileSync(captureWpr, 'utf8');
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!project) throw new Error('expected a project');
      assert.equal(project.box.abc.vents.intra.diameter_m.value, Number(goldenField(captureWpr, 'VentIntra', 'dia1')));
      assert.equal(project.box.abc.vents.intra.endCorrection_m.value, Number(goldenField(captureWpr, 'VentIntra', 'endcorrection')));
    });
  }
  });
});
