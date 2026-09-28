/**
 * `OpenISDProject` <-> WinISD `.wpr`, bandpass6 (BType=3) and ABC (BType=5) — the two box types
 * `openIsdProjectToWinIsdProject.ts` used to refuse. Two real WinISD-written samples per box
 * type: a live debugger capture (`winisd_research runs/{bp6,abc}-w5-1/w5.wpr`, copied here as
 * `bp6-w5-1.wpr`/`abc-w5-1.wpr` — the same files `bandpass6-winisd.test.ts`/`abc-winisd.test.ts`
 * build their engine fixtures from) and `docs/samples/sample_project_{bandpass6,abc}.wpr`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import {WinIsdProjectConverter} from '../../domain/openIsdProjectToWinIsdProject.js';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {WinISDProject} from '../../winisd/winisdProject.js';
import {winISDDriverToOpenISDDeviceJson} from '../../domain/winIsdDriverImport.js';

const here = dirname(fileURLToPath(import.meta.url));
const CAPTURE_BP6_WPR = join(here, 'fixtures', 'bp6-w5-1.wpr');
const CAPTURE_ABC_WPR = join(here, 'fixtures', 'abc-w5-1.wpr');
const SAMPLE_BP6_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_bandpass6.wpr');
const SAMPLE_ABC_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_abc.wpr');

function goldenField(file: string, section: string, key: string): string {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const block = text.match(new RegExp(`\\[${section}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`));
  if (!block) throw new Error(`golden ${file} has no [${section}] section`);
  const line = block[1].match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!line) throw new Error(`golden ${file}'s [${section}] has no ${key}= line`);
  return line[1];
}

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

function aProject(box: (p: ReturnType<typeof OpenISDProject.builder>) => OpenISDProject): OpenISDProject {
  const engine = createEngine();
  return box(OpenISDProject.builder(driverFromCapture(engine), engine));
}

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

  describe(`openIsdProjectToWinIsdProject — ${label} (BType=${bType}) export`, () => {
    it(`writes BType=${bType} and every [Box]/[VentFront]/[VentRear] key WinISD's own capture writes, in the template's order`, () => {
      const REAR_VOLUME_M3 = Number(goldenField(captureWpr, 'Box', 'Vr'));
      const REAR_TUNING_HZ = Number(goldenField(captureWpr, 'Box', 'Fr'));
      const FRONT_VOLUME_M3 = Number(goldenField(captureWpr, 'Box', 'Vf'));
      const FRONT_TUNING_HZ = Number(goldenField(captureWpr, 'Box', 'Ff'));
      const project = aProject((p) => p[kind]()
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
      const project = aProject((p) => p[kind]()
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

describe('winIsdProjectToOpenIsdProject/openIsdProjectToWinIsdProject — ABC intra port', () => {
  it('imports [VentIntra] and round-trips it through .wpr text', () => {
    const project = aProject((p) => p.abc()
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
    const project = aProject((p) => p.bandpass6()
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
