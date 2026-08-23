/**
 * Persistence — what survives a save round trip, and what a share link carries.
 *
 * Three properties, all real:
 *   1. A driver's PROVENANCE survives. An E field comes back E and a C field comes back C —
 *      because the record carries `readings`/`origin`, not a flat bag of numbers that would
 *      make a computed value indistinguishable from a measured one on reload.
 *   2. A share link carries the WHOLE state, stripped of nothing (human ruling 2026-08-14).
 *      A link that quietly differs from what the sender saw cannot diagnose what the sender saw.
 *   3. A local autosave and a `.owpr` file carry PURE PROJECT DATA ONLY (QO90) — the view
 *      (open tab/chart, panel sizes, unit tokens, graph cursor) never reaches that wire, even
 *      though the same `ProjectPayload` value handed to every door always carries one.
 */
import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { OpenISDDriver, Provenance } from '@openisd/model';
import { WinISDDriver } from '@openisd/winisd';
import { createProjectRepo, createMemoryStorage, type FileStorage, type ProjectPayload, type ViewSnapshot } from '@openisd/persistence';
import { projectSchema } from '../../src/logic/schemaUpgrade.js';
import { state, managedProject, applyProjectPayload, currentProjectPayload } from '../../src/logic/appState.js';
import type { UiParams, OpenISDProjectMeta } from '@openisd/model';
import type { BoxType } from '@openisd/engine';

/** A picker that is never reached — these tests exercise the storage/link/text doors only. */
const noFilePicker: FileStorage = {
  save: async () => ({ name: null, cancelled: true, written: false }),
  saveAs: async () => ({ name: null, cancelled: true, written: false }),
  openFileName: () => null,
  forget: () => {},
};
const mem = createMemoryStorage();
const repo = createProjectRepo(mem, projectSchema, noFilePicker);

/** The payload every door takes, from the same pieces the old positional call passed. */
function payloadOf(box: BoxType, meta: OpenISDProjectMeta, view: ViewSnapshot,
  driverText: string | undefined, params: UiParams): ProjectPayload {
  return { params, box, meta, view, driverText };
}

/** The stored LOCAL-SAVE payload as raw bytes — what `saveLocal` actually writes, decoded
 *  independently. Pure project data (QO90): `p.view` never reaches this wire. */
function storedPayload(p: ProjectPayload): ReturnType<typeof JSON.parse> {
  repo.saveLocal(p);
  return JSON.parse(mem.get('openisd.state')!);
}

/** The share-link payload, decoded independently of the app's own `stateToUrl`/gzip path —
 *  what a real browser would decode a link to. */
function decodeShare(url: string): ReturnType<typeof JSON.parse> {
  const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
}

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd', 'John-all-manu-populated.wdr');
const wdrText = readFileSync(SAMPLE, 'utf8');

// A minimal view — irrelevant to the pure-project tests (never reaches that wire), and a real
// value where a share-link test needs one.
const miniView: ViewSnapshot = { graphs: ['SPL'] };

/** The sample `.wdr`, read as-read by the serialiser, as the driver's own persisted TEXT —
 *  the only form the driver takes in a serialised payload (QO73: the UI carries the managed
 *  layer's serialisation, never the record value). */
function sampleDriverText(): string {
  return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(wdrText)).toOwdrText();
}

