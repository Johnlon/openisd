/**
 * Persistence — what survives a serialize round trip, and what a share link carries.
 *
 * Two properties, both real:
 *   1. A driver's PROVENANCE survives. An E field comes back E and a C field comes back C —
 *      because the record carries `readings`/`origin`, not a flat bag of numbers that would
 *      make a computed value indistinguishable from a measured one on reload.
 *   2. A share link carries the WHOLE state, stripped of nothing (human ruling 2026-08-14).
 *      A link that quietly differs from what the sender saw cannot diagnose what the sender saw.
 */
import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { OpenISDDriver, Provenance } from '@openisd/model';
import { WinISDDriver } from '@openisd/winisd';
import { serialize, stateToUrl, loadFromHash, upgradeParsedState } from '../../src/logic/persist.js';
import { state, managedProject, applyState } from '../../src/logic/appState.js';
import { presentationState } from '../../src/logic/presentationState.js';
import type { ProjectMeta, SerializedState, UiParams } from '../../src/types.js';
import type { PresentationState } from '../../src/logic/presentationState.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd', 'John-all-manu-populated.wdr');
const wdrText = readFileSync(SAMPLE, 'utf8');

// A minimal PresentationState — serialize only reads graphs off it here.
const miniView = { graphs: ['SPL'] } as unknown as PresentationState;

/** The sample `.wdr`, read as-read by the serialiser, as the driver's own persisted TEXT —
 *  the only form the driver takes in a serialised payload (QO73: the UI carries the managed
 *  layer's serialisation, never the record value). */
function sampleDriverText(): string {
  return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(wdrText)).toOwdrText();
}

