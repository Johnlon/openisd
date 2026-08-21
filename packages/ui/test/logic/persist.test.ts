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
import { state, managedProject, applyState } from '../../src/logic/store.js';
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

    const wire = JSON.parse(JSON.stringify(serialize(miniState, src.toJsonRecord(), {} as UiParams)));
    const back = OpenISDDriver.fromJsonRecord(wire.driver);

    for (const f of ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Cms', 'Mms', 'BL'] as const) {
      assert.equal(back.cell(f).state, src.cell(f).state,
        `cell(${f}).state must survive persistence — provenance is the point of the record`);
    }
  });

  it('the payload is the RECORD, so `specs` and its readings travel', () => {
    const ser = serialize(miniState, sampleRecord(), {} as UiParams);
    assert.ok(ser.driver?.specs, 'the driver payload is the openisd.yml record');
    assert.ok(ser.driver?.specs.woofer?.Fs?.readings,
      'each field carries its readings, not a bare number — that is what makes E/C survivable');
  });

  it('a design with NO driver chosen serialises without inventing one', () => {
    const ser = serialize(miniState, undefined, {} as UiParams);
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
    const shared = decodeShare(await stateToUrl(serialize(uiState, drv, {} as UiParams)));
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
    const plainBase64Len = Buffer.from(JSON.stringify(serialize(loaded, drv, {} as UiParams)), 'utf8').toString('base64').length;
    const gzipBase64Len = (await stateToUrl(serialize(loaded, drv, {} as UiParams))).match(/[#&]s=([^&]+)/)![1].length;

    assert.ok(gzipBase64Len < plainBase64Len,
      `gzip+base64 (${gzipBase64Len}) should be smaller than plain base64 (${plainBase64Len})`);
  });

  it('carries the graph cursor — live hover and locked/pinned, both if both are set', async () => {
    const withCursor = { ...uiState, cursorF: 123.4, pinnedF: 500, cursorLocked: true } as unknown as AppState;
    const local = serialize(withCursor, drv, {} as UiParams);
    assert.deepEqual(local.cursor, { f: 123.4, pinnedF: 500, locked: true, range: null });
    assert.deepEqual(decodeShare(await stateToUrl(local)).cursor,
      { f: 123.4, pinnedF: 500, locked: true, range: null });
  });

  it('carries the dragged band (fLo/fHi only — stats are per-panel derived)', async () => {
    const withBand = { ...uiState, dragRange: { fLo: 31.6, fHi: 100, stats: { peak: 1 } } } as unknown as AppState;
    const local = serialize(withBand, drv, {} as UiParams);
    assert.deepEqual(local.cursor!.range, { fLo: 31.6, fHi: 100 }, 'derived stats are not state');
    assert.deepEqual(decodeShare(await stateToUrl(local)).cursor!.range, { fLo: 31.6, fHi: 100 });
  });

  it('an unset cursor serialises as all-null/false, not omitted', () => {
    const noCursor = { ...uiState, cursorF: null, pinnedF: null, cursorLocked: false } as unknown as AppState;
    assert.deepEqual(serialize(noCursor, drv, {} as UiParams).cursor,
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

    const wire = JSON.parse(JSON.stringify(serialize(state, undefined, before))) as SerializedState;

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
