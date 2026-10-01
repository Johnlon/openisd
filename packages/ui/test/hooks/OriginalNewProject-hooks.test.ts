import { describe, expect, it } from 'vitest';
import {DEFAULT_ENV_DEFAULTS, type Engine, createEngine, type VentedDesignLimits} from '@openisd/design/engine';
import { OpenISDDriver } from '@openisd/design';
import { NEW_PROJECT_VENTED_QL, type NewProjectPassiveRadiatorRepos, useOgNewProject } from '../../src/hooks/OriginalNewProject-hooks.js';
import { OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import { type BundledPassiveRadiatorRepo, createMemoryStorage, createMyPassiveRadiatorRepo } from '@openisd/persistence';
import { vi } from 'vitest';

/** No bundled catalogue: a test that reaches it has gone somewhere it did not mean to. */
const noBundled: BundledPassiveRadiatorRepo = {
  index: () => Promise.reject(new Error('no bundled catalogue in this test')),
  load: () => Promise.reject(new Error('no bundled catalogue in this test')),
};

/** Saved radiators over memory storage, and no bundled catalogue. */
function testPassiveRadiators(bundled: BundledPassiveRadiatorRepo = noBundled): NewProjectPassiveRadiatorRepos {
  return { saved: createMyPassiveRadiatorRepo(createMemoryStorage()), bundled };
}

/** A radiator stating the five parameters WinISD's wizard step asks for. */
function testRadiator(model: string): OpenISDPassiveRadiatorStandalone {
  const pr = OpenISDPassiveRadiatorStandalone.empty();
  pr.model.set(model);
  pr.spec.Vas_m3.set(0.05);
  pr.spec.Qms.set(5);
  pr.spec.Fs_hz.set(20);
  pr.spec.Sd_m2.set(0.05);
  pr.spec.Xmax_m.set(0.01);
  return pr;
}

/** An engine judging designed vented boxes against `band` — the shape the Settings tab writes. */
const engineWithBand = (band: VentedDesignLimits) =>
  createEngine({ ventedLimits: () => band, envDefaults: () => DEFAULT_ENV_DEFAULTS });

interface TestDriverParams {
  Fs?: number; Qes?: number; Qms?: number; Qts?: number; Re_ohm?: number; Vas_m3?: number;
}

function createTestDriver(engine: Engine, params?: TestDriverParams) {
  const driver = OpenISDDriver.empty(engine);
  driver.model.set('Test Woofer');
  driver.brand.set('Test Brand');
  driver.specs.Fs_hz.set(params?.Fs ?? 40);
  driver.specs.Qes.set(params?.Qes ?? 0.45);
  if (params?.Qms != null) driver.specs.Qms.set(params.Qms);
  driver.specs.Qts.set(params?.Qts ?? 0.38);
  if (params?.Re_ohm != null) driver.specs.Re_ohm.set(params.Re_ohm);
  driver.specs.Vas_m3.set(params?.Vas_m3 ?? 0.03); // 30 L
  return driver;
}

/** The WinISD capture driver (winisd_research/runs/vented_alignments.jsonl): Fs 40, Vas 20 L,
 *  Qms 4, Re 6, Qes 0.432133 → Qts 0.39. */
function captureDriver(engine: Engine) {
  return createTestDriver(engine, { Fs: 40, Qes: 0.432133, Qms: 4, Qts: 0.39, Re_ohm: 6, Vas_m3: 0.02 });
}

describe('useOgNewProject', () => {
  it('initializes at step 1 and requires a driver selection before advancing', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine });

    expect(wizard.step.value).toBe(1);
    expect(wizard.canBack.value).toBe(false);
    expect(wizard.canNext.value).toBe(false);

    const driver = createTestDriver(engine);
    wizard.selectDriver(driver);

    expect(wizard.selectedDriver.value).toBe(driver);
    expect(wizard.canNext.value).toBe(true);
  });

  it('step 1 previews the chosen driver as Fs / Qts / Vas display strings, empty when nothing is chosen', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine });
    expect(wizard.selectedDriverSpecs.value).toEqual([]);

    wizard.selectDriver(createTestDriver(engine, { Fs: 40, Qts: 0.38, Vas_m3: 0.03 }));
    expect(wizard.selectedDriverSpecs.value).toEqual(['Fs: 40 Hz', 'Qts: 0.38', 'Vas: 30.0 L']);
  });

  it('initializes with pre-loaded driver if provided', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine);
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    expect(wizard.selectedDriver.value).toBe(driver);
    expect(wizard.canNext.value).toBe(true);
  });

  it('navigates through all 5 steps when box type is sealed', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine);
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    // Step 1 -> 2
    expect(wizard.step.value).toBe(1);
    wizard.next();
    expect(wizard.step.value).toBe(2);

    // Step 2 -> 3
    wizard.next();
    expect(wizard.step.value).toBe(3);
    expect(wizard.boxType.value).toBe('sealed');

    // Step 3 -> 4 (Sealed Alignment)
    wizard.next();
    expect(wizard.step.value).toBe(4);
    expect(wizard.currentStepNumber.value).toBe(4);
    expect(wizard.totalSteps.value).toBe(5);

    // Step 4 -> 5 (Project Info)
    wizard.next();
    expect(wizard.step.value).toBe(5);
    expect(wizard.currentStepNumber.value).toBe(5);
    expect(wizard.totalSteps.value).toBe(5);

    // Navigating back 5 -> 4 -> 3 -> 2 -> 1
    wizard.back();
    expect(wizard.step.value).toBe(4);
    wizard.back();
    expect(wizard.step.value).toBe(3);
    wizard.back();
    expect(wizard.step.value).toBe(2);
    wizard.back();
    expect(wizard.step.value).toBe(1);
  });

  it('skips step 4 when box type is bandpass4 (no alignment step built yet)', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine);
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    // Go to step 3
    wizard.next();
    wizard.next();
    expect(wizard.step.value).toBe(3);

    wizard.boxType.value = 'bandpass4';
    expect(wizard.totalSteps.value).toBe(4);

    // Step 3 -> 5 (skipping step 4)
    wizard.next();
    expect(wizard.step.value).toBe(5);
    expect(wizard.currentStepNumber.value).toBe(4);

    // Back from 5 -> 3
    wizard.back();
    expect(wizard.step.value).toBe(3);
  });

  it('gives vented a step 4 (alignment), same slot sealed uses', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine);
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    wizard.next();
    wizard.next();
    expect(wizard.step.value).toBe(3);

    wizard.boxType.value = 'vented';
    expect(wizard.totalSteps.value).toBe(5);

    // Step 3 -> 4 (Vented Alignment)
    wizard.next();
    expect(wizard.step.value).toBe(4);
    expect(wizard.currentStepNumber.value).toBe(4);

    // Step 4 -> 5 (Project Info)
    wizard.next();
    expect(wizard.step.value).toBe(5);
    expect(wizard.currentStepNumber.value).toBe(5);

    // Back 5 -> 4 -> 3
    wizard.back();
    expect(wizard.step.value).toBe(4);
    wizard.back();
    expect(wizard.step.value).toBe(3);
  });

  it('offers WinISD\'s five vented alignments and opens on C4/SC4', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: captureDriver(engine) });
    wizard.boxType.value = 'vented';

    expect(wizard.VENTED_ALIGNMENT_OPTIONS.map(o => o.value)).toEqual(['qb3', 'bb4', 'c4', 'ebs3', 'ebs6']);
    expect(wizard.selectedVentedAlignment.value).toBe('c4');
  });

  it('designs the vented box as WinISD does: source-loaded Qts at the project\'s Rg, box Ql, chosen alignment', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: captureDriver(engine) });
    wizard.boxType.value = 'vented';

    // WinISD capture, C4 at Qts 0.39 with Rg 0.1 Ω, Ql 10: Vb 17.2885792662035 L, Fb 40.6761517251006 Hz.
    expect(wizard.ventedVolume_L.value).toBeCloseTo(17.2885792662035, 9);
    expect(wizard.ventedTuning_hz.value).toBeCloseTo(40.6761517251006, 9);

    // EBS6 at the same Qts: Vb 37.6196150654936 L, Fb 23.8186393055339 Hz.
    wizard.selectVentedAlignment('ebs6');
    expect(wizard.selectedVentedAlignment.value).toBe('ebs6');
    expect(wizard.ventedVolume_L.value).toBeCloseTo(37.6196150654936, 9);
    expect(wizard.ventedTuning_hz.value).toBeCloseTo(23.8186393055339, 9);

    const project = wizard.createProject();
    expect(project?.box.vented.volume_m3.value).toBeCloseTo(wizard.ventedVolume_L.value / 1000, 12);
    expect(project?.box.vented.tuning_goal_hz.value).toBeCloseTo(wizard.ventedTuning_hz.value, 12);
  });

  it("the wizard preview's Ql is the SCHEMA's new-project Ql, not a hook-local copy (plan FIX_WIZARD_VENTED-remains #3)", () => {
    // The preview constant and the box record's starting value must be ONE declaration: if the
    // schema's NO_VENTED_LOSSES ever changes, a hook-local `10` would silently disagree with
    // the project the wizard creates. The design is made from the created project's OWN Ql
    // (openisdTransforms afterWrap), so the preview must read the same source.
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: captureDriver(engine) });
    wizard.boxType.value = 'vented';
    wizard.selectVentedAlignment('bb4');
    const previewVb_m3 = wizard.ventedVolume_L.value / 1000;

    const project = wizard.createProject();
    expect(project).not.toBeNull();
    if (!project) return;
    const qtsLoaded = project.driver.sourceLoadedQts(project.Rs_ohm.value);
    expect(qtsLoaded).not.toBeNull();
    if (qtsLoaded === null) return;
    const fromProject = engine.vented.alignment(
      'bb4', 40, qtsLoaded, 0.02, project.box.vented.losses.Ql.value,
    );
    expect(previewVb_m3).toBeCloseTo(fromProject.Vb, 12);
    // And the constants are literally shared — the hook no longer carries its own literal.
    expect(NEW_PROJECT_VENTED_QL).toBe(project.box.vented.losses.Ql.value);
  });

  it('the preview uses the same Rg and Ql the created project carries', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: captureDriver(engine) });
    wizard.boxType.value = 'vented';
    wizard.selectVentedAlignment('bb4');
    const previewVb_m3 = wizard.ventedVolume_L.value / 1000;

    const project = wizard.createProject();
    expect(project).not.toBeNull();
    if (!project) return;
    const qtsLoaded = project.driver.sourceLoadedQts(project.Rs_ohm.value);
    expect(qtsLoaded).not.toBeNull();
    if (qtsLoaded === null) return;
    const fromProject = engine.vented.alignment('bb4', 40, qtsLoaded, 0.02, project.box.vented.losses.Ql.value);
    expect(previewVb_m3).toBeCloseTo(fromProject.Vb, 12);
  });

  it('computes EBP and suitability readout correctly', () => {
    const engine = createEngine();
    // Driver with Fs=35, Qes=0.8 -> EBP = 43.75 < 50 -> Sealed preferred
    const sealedDriver = createTestDriver(engine, { Fs: 35, Qes: 0.8 });
    const wizardSealed = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: sealedDriver });

    expect(wizardSealed.ebp.value).toBeCloseTo(43.75, 1);
    expect(wizardSealed.ebpSuitability.value).toBe('sealed');
    expect(wizardSealed.ebpSuitabilityLabel.value).toBe('Sealed preferred');

    // Driver with Fs=30, Qes=0.2 -> EBP = 150 -> Vented preferred
    const ventedDriver = createTestDriver(engine, { Fs: 30, Qes: 0.2 });
    const wizardVented = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: ventedDriver });

    expect(wizardVented.ebp.value).toBeCloseTo(150, 1);
    expect(wizardVented.ebpSuitability.value).toBe('vented');
    expect(wizardVented.ebpSuitabilityLabel.value).toBe('Vented preferred');
  });

  it('calculates sealed volume on step 4 when selecting Qtc alignment', () => {
    const engine = createEngine();
    // Qts = 0.38, Vas = 0.03 m3 (30 L)
    const driver = createTestDriver(engine, { Qts: 0.38, Vas_m3: 0.03 });
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    wizard.selectSealedAlignment(0.707);
    expect(wizard.sealedVolume_L.value).toBeGreaterThan(0);
    expect(wizard.qtc.value).toBeCloseTo(0.707, 2);
    expect(wizard.selectedSealedAlignment.value?.value).toBeCloseTo(0.707, 2);

    // Editing volume directly updates qtc and closest alignment option
    wizard.setSealedVolume_L(15);
    expect(wizard.sealedVolume_L.value).toBe(15);
    expect(wizard.qtc.value).toBeGreaterThan(0);
    expect(wizard.selectedSealedAlignment.value).not.toBeNull();
  });

  it('a passive-radiator project keeps the starting volume — the sealed alignment volume never leaks into it', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine });
    wizard.selectDriver(createTestDriver(engine, { Qts: 0.38, Vas_m3: 0.03 }));
    wizard.boxType.value = 'box-passive-radiator';
    wizard.defineNewPassiveRadiator();
    wizard.projName.value = 'PR';

    // Picking the driver derives the 0.707 sealed volume — a different number from the 7 L default.
    expect(wizard.sealedVolume_L.value).not.toBeCloseTo(7, 3);
    expect(wizard.vol.value).toBe(7);

    const project = wizard.createProject();
    expect(project?.box.passiveRadiator.volume_m3.value).toBeCloseTo(0.007, 6);
  });

  it('rounds the derived sealed volume to 2dp instead of showing the raw calculation', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine, { Qts: 0.38, Vas_m3: 0.03 });
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    wizard.selectSealedAlignment(0.6);

    expect(wizard.sealedVolume_L.value).toBe(20.09);
  });

  it('picking a driver on step 1 moves the wizard on to step 2 — "Use" advances, it does not just arm Next', () => {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine });

    expect(wizard.step.value).toBe(1);
    wizard.selectDriver(createTestDriver(engine));

    expect(wizard.step.value).toBe(2);
  });

  it('preserves state when navigating Back and Next', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine);
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    // Step 2: edit nDrivers & wiring
    wizard.next();
    wizard.nDrivers.value = 2;
    wizard.wiring.value = 'series';

    // Step 3: edit boxType and volume
    wizard.next();
    wizard.boxType.value = 'bandpass4';
    wizard.vol.value = 25;
    wizard.frontVol.value = 15;

    // Step 5: edit project name
    wizard.next();
    wizard.projName.value = 'Subwoofer Deluxe';
    wizard.projDescription.value = 'Custom 4th order bandpass';

    // Navigate back to step 1
    wizard.back(); // 3
    wizard.back(); // 2
    wizard.back(); // 1

    // Verify all preserved
    expect(wizard.nDrivers.value).toBe(2);
    expect(wizard.wiring.value).toBe('series');
    expect(wizard.boxType.value).toBe('bandpass4');
    expect(wizard.vol.value).toBe(25);
    expect(wizard.frontVol.value).toBe(15);
    expect(wizard.projName.value).toBe('Subwoofer Deluxe');
    expect(wizard.projDescription.value).toBe('Custom 4th order bandpass');
  });

  it('creates a project with all configured parameters on completion', () => {
    const engine = createEngine();
    const driver = createTestDriver(engine);
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: driver });

    wizard.nDrivers.value = 2;
    wizard.wiring.value = 'parallel';
    wizard.boxType.value = 'sealed';
    wizard.setSealedVolume_L(20);
    wizard.projName.value = 'My Sealed Sub';
    wizard.projDescription.value = 'Test description';

    const project = wizard.createProject();
    expect(project).not.toBeNull();
    if (project) {
      expect(project.name.value).toBe('My Sealed Sub');
      expect(project.description.value).toBe('Test description');
      expect(project.nDrivers.value).toBe(2);
      expect(project.wiring.value).toBe('parallel');
      expect(project.box.boxType.value).toBe('sealed');
      expect(project.box.sealed.volume_m3.value).toBeCloseTo(0.02, 4);
    }
  });
});

