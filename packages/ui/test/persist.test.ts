/**
 * Persistence carries provenance (Phase 5).
 *
 * serialize() → JSON transport (localStorage/share-link/project JSON) → restore must
 * preserve BOTH the E/C/N marks AND the pass-through fields a WDR-loaded driver carries
 * (dimensions/thermal/ParState) — the values raw() alone drops. It must also still read a
 * legacy v1 blob (flat DriverRaw) without provenance, degrading gracefully.
 *
 * Oracle: the Driver's own cell().state and toWdr() — independent of persist.ts.
 */

import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Driver } from '@openisd/winisd';
import { serialize, stateToUrl } from '../src/utils/persist.js';
import type { AppState, UiParams } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(here, '..', '..', '..', 'drivers', 'sample', 'SEAS_Prestige_L19RNX1.wdr');
const wdrText = readFileSync(SAMPLE, 'utf8');

// A minimal AppState — serialize only reads box/P/graphs off it.
const miniState = { box: 'sealed', P: {} as UiParams, graphs: ['SPL'] } as unknown as AppState;

// The restore logic mirrors store.setDriverFromSerialized (kept out of this unit test so
// it doesn't pull in the reactive store; the discriminator is the whole point).
function restore(d: unknown): Driver {
  return (d && typeof d === 'object' && 'inputs' in (d as object))
    ? Driver.fromJSON(d as Parameters<typeof Driver.fromJSON>[0])
    : Driver.fromRaw((d ?? {}) as Record<string, never>);
}

describe('persistence — provenance + carried fields survive a serialize round-trip', () => {
  it('E/C/N marks are identical after serialize → JSON → restore', () => {
    const src = Driver.fromWdr(wdrText);
    // This scraper marks every field E; clear a derivable one so the fixture carries a
    // genuine C (Cms recomputes from Fs/Vas/Sd) alongside the E fields.
    src.clear('Cms');
    const wire = JSON.parse(JSON.stringify(serialize(miniState, src.toJSON(), [])));
    const back = restore(wire.driver);

    // The fixture must actually contain both an E and a C field, or the test is vacuous.
    assert.equal(src.cell('Fs').state, 'E', 'fixture precondition: Fs entered');
    assert.equal(src.cell('Cms').state, 'C', 'fixture precondition: Cms now computed');

    for (const f of ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'Bl']) {
      assert.equal(back.cell(f).state, src.cell(f).state, `cell(${f}).state must survive persistence`);
    }
  });

  it('a carried pass-through field (Basket) survives — raw() would have dropped it', () => {
    const src = Driver.fromWdr(wdrText);
    const wire = JSON.parse(JSON.stringify(serialize(miniState, src.toJSON(), [])));
    assert.match(restore(wire.driver).toWdr(), /^Basket=/m);
  });

  it('serialize stamps v:2 and stores the full DriverJSON (inputs present)', () => {
    const ser = serialize(miniState, Driver.fromWdr(wdrText).toJSON(), []);
    assert.equal(ser.v, 2);
    assert.ok('inputs' in ser.driver, 'driver payload is the full DriverJSON');
  });

  it('a legacy v1 blob (flat DriverRaw) still loads, marks its fields E', () => {
    const v1 = { v: 1, driver: { name: 'Old', Fs: 40, Qes: 0.4, Qms: 5, Vas: 0.02, Sd: 0.012, Re: 6 } };
    const back = restore(JSON.parse(JSON.stringify(v1)).driver);
    assert.equal(back.cell('Fs').state, 'E');
    assert.equal(back.cell('Fs').value, 40);
  });
});

