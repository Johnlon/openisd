import {describe, expect, it} from 'vitest';
import {type DriverError, createEngine} from '@openisd/design/engine';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {isRecord, at, specSection, prSpecSection, driverFrom, driverJson} from '../fixtures/domainBuilders.js';

describe('editing a driver — copy, then update or drop', () => {
  const wooferDriver = () => driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  });

  it('leaves the project untouched until the copy is written back', () => {
    const mp = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();

    // What an editor does: take a copy, edit THAT, and only then decide.
    const working = mp.driver.detach();
    working.specs.Fs_hz.set(123);
    expect(mp.driver.specs.Fs_hz.value).toBe(30);   // cancel = just drop `working`

    const second = mp.driver.detach();
    second.specs.Fs_hz.set(61);
    mp.driver.update(second);                        // ok
    expect(mp.driver.specs.Fs_hz.value).toBe(61);
  });

  it('works identically on a standalone driver — the same two calls, whatever the origin', () => {
    const original = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.specs.Fs_hz.set(200);
    expect(original.specs.Fs_hz.value).toBe(30);

    original.update(working);
    expect(original.specs.Fs_hz.value).toBe(200);
  });

  it('update() takes a deep copy — a later edit on the source does not reach the target', () => {
    const target = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();
    const source = target.detach();
    source.specs.Fs_hz.set(111111);

    target.update(source);
    expect(target.specs.Fs_hz.value).toBe(111111);

    // The source's nested spec object must not still be shared with the target.
    source.specs.Fs_hz.set(222222);
    expect(target.specs.Fs_hz.value).toBe(111111);
  });

  it('setDriver() takes a deep copy — a later edit on the source does not reach the project', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    const source = project.driver.detach();
    source.specs.Fs_hz.set(333333);

    project.setDriver(source);
    expect(project.driver.specs.Fs_hz.value).toBe(333333);

    source.specs.Fs_hz.set(444444);
    expect(project.driver.specs.Fs_hz.value).toBe(333333);
  });

  it('adopting a standalone driver gives the embedded project record a fresh UUID', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    const source = wooferDriver();

    project.loadDriver(source);

    expect(project.driver.uuid()).not.toBe(source.uuid());
  });

  it('discards an edit by dropping the copy — nothing to roll back', () => {
    const original = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.specs.Fs_hz.set(500);
    // no update() — the copy simply goes out of scope

    expect(original.specs.Fs_hz.value).toBe(30);
  });

  it('loadDriver() takes a deep copy — a later edit on the source does not reach the project', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    const source = project.driver.detach();
    source.specs.Fs_hz.set(555555);

    project.loadDriver(source);
    expect(project.driver.specs.Fs_hz.value).toBe(555555);

    source.specs.Fs_hz.set(666666);
    expect(project.driver.specs.Fs_hz.value).toBe(555555);

    expect(() => project.loadDriver(project.driver)).toThrow(/standalone/i);
  });

  it('embedding a driver that states its own c/roo strips them — the project is the sole source', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    project.envTempK.set(250);   // far from the reference default, so a leaked driver value is obvious
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    const source = wooferDriver();
    source.specs.c_m_per_s.set(999);
    source.specs.roo_kg_per_m3.set(5);

    project.setDriver(source);

    expect(project.driver.specs.c_m_per_s.calculated).toBe(true);
    expect(project.driver.specs.roo_kg_per_m3.calculated).toBe(true);
    const projectAir = createEngine().environment.solve({ tempK: 250, humidityPct: 80, pressurePa: 90000, useWinisdAirModel: true }).values;
    expect(project.driver.specs.c_m_per_s.value).toBeCloseTo(projectAir.c, 6);
    expect(project.driver.specs.roo_kg_per_m3.value).toBeCloseTo(projectAir.rho, 6);
    // Never 999/5 — the driver's own stated pair must not survive embedding.
    expect(project.driver.specs.c_m_per_s.value).not.toBeCloseTo(999, 0);
  });

  it("a stale c/roo already sitting in an embedded driver's record (pre-existing data, or any " +
    'write that bypasses setDriver/loadDriver) is still ignored by both the solver and .wdr export ' +
    "— the project's environment wins regardless of how the stale value got there", () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    project.envTempK.set(250);
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    // Simulate data saved by a version of openisd before the strip existed (`fromOwprText` loads
    // a record directly, bypassing `setDriver`/`loadDriver` entirely, so nothing retroactively
    // clears a value written under the old rules) by writing straight onto the embedded driver's
    // own field — the one other way a stale value could end up here.
    //
    // S2-10: `OpenISDDriverEmbedded.resolve()` now clears `c_m_per_s`/`roo_kg_per_m3` on EVERY
    // resolve (not just on `update()`), so the write below is undone by the SAME synchronous
    // cascade it triggers — there is no longer an intermediate tick where this record
    // observably holds an 'entered' stale pair to assert on; the guarantee is stronger than
    // before, not merely preserved, so that checkpoint is gone rather than weakened.
    project.driver.specs.c_m_per_s.set(999);
    project.driver.specs.roo_kg_per_m3.set(5);

    const projectAir = createEngine().environment.solve({ tempK: 250, humidityPct: 80, pressurePa: 90000, useWinisdAirModel: true }).values;
    const ts = project.driver.specs;
    expect(ts.c_m_per_s.value).toBeCloseTo(projectAir.c, 6);
    expect(ts.roo_kg_per_m3.value).toBeCloseTo(projectAir.rho, 6);

    const { value: wdrText, errors } = project.driver.toWdrIniText();
    expect(errors).toEqual([]);
    expect(wdrText).not.toBeNull();
    expect(wdrText).toContain(`c=${projectAir.c}`);
    expect(wdrText).toContain(`roo=${projectAir.rho}`);
    expect(wdrText).not.toContain('c=999');
    expect(wdrText).not.toContain('roo=5\n');
  });

  it('loading a project file gives its embedded driver a fresh project-owned UUID', () => {
    const original = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    const originalDriverUuid = original.driver.uuid();

    const loaded = OpenISDProject.fromOwprText(original.toOwprText(), createEngine());
    if (Array.isArray(loaded)) throw new Error(loaded.join(', '));

    expect(loaded.driver.uuid()).not.toBe(originalDriverUuid);
  });

  it('renameToCopy() prefixes the model so the copy is a distinct brand/model', () => {
    const driver = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();
    expect(driver.model.value).toBe('RS225');

    driver.renameToCopy();
    expect(driver.model.value).toBe('Copy of RS225');
  });

  it('toOwdrText() then OpenISDDriver.fromOwdrText() round-trips a driver through .owdr text', () => {
    const driver = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.specs.Fs_hz.set(41.5);

    const text = driver.toOwdrText();
    expect(typeof text).toBe('string');

    const back = OpenISDDriver.fromOwdrText(text, createEngine());
    if (Array.isArray(back)) throw new Error('fromOwdrText returned problems: ' + back.join(', '));
    expect(back.specs.Fs_hz.value).toBe(41.5);
    expect(back.model.value).toBe('RS225');
  });

  it('.owdr text is JSON, not YAML — the openisd record is JSON text (openisd.json)', () => {
    const driver = wooferDriver();
    const text = driver.toOwdrText();

    expect(() => { JSON.parse(text); }).not.toThrow();
    expect(text.trimStart().startsWith('{')).toBe(true);
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error('expected an object');
    expect(parsed.quality).toBeDefined();
    expect(parsed.brand).toBeDefined();
    expect(parsed.specs).toBeDefined();
    expect('uuid' in parsed).toBe(false);
  });

  it('drops the record UUID on .owdr export and mints a new one on import', () => {
    const driver = wooferDriver();
    const originalUuid = driver.cloneDriver().uuid.value;

    const text = driver.toOwdrText();

    expect(text).not.toContain('uuid:');
    const imported = OpenISDDriver.fromOwdrText(text, createEngine());
    if (Array.isArray(imported)) throw new Error(imported.join(', '));
    expect(imported.cloneDriver().uuid.value).not.toBe(originalUuid);
  });

  it('mints a new record UUID when making a named copy', () => {
    const driver = wooferDriver();
    const originalUuid = driver.cloneDriver().uuid.value;

    driver.renameToCopy();

    expect(driver.cloneDriver().uuid.value).not.toBe(originalUuid);
    expect(driver.model.value).toBe('Copy of RS225');
  });

  it('toWdrIniText() then WinIsdDriverConverter() round-trips a driver through WinISD .wdr text', () => {
    const driver = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.specs.Fs_hz.set(41.5);

    const { value: text, errors } = driver.toWdrIniText();
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (text === null) throw new Error('toWdrIniText produced no text');

    const back = new WinIsdDriverConverter(createEngine()).winIsdDriverToOpenIsdDriver(text);
    if (back.value === null) throw new Error('winIsdDriverToOpenIsdDriver returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.specs.Fs_hz.value).toBeCloseTo(41.5, 3);
    expect(back.value.model.value).toBe('RS225');
  });

  it('WinIsdProjectConverter round-trips a project through WinISD .wpr text', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (wpr === null) throw new Error('openIsdProjectToWinIsdProject produced no project');

    const back = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
    if (back.value === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.box.boxType.value).toBe('sealed');
    expect(back.value.driver.model.value).toBe('RS225');
  });

  it('the converter round-trips a bandpass6 box (BType=3) — see winisd/winIsdProjectToOpenIsdProject.test.ts for the full coverage', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine())
      .bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.03).frontTuning_hz(40).build();

    const { value: wpr, errors } = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (wpr === null) throw new Error('openIsdProjectToWinIsdProject produced no project');

    const back = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
    if (back.value === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.box.boxType.value).toBe('bandpass6');
  });

  it('clonePassiveRadiator() gives the record back, deep-cloned so an edit after the call cannot reach it', () => {
    const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
      brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
    }));
    if (Array.isArray(pr)) throw new Error('fixture radiator must conform: ' + pr.join('; '));

    const stored = pr.clonePassiveRadiator();
    pr.model.set('changed after the clone');

    const back = OpenISDPassiveRadiatorStandalone.fromConformingRecord(stored);
    if (Array.isArray(back)) throw new Error('the cloned record must conform: ' + back.join('; '));
    expect(back.model.value).toBe('SB23PACS');
  });

  it('toOwprText() then OpenISDProject.fromOwprText() round-trips a project through .owpr text', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    project.name.set('Kitchen sub');
    project.description.set('111111');

    const text = project.toOwprText();
    expect(typeof text).toBe('string');

    const back = OpenISDProject.fromOwprText(text, createEngine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.name.value).toBe('Kitchen sub');
    expect(back.description.value).toBe('111111');
    expect(back.box.boxType.value).toBe('sealed');
  });

  it('OpenISDProject.fromOwprText() answers with problems rather than throwing on text that is not a project', () => {
    const back = OpenISDProject.fromOwprText('{"nope":1}', createEngine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

  it('a saved project with a driver in the radiator slot, or a radiator in the driver slot, is refused', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    const parsed: unknown = JSON.parse(project.toOwprText());
    if (!isRecord(parsed)) throw new Error('expected an object');
    const saved = at(parsed, 'saved');
    if (!isRecord(saved)) throw new Error('expected saved to be an object');
    const driverEmbedding = saved.driverEmbedding;
    if (!isRecord(driverEmbedding)) throw new Error('expected saved.driverEmbedding to be an object');
    const passiveRadiator = at(saved, 'box', 'passiveRadiator');
    if (!isRecord(passiveRadiator)) throw new Error('expected saved.box.passiveRadiator to be an object');
    const driverRecord = driverEmbedding.device;
    const radiatorRecord = passiveRadiator.component;

    passiveRadiator.component = driverRecord;
    const driverInRadiatorSlot = OpenISDProject.fromOwprText(JSON.stringify(parsed), createEngine());
    expect(driverInRadiatorSlot).toEqual(expect.arrayContaining([expect.stringMatching(/radiator slot holds a driver record/)]));

    passiveRadiator.component = radiatorRecord;
    driverEmbedding.device = radiatorRecord;
    const radiatorInDriverSlot = OpenISDProject.fromOwprText(JSON.stringify(parsed), createEngine());
    expect(radiatorInDriverSlot).toEqual(expect.arrayContaining([expect.stringMatching(/driver slot holds a passive-radiator record/)]));
  });

  it('OpenISDProject.fromOwprText() answers with problems rather than throwing on text that is not JSON', () => {
    const back = OpenISDProject.fromOwprText('not json at all', createEngine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

  it('a signal record stating nothing loads with P N', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    const parsed: unknown = JSON.parse(project.toOwprText());
    if (!isRecord(parsed)) throw new Error('expected an object');
    const saved = parsed.saved;
    if (!isRecord(saved)) throw new Error('expected saved to be an object');
    saved.signal = {};

    const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), createEngine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.powerDrive_W.value).toBe(null);
    expect(back.powerDrive_W.value).toBeNull();
  });

  it('OpenISDDriver.fromOwdrText() answers with problems rather than throwing on JSON that is not an object', () => {
    const back = OpenISDDriver.fromOwdrText('42', createEngine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a driver');
    expect(back.length).toBeGreaterThan(0);
  });

  it('OpenISDDriver.fromOwdrText() answers with problems naming the parse failure on text that is not JSON', () => {
    const back = OpenISDDriver.fromOwdrText('{not json', createEngine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a driver');
    expect(back.some(p => p.includes('not valid JSON'))).toBe(true);
  });

  it('OpenISDDriver.fromOwdrText() refuses text that parses fine but is a radiator record, not a driver\'s', () => {
    const {uuid: _uuid, ...radiatorJsonWithoutUuid} = driverJson({
      brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
    });

    const back = OpenISDDriver.fromOwdrText(JSON.stringify(radiatorJsonWithoutUuid), createEngine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a driver');
    expect(back.some(p => p.includes('no woofer section'))).toBe(true);
  });

  it('a driver.yml-only key (definition) present on imported .owdr text is stripped, not refused', () => {
    const driver = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build().driver.detach();
    const parsed: unknown = JSON.parse(driver.toOwdrText());
    if (!isRecord(parsed)) throw new Error('expected an object');
    parsed.definition = 'driver.yml only describes what a field means — never reaches an openisd record';

    const back = OpenISDDriver.fromOwdrText(JSON.stringify(parsed), createEngine());
    if (Array.isArray(back)) throw new Error('fromOwdrText returned problems: ' + back.join(', '));
    expect(back.model.value).toBe('RS225');
  });

  it('the converter takes a SNAPSHOT — the project it was given is not held or changed', () => {
    const project = new ProjectBuilder(wooferDriver(), createEngine()).sealed().volume_m3(0.03).build();
    project.description.set('before');

    new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);

    expect(project.description.value).toBe('before');
    expect(project.box.boxType.value).toBe('sealed');
  });

});
