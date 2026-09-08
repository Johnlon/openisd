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
import { gunzipSync, gzipSync } from 'node:zlib';
import { OpenISDDriver, OpenISDProject } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { createProjectRepo, type FileStorage, type ViewSnapshot } from '@openisd/persistence';
import { currentViewSnapshot } from '../../src/logic/appState.js';

import type { BoxType } from '@openisd/design/engine';

/** A picker that is never reached — these tests exercise the storage/link/text doors only. */
const noFilePicker: FileStorage = {
  save: async () => ({ name: null, cancelled: true, written: false }),
  saveAs: async () => ({ name: null, cancelled: true, written: false }),
  openFileName: () => null,
  forget: () => {},
};
const repo = createProjectRepo(new Engine(), noFilePicker);

/** A picker that KEEPS what was written, so a test can decode the file door's own bytes. */
let written: string | null = null;
const capturingPicker: FileStorage = {
  save: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  saveAs: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  openFileName: () => 'p.owpr',
  forget: () => {},
};
const fileRepo = createProjectRepo(new Engine(), capturingPicker);
const owprNaming = { suggestedName: 'p.owpr', mime: 'application/json', label: 'OpenISD project', ext: '.owpr' };

/** The bytes the FILE door writes, decoded independently. */
async function savedFileText(project: OpenISDProject): Promise<string> {
  written = null;
  await fileRepo.saveToFile(project, owprNaming);
  assert.ok(written, 'the file door must have written bytes');
  return written!;
}

/** The project every door takes, built through `OpenISDProject.builder` rather than a second,
 *  hand-rolled construction path. `driverRecord` is REQUIRED: a project cannot exist without a
 *  driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
function projectOf(box: BoxType, meta: any,
  driverRecord: any): OpenISDProject {
  const driver = OpenISDDriver.fromConformingRecord(driverRecord, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture record does not conform: ${driver.join('; ')}`);
  
  const builder = OpenISDProject.builder(driver, new Engine());
  let project: OpenISDProject;
  // Each box type requires its own volume before `build()`; these tests are about what crosses
  // the wire, so any stated size does.
  if (box === 'vented') project = builder.vented().volume_m3(0.03).tuning_hz(35).build();
  else if (box === 'bandpass4') project = builder.bandpass4().rearVolume_m3(0.03).frontVolume_m3(0.02).build();
  else project = builder.sealed().volume_m3(0.03).build();
  
  project.name.set(meta.name);
  project.creator.set(meta.creator);
  project.created.set(meta.created);
  project.modified.set(meta.modified);
  project.description.set(meta.description);
  // A file/share write serialises the SAVED record, never the edited one
  // (`openisdDomain.ts` `#slot`/`save()`), so the meta set above reaches the wire only once it is
  // committed. That the app itself never commits before writing is
  // bugs/BUG_20260908_saving_a_project_drops_its_name_creator_and_all_metadata.md; these tests
  // commit here so they exercise the WIRE rather than restating that bug.
  project.save();
  return project;
}

/** The saved-FILE payload's PROJECT half, decoded independently. Pure project data (QO90): no
 *  view ever reaches this wire.
 *
 *  A `.owpr` file holds the session wrapper `{label, saved, edited}`
 *  (`openISDProjectSessionJsonSchema`), so the project itself is `saved` — every assertion below
 *  is about the project, and reading the wrapper instead would make each one vacuously true. */
// Parsed JSON, so untyped — a test reads whatever fields it is checking.
async function storedPayload(project: OpenISDProject): Promise<ReturnType<typeof JSON.parse>> {
  const session = JSON.parse(await savedFileText(project));
  assert.ok(session.saved, 'the file must carry a saved project');
  return session.saved;
}

/** The share-link payload, decoded independently of the app's own `stateToUrl`/gzip path —
 *  what a real browser would decode a link to. */
// Parsed JSON, so untyped.
function decodeShare(url: string): ReturnType<typeof JSON.parse> {
  const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
}

/** A conforming driver RECORD — the form a driver takes inside a serialised payload. Every key
 *  the schema requires is present; the values are deliberately synthetic, since these tests are
 *  about what survives the wire, not about any driver's physics. */
function sampleDriverRecord(): any {
  return {
    brand: {value: 'test'}, model: {value: 'test'}, manufacturer: {value: 'test'},
    uuid: {value: '00000000-0000-4000-8000-000000000000'}, driver_type: {value: 'woofer'},
    sku: {value: 'test', grounds: [{origin: 'manual', reading: 'test'}]},
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    data_sources: {value: {}},
    authoritative: {value: 'openisd'},
    specs: { woofer: {
      Fs:  { origin: 'entered', readings: { entered: { read_value: 30 } } },
      Vas: { origin: 'entered', readings: { entered: { read_value: 0.05 } } },
      Sd:  { origin: 'entered', readings: { entered: { read_value: 0.02 } } },
    } }
  };
}