/**
 * Step 4's vented readout says when the designed box is implausible.
 *
 * WinISD does not clamp its alignment polynomials and OpenISD matches
 * it bit-exact, so the number on screen matches WinISD and stays put (John 2026-09-22: "keep parity
 * and use dq — this is the way"). The readout MARKS it instead: the wizard is the one surface
 * where the user meets a designed value before a project exists to carry a cell's DQ.
 *
 * The band is an application setting, so every test here states its own rather than leaning on
 * whatever the factory band happens to be.
 */
describe('useOgNewProject — vented plausibility readout', () => {
  /** Rejects nothing an ordinary driver designs. */
  const WIDE: VentedDesignLimits = { minVb_m3: 1e-9, maxVb_m3: 1e9, minFb_hz: 1e-9, maxFb_hz: 1e9 };

  /** A wizard sitting on step 4 with a vented box and the capture driver chosen. */
  function ventedWizard(engine: Engine) {
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(), areas: engine, initialDriver: captureDriver(engine) });
    wizard.boxType.value = 'vented';
    return wizard;
  }

  it('says nothing when the designed box is inside the band', () => {
    const wizard = ventedWizard(engineWithBand(WIDE));

    expect(wizard.ventedVolumeWarning.value).toBeNull();
    expect(wizard.ventedTuningWarning.value).toBeNull();
  });

  it('warns about the volume when the designed box is outside the band', () => {
    // maxVb 1 mL — every real design is above it, so this asks the question without depending
    // on which alignment the wizard happens to start on.
    const band: VentedDesignLimits = { ...WIDE, maxVb_m3: 0.000001 };
    const wizard = ventedWizard(engineWithBand(band));

    const warning = wizard.ventedVolumeWarning.value;
    expect(warning).not.toBeNull();
    expect(warning).toMatch(/WinISD/);
    expect(wizard.ventedTuningWarning.value).toBeNull();
  });

  it('warns about the tuning when the designed tuning is outside the band', () => {
    const band: VentedDesignLimits = { ...WIDE, minFb_hz: 10000 };
    const wizard = ventedWizard(engineWithBand(band));

    expect(wizard.ventedTuningWarning.value).not.toBeNull();
    expect(wizard.ventedVolumeWarning.value).toBeNull();
  });

  it('leaves the designed numbers exactly as WinISD designs them — the mark is not a clamp', () => {
    const wide = ventedWizard(engineWithBand(WIDE));
    const narrow = ventedWizard(engineWithBand({ ...WIDE, maxVb_m3: 0.000001, minFb_hz: 10000 }));

    expect(narrow.ventedVolume_L.value).toBe(wide.ventedVolume_L.value);
    expect(narrow.ventedTuning_hz.value).toBe(wide.ventedTuning_hz.value);
  });

  it('says nothing for a sealed design — there is no vented box to judge', () => {
    const wizard = useOgNewProject({ passiveRadiators: testPassiveRadiators(),
      areas: engineWithBand({ ...WIDE, maxVb_m3: 0.000001, minFb_hz: 10000 }),
      initialDriver: captureDriver(engineWithBand(WIDE)),
    });
    wizard.boxType.value = 'sealed';

    expect(wizard.ventedVolumeWarning.value).toBeNull();
    expect(wizard.ventedTuningWarning.value).toBeNull();
  });

  it('re-judges when the alignment changes — each alignment designs its own box', () => {
    const wizard = ventedWizard(engineWithBand(WIDE));
    expect(wizard.ventedVolumeWarning.value).toBeNull();

    const narrow = ventedWizard(engineWithBand({ ...WIDE, maxVb_m3: 0.000001 }));
    const first = narrow.ventedVolumeWarning.value;
    narrow.selectVentedAlignment('c4');
    const second = narrow.ventedVolumeWarning.value;

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });
});

