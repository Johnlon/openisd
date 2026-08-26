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
 *      never reaches that wire; `stateToUrl` alone takes a `ViewSnapshot` alongside the project.
 */
import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { OpenISDDriver, OpenISDProject, Provenance } from '@openisd/model';
import { WinISDDriver } from '@openisd/winisd';
import { createProjectRepo, createMemoryStorage, type FileStorage, type ViewSnapshot } from '@openisd/persistence';
import { projectSchema } from '../../src/logic/schemaUpgrade.js';
import { state, requireFocusedProject, applyLoadedProject, currentProject, currentViewSnapshot } from '../../src/logic/appState.js';
import { toAlignmentKind } from '../../src/logic/managedProject.js';
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

/** A picker that KEEPS what was written, so a test can decode the file door's own bytes. */
let written: string | null = null;
const capturingPicker: FileStorage = {
  save: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  saveAs: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  openFileName: () => 'p.owpr',
  forget: () => {},
};
const fileRepo = createProjectRepo(createMemoryStorage(), projectSchema, capturingPicker);
const owprNaming = { suggestedName: 'p.owpr', mime: 'application/json', label: 'OpenISD project', ext: '.owpr' };

/** The bytes the FILE door writes, decoded independently. */
async function savedFileText(project: OpenISDProject): Promise<string> {
  written = null;
  await fileRepo.saveToFile(project, owprNaming);
  assert.ok(written, 'the file door must have written bytes');
  return written!;
}

/** The project every door takes, from the same pieces the old positional call passed —
 *  `OpenISDProject`'s own restore surface (`loadUiParams()`/`setProjectMeta()`/`setDriver()`),
 *  not a second, hand-rolled construction path. `driverText` is REQUIRED: a project cannot
 *  exist without a driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
function projectOf(box: BoxType, meta: OpenISDProjectMeta,
  driverText: string, params: Partial<UiParams>): OpenISDProject {
  const project = OpenISDProject.empty(OpenISDDriver.fromOwdrJson(driverText));
  project.loadUiParams(params, toAlignmentKind(box));
  project.setProjectMeta(meta);
  return project;
}

/** The saved-FILE payload, decoded independently. Pure project data (QO90): no view ever
 *  reaches this wire. */
async function storedPayload(project: OpenISDProject): Promise<ReturnType<typeof JSON.parse>> {
  return JSON.parse(await savedFileText(project));
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

/** The sample `.wdr`, read as-read by the serialiser, as the driver's own persisted TEXT —
 *  the only form the driver takes in a serialised payload (QO73: the UI carries the managed
 *  layer's serialisation, never the record value). */
function sampleDriverText(): string {
  return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(wdrText)).toOwdrJson();
}