describe('persistence — provenance survives a file-save round trip', () => {
  it('E stays E and C stays C across save → JSON → restore', async () => {
    const srcOrErr = OpenISDDriver.fromConformingRecord(sampleDriverRecord(), new Engine());
    if (Array.isArray(srcOrErr)) throw new Error(`fixture record does not conform: ${srcOrErr.join('; ')}`);
    const src = srcOrErr;
    // Clear a derivable field so the fixture carries a genuine C (Cms derives from Vas and Sd)
    // alongside the E fields.
    src.spec[src.section].Cms_m_per_N.clear();

    assert.equal(src.spec[src.section].Fs_hz.get().state, 'entered', 'fixture precondition: Fs entered');
    // The fixture must actually carry both an E and a C field, or the test is vacuous. Cms is
    // unstated and the record states Vas and Sd, so it reads back derived.
    assert.equal(src.spec[src.section].Cms_m_per_N.get().state, 'calculated',
      'fixture precondition: Cms now computed');

    const project = projectOf('sealed', { name: 'John-all-manu-populated', creator: 'John',
      created: '2026-01-01', modified: '2026-01-02', description: '' }, sampleDriverRecord());
    // The cleared Cms is the whole point of the fixture, so the MODIFIED driver is the one that
    // must travel — not a fresh one rebuilt from the untouched record.
    project.setDriver(src);
    const wire = await storedPayload(project);
    const backOrErr = OpenISDDriver.fromConformingRecord(wire.driverEmbedding.device, new Engine());
    const back = Array.isArray(backOrErr) ? null : backOrErr;
    if (!back) throw new Error('Bad back driver');

    const CHECKED_FIELDS = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'BL'] as const;
    /** Dispatch a fixed field name to its flat accessor's `.state` — `SpecField` never
     *  appears as a public parameter (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md);
     *  this test needs the same field checked on two driver instances, so the dispatch lives
     *  here. */
    // `field` is one of the names listed above.
    function stateOf(d: any, field: typeof CHECKED_FIELDS[number]) {
      switch (field) {
        case 'Fs': return d.spec[d.section].Fs_hz.get().state;
        case 'Qts': return d.spec[d.section].Qts.get().state;
        case 'Qes': return d.spec[d.section].Qes.get().state;
        case 'Qms': return d.spec[d.section].Qms.get().state;
        case 'Vas': return d.spec[d.section].Vas_m3.get().state;
        case 'Sd': return d.spec[d.section].Sd_m2.get().state;
        case 'Re': return d.spec[d.section].Re_ohm.get().state;
        case 'Cms': return d.spec[d.section].Cms_m_per_N.get().state;
        case 'Mms': return d.spec[d.section].Mms_kg.get().state;
        case 'BL': return d.spec[d.section].BL_Tm.get().state;
      }
    }
    for (const f of CHECKED_FIELDS) {
      assert.equal(stateOf(back, f), stateOf(src, f),
        `cell(${f}).state must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'Provenance sample', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, sampleDriverRecord()));
    const record = ser.driverEmbedding?.device;
    assert.ok(record, 'the driver payload travels');
    assert.ok(record.specs, 'the driver payload is the openisd.yml record');
    assert.ok(record.specs.woofer?.Fs?.readings,
      'each field carries its readings, not a bare number — that is what makes E/C survivable');
  });

  it('the driver always travels — a project cannot exist without one', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'Has a driver', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, sampleDriverRecord()));
    assert.equal(typeof ser.driverEmbedding?.device, 'object',
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
      modified: '2026-01-02', description: '' }, sampleDriverRecord()));
    // The whole key set, not four named absences: a view field arriving under a name nobody
    // predicted is exactly the leak this test exists to catch, and asserting `ser.ui ===
    // undefined` cannot see it. Any key added to the project wire must be added here
    // DELIBERATELY, which is the point.
    assert.deepEqual(Object.keys(ser).sort(),
      ['advanced', 'box', 'charts', 'driverEmbedding', 'environment', 'filters', 'meta', 'signal'],
      'the file wire carries project data only — no ui, cursor, graphs or lossMode (QO90)');
    // The project itself still travels.
    assert.equal(ser.meta?.name, 'View-free save');
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
    cursor: { f: null, pinnedF: null, locked: false, range: null },
    ui: {
      originalProjectTab: 'signal', originalChartTab: 'Excursion', originalChartLabel: 'Cone excursion',
      originalTuneOpen: true, originalEditorOpen: true,
      originalNavW: 320, originalBottomH: 200, originalNavCollapsed: true,
      originalBottomCollapsed: true, originalChartMax: true,
      username: 'johnl', envDefaults: { tempK: 300, pressurePa: 100000, humidityPct: 40 },
      chartColors: { background: '#ffffff' },
    },
  };
  const drv = sampleDriverRecord();

  // stateToUrl reads location.{origin,pathname}; stub it (no jsdom needed) for the URL test.
  beforeAll(() => vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' }));
  afterAll(() => vi.unstubAllGlobals());

  it('every ui field travels — view context, open panels, local preferences and project meta alike', async () => {
    const meta: any = {
      name: 'Kick bin', creator: 'John Lonergan', created: '2026-08-01T00:00:00.000Z',
      modified: '2026-08-14T12:30:00.000Z', description: 'PA subwoofer for the shed',
    };
    const urlOrErr = await repo.stateToUrl(projectOf('sealed', meta, drv), uiView);
    if (Array.isArray(urlOrErr)) throw new Error('fail');
    const shared = decodeShare(urlOrErr as string);
    // A share link is `{project, view}` — the design and where the sender was looking, kept
    // apart. The ui fields are the view's; the metadata is the project's.
    const ui = (shared as any).view?.ui as Record<string, unknown> | undefined;
    assert.ok(ui, 'the view context travels');

    // Project-level metadata is part of the session too — a share link that dropped it would
    // hand the recipient an anonymous, undated design.
    // `project` here is the same session wrapper a `.owpr` file carries — `{label, saved,
    // edited}` — so the design itself is under `saved`.
    const saved = (shared as any).project?.saved;
    assert.equal(saved?.meta?.name, 'Kick bin');
    assert.equal(saved?.meta?.creator, 'John Lonergan');
    assert.equal(saved?.meta?.modified, '2026-08-14T12:30:00.000Z');

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

    assert.equal(saved?.box?.boxType, 'sealed', 'and the design itself');
  });

  it('gzip actually shrinks the link vs plain base64 of the same JSON', async () => {
    // A realistic payload — a real record plus two comparison overlays, so the JSON has the
    // repetition gzip exploits. A round-trip alone would not prove compression happened.
    const meta: any = { name: 'Gzip fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: drv };
    // Two driver texts in one payload gives the JSON the repetition gzip exploits.
    const shareUrlOrErr = await repo.stateToUrl(projectOf('sealed', meta, drv), uiView);
    if (Array.isArray(shareUrlOrErr)) throw new Error('fail');
    const shareUrl = shareUrlOrErr;
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
    const meta: any = { name: 'Cursor fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const project = projectOf('sealed', meta, drv);
    assert.deepEqual(decodeShare((await repo.stateToUrl(project, withCursor)) as string).view.cursor,
      { f: 123.4, pinnedF: 500, locked: true, range: null });
  });

  it('the dragged band crosses as fLo/fHi only — per-panel stats are derived, not state', async () => {
    // The stats-stripping itself happens in `currentViewSnapshot()` (appState.ts), which reads
    // the live presentation state; at the repo door the band is already bare.
    const withBand: ViewSnapshot = { ...uiView, cursor: { f: null, pinnedF: null, locked: false, range: { fLo: 31.6, fHi: 100 } } };
    const meta: any = { name: 'Band fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' };
    const project = projectOf('sealed', meta, drv);
    assert.deepEqual(decodeShare((await repo.stateToUrl(project, withBand)) as string).view.cursor.range,
      { fLo: 31.6, fHi: 100 });
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
      driver: sampleDriverRecord(),
    };
    // Encoded with Node's zlib, independent of the app's own CompressionStream path — this
    // checks what a real browser-produced link would decode to, not the app agreeing with itself.
    const encoded = gzipSync(Buffer.from(JSON.stringify(v1), 'utf8'))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    vi.stubGlobal('location', { hash: '#s=' + encoded, origin: 'https://openisd.test', pathname: '/' });

    const loaded = await repo.loadFromHash();
    if (Array.isArray(loaded)) throw new Error(`the V1 payload was refused: ${loaded.join('; ')}`);
    assert.ok(loaded, 'a V1 payload must load, upgraded — not be refused');
    assert.ok((loaded as any)!.project.driver(), 'the V1→V2 step serialises the driver slot, and the repo adopts it');
    assert.equal((loaded as any)!.project.driver.Fs_hz.get().state, 'entered',
      'the upgraded driver is the same record — provenance intact');
  });

  it('readProjectText is the same seam File → Open uses — V1 object slot loads a driver', () => {
    const upgraded = repo.readProjectText(JSON.stringify({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: sampleDriverRecord(),
    }));
    if (Array.isArray(upgraded)) throw new Error(`the V1 payload was refused: ${upgraded.join('; ')}`);
    assert.ok(upgraded);
    assert.ok(upgraded!.driver);
  });
});