// WinISD's wizard has a passive-radiator step after the box type: pick or enter the radiator
// (Vas / Qms / Fs / Sd / Xmax). bugs/BUG_20261001_new-project-wizard-skips-the-passive-radiator-step.md
describe('useOgNewProject — passive-radiator step', () => {
  function atBoxTypeStep(passiveRadiators: NewProjectPassiveRadiatorRepos) {
    const engine = createEngine();
    const wizard = useOgNewProject({ passiveRadiators, areas: engine, initialDriver: createTestDriver(engine) });
    wizard.next();
    wizard.next();
    wizard.boxType.value = 'box-passive-radiator';
    return wizard;
  }

  it('a passive-radiator box gets step 4, the radiator, and Next waits until one is chosen', () => {
    const wizard = atBoxTypeStep(testPassiveRadiators());
    expect(wizard.totalSteps.value).toBe(5);

    wizard.next();
    expect(wizard.step.value).toBe(4);
    expect(wizard.stepLabel.value).toBe('Passive Radiator');
    expect(wizard.canNext.value).toBe(false);

    wizard.passiveRadiatorBrowseOpen.value = true;
    wizard.defineNewPassiveRadiator();
    expect(wizard.passiveRadiatorBrowseOpen.value).toBe(false);
    expect(wizard.canNext.value).toBe(true);
    wizard.next();
    expect(wizard.step.value).toBe(5);
    wizard.back();
    expect(wizard.step.value).toBe(4);
  });

  it('a saved radiator chosen at step 4 is the one the project is built with', () => {
    const repos = testPassiveRadiators();
    const saved = repos.saved.upsert(testRadiator('Saved PR'));
    if (saved === null) throw new Error('memory storage refused the save');
    const wizard = atBoxTypeStep(repos);
    wizard.next();

    wizard.loadSavedPassiveRadiator(saved.uuid);
    wizard.next();
    wizard.projName.value = 'With PR';
    const project = wizard.createProject();

    const radiator = project?.box.passiveRadiator.radiator;
    expect(radiator?.model.value).toBe('Saved PR');
    expect(radiator?.spec.Sd_m2.value).toBeCloseTo(0.05, 9);
    expect(radiator?.spec.Fs_hz.value).toBeCloseTo(20, 9);
  });

  it('a bundled radiator is loaded through the catalogue', async () => {
    const load = vi.fn<BundledPassiveRadiatorRepo['load']>(() => Promise.resolve(testRadiator('Bundled PR')));
    const wizard = atBoxTypeStep(testPassiveRadiators({ index: () => Promise.resolve([]), load }));
    wizard.next();

    await wizard.loadBundledPassiveRadiator('bundled-1');

    expect(load).toHaveBeenCalledWith('bundled-1');
    expect(wizard.passiveRadiatorView.value?.name).toBe('Bundled PR');
  });

  it('a radiator defined at step 4 carries the five parameters typed into it', () => {
    const wizard = atBoxTypeStep(testPassiveRadiators());
    wizard.next();

    wizard.defineNewPassiveRadiator();
    const edits = wizard.passiveRadiatorEdits;
    edits.setVas_m3(0.04);
    edits.setQms(6);
    edits.setFs_hz(18);
    edits.setSd_m2(0.06);
    edits.setXmax_m(0.012);
    expect(wizard.passiveRadiatorView.value?.Qms).toBe(6);
    wizard.next();
    wizard.projName.value = 'Typed PR';

    const spec = wizard.createProject()?.box.passiveRadiator.radiator.spec;
    expect(spec?.Vas_m3.value).toBeCloseTo(0.04, 9);
    expect(spec?.Qms.value).toBeCloseTo(6, 9);
    expect(spec?.Fs_hz.value).toBeCloseTo(18, 9);
    expect(spec?.Sd_m2.value).toBeCloseTo(0.06, 9);
    expect(spec?.Xmax_m.value).toBeCloseTo(0.012, 9);
  });
});