describe('persistence — provenance survives a local-save round trip', () => {
  it('E stays E and C stays C across save → JSON → restore', () => {
    const src = OpenISDDriver.fromOwdrText(sampleDriverText());
    // Clear a derivable field so the fixture carries a genuine C (Cms recomputes from
    // Fs/Vas/Sd) alongside the E fields the WinISD save marks entered.
    src.clear('Cms');

    // The fixture must actually contain both an E and a C field, or the test is vacuous.
    assert.equal(src.cell('Fs').state, Provenance.Entered, 'fixture precondition: Fs entered');
    assert.equal(src.cell('Cms').state, Provenance.Calculated, 'fixture precondition: Cms now computed');

    const wire = storedPayload(payloadOf('sealed', { name: 'John-all-manu-populated', creator: 'John',
      created: '2026-01-01', modified: '2026-01-02', description: '' }, miniView, src.toOwdrText(), {} as UiParams));
    const back = OpenISDDriver.fromOwdrText(wire.driver);

    for (const f of ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'BL'] as const) {
      assert.equal(back.cell(f).state, src.cell(f).state,
        `cell(${f}).state must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', () => {
    const ser = storedPayload(payloadOf('sealed', { name: 'Provenance sample', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, miniView, sampleDriverText(), {} as UiParams));
    assert.ok(ser.driver, 'the driver payload travels');
    const record = JSON.parse(ser.driver!);
    assert.ok(record.specs, 'the driver payload is the openisd.yml record, serialised');
    assert.ok(record.specs.woofer?.Fs?.readings,
      'each field carries its readings, not a bare number — that is what makes E/C survivable');
  });

  it('a design with NO driver chosen serialises without inventing one', () => {
    const ser = storedPayload(payloadOf('sealed', { name: 'No driver yet', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, miniView, undefined, {} as UiParams));
    assert.equal(ser.driver, undefined,
      'a fake driver written to fill the slot would be indistinguishable on reload from one ' +
      'the user actually picked');
  });
});

/**
 * QO90: a local autosave and a `.owpr` file are PURE PROJECT DATA — the view never reaches
 * that wire, even though every `ProjectPayload` handed to `saveLocal` carries one (every
 * caller has one to hand; `saveLocal` itself ignores it).
 */
describe('local save carries PURE PROJECT DATA — no view (QO90)', () => {
  it('the stored payload carries no ui/cursor/graphs/lossMode, even when the payload carries a real view', () => {
    const withView: ViewSnapshot = {
      lossMode: 'diyaudio', graphs: ['SPL', 'Excursion'],
      ui: { originalProjectTab: 'signal', envDefaults: { tempK: 300, pressurePa: 100000, humidityPct: 40 } },
      cursor: { f: 123.4, pinnedF: 500, locked: true, range: { fLo: 31.6, fHi: 100 } },
    };
    const ser = storedPayload(payloadOf('sealed', { name: 'View-free save', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, withView, undefined, {} as UiParams));
    assert.equal(ser.lossMode, undefined, 'the view carries a lossMode; the local-save wire must not');
    assert.equal(ser.graphs, undefined, 'the view carries open charts; the local-save wire must not');
    assert.equal(ser.ui, undefined, 'the view carries UI preferences; the local-save wire must not');
    assert.equal(ser.cursor, undefined, 'the view carries the graph cursor; the local-save wire must not');
    // The project itself still travels.
    assert.equal(ser.project?.name, 'View-free save');
  });
});

/**
 * A share link is a COMPLETE description of the session: the recipient lands on exactly what
 * the sender was looking at. Nothing is stripped — not the open-panel flags, and not the
 * recipient-preference fields, even though they are preferences rather than design data
 * (human ruling 2026-08-14).
 */
describe('share link carries the whole state, stripped of nothing', () => {
  const uiView: ViewSnapshot = {
    graphs: ['SPL'],
    ui: {
      originalProjectTab: 'signal', originalChartTab: 'Excursion', originalChartLabel: 'Cone excursion',
      originalTuneOpen: true, originalEditorOpen: true,
      originalNavW: 320, originalBottomH: 200, originalNavCollapsed: true,
      originalBottomCollapsed: true, originalChartMax: true,
      username: 'johnl', envDefaults: { tempK: 300, pressurePa: 100000, humidityPct: 40 },
      chartColors: { background: '#ffffff' },
    },
  };
  const drv = sampleDriverText();

  // stateToUrl reads location.{origin,pathname}; stub it (no jsdom needed) for the URL test.
  beforeAll(() => vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' }));
  afterAll(() => vi.unstubAllGlobals());

  it('every ui field travels — view context, open panels, local preferences and project meta alike', async () => {
    const project: OpenISDProjectMeta = {
      name: 'Kick bin', creator: 'John Lonergan', created: '2026-08-01T00:00:00.000Z',
      modified: '2026-08-14T12:30:00.000Z', description: 'PA subwoofer for the shed',
    };
    const shared = decodeShare(await repo.stateToUrl(payloadOf('sealed', project, uiView, drv, {} as UiParams)));
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
    // "personal working state" to be hidden.
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
    const project: OpenISDProjectMeta = { name: 'Gzip fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    // Two driver texts in one payload gives the JSON the repetition gzip exploits.
    const p = payloadOf('sealed', { ...project, description: drv }, uiView, drv, {} as UiParams);
    const shareUrl = await repo.stateToUrl(p);
    // Compare like-for-like: plain base64 of the EXACT session JSON that was gzipped, not of
    // some other payload — the local-save wire (QO90) carries different bytes entirely now.
    const sessionJson = JSON.stringify(decodeShare(shareUrl));
    const plainBase64Len = Buffer.from(sessionJson, 'utf8').toString('base64').length;
    const gzipBase64Len = shareUrl.match(/[#&]s=([^&]+)/)![1].length;

    assert.ok(gzipBase64Len < plainBase64Len,
      `gzip+base64 (${gzipBase64Len}) should be smaller than plain base64 (${plainBase64Len})`);
  });

  it('carries the graph cursor — live hover and locked/pinned, both if both are set', async () => {
    const withCursor: ViewSnapshot = { ...uiView, cursor: { f: 123.4, pinnedF: 500, locked: true, range: null } };
    const project: OpenISDProjectMeta = { name: 'Cursor fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const p = payloadOf('sealed', project, withCursor, drv, {} as UiParams);
    assert.deepEqual(decodeShare(await repo.stateToUrl(p)).cursor,
      { f: 123.4, pinnedF: 500, locked: true, range: null });
  });

  it('the dragged band crosses as fLo/fHi only — per-panel stats are derived, not state', async () => {
    // The stats-stripping itself happens in `currentProjectPayload()` (appState.ts), which reads
    // the live presentation state; at the repo door the band is already bare.
    const withBand: ViewSnapshot = { ...uiView, cursor: { f: null, pinnedF: null, locked: false, range: { fLo: 31.6, fHi: 100 } } };
    const project: OpenISDProjectMeta = { name: 'Band fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const p = payloadOf('sealed', project, withBand, drv, {} as UiParams);
    assert.deepEqual(decodeShare(await repo.stateToUrl(p)).cursor.range, { fLo: 31.6, fHi: 100 });
  });

  it('an unset cursor serialises as all-null/false, not omitted — via the live gatherer', () => {
    // `currentProjectPayload()` is the one mapping from live presentation state to the payload's
    // cursor; an unset cursor must cross as explicit null/false, or absence and unset become
    // indistinguishable on reload.
    const cw = currentProjectPayload();
    assert.deepEqual(cw.view.cursor, { f: null, pinnedF: null, locked: false, range: null });
  });
});

/**
 * `UiParams` is the ONE wire shape for the project's flat params — `managedProject.toUiParams()`
 * out, `managedProject.loadUiParams()` in, through the project repo and `applyProjectPayload()`.
 * A caller that passed `SyncedParams` (`UiParams & {eg, Sp, Leff}`) instead would persist
 * DERIVED values (recomputed from the rest on every load) as if they were stored state — a
 * second, redundant shape for the same three fields, free to disagree with what they recompute
 * to. Regression guard: every real `UiParams` field must survive
 * `toUiParams → save → load → applyProjectPayload → toUiParams` unchanged.
 */
describe('UiParams round-trips losslessly through the repo and applyProjectPayload', () => {
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

    repo.saveLocal({ ...currentProjectPayload(), params: before, driverText: undefined });
    const wire = repo.loadLocal();
    assert.ok(wire, 'the just-saved design must load');

    // Scramble the live project back to nothing BEFORE restoring, so this actually exercises
    // write-back — restoring into a project that already held these values would pass even if
    // `loadUiParams` silently dropped every field.
    managedProject.loadEmpty();
    applyProjectPayload(wire!);

    const after = managedProject.toUiParams();
    assert.deepEqual(after, before,
      'every UiParams field must round-trip byte-identical through the repo and applyProjectPayload — a ' +
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

    const loaded = await repo.loadFromHash();
    assert.ok(loaded, 'a V1 payload must load, upgraded — not be refused');
    assert.equal(typeof loaded!.driverText, 'string', 'the V1→V2 step serialises the driver slot');
    const back = OpenISDDriver.fromOwdrText(loaded!.driverText!);
    assert.equal(back.cell('Fs').state, Provenance.Entered,
      'the upgraded driver is the same record — provenance intact');
  });

  it('readProjectText is the same seam File → Open uses — V1 object slot becomes text', () => {
    const upgraded = repo.readProjectText(JSON.stringify({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: JSON.parse(sampleDriverText()),
    }));
    assert.ok(upgraded);
    assert.equal(typeof upgraded!.driverText, 'string');
  });
});