describe('persistence — provenance survives a file-save round trip', () => {
  it('E stays E and C stays C across save → JSON → restore', async () => {
    const src = OpenISDDriver.fromOwdrJson(sampleDriverText());
    // Clear a derivable field so the fixture carries a genuine C (Cms recomputes from
    // Fs/Vas/Sd) alongside the E fields the WinISD save marks entered.
    src.clearCms();

    // The fixture must actually contain both an E and a C field, or the test is vacuous.
    assert.equal(src.FsCell().state, Provenance.Entered, 'fixture precondition: Fs entered');
    assert.equal(src.CmsCell().state, Provenance.Calculated, 'fixture precondition: Cms now computed');

    const wire = await storedPayload(projectOf('sealed', { name: 'John-all-manu-populated', creator: 'John',
      created: '2026-01-01', modified: '2026-01-02', description: '' }, src.toOwdrJson(), {}));
    const back = OpenISDDriver.fromOwdrJson(wire.driver);

    const CHECKED_FIELDS = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'BL'] as const;
    /** Dispatch a fixed field name to its flat accessor's `.state` — `SpecField` never
     *  appears as a public parameter (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md);
     *  this test needs the same field checked on two driver instances, so the dispatch lives
     *  here. */
    function stateOf(d: OpenISDDriver, field: typeof CHECKED_FIELDS[number]) {
      switch (field) {
        case 'Fs': return d.FsCell().state;
        case 'Qts': return d.QtsCell().state;
        case 'Qes': return d.QesCell().state;
        case 'Qms': return d.QmsCell().state;
        case 'Vas': return d.VasCell().state;
        case 'Sd': return d.SdCell().state;
        case 'Re': return d.ReCell().state;
        case 'Cms': return d.CmsCell().state;
        case 'Mms': return d.MmsCell().state;
        case 'BL': return d.BLCell().state;
      }
    }
    for (const f of CHECKED_FIELDS) {
      assert.equal(stateOf(back, f), stateOf(src, f),
        `cell(${f}).state must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'Provenance sample', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, sampleDriverText(), {}));
    assert.ok(ser.driver, 'the driver payload travels');
    const record = JSON.parse(ser.driver!);
    assert.ok(record.specs, 'the driver payload is the openisd.yml record, serialised');
    assert.ok(record.specs.woofer?.Fs?.readings,
      'each field carries its readings, not a bare number — that is what makes E/C survivable');
  });

  it('the driver always travels — a project cannot exist without one', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'Has a driver', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, OpenISDDriver.empty().toOwdrJson(), {}));
    assert.equal(typeof ser.driver, 'string',
      'driver is REQUIRED on the wire (docs/design/DRIVER_NON_NULL_INVARIANT.md) — never absent');
  });
});

/**
 * QO90: a `.owpr` file is PURE PROJECT DATA — `saveToFile`/`saveToNewFile` take only
 * `OpenISDProject`, with no `ViewSnapshot` parameter at all; only `stateToUrl` takes a view,
 * and separately (see the share-link describe block below).
 */
describe('file save carries PURE PROJECT DATA — no view (QO90)', () => {
  it('the stored payload carries no ui/cursor/graphs/lossMode', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'View-free save', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, OpenISDDriver.empty().toOwdrJson(), {}));
    assert.equal(ser.lossMode, undefined, 'the file wire writer must not emit a lossMode');
    assert.equal(ser.graphs, undefined, 'the file wire writer must not emit open charts');
    assert.equal(ser.ui, undefined, 'the file wire writer must not emit UI preferences');
    assert.equal(ser.cursor, undefined, 'the file wire writer must not emit the graph cursor');
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
    const meta: OpenISDProjectMeta = {
      name: 'Kick bin', creator: 'John Lonergan', created: '2026-08-01T00:00:00.000Z',
      modified: '2026-08-14T12:30:00.000Z', description: 'PA subwoofer for the shed',
    };
    const shared = decodeShare(await repo.stateToUrl(projectOf('sealed', meta, drv, {}), uiView));
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
    const meta: OpenISDProjectMeta = { name: 'Gzip fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: drv };
    // Two driver texts in one payload gives the JSON the repetition gzip exploits.
    const shareUrl = await repo.stateToUrl(projectOf('sealed', meta, drv, {}), uiView);
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
    const meta: OpenISDProjectMeta = { name: 'Cursor fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const project = projectOf('sealed', meta, drv, {});
    assert.deepEqual(decodeShare(await repo.stateToUrl(project, withCursor)).cursor,
      { f: 123.4, pinnedF: 500, locked: true, range: null });
  });

  it('the dragged band crosses as fLo/fHi only — per-panel stats are derived, not state', async () => {
    // The stats-stripping itself happens in `currentViewSnapshot()` (appState.ts), which reads
    // the live presentation state; at the repo door the band is already bare.
    const withBand: ViewSnapshot = { ...uiView, cursor: { f: null, pinnedF: null, locked: false, range: { fLo: 31.6, fHi: 100 } } };
    const meta: OpenISDProjectMeta = { name: 'Band fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const project = projectOf('sealed', meta, drv, {});
    assert.deepEqual(decodeShare(await repo.stateToUrl(project, withBand)).cursor.range, { fLo: 31.6, fHi: 100 });
  });

  it('an unset cursor serialises as all-null/false, not omitted — via the live gatherer', () => {
    // `currentViewSnapshot()` is the one mapping from live presentation state to the wire's
    // cursor; an unset cursor must cross as explicit null/false, or absence and unset become
    // indistinguishable on reload.
    assert.deepEqual(currentViewSnapshot().cursor, { f: null, pinnedF: null, locked: false, range: null });
  });
});

/**
 * `UiParams` is the ONE wire shape for the project's flat params — `requireFocusedProject().toUiParams()`
 * out, `requireFocusedProject().loadUiParams()` in, through the project repo and `applyLoadedProject()`.
 * A caller that passed `SyncedParams` (`UiParams & {eg, Sp, Leff}`) instead would persist
 * DERIVED values (recomputed from the rest on every load) as if they were stored state — a
 * second, redundant shape for the same three fields, free to disagree with what they recompute
 * to. Regression guard: every real `UiParams` field must survive
 * `toUiParams → save → load → applyLoadedProject → toUiParams` unchanged.
 */
describe('UiParams round-trips losslessly through the repo and applyLoadedProject', () => {
  it('every field of a fully-specified design survives a save/restore cycle unchanged', async () => {
    requireFocusedProject().setActiveAlignment('vented');
    requireFocusedProject().setBoxVolume_m3(0.028);
    requireFocusedProject().setFrontVolume_m3(0.011);
    requireFocusedProject().setVentShape('slotted');
    requireFocusedProject().setVentDiameter_m(0.06);
    requireFocusedProject().setVentWidth_m(0.05);
    requireFocusedProject().setVentHeight_m(0.03);
    requireFocusedProject().setVentLength_m(0.15);
    requireFocusedProject().setVentEndCorrection(0.61);
    requireFocusedProject().setBoxTuning_Fb_hz(38.5);
    requireFocusedProject().setPrFp_hz(41);
    requireFocusedProject().setPrName('Test PR');
    requireFocusedProject().setPrSd_m2(0.009);
    requireFocusedProject().setPrCount(2);
    requireFocusedProject().setPrMmd_kg(0.021);
    requireFocusedProject().setPrAddedMass_kg(0.004);
    requireFocusedProject().setPrCms_m_per_N(0.0007);
    requireFocusedProject().setPrRms_Ns_per_m(0.6);
    requireFocusedProject().setPrXmax_m(0.006);
    requireFocusedProject().setFrcHz(111111);
    requireFocusedProject().setBoxQl(9);
    requireFocusedProject().setBoxQa(95);
    requireFocusedProject().setBoxQp(105);
    requireFocusedProject().setDriverCount(2);
    requireFocusedProject().setWiring('series');
    requireFocusedProject().setInputPower_W(85);
    requireFocusedProject().setSeriesResistance_ohm(0.15);
    requireFocusedProject().setSweepFmin_hz(12);
    requireFocusedProject().setSweepFmax_hz(18000);
    requireFocusedProject().setSweepPoints(350);
    requireFocusedProject().setCircuitModel('gyrator');
    requireFocusedProject().setFilters([{ id: 'f1', type: 'highpass', enabled: true, fc: 35, Q: 0.71 }]);
    requireFocusedProject().setVcTempRise(12);
    requireFocusedProject().setAlfaVC(0.004);
    requireFocusedProject().setDriverAddedMass(0.002);
    requireFocusedProject().setRgAtDriverSide(true);
    requireFocusedProject().setTlPortModel(true);
    requireFocusedProject().setForceFlatResponse(true);
    requireFocusedProject().setSplXmaxLimited(true);
    requireFocusedProject().setEnvTempK(300);
    requireFocusedProject().setEnvHumidityPct(45);
    requireFocusedProject().setEnvPressurePa(99000);
    requireFocusedProject().setEnvIgnoreHumidityAndPressure(true);
    requireFocusedProject().setEnteredSet({ Vb: true, ventD: true, Fb: true, prMadd: true });
    state.box = 'vented';

    const before = requireFocusedProject().toUiParams();

    const wire = fileRepo.readProjectText(await savedFileText(currentProject()));
    assert.ok(wire, 'the just-saved design must load');

    // Scramble the live project back to nothing BEFORE restoring, so this actually exercises
    // write-back — restoring into a project that already held these values would pass even if
    // `loadUiParams` silently dropped every field.
    requireFocusedProject().loadEmpty();
    applyLoadedProject(wire!);

    const after = requireFocusedProject().toUiParams();
    assert.deepEqual(after, before,
      'every UiParams field must round-trip byte-identical through the repo and applyLoadedProject — a ' +
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
    assert.ok(loaded!.project.driver(), 'the V1→V2 step serialises the driver slot, and the repo adopts it');
    assert.equal(loaded!.project.driver()!.FsCell().state, Provenance.Entered,
      'the upgraded driver is the same record — provenance intact');
  });

  it('readProjectText is the same seam File → Open uses — V1 object slot loads a driver', () => {
    const upgraded = repo.readProjectText(JSON.stringify({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: JSON.parse(sampleDriverText()),
    }));
    assert.ok(upgraded);
    assert.ok(upgraded!.driver());
  });
});