// A share link carries the sender's whole VIEW (skin, active tab, selected chart) so the
// recipient lands on the identical page — but NOT personal working state (an open editor +
// its uncommitted buffer) or per-field unit-display prefs.
describe('share link carries skin + view context but not editor/working state', () => {
  const uiState = {
    box: 'sealed', P: {} as UiParams, graphs: ['SPL'],
    ui: {
      skin: 'classic',
      originalProjectTab: 'signal', originalChartTab: 'Excursion', originalChartLabel: 'Cone excursion',
      originalTuneOpen: true, originalWhatIf: { inputs: {} }, originalEditorOpen: true,
      originalNavW: 320, originalBottomH: 200, originalNavCollapsed: true,
      originalBottomCollapsed: true, originalChartMax: true,
      username: 'johnl', envDefaults: { tempK: 300, pressurePa: 100000, humidityPct: 40 },
      chartColors: { background: '#ffffff' },
    },
  } as unknown as AppState;
  const drv = Driver.fromWdr(wdrText).toJSON();

  // stateToUrl reads location.{origin,pathname}; stub it (no jsdom needed) for the URL test.
  beforeAll(() => vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' }));
  afterAll(() => vi.unstubAllGlobals());

  // stateToUrl() gzips the payload before base64url — reverse both steps with Node's zlib
  // (independent of the app's own CompressionStream code path, so this is a real check of
  // what a browser would decode, not a tautology against the same implementation).
  function decodeShare(url: string): Record<string, unknown> {
    const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
    const gzipped = Buffer.from(b64, 'base64');
    const json = gunzipSync(gzipped).toString('utf8');
    return JSON.parse(json);
  }

  it('serialize() carries the full ui (incl. skin) so localStorage remembers everything', () => {
    assert.equal(serialize(uiState, drv, []).ui?.skin, 'classic');
  });

  it('stateToUrl() keeps skin + active tab + chart but drops the open-editor buffer', async () => {
    const shared = decodeShare(await stateToUrl(serialize(uiState, drv, [])));
    const ui = shared.ui as Record<string, unknown> | undefined;
    assert.ok(ui, 'shareable view context (ui) travels');
    assert.equal(ui!.skin, 'classic');                    // recipient lands on the SENDER's skin
    assert.equal(ui!.originalProjectTab, 'signal');       // land on the same tab
    assert.equal(ui!.originalChartTab, 'Excursion');      // and the same chart
    assert.equal(ui!.originalChartLabel, 'Cone excursion');
    assert.equal('originalTuneOpen' in ui!, false);       // personal working state excluded
    assert.equal('originalWhatIf' in ui!, false);
    assert.equal('originalEditorOpen' in ui!, false);
    // device-local layout prefs (panel sizes / collapse / chart maximise) excluded too
    assert.equal('originalNavW' in ui!, false);
    assert.equal('originalBottomH' in ui!, false);
    assert.equal('originalNavCollapsed' in ui!, false);
    assert.equal('originalBottomCollapsed' in ui!, false);
    assert.equal('originalChartMax' in ui!, false);
    assert.equal('username' in ui!, false);               // Options-dialog app-level prefs excluded
    assert.equal('envDefaults' in ui!, false);
    assert.equal('chartColors' in ui!, false);
    assert.equal(shared.box, 'sealed');                   // the design itself still travels
  });

  it('gzip actually shrinks the link vs plain base64 of the same JSON (not just round-trips)', async () => {
    // A realistic-size payload — a real driver record (many T/S + carried WDR fields) plus
    // a couple of comparison overlays, so the JSON has the repetition gzip exploits.
    const loaded = { ...uiState, compare: [
      { driver: drv, box: 'vented', P: {}, name: 'Compare A', color: '#ff0000' },
      { driver: drv, box: 'sealed', P: {}, name: 'Compare B', color: '#00ff00' },
    ] } as unknown as AppState;
    const json = JSON.stringify(serialize(loaded, drv, loaded.compare as unknown as never[]));
    const plainBase64Len = Buffer.from(json, 'utf8').toString('base64').length;

    const url = await stateToUrl(serialize(loaded, drv, loaded.compare as unknown as never[]));
    const gzipBase64Len = url.match(/[#&]s=([^&]+)/)![1].length;

    assert.ok(gzipBase64Len < plainBase64Len,
      `gzip+base64 (${gzipBase64Len}) should be smaller than plain base64 (${plainBase64Len}) of the same JSON`);
  });

  it('carries the graph cursor/marker (live hover + locked/pinned) — both, if both are set', async () => {
    const withCursor = { ...uiState, cursorF: 123.4, pinnedF: 500, cursorLocked: true } as unknown as AppState;
    const local = serialize(withCursor, drv, []);
    assert.deepEqual(local.cursor, { f: 123.4, pinnedF: 500, locked: true });

    const shared = decodeShare(await stateToUrl(local));
    assert.deepEqual(shared.cursor, { f: 123.4, pinnedF: 500, locked: true });
  });

  it('an unset cursor serializes as all-null/false, not omitted (no special-casing "nothing pinned")', () => {
    const noCursor = { ...uiState, cursorF: null, pinnedF: null, cursorLocked: false } as unknown as AppState;
    assert.deepEqual(serialize(noCursor, drv, []).cursor, { f: null, pinnedF: null, locked: false });
  });
});
