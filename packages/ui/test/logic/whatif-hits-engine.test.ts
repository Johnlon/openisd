/**
 * Proves the What-If pane's scrubs are not just stored and notified, but actually reach the
 * ENGINE — i.e. a scrub changes what `Engine.sweep()` computes, not merely what `toEngineDriver()`
 * reports. `managedProject.test.ts` covers the notification-count specification exhaustively but
 * never asserts on a computed engine output, so a regression that silently detached the what-if
 * driver from the sweep (while still notifying) would pass that whole suite.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDDriver, OpenISDProject } from '@openisd/model';
import { ManagedProject } from '../../src/logic/managedProject.js';
import { Engine } from '@openisd/design/engine';
import type { OpenISDDriverJson } from '@openisd/model';

function driverRecord(): OpenISDDriverJson {
  return {
    uuid: { value: 'whatif-hits-engine-0000', definition: 'stable record identity' },
    quality: {
      rating: 'M', confirmed_fields: ['Fs'], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: 'Acme', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    brand: { value: 'Acme', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    model: { value: 'Test-1', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    sku: { value: 'test-1', definition: 'd', grounds: [
      { origin: 'manufacturer_datasheet', reading: 'Test-1', definition: 'd' },
    ] },
    driver_type: { value: 'woofer', origin: 'manufacturer_datasheet', definition: 'd', dq: [] },
    data_sources: { value: {}, definition: 'd' },
    authoritative: { value: 'manufacturer_datasheet', definition: 'd' },
    specs: {
      woofer: {
        Fs: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 40, actual_reading: '40 Hz' } }, dq: [] },
        Qes: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 0.45, actual_reading: '0.45' } }, dq: [] },
        Qms: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 4, actual_reading: '4' } }, dq: [] },
        Vas: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 0.03, actual_reading: '30 l' } }, dq: [] },
        Sd: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 0.0133, actual_reading: '133 cm2' } }, dq: [] },
        Re: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 6, actual_reading: '6 ohm' } }, dq: [] },
        Le: { origin: 'manufacturer_datasheet', readings: { manufacturer_datasheet: { read_value: 0.5e-3, actual_reading: '0.5 mH' } }, dq: [] },
      },
    },
  };
}

describe('What-If pane — a live scrub reaches the engine, not just the store', () => {
  it('enterFs during a what-if changes Engine.sweep()\'s computed impedance peak, and notifies', () => {
    const p = OpenISDProject.empty(OpenISDDriver.fromJsonRecord(driverRecord()));
    p.setBoxType('sealed');
    p.set('Vb', 0.03);
    const mp = ManagedProject.fromProject(p);
    const engine = new Engine();
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 500, N: 400 };
    const peakF = (zmag: number[], fs: number[]) => fs[zmag.indexOf(Math.max(...zmag))];

    const before = mp.toEngineDriver();
    assert.ok(before, 'fixture driver must derive to an EngineDriver');
    const baseline = engine.sweep(before!, 'sealed', P);

    let notifications = 0;
    mp.subscribe(() => { notifications++; });
    mp.beginWhatIf();
    mp.enterFs(80); // obviously-synthetic, far from the fixture's 40 Hz — any wiring must move the peak

    const scrubbed = mp.toEngineDriver();
    assert.ok(scrubbed, 'what-if driver must still derive to an EngineDriver');
    assert.equal(scrubbed!.Fs, 80, 'toEngineDriver() must reflect the live what-if scrub');

    const afterScrub = engine.sweep(scrubbed!, 'sealed', P);
    assert.notDeepEqual(afterScrub.zmag, baseline.zmag, 'scrubbing Fs in a what-if must change what the engine computes');
    assert.ok(
      peakF(afterScrub.zmag, afterScrub.fs) > peakF(baseline.zmag, baseline.fs),
      'raising Fs must raise the impedance-magnitude peak frequency',
    );
    assert.equal(notifications, 2, 'beginWhatIf() + enterFs() — exactly one notification per call');
  });
});
