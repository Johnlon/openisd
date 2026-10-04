/**
 * fileImportExport — what the `.owpr` file door writes and reads back: a driver's PROVENANCE
 * survives (an E field comes back E, a C field comes back C, because the record carries
 * `readings`/`origin` rather than a flat bag of numbers), and the file carries PURE PROJECT
 * DATA ONLY (QO90) — the view never reaches that wire.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {createMemoryStorage, createProjectRepo, type FileStorage} from '@openisd/persistence';
import {parseSavedProject, projectOf, sampleDriverRecord, type SavedProjectWire} from '../fixtures/persistedProject.js';

/** A picker that KEEPS what was written, so a test can decode the file door's own bytes. */
let written: string | null = null;
const capturingPicker: FileStorage = {
  save: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  saveAs: async (bytes) => { written = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes); return { name: 'p.owpr', cancelled: false, written: true }; },
  openFileName: () => 'p.owpr',
  forget: () => {},
};
const fileRepo = createProjectRepo(createEngine(), capturingPicker, createMemoryStorage());
const owprNaming = { suggestedName: 'p.owpr', mime: 'application/json', label: 'OpenISD project', ext: '.owpr' };

/** The bytes the FILE door writes, decoded independently. */
async function savedFileText(project: OpenISDProject): Promise<string> {
  written = null;
  await fileRepo.saveToFile(project, owprNaming);
  assert.ok(written, 'the file door must have written bytes');
  return written!;
}

/** The saved-FILE payload's PROJECT half, decoded independently. Pure project data (QO90): no
 *  view ever reaches this wire.
 *
 *  A `.owpr` file holds the session wrapper `{label, saved, edited}`
 *  (`openISDProjectSessionJsonSchema`), so the project itself is `saved` — every assertion below
 *  is about the project, and reading the wrapper instead would make each one vacuously true. */
async function storedPayload(project: OpenISDProject): Promise<SavedProjectWire> {
  return parseSavedProject(await savedFileText(project));
}

describe('fileImportExport — provenance survives a file-save round trip', () => {
  it('E stays E and C stays C across save → JSON → restore', async () => {
    const srcOrErr = OpenISDDriver.fromConformingRecord(sampleDriverRecord(), createEngine());
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
    const backOrErr = OpenISDDriver.fromConformingRecord(wire.driverEmbedding?.device, createEngine());
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
        case 'Fs_hz': return d.specs.Fs_hz.provenance;
        case 'Qts': return d.specs.Qts.provenance;
        case 'Qes': return d.specs.Qes.provenance;
        case 'Qms': return d.specs.Qms.provenance;
        case 'Vas_m3': return d.specs.Vas_m3.provenance;
        case 'Sd_m2': return d.specs.Sd_m2.provenance;
        case 'Re_ohm': return d.specs.Re_ohm.provenance;
        case 'Cms_m_per_N': return d.specs.Cms_m_per_N.provenance;
        case 'Mms_kg': return d.specs.Mms_kg.provenance;
        case 'BL_Tm': return d.specs.BL_Tm.provenance;
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
describe('fileImportExport — file save carries pure project data, no view', () => {
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

