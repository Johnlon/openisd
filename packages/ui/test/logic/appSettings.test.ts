/**
 * appState's application-settings seam — the UI end of the plausibility band.
 *
 * The band is an application setting the user owns, not a constant (John 2026-09-22: "we can
 * make the limits application level limit settings in a new settings tab"). It reaches a
 * calculation through the collaborator the engine is constructed with, so this file pins three
 * properties of that seam:
 *
 *   1. appState's `engine` reads the band at CALL time — a band written after the engine was
 *      built changes the engine's answer, with nothing rebuilt.
 *   2. `setVentedLimits` writes through the installed `AppSettingsRepo`, so the setting survives
 *      a reload rather than living in a ref.
 *   3. `setVentedLimits` recalls every OPEN project, not only the focused one — the marks on a
 *      background tab's cells must not be left stale.
 *
 * `appState.ts` caches its state on an HMR singleton shared with every other test file in this
 * run, so these assert deltas and always restore the factory band in `afterEach`.
 */
import {afterEach, describe, expect, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import {
    DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS, type EnvDefaults, type VentedDesignLimits,
} from '@openisd/design/engine';
import {createAppSettingsRepo, createMemoryStorage} from '@openisd/persistence';
import {
    addProject,
    engine,
    envDefaults,
    installAppSettings,
    openProjects,
    removeProject,
    setEnvDefaults,
    setVentedLimits,
    ventedLimits,
} from '../../src/logic/appState.js';

/** A band that rejects the extrapolated C4-at-Qts-1.0 design (1684 L, 5.4 Hz) and accepts an
 *  ordinary one. */
const NARROW: VentedDesignLimits = {minVb_m3: 0.001, maxVb_m3: 1.0, minFb_hz: 10, maxFb_hz: 150};
/** A band nothing physical falls outside of. */
const WIDE: VentedDesignLimits = {minVb_m3: 1e-9, maxVb_m3: 1e9, minFb_hz: 1e-9, maxFb_hz: 1e9};

const scraped = <T,>(value: T) => ({value});
const spec = (read_value: number) =>
  ({state: 'E' as const, value: read_value, origin: 'scraped', readings: {scraped: {read_value}}});

function testDriver(): OpenISDDriver {
  const record = {
    uuid: {value: '00000000-0000-4000-8000-000000000000'},
    manufacturer: scraped('Dayton'), brand: scraped('Dayton'), model: scraped('RS225'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: {value: 'TEST-SKU', grounds: [{origin: 'manufacturer_datasheet', reading: 'TEST-SKU'}]},
    driver_type: scraped('woofer'),
    data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
    authoritative: {value: 'manufacturer_datasheet'},
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005),
        Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

/** A vented project whose designed box is the extrapolated one — 1.684 m³, 5.4 Hz. */
function implausibleVentedProject(): OpenISDProject {
  return OpenISDProject.builder(testDriver(), engine).vented().volume_m3(1.684).tuning_goal_hz(5.4).build();
}

/** Open `project` in the registry for the duration of one test. */
function opened(project: OpenISDProject): OpenISDProject {
  addProject(project);
  return project;
}

afterEach(() => {
  // Restore the factory band AND a clean storage, so a band written here cannot reach the next
  // test file through the shared HMR singleton.
  installAppSettings(createAppSettingsRepo(createMemoryStorage()));
  // Close anything this file opened — the registry is shared with every other test file.
  while (openProjects().length > 0) removeProject(openProjects().length - 1);
});

describe('appState — the application settings seam', () => {
  it('starts on the factory band', () => {
    assert.deepEqual(ventedLimits(), DEFAULT_VENTED_DESIGN_LIMITS);
  });

  it('reads the band from the repo the composition root installed', () => {
    const repo = createAppSettingsRepo(createMemoryStorage());
    repo.setVentedLimits(NARROW);

    installAppSettings(repo);

    assert.deepEqual(ventedLimits(), NARROW);
  });

  it('writes the band through the installed repo, so it survives a reload', () => {
    const storage = createMemoryStorage();
    installAppSettings(createAppSettingsRepo(storage));

    setVentedLimits(NARROW);

    // A SECOND repo over the same storage is what a reload is — it must read the band back.
    assert.deepEqual(createAppSettingsRepo(storage).ventedLimits(), NARROW);
  });

  it("the engine reads the band at call time — a later write changes its answer, nothing rebuilt", () => {
    setVentedLimits(WIDE);
    assert.equal(engine.ventedVolumeIssue(1.684), null);

    setVentedLimits(NARROW);

    const issue = engine.ventedVolumeIssue(1.684);
    assert.notEqual(issue, null);
    assert.equal(issue?.kind, 'out-of-range');
  });

  it('marks an open project\'s cells when the band narrows', () => {
    setVentedLimits(WIDE);
    const project = opened(implausibleVentedProject());
    assert.deepEqual(project.box.vented.volume_m3.dq, []);

    setVentedLimits(NARROW);

    const dq = project.box.vented.volume_m3.dq;
    assert.equal(dq.length, 1);
    expect(dq[0]).toEqual({kind: 'out-of-range', quantity: 'Vb', value: 1.684, min: NARROW.minVb_m3, max: NARROW.maxVb_m3});
  });

  it('unmarks again when the band widens — the recall is not one-way', () => {
    setVentedLimits(NARROW);
    const project = opened(implausibleVentedProject());
    assert.equal(project.box.vented.volume_m3.dq.length, 1);

    setVentedLimits(WIDE);

    assert.deepEqual(project.box.vented.volume_m3.dq, []);
  });

  it('recalls EVERY open project, not only the focused one', () => {
    setVentedLimits(WIDE);
    const first = opened(implausibleVentedProject());
    const second = opened(implausibleVentedProject());
    // `addProject` focuses what it adds, so `first` is now a background tab.

    setVentedLimits(NARROW);

    assert.equal(first.box.vented.volume_m3.dq.length, 1, 'background project left stale');
    assert.equal(second.box.vented.volume_m3.dq.length, 1);
  });

  it('does not change the designed value, and does not make the project edited', () => {
    setVentedLimits(WIDE);
    const project = opened(implausibleVentedProject());
    project.save();

    setVentedLimits(NARROW);

    assert.equal(project.box.vented.volume_m3.value, 1.684);
    assert.equal(project.isModified(), false);
  });
});

/** An environment nothing ships with. */
const ARCTIC: EnvDefaults = {tempK: 250, humidityPct: 80, pressurePa: 99000};

describe('appState — the environment defaults, Options → General → Environment', () => {
  it('starts on the factory environment', () => {
    assert.deepEqual(envDefaults(), DEFAULT_ENV_DEFAULTS);
  });

  it('reads the environment from the repo the composition root installed', () => {
    const repo = createAppSettingsRepo(createMemoryStorage());
    repo.setEnvDefaults(ARCTIC);

    installAppSettings(repo);

    assert.deepEqual(envDefaults(), ARCTIC);
  });

  it('writes the environment through the installed repo, so it survives a reload', () => {
    const storage = createMemoryStorage();
    installAppSettings(createAppSettingsRepo(storage));

    setEnvDefaults(ARCTIC);

    assert.deepEqual(createAppSettingsRepo(storage).envDefaults(), ARCTIC);
  });

  it("a project with no environment of its own reads the new default as calculated — nothing rebuilt", () => {
    const project = opened(implausibleVentedProject());
    assert.equal(project.envTempK.entered, false);
    assert.equal(project.envTempK.value, DEFAULT_ENV_DEFAULTS.tempK);

    setEnvDefaults(ARCTIC);

    assert.equal(project.envTempK.value, ARCTIC.tempK);
    assert.equal(project.envTempK.calculated, true);
    assert.equal(project.envHumidityPct.value, ARCTIC.humidityPct);
    assert.equal(project.envPressurePa.value, ARCTIC.pressurePa);
  });

  it("a project's own entered environment is untouched by the app default changing", () => {
    const project = opened(implausibleVentedProject());
    project.envTempK.set(300);

    setEnvDefaults(ARCTIC);

    assert.equal(project.envTempK.value, 300);
    assert.equal(project.envTempK.entered, true);
  });

  it('notifies EVERY open project so its readouts repaint, not only the focused one', () => {
    const first = opened(implausibleVentedProject());
    const second = opened(implausibleVentedProject());
    let firstNotified = 0;
    let secondNotified = 0;
    first.subscribe(() => { firstNotified++; });
    second.subscribe(() => { secondNotified++; });

    setEnvDefaults(ARCTIC);

    // The background project hears exactly the one recall. The focused one hears more: the
    // vent-group watcher on `live` re-solves against the new air and its writes notify too.
    assert.equal(firstNotified, 1, 'background project not repainted');
    assert.ok(secondNotified >= 1, 'focused project not repainted');
  });

  it('does not make the project edited', () => {
    const project = opened(implausibleVentedProject());
    project.save();

    setEnvDefaults(ARCTIC);

    assert.equal(project.isModified(), false);
  });
});
