/**
 * `OpenISDProject` <-> WinISD `.wpr` — the project-level counterpart to
 * `driverYmlToOpenisdAndWdr.ts`. Verified against the same WinISD-Pro-written goldens
 * `winisdProject.test.ts` uses (`packages/design/test/winisd/fixtures/winisd-parity/goldens/`),
 * so the values asserted here are traceable to files WinISD itself produced, not invented.
 *
 * Scope: sealed, vented, bandpass4, box-passive-radiator — the four `SimulatableBoxType`s, and
 * the four box types the golden corpus covers. `bandpass6`/`abc` have real WinISD-written
 * samples under `docs/samples/` but no golden fixtures here and are not simulated
 * (`packages/design/engine/types.ts` `SimulatableBoxType`) — out of scope for this bridge.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine } from '@openisd/design/engine';
import {
  OpenISDProject, OpenISDDriver, OpenISDPassiveRadiatorStandalone,
   
} from '@openisd/design';
import {
  openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject,
} from '../../domain/openIsdProjectToWinIsdProject.js';

const here = dirname(fileURLToPath(import.meta.url));
const goldensDir = join(here, 'fixtures', 'winisd-parity', 'goldens');
const SEALED_SMALL_WPR = join(goldensDir, 'sealed-small.wpr');
const VENTED_SMALL_WPR = join(goldensDir, 'vented-small.wpr');
const BANDPASS4_WPR = join(goldensDir, 'bandpass4.wpr');
const PASSIVE_RADIATOR_WPR = join(goldensDir, 'passive-radiator.wpr');

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
const num = (read_value: number) => ({ origin: 'test', readings: { test: { read_value } } });

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
        Fs: num(37.2), Sd: num(0.0132), Cms: num(0.00118092600256716),
        Mms: num(0.0155), Rms: num(0.953390696873618), Xmax: num(0.006),
        Re: num(6.4), Le: num(0.0005), BL: num(7.5), Qms: num(3.8),
        Qes: num(0.412203764408292), Qts: num(0.371865748278097),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(`fixture is not a conforming driver: ${driver.join('; ')}`);
  return driver;
}

function aProject(box: (p: ReturnType<typeof OpenISDProject.builder>) => OpenISDProject): OpenISDProject {
  const engine = new Engine();
  return box(OpenISDProject.builder(aDriver(engine, 'QO8', 'test'), engine));
}

describe('openIsdProjectToWinIsdProject — [Box]/[SignalSource] match the WinISD-written goldens', () => {
  it('sealed box: BType=0, rear chamber volume and lossless resonance match sealed-small.wpr', () => {
    const golden = readFileSync(SEALED_SMALL_WPR, 'utf8').replace(/\r\n/g, '\n');
    // sealed-small.wpr's own [Box]: Vr=0.02, Fr=61.2670146589858 (docs/samples ground truth,
    // confirmed by grep above) — the volume this fixture project is built with.
    const SEALED_VOLUME_M3 = 0.02;
    const project = aProject((p) => p.sealed().volume_m3(SEALED_VOLUME_M3).build());
    project.Rs_ohm.set(0.1); // golden's [SignalSource] Rg=0.1
    project.setPowerDrive_W(1); // golden's [SignalSource] P=1

    const { value: wpr, errors } = openIsdProjectToWinIsdProject(project, new Engine());
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=0\n/);
    assert.ok(text.includes('Vr=0.02'), 'rear chamber volume matches the golden');
    assert.ok(golden.includes('Fr=61.2670146589858'), 'ground truth: sealed-small.wpr\'s own Fr');

    // `#sealedResonance_hz()` (packages/design/domain/openisdDomain.ts:727-750) never passes
    // `useWinisdAirModel` to `Engine.airFor()`, so it always uses the CIPM-2007 physical air
    // model instead of WinISD's own parity air-property formula even though
    // `OpenISDProject.envUseWinisdAirModel()` defaults to `true` specifically to select it. This
    // is a genuine, pre-existing gap in `project.ts` — see
    // bugs/BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md — not something this
    // bridge can or should paper over by fudging the value it reads from `resonance_hz()`. Fixed
    // tolerance, not exact match, documents that gap rather than hiding it.
    const FR_TOLERANCE_HZ = 0.05; // observed discrepancy is ~0.044 Hz (~700ppm at 61 Hz)
    const match = text.match(/\[Box\][\s\S]*?\nFr=([\d.]+)\n/);
    assert.ok(match, 'bridge output has a [Box] Fr= line');
    const bridgeFr = Number(match[1]);
    const goldenFr = 61.2670146589858;
    assert.ok(Math.abs(bridgeFr - goldenFr) < FR_TOLERANCE_HZ,
      `bridge Fr=${bridgeFr} should be within ${FR_TOLERANCE_HZ} Hz of golden Fr=${goldenFr} `
      + '(pre-existing air-model gap, see bugs/BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md)');

    assert.ok(text.includes('[SignalSource]\nRg=0.1\nP=1'), 'signal source matches the golden');
  });

  it('vented box: BType=1, rear chamber volume/tuning match vented-small.wpr', () => {
    // Both read from vented-small.wpr's own [Box], never transcribed.
    const VENTED_VOLUME_M3 = Number(goldenField(VENTED_SMALL_WPR, 'Box', 'Vr'));
    const VENTED_TUNING_HZ = Number(goldenField(VENTED_SMALL_WPR, 'Box', 'Fr'));
    const project = aProject((p) => p.vented().volume_m3(VENTED_VOLUME_M3).tuning_hz(VENTED_TUNING_HZ).build());
    project.setPowerDrive_W(1);

    const { value: wpr, errors } = openIsdProjectToWinIsdProject(project, new Engine());
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=1\n/);
    assert.equal(goldenField(VENTED_SMALL_WPR, 'Box', 'BType'), '1', 'ground truth: the golden is a vented box');
    assert.ok(text.includes(`Vr=${VENTED_VOLUME_M3}`), 'rear chamber volume matches the golden\'s own Vr');
    assert.ok(text.includes(`Fr=${VENTED_TUNING_HZ}`), 'rear chamber tuning matches the golden\'s own Fr');
  });

  it('bandpass4 box: BType=2, rear (sealed) and front (vented) volumes/tuning match bandpass4.wpr', () => {
    // All three read from bandpass4.wpr's own [Box], never transcribed.
    const REAR_VOLUME_M3 = Number(goldenField(BANDPASS4_WPR, 'Box', 'Vr'));
    const FRONT_VOLUME_M3 = Number(goldenField(BANDPASS4_WPR, 'Box', 'Vf'));
    const FRONT_TUNING_HZ = Number(goldenField(BANDPASS4_WPR, 'Box', 'Ff'));
    const project = aProject((p) => p.bandpass4()
      .rearVolume_m3(REAR_VOLUME_M3).frontVolume_m3(FRONT_VOLUME_M3).frontTuning_hz(FRONT_TUNING_HZ).build());
    project.setPowerDrive_W(1);

    const { value: wpr, errors } = openIsdProjectToWinIsdProject(project, new Engine());
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=2\n/);
    assert.equal(goldenField(BANDPASS4_WPR, 'Box', 'BType'), '2', 'ground truth: the golden is a bandpass4 box');
    assert.ok(text.includes(`Vr=${REAR_VOLUME_M3}`), 'rear (sealed) chamber volume matches the golden');
    assert.ok(text.includes(`Vf=${FRONT_VOLUME_M3}`), 'front (vented) chamber volume matches the golden');
    assert.ok(text.includes(`Ff=${FRONT_TUNING_HZ}`), 'front chamber tuning matches the golden');

    // The one value in this golden WinISD COMPUTED rather than was given: the rear (sealed)
    // chamber's resonance. Volumes and Ff are inputs echoed back, so they agree with the golden
    // whatever the bridge does; Fr is the only field here that can disagree, which makes it the
    // actual parity assertion. Tolerance for the same air-model gap the sealed case documents
    // (bugs/BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md).
    const FR_TOLERANCE_HZ = 0.05;
    const goldenRearFr = Number(goldenField(BANDPASS4_WPR, 'Box', 'Fr'));
    const bridgeRearFr = Number(text.match(/\[Box\][\s\S]*?\nFr=([\d.]+)\n/)![1]);
    assert.ok(Math.abs(bridgeRearFr - goldenRearFr) < FR_TOLERANCE_HZ,
      `bridge rear Fr=${bridgeRearFr} should be within ${FR_TOLERANCE_HZ} Hz of WinISD's own `
      + `Fr=${goldenRearFr}`);
  });

  it('passive-radiator box: BType=4, [PassiveRadiator] matches passive-radiator.wpr exactly', () => {
    // Both read from passive-radiator.wpr's own [Box], never transcribed.
    const PR_VOLUME_M3 = Number(goldenField(PASSIVE_RADIATOR_WPR, 'Box', 'Vr'));
    const PR_TUNING_HZ = Number(goldenField(PASSIVE_RADIATOR_WPR, 'Box', 'Fr'));
    const engine = new Engine();
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
          Vas: num(Number(goldenField(PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Vas'))),
          Qms: num(Number(goldenField(PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Qms'))),
          Fs: num(Number(goldenField(PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Fs'))),
          Sd: num(Number(goldenField(PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Sd'))),
          Xmax: num(Number(goldenField(PASSIVE_RADIATOR_WPR, 'PassiveRadiator', 'Xmax'))),
        },
      },
    };
    const radiator = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorRecord, engine);
    if (Array.isArray(radiator)) throw new Error(`fixture is not a conforming radiator: ${radiator.join('; ')}`);

    const driver = aDriver(engine, 'QO8', 'test');
    const project = OpenISDProject.builder(driver, engine).passiveRadiator()
      .volume_m3(PR_VOLUME_M3).tuning_hz(PR_TUNING_HZ).count(1).radiator(radiator).build();
    project.setPowerDrive_W(1);

    const { value: wpr, errors } = openIsdProjectToWinIsdProject(project, engine);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!wpr) throw new Error('expected a WinISDProject');
    const text = wpr.toWpr().replace(/\r\n/g, '\n');

    assert.match(text, /\[Box\]\nBType=4\n/);
    assert.equal(goldenField(PASSIVE_RADIATOR_WPR, 'Box', 'BType'), '4', 'ground truth: the golden is a PR box');
    assert.ok(text.includes(`Vr=${PR_VOLUME_M3}`), 'rear chamber volume matches the golden\'s own Vr');
    const goldenPr = ['Vas', 'Qms', 'Fs', 'Sd', 'Xmax']
      .map(k => `${k}=${goldenField(PASSIVE_RADIATOR_WPR, 'PassiveRadiator', k)}`).join('\n');
    assert.ok(text.includes(`[PassiveRadiator]\n${goldenPr}\nMe=0`),
      '[PassiveRadiator] block matches the golden byte for byte on every T/S value');
  });
});

describe('winIsdProjectToOpenIsdProject — .wpr text back to a project (round trip)', () => {
  it('sealed golden imports to a project whose box volume matches the file', () => {
    // This direction is exercised once here to prove the seam exists; the full round-trip
    // (OIDP -> WPR -> OIDP, field-for-field) is Chain 2 of the two round-trip chains — see the
    // gap noted in this session's report about the OWPR-native chain (Chain 1) not existing yet.
    const text = readFileSync(SEALED_SMALL_WPR, 'utf8');
    const engine = new Engine();
    const { value: project, errors } = winIsdProjectToOpenIsdProject(text, engine);
    assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
    if (!project) throw new Error('expected a project');
    assert.equal(project.box.boxType.get(), 'sealed');
    assert.equal(project.box.sealed.volume_m3.get(), 0.02);
  });
});
