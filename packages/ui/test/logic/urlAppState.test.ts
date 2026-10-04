/**
 * urlAppState — a share link carries the WHOLE state, stripped of nothing (human ruling
 * 2026-08-14). A link that quietly differs from what the sender saw cannot diagnose what the
 * sender saw. `stateToUrl` alone takes a `ViewSnapshot` alongside the project.
 */
import {afterAll, beforeAll, describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createEngine} from '@openisd/design/engine';
import {createMemoryStorage, createProjectRepo, type ViewSnapshot} from '@openisd/persistence';
import {noFilePicker, parseSavedProject, projectOf, sampleDriverRecord, type FixtureMeta} from '../fixtures/persistedProject.js';

const repo = createProjectRepo(createEngine(), noFilePicker, createMemoryStorage());

/** The share-link payload, decoded independently of the app's own `stateToUrl`/gzip path —
 *  what a real browser would decode a link to. */
/** What a decoded share link holds: the project as `.owpr` text (parsed further where a test
 *  reaches into the record) beside the view the link was carrying. */
interface DecodedShare { project: string; view: ViewSnapshot }
function isDecodedShare(value: unknown): value is DecodedShare {
  if (typeof value !== 'object' || value === null) return false;
  if (!('project' in value) || typeof value.project !== 'string') return false;
  if (!('view' in value) || typeof value.view !== 'object' || value.view === null) return false;
  return true;
}
function decodeShare(url: string): DecodedShare {
  const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
  const decoded: unknown = JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
  if (!isDecodedShare(decoded)) throw new Error('share link payload does not match {project, view}');
  return decoded;
}

/**
 * A share link is a COMPLETE description of the session: the recipient lands on exactly what
 * the sender was looking at. Nothing is stripped — not the open-panel flags, and not the
 * recipient-preference fields, even though they are preferences rather than design data
 * (human ruling 2026-08-14). Cursor/graphs/lossMode are excluded per QO130/QO168 above — not a
 * strip of session fidelity, since the project text (also in the share link) already carries
 * graphs/lossMode, and the cursor was ruled out of every saved record, share links included.
 */
describe('urlAppState — share link carries the whole state, stripped of nothing', () => {
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
    const shared = decodeShare(urlOrErr);
    // A share link is `{project, view}` — the design and where the sender was looking, kept
    // apart. The ui fields are the view's; the metadata is the project's.
    const ui: Record<string, unknown> | undefined = shared.view?.ui;
    assert.ok(ui, 'the view context travels');

    // Project-level metadata is part of the session too — a share link that dropped it would
    // hand the recipient an anonymous, undated design.
    // The project travels as `.owpr` TEXT — the same bytes a saved file holds, one serialised
    // form for every door (`projectRepo.stateToUrl`) — so it is parsed to reach the record. The
    // parsed shape is the session wrapper `{label, saved, edited}`; the design is under `saved`.
    const saved = parseSavedProject(shared.project);
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

