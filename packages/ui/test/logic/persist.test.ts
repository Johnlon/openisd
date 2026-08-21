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
import { gunzipSync } from 'node:zlib';
import { OpenISDDriver, Provenance } from '@openisd/model';
import { WinISDDriver } from '@openisd/winisd';
import { serialize, stateToUrl } from '../../src/logic/persist.js';
import type { AppState, SerializedState, UiParams, DriverJSON } from '../../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd', 'John-all-manu-populated.wdr');
const wdrText = readFileSync(SAMPLE, 'utf8');

// A minimal AppState — serialize only reads box/P/graphs off it.
const miniState = { box: 'sealed', P: {} as UiParams, graphs: ['SPL'] } as unknown as AppState;

/** The sample `.wdr`, read as-read by the serialiser and projected into the app's own record.
 *  One reader, one model — there is no second shape to discriminate on. */
function sampleRecord(): DriverJSON {
  return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(wdrText)).toJsonRecord();
}

describe('persistence — provenance survives a serialize round trip', () => {
  it('E stays E and C stays C across serialize → JSON → restore', () => {
    const src = OpenISDDriver.fromJsonRecord(sampleRecord());
    // Clear a derivable field so the fixture carries a genuine C (Cms recomputes from
    // Fs/Vas/Sd) alongside the E fields the WinISD save marks entered.
    src.clear('Cms');

    // The fixture must actually contain both an E and a C field, or the test is vacuous.
    assert.equal(src.cell('Fs').state, Provenance.Entered, 'fixture precondition: Fs entered');
    assert.equal(src.cell('Cms').state, Provenance.Calculated, 'fixture precondition: Cms now computed');

    const wire = JSON.parse(JSON.stringify(serialize(miniState, src.toJsonRecord())));
    const back = OpenISDDriver.fromJsonRecord(wire.driver);

    for (const f of ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'BL'] as const) {
      assert.equal(back.cell(f).state, src.cell(f).state,
        `cell(${f}).state must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', () => {
    const ser = serialize(miniState, sampleRecord());
    assert.ok(ser.driver?.specs, 'the driver payload is the openisd.yml record');
    assert.ok(ser.driver?.specs.woofer?.Fs?.readings,
      'each field carries its readings, not a bare number — that is what makes E/C survivable');
  });

  it('a design with NO driver chosen serialises without inventing one', () => {
    const ser = serialize(miniState, undefined);
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
  const uiState = {
    box: 'sealed', P: {} as UiParams, graphs: ['SPL'],
    ui: {
      skin: 'classic',
      originalProjectTab: 'signal', originalChartTab: 'Excursion', originalChartLabel: 'Cone excursion',
      originalTuneOpen: true, originalEditorOpen: true,
      originalNavW: 320, originalBottomH: 200, originalNavCollapsed: true,
      originalBottomCollapsed: true, originalChartMax: true,
      username: 'johnl', envDefaults: { tempK: 300, pressurePa: 100000, humidityPct: 40 },
      chartColors: { background: '#ffffff' },
    },
  } as unknown as AppState;
  const drv = sampleRecord();

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

  it('every ui field travels — view context, open panels and local preferences alike', async () => {
    const shared = decodeShare(await stateToUrl(serialize(uiState, drv)));
    const ui = shared.ui as Record<string, unknown> | undefined;
    assert.ok(ui, 'the view context travels');

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
    const loaded = { ...uiState, compare: [
      { driver: drv, box: 'vented', P: {}, name: 'Compare A', color: '#ff0000' },
      { driver: drv, box: 'sealed', P: {}, name: 'Compare B', color: '#00ff00' },
    ] } as unknown as AppState;
    const plainBase64Len = Buffer.from(JSON.stringify(serialize(loaded, drv)), 'utf8').toString('base64').length;
    const gzipBase64Len = (await stateToUrl(serialize(loaded, drv))).match(/[#&]s=([^&]+)/)![1].length;

    assert.ok(gzipBase64Len < plainBase64Len,
      `gzip+base64 (${gzipBase64Len}) should be smaller than plain base64 (${plainBase64Len})`);
  });

  it('carries the graph cursor — live hover and locked/pinned, both if both are set', async () => {
    const withCursor = { ...uiState, cursorF: 123.4, pinnedF: 500, cursorLocked: true } as unknown as AppState;
    const local = serialize(withCursor, drv);
    assert.deepEqual(local.cursor, { f: 123.4, pinnedF: 500, locked: true, range: null });
    assert.deepEqual(decodeShare(await stateToUrl(local)).cursor,
      { f: 123.4, pinnedF: 500, locked: true, range: null });
  });

  it('carries the dragged band (fLo/fHi only — stats are per-panel derived)', async () => {
    const withBand = { ...uiState, dragRange: { fLo: 31.6, fHi: 100, stats: { peak: 1 } } } as unknown as AppState;
    const local = serialize(withBand, drv);
    assert.deepEqual(local.cursor!.range, { fLo: 31.6, fHi: 100 }, 'derived stats are not state');
    assert.deepEqual(decodeShare(await stateToUrl(local)).cursor!.range, { fLo: 31.6, fHi: 100 });
  });

  it('an unset cursor serialises as all-null/false, not omitted', () => {
    const noCursor = { ...uiState, cursorF: null, pinnedF: null, cursorLocked: false } as unknown as AppState;
    assert.deepEqual(serialize(noCursor, drv).cursor,
      { f: null, pinnedF: null, locked: false, range: null },
      'omitting "nothing pinned" would make absence and unset indistinguishable on reload');
  });
});
