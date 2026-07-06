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

// The chosen skin is a LOCAL preference — kept in localStorage but excluded from the
// shareable URL, so a shared design adapts to the recipient's own device/skin.
describe('skin preference is local-only', () => {
  const skinState = { box: 'sealed', P: {} as UiParams, graphs: ['SPL'], ui: { skin: 'classic' } } as unknown as AppState;
  const drv = Driver.fromWdr(wdrText).toJSON();

  // stateToUrl reads location.{origin,pathname}; stub it (no jsdom needed) for the URL test.
  beforeAll(() => vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' }));
  afterAll(() => vi.unstubAllGlobals());

  function decodeShare(url: string): Record<string, unknown> {
    const b64 = url.match(/[#&]s=([^&]+)/)![1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }

  it('serialize() carries ui.skin so localStorage remembers it', () => {
    assert.equal(serialize(skinState, drv, []).ui?.skin, 'classic');
  });

  it('stateToUrl() omits ui — a shared link never forces a skin on the recipient', () => {
    const shared = decodeShare(stateToUrl(serialize(skinState, drv, [])));
    assert.equal('ui' in shared, false);
    assert.equal(shared.box, 'sealed');  // the design itself still travels
  });
});
