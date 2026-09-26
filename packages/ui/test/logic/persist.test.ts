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
import {afterAll, beforeAll, describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {gunzipSync, gzipSync} from 'node:zlib';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {Engine} from '@openisd/design/engine';
import {createMemoryStorage, createProjectRepo, type FileStorage, type ViewSnapshot} from '@openisd/persistence';
import {currentViewSnapshot} from '../../src/logic/appState.js';
import {provenanceOf} from '../../src/logic/fieldProvenance.js';

/** A picker that is never reached — these tests exercise the storage/link/text doors only. */
const noFilePicker: FileStorage = {
  save: async () => ({ name: null, cancelled: true, written: false }),
  saveAs: async () => ({ name: null, cancelled: true, written: false }),
  openFileName: () => null,
  forget: () => {},
};
const repo = createProjectRepo(new Engine(), noFilePicker, createMemoryStorage());

/** A picker that KEEPS what was written, so a test can decode the file door's own bytes. */
let written: string | null = null;
const capturingPicker: FileStorage = {
  save: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  saveAs: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  openFileName: () => 'p.owpr',
  forget: () => {},
};
const fileRepo = createProjectRepo(new Engine(), capturingPicker, createMemoryStorage());
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
function projectOf(box: BoxType, meta: FixtureMeta,
  driverRecord: unknown): OpenISDProject {
  const driver = OpenISDDriver.fromConformingRecord(driverRecord, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture record does not conform: ${driver.join('; ')}`);
  
  const builder = OpenISDProject.builder(driver, new Engine());
  let project: OpenISDProject;
  // Each box type requires its own volume before `build()`; these tests are about what crosses
  // the wire, so any stated size does.
  if (box === 'vented') project = builder.vented().volume_m3(0.03).tuning_goal_hz(35).build();
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
/** What a decoded share link holds: the project as `.owpr` text (parsed further where a test
 *  reaches into the record) beside the view the link was carrying. */
interface DecodedShare { project: string; view: ViewSnapshot }
function decodeShare(url: string): DecodedShare {
  const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
}

/** The project metadata a fixture states — the five fields `projectOf` writes onto a project
 *  before saving it. */
interface FixtureMeta {
  name: string; creator: string; created: string; modified: string; description: string;
}

/** A conforming driver RECORD — the form a driver takes inside a serialised payload. Every key
 *  the schema requires is present; the values are deliberately synthetic, since these tests are
 *  about what survives the wire, not about any driver's physics. */
function sampleDriverRecord(): unknown {
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
      Fs_hz:  { state: 'E', value: 30, origin: 'entered', readings: { entered: { read_value: 30 } } },
      Vas_m3: { state: 'E', value: 0.05, origin: 'entered', readings: { entered: { read_value: 0.05 } } },
      Sd_m2:  { state: 'E', value: 0.02, origin: 'entered', readings: { entered: { read_value: 0.02 } } },
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
    src.specs.Cms_m_per_N.clear();

    assert.equal(src.specs.Fs_hz.entered, true, 'fixture precondition: Fs entered');
    // The fixture must actually carry both an E and a C field, or the test is vacuous. Cms is
    // unstated and the record states Vas and Sd, so it reads back derived.
    assert.equal(src.specs.Cms_m_per_N.calculated, true,
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

    const CHECKED_FIELDS = ['Fs_hz', 'Qts', 'Qes', 'Qms', 'Vas_m3', 'Sd_m2', 'Re_ohm', 'Cms_m_per_N', 'Mms_kg', 'BL_Tm'] as const;
    /** Dispatch a fixed field name to its flat accessor's provenance letter — `SpecField` never
     *  appears as a public parameter (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md);
     *  this test needs the same field checked on two driver instances, so the dispatch lives
     *  here. */
    // `field` is one of the names listed above.
    function stateOf(d: OpenISDDriver, field: typeof CHECKED_FIELDS[number]) {
      switch (field) {
        case 'Fs_hz': return provenanceOf(d.specs.Fs_hz);
        case 'Qts': return provenanceOf(d.specs.Qts);
        case 'Qes': return provenanceOf(d.specs.Qes);
        case 'Qms': return provenanceOf(d.specs.Qms);
        case 'Vas_m3': return provenanceOf(d.specs.Vas_m3);
        case 'Sd_m2': return provenanceOf(d.specs.Sd_m2);
        case 'Re_ohm': return provenanceOf(d.specs.Re_ohm);
        case 'Cms_m_per_N': return provenanceOf(d.specs.Cms_m_per_N);
        case 'Mms_kg': return provenanceOf(d.specs.Mms_kg);
        case 'BL_Tm': return provenanceOf(d.specs.BL_Tm);
      }
    }
    for (const f of CHECKED_FIELDS) {
      assert.equal(stateOf(back, f), stateOf(src, f),
        `${f}'s provenance must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'Provenance sample', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, sampleDriverRecord()));
    const record = ser.driverEmbedding?.device;
    assert.ok(record, 'the driver payload travels');
    assert.ok(record.specs, 'the driver payload is the openisd.yml record');
    assert.ok(record.specs.woofer?.Fs_hz?.readings,
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
 *
 * QO130 partially reverses QO90's `lossMode` call: the UI-singleton `presentationState.lossMode`
 * this test used to rule out is gone, but `lossMode` now travels as PROJECT data, nested under
 * `advanced` (`OpenISDProject.lossMode`) — a project fact (S10), not a view preference. The key
 * set below still has no bare top-level `lossMode`, which is what this test actually checks.
 */
describe('file save carries PURE PROJECT DATA — no view (QO90)', () => {
  it('the stored payload carries no ui/cursor/graphs, and no view-singleton lossMode ' +
     '(project-scoped lossMode nests under advanced, QO130)', async () => {
    const ser = await storedPayload(projectOf('sealed', { name: 'View-free save', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: '' }, sampleDriverRecord()));
    // The whole key set, not four named absences: a view field arriving under a name nobody
    // predicted is exactly the leak this test exists to catch, and asserting `ser.ui ===
    // undefined` cannot see it. Any key added to the project wire must be added here
    // DELIBERATELY, which is the point.
    assert.deepEqual(Object.keys(ser).sort(),
      ['advanced', 'box', 'charts', 'driverEmbedding', 'environment', 'filters', 'meta', 'signal'],
      'the file wire carries project data only — no ui, cursor, graphs, or top-level lossMode (QO90/QO130)');
    // The project itself still travels.
    assert.equal(ser.meta?.name, 'View-free save');
  });
});

/**
 * QO168 (2026-09-21) takes S10/QO130's project-scoping of the graph cursor one step further:
 * the four fast-changing cursor fields (crosshair f, pinnedF, locked, drag-band range) are OUT
 * of the saved record ENTIRELY — never `.owpr`, never a share link, never the view-state
 * autosave (`OpenISDProject.cursorF` etc. are plain in-memory instance state, a documented
 * exception in `architecture-project-has-three-fields.test.ts`). `graphs`/`lossMode` (QO130)
 * are project data now too, persisted via `OpenISDProject.graphs`/`.lossMode` inside
 * `project.toOwprText()` — a share link's project text already carries them, so `ViewSnapshot`
 * does not need to carry them a second time either. `ViewSnapshot` shrinks to `{ ui }` alone.
 */
describe('ViewSnapshot carries only ui — cursor/graphs/lossMode moved onto the project (QO130/QO168)', () => {
  it('currentViewSnapshot() carries no cursor, graphs, or lossMode key', () => {
    const snapshot = currentViewSnapshot();
    assert.deepEqual(Object.keys(snapshot), ['ui', 'chart'],
      'cursor is QO168-exempt from every saved record; graphs/lossMode are now project data ' +
      '(QO130), already carried inside the project text; chart is the app-level sweep/Y ranges ' +
      '(BUG_20260926_sweep-range-and-y-ranges-not-persisted)');
  });
});

/**
 * A share link is a COMPLETE description of the session: the recipient lands on exactly what
 * the sender was looking at. Nothing is stripped — not the open-panel flags, and not the
 * recipient-preference fields, even though they are preferences rather than design data
 * (human ruling 2026-08-14). Cursor/graphs/lossMode are excluded per QO130/QO168 above — not a
 * strip of session fidelity, since the project text (also in the share link) already carries
 * graphs/lossMode, and the cursor was ruled out of every saved record, share links included.
 */
describe('share link carries the whole state, stripped of nothing', () => {
  const uiView: ViewSnapshot = {
    ui: {
      originalProjectTab: 'signal', originalChartTab: 'Excursion', originalChartLabel: 'Cone excursion',
      originalTuneOpen: true, originalEditorOpen: true,
      originalNavW: 320, originalBottomH: 200, originalNavCollapsed: true,
      originalBottomCollapsed: true, originalChartMax: true,
      username: 'johnl',
      chartColors: { background: '#ffffff' },
    },
  };
  const drv = sampleDriverRecord();

  // stateToUrl reads location.{origin,pathname}; stub it (no jsdom needed) for the URL test.
  beforeAll(() => vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' }));
  afterAll(() => vi.unstubAllGlobals());

  it('every ui field travels — view context, open panels, local preferences and project meta alike', async () => {
    const meta: FixtureMeta = {
      name: 'Kick bin', creator: 'John Lonergan', created: '2026-08-01T00:00:00.000Z',
      modified: '2026-08-14T12:30:00.000Z', description: 'PA subwoofer for the shed',
    };
    const urlOrErr = await repo.stateToUrl(projectOf('sealed', meta, drv), uiView);
    if (Array.isArray(urlOrErr)) throw new Error('fail');
    const shared = decodeShare(urlOrErr as string);
    // A share link is `{project, view}` — the design and where the sender was looking, kept
    // apart. The ui fields are the view's; the metadata is the project's.
    const ui: Record<string, unknown> | undefined = shared.view?.ui;
    assert.ok(ui, 'the view context travels');

    // Project-level metadata is part of the session too — a share link that dropped it would
    // hand the recipient an anonymous, undated design.
    // The project travels as `.owpr` TEXT — the same bytes a saved file holds, one serialised
    // form for every door (`projectRepo.stateToUrl`) — so it is parsed to reach the record. The
    // parsed shape is the session wrapper `{label, saved, edited}`; the design is under `saved`.
    const saved = JSON.parse(shared.project)?.saved;
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
    // A long, repetitive description gives the JSON the repetition gzip exploits, on top of
    // the driver record itself.
    const meta: FixtureMeta = { name: 'Gzip fixture', creator: 'John', created: '2026-01-01',
      modified: '2026-01-02', description: 'repetition '.repeat(200) };
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

  // The graph-cursor/drag-band tests that lived here (cursor carried through a share link)
  // are dropped, not weakened: QO168 (John 2026-09-21) ruled the four cursor fields out of
  // EVERY saved record, share links included — see the ViewSnapshot describe block above.
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
    assert.ok(loaded.project.driver, 'the V1→V2 step serialises the driver slot, and the repo adopts it');
    const d = loaded.project.driver;
    assert.equal(d.specs.Fs_hz.entered, true,
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

describe('browser storage project door', () => {
  it('saves and restores the committed project without view state', () => {
    const storage = createMemoryStorage();
    const storageRepo = createProjectRepo(new Engine(), noFilePicker, storage);
    const project = projectOf('sealed', {
      name: 'Browser storage fixture', creator: 'Synthetic', created: '2026-01-01',
      modified: '2026-01-02', description: '',
    }, sampleDriverRecord());

    storageRepo.saveToStorage(project);
    const loaded = storageRepo.loadFromStorage();

    assert.ok(!Array.isArray(loaded) && loaded, 'saved project must restore');
    assert.equal(loaded.name.value, 'Browser storage fixture');
    assert.equal(loaded.box.boxType.value, 'sealed');
  });

  it('lists every saved project newest first and loads the selected project', () => {
    const storage = createMemoryStorage();
    const storageRepo = createProjectRepo(new Engine(), noFilePicker, storage);
    const older = projectOf('sealed', {
      name: 'Older browser project', creator: 'Synthetic', created: '2026-01-01',
      modified: '2026-01-02', description: '',
    }, sampleDriverRecord());
    const newer = projectOf('sealed', {
      name: 'Newer browser project', creator: 'Synthetic', created: '2026-01-03',
      modified: '2026-01-04', description: '',
    }, sampleDriverRecord());

    storageRepo.saveToStorage(older);
    storageRepo.saveToStorage(newer);

    const listings = storageRepo.listStoredProjects();
    assert.deepEqual(listings.map(entry => entry.name), ['Newer browser project', 'Older browser project']);
    const loaded = storageRepo.loadStoredProject(listings[1].id);
    assert.ok(!Array.isArray(loaded) && loaded);
    assert.equal(loaded.name.value, 'Older browser project');
  });

  it('saving a project opened from browser storage updates its entry', () => {
    const storage = createMemoryStorage();
    const storageRepo = createProjectRepo(new Engine(), noFilePicker, storage);
    const original = projectOf('sealed', {
      name: 'Stored project to reopen', creator: 'Synthetic', created: '2026-01-05',
      modified: '2026-01-06', description: '',
    }, sampleDriverRecord());
    storageRepo.saveToStorage(original);
    const listing = storageRepo.listStoredProjects()[0];
    const reopened = storageRepo.loadStoredProject(listing.id);
    assert.ok(!Array.isArray(reopened) && reopened);

    reopened.name.set('Stored project after edit');
    storageRepo.saveToStorage(reopened);

    assert.deepEqual(storageRepo.listStoredProjects().map(entry => entry.name), ['Stored project after edit']);
  });

  it('restores every open project and the focused project after refresh', () => {
    const storage = createMemoryStorage();
    const storageRepo = createProjectRepo(new Engine(), noFilePicker, storage);
    const first = projectOf('sealed', {
      name: 'Open project one', creator: 'Synthetic', created: '2026-01-07',
      modified: '2026-01-08', description: '',
    }, sampleDriverRecord());
    const second = projectOf('sealed', {
      name: 'Open project two', creator: 'Synthetic', created: '2026-01-09',
      modified: '2026-01-10', description: '',
    }, sampleDriverRecord());

    storageRepo.saveOpenProjects([first, second], second);

    const restored = storageRepo.loadOpenProjects();
    assert.ok(restored && !Array.isArray(restored));
    assert.deepEqual(restored.projects.map(project => project.name.value), ['Open project one', 'Open project two']);
    assert.equal(restored.focusedIndex, 1);
  });

  it('reads projects saved under the previous browser-storage keys', () => {
    const project = projectOf('sealed', {
      name: 'Legacy saved project', creator: 'Synthetic', created: '2026-01-11',
      modified: '2026-01-12', description: '',
    }, sampleDriverRecord());
    const storage = createMemoryStorage({ 'openisd.project': project.toOwprText() });
    const storageRepo = createProjectRepo(new Engine(), noFilePicker, storage);

    const restored = storageRepo.loadFromStorage();

    assert.ok(!Array.isArray(restored) && restored);
    assert.equal(restored.name.value, 'Legacy saved project');
  });
});