describe('persistence — provenance survives a serialize round trip', () => {
  it('E stays E and C stays C across serialize → JSON → restore', () => {
    const src = OpenISDDriver.fromOwdrText(sampleDriverText());
    // Clear a derivable field so the fixture carries a genuine C (Cms recomputes from
    // Fs/Vas/Sd) alongside the E fields the WinISD save marks entered.
    src.clear('Cms');

    // The fixture must actually contain both an E and a C field, or the test is vacuous.
    assert.equal(src.cell('Fs').state, Provenance.Entered, 'fixture precondition: Fs entered');
    assert.equal(src.cell('Cms').state, Provenance.Calculated, 'fixture precondition: Cms now computed');

    const wire = JSON.parse(JSON.stringify(
      serialize('sealed', { name: 'John-all-manu-populated', creator: 'John', created: '2026-01-01',
        modified: '2026-01-02', description: '' }, miniView, src.toOwdrText(), {} as UiParams)));
    const back = OpenISDDriver.fromOwdrText(wire.driver);

    for (const f of ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'BL'] as const) {
      assert.equal(back.cell(f).state, src.cell(f).state,
        `cell(${f}).state must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', () => {
    const ser = serialize('sealed', { name: 'Provenance sample', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, miniView, sampleDriverText(), {} as UiParams);
    assert.ok(ser.driver, 'the driver payload travels');
    const record = JSON.parse(ser.driver!);
    assert.ok(record.specs, 'the driver payload is the openisd.yml record, serialised');
    assert.ok(record.specs.woofer?.Fs?.readings,
      'each field carries its readings, not a bare number — that is what makes E/C survivable');
  });

  it('a design with NO driver chosen serialises without inventing one', () => {
    const ser = serialize('sealed', { name: 'No driver yet', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, miniView, undefined, {} as UiParams);
    assert.equal(ser.driver, undefined,
      'a fake driver written to fill the slot would be indistinguishable on reload from one ' +
      'the user actually picked');
  });
});

/**
 * A share link is a COMPLETE description of the session: the recipient lands on exactly what
 * the sender was looking at. Nothing is stripped — not the open-panel flags, and not the
 * recipient-preference fields an earlier version removed (human ruling 2026-08-14).
 */
describe('share link carries the whole state, stripped of nothing', () => {
  const uiView = {
    graphs: ['SPL'],
    ui: {
      originalProjectTab: 'signal', originalChartTab: 'Excursion', originalChartLabel: 'Cone excursion',
      originalTuneOpen: true, originalEditorOpen: true,
      originalNavW: 320, originalBottomH: 200, originalNavCollapsed: true,
      originalBottomCollapsed: true, originalChartMax: true,
      username: 'johnl', envDefaults: { tempK: 300, pressurePa: 100000, humidityPct: 40 },
      chartColors: { background: '#ffffff' },
    },
  } as unknown as PresentationState;
  const drv = sampleDriverText();

  // stateToUrl reads location.{origin,pathname}; stub it (no jsdom needed) for the URL test.
  beforeAll(() => vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' }));
  afterAll(() => vi.unstubAllGlobals());

  // stateToUrl() gzips before base64url — reverse both with Node's zlib, independent of the
  // app's own CompressionStream path, so this checks what a browser would decode rather than
  // agreeing with the implementation about itself.
  function decodeShare(url: string): SerializedState {
    const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
  }

  it('every ui field travels — view context, open panels, local preferences and project meta alike', async () => {
    const project: ProjectMeta = {
      name: 'Kick bin', creator: 'John Lonergan', created: '2026-08-01T00:00:00.000Z',
      modified: '2026-08-14T12:30:00.000Z', description: 'PA subwoofer for the shed',
    };
    const shared = decodeShare(await stateToUrl(serialize('sealed', project, uiView, drv, {} as UiParams)));
    const ui = shared.ui as Record<string, unknown> | undefined;
    assert.ok(ui, 'the view context travels');

    // Project-level metadata is part of the session too — a share link that dropped it would
    // hand the recipient an anonymous, undated design.
    assert.equal(shared.project?.name, 'Kick bin');
    assert.equal(shared.project?.creator, 'John Lonergan');
    assert.equal(shared.project?.modified, '2026-08-14T12:30:00.000Z');

    // Where the sender was looking.
    assert.equal(ui!.originalProjectTab, 'signal');
    assert.equal(ui!.originalChartTab, 'Excursion');
    assert.equal(ui!.originalChartLabel, 'Cone excursion');

    // WHICH PANELS WERE OPEN — this is app state the URL is meant to encapsulate, not
    // "personal working state" to be hidden. An earlier version dropped these.
    assert.equal(ui!.originalTuneOpen, true);
    assert.equal(ui!.originalEditorOpen, true);

    // Layout and preferences. Kept for fidelity: a link that differs from what the sender saw
    // cannot be used to diagnose what the sender saw.
    assert.equal(ui!.originalNavW, 320);
    assert.equal(ui!.originalChartMax, true);
    assert.equal(ui!.username, 'johnl');
    assert.deepEqual(ui!.chartColors, { background: '#ffffff' });

    assert.equal(shared.box, 'sealed', 'and the design itself');
  });

  it('gzip actually shrinks the link vs plain base64 of the same JSON', async () => {
    // A realistic payload — a real record plus two comparison overlays, so the JSON has the
    // repetition gzip exploits. A round-trip alone would not prove compression happened.
    const loaded = { ...uiView, compare: [
      { driver: drv, box: 'vented', P: {}, name: 'Compare A', color: '#ff0000' },
      { driver: drv, box: 'sealed', P: {}, name: 'Compare B', color: '#00ff00' },
    ] } as unknown as PresentationState;
    const project: ProjectMeta = { name: 'Gzip fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const plainBase64Len = Buffer.from(
      JSON.stringify(serialize('sealed', project, loaded, drv, {} as UiParams)), 'utf8').toString('base64').length;
    const gzipBase64Len = (await stateToUrl(serialize('sealed', project, loaded, drv, {} as UiParams)))
      .match(/[#&]s=([^&]+)/)![1].length;

    assert.ok(gzipBase64Len < plainBase64Len,
      `gzip+base64 (${gzipBase64Len}) should be smaller than plain base64 (${plainBase64Len})`);
  });

  it('carries the graph cursor — live hover and locked/pinned, both if both are set', async () => {
    const withCursor = { ...uiView, cursorF: 123.4, pinnedF: 500, cursorLocked: true } as unknown as PresentationState;
    const project: ProjectMeta = { name: 'Cursor fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const local = serialize('sealed', project, withCursor, drv, {} as UiParams);
    assert.deepEqual(local.cursor, { f: 123.4, pinnedF: 500, locked: true, range: null });
    assert.deepEqual(decodeShare(await stateToUrl(local)).cursor,
      { f: 123.4, pinnedF: 500, locked: true, range: null });
  });

  it('carries the dragged band (fLo/fHi only — stats are per-panel derived)', async () => {
    const withBand = { ...uiView, dragRange: { fLo: 31.6, fHi: 100, stats: { peak: 1 } } } as unknown as PresentationState;
    const project: ProjectMeta = { name: 'Band fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const local = serialize('sealed', project, withBand, drv, {} as UiParams);
    assert.deepEqual(local.cursor!.range, { fLo: 31.6, fHi: 100 }, 'derived stats are not state');
    assert.deepEqual(decodeShare(await stateToUrl(local)).cursor!.range, { fLo: 31.6, fHi: 100 });
  });

  it('an unset cursor serialises as all-null/false, not omitted', () => {
    const noCursor = { ...uiView, cursorF: null, pinnedF: null, cursorLocked: false } as unknown as PresentationState;
    const project: ProjectMeta = { name: 'No-cursor fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    assert.deepEqual(serialize('sealed', project, noCursor, drv, {} as UiParams).cursor,
      { f: null, pinnedF: null, locked: false, range: null },
      'omitting "nothing pinned" would make absence and unset indistinguishable on reload');
  });
});

/**
 * `UiParams` is the ONE wire shape for the project's flat params — `managedProject.toUiParams()`
 * out, `managedProject.loadUiParams()` in, through `serialize()`/`applyState()`. A caller that
 * passed `SyncedParams` (`UiParams & {eg, Sp, Leff}`) instead would persist DERIVED values
 * (recomputed from the rest on every load) as if they were stored state — a second, redundant
 * shape for the same three fields, free to disagree with what they recompute to.
 * Regression guard: every real `UiParams` field must survive
 * `toUiParams → serialize → JSON → applyState → toUiParams` unchanged.
 */
describe('UiParams round-trips losslessly through serialize/applyState', () => {
  it('every field of a fully-specified design survives a save/restore cycle unchanged', () => {
    managedProject.setActiveAlignment('vented');
    managedProject.setBoxVolume_m3(0.028);
    managedProject.setFrontVolume_m3(0.011);
    managedProject.setActiveVentField('shape', 'slotted');
    managedProject.setActiveVentField('diameter_m', 0.06);
    managedProject.setActiveVentField('width_m', 0.05);
    managedProject.setActiveVentField('height_m', 0.03);
    managedProject.setActiveVentField('length_m', 0.15);
    managedProject.setActiveVentField('endCorrection', 0.61);
    managedProject.setBoxTuning_Fb_hz(38.5);
    managedProject.setPrFp_hz(41);
    managedProject.setPrField('name', 'Test PR');
    managedProject.setPrField('Sd_m2', 0.009);
    managedProject.setPrCount(2);
    managedProject.setPrField('Mmd_kg', 0.021);
    managedProject.setPrAddedMass_kg(0.004);
    managedProject.setPrField('Cms_m_per_N', 0.0007);
    managedProject.setPrField('Rms_Ns_per_m', 0.6);
    managedProject.setPrField('Xmax_m', 0.006);
    managedProject.setBoxQl(9);
    managedProject.setBoxQa(95);
    managedProject.setBoxQp(105);
    managedProject.setDriverCount(2);
    managedProject.setWiring('series');
    managedProject.setInputPower_W(85);
    managedProject.setSeriesResistance_ohm(0.15);
    managedProject.setSweepFmin_hz(12);
    managedProject.setSweepFmax_hz(18000);
    managedProject.setSweepPoints(350);
    managedProject.setCircuitModel('gyrator');
    managedProject.setFilters([{ id: 'f1', type: 'highpass', enabled: true, fc: 35, Q: 0.71 }]);
    managedProject.setVcTempRise(12);
    managedProject.setAlfaVC(0.004);
    managedProject.setDriverAddedMass(0.002);
    managedProject.setRgAtDriverSide(true);
    managedProject.setTlPortModel(true);
    managedProject.setForceFlatResponse(true);
    managedProject.setSplXmaxLimited(true);
    managedProject.setEnvTempK(300);
    managedProject.setEnvHumidityPct(45);
    managedProject.setEnvPressurePa(99000);
    managedProject.setEnvIgnoreHumidityAndPressure(true);
    managedProject.setEnteredSet({ Vb: true, ventD: true, Fb: true, prMadd: true });
    state.box = 'vented';

    const before = managedProject.toUiParams();

    const wire = JSON.parse(JSON.stringify(
      serialize(state.box, state.project, presentationState, undefined, before))) as SerializedState;

    // Scramble the live project back to nothing BEFORE restoring, so this actually exercises
    // write-back — restoring into a project that already held these values would pass even if
    // `loadUiParams` silently dropped every field.
    managedProject.loadEmpty();
    applyState(wire);

    const after = managedProject.toUiParams();
    assert.deepEqual(after, before,
      'every UiParams field must round-trip byte-identical through serialize/applyState — a ' +
      'diverging field would mean the wire shape silently drops or corrupts it');
  });
});

/**
 * bugs/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md — every reader
 * of a persisted payload upgrades it. The V1→V2 step converts the driver slot from a record
 * OBJECT to the managed layer's serialised TEXT; a V1 share link must arrive upgraded.
 */
describe('persisted-payload readers upgrade the schema (V1 driver-object → V2 driver-text)', () => {
  afterAll(() => vi.unstubAllGlobals());

  it('a V1 payload loaded via the HASH path comes back at the current schema, driver as text', async () => {
    const v1 = {
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-fixture', creator: '', created: '', modified: '', description: '' },
      driver: JSON.parse(sampleDriverText()),
    };
    // Encoded with Node's zlib, independent of the app's own CompressionStream path — this
    // checks what a real browser-produced link would decode to, not the app agreeing with itself.
    const encoded = gzipSync(Buffer.from(JSON.stringify(v1), 'utf8'))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    vi.stubGlobal('location', { hash: '#s=' + encoded, origin: 'https://openisd.test', pathname: '/' });

    const loaded = await loadFromHash();
    assert.ok(loaded, 'a V1 payload must load, upgraded — not be refused');
    assert.equal(typeof loaded!.driver, 'string', 'the V1→V2 step serialises the driver slot');
    const back = OpenISDDriver.fromOwdrText(loaded!.driver!);
    assert.equal(back.cell('Fs').state, Provenance.Entered,
      'the upgraded driver is the same record — provenance intact');
  });

  it('upgradeParsedState is the same seam File → Open uses — V1 object slot becomes text', () => {
    const upgraded = upgradeParsedState({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: JSON.parse(sampleDriverText()),
    });
    assert.ok(upgraded);
    assert.equal(typeof upgraded!.driver, 'string');
  });
});
