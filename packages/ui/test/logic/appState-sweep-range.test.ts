/**
 * The store's sweep runs over the global plot range (`presentationState.sweepRange`) — the
 * same range `syncedP` hands the chart's X axis. Two readers of one fact: a 1 Hz plot start
 * that widened the axis but left the curves starting at 10 Hz (John, 2026-09-24: "a complete
 * blank below 10hz") was the store sweeping a fixed 10 Hz–20 kHz grid of its own.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {curvesData, maxData, newProject, requireFocusedProject, syncedP} from '../../src/logic/appState.js';
import {presentationState} from '../../src/logic/presentationState.js';

/** Past `scheduleSweep`'s throttle window (`SWEEP_MS`), so the re-sweep has landed. */
async function awaitSweepThrottle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50));
}

function aSimulatableSealedProject(): void {
  newProject();
  const p = requireFocusedProject();
  p.driver.specs.Fs_hz.set(45);
  p.driver.specs.Qts.set(0.49);
  p.driver.specs.Qes.set(0.57);
  p.driver.specs.Qms.set(3.56);
  p.driver.specs.Vas_m3.set(0.00485);
  p.driver.specs.Sd_m2.set(0.0094);
  p.driver.specs.Re_ohm.set(3.4);
  p.driver.specs.Le_H.set(0.34e-3);
  p.driver.specs.Xmax_m.set(0.00925);
  p.driver.specs.Pe_W.set(80);
  p.driver.specs.Znom_ohm.set(4);
  p.box.sealed.volume_m3.set(0.00448);
}

describe('the store sweeps the range the chart axis shows', () => {
  it('a 1 Hz plot start sweeps from 1 Hz, for the curves and the max curves alike', async () => {
    aSimulatableSealedProject();
    presentationState.sweepRange = {min: 1, max: 5000};
    await awaitSweepThrottle();

    assert.equal(syncedP.value.fmin, 1);
    assert.equal(syncedP.value.fmax, 5000);
    const sw = curvesData.value;
    const mx = maxData.value;
    assert.ok(sw && mx, 'a sized sealed box with a complete driver must produce curves');
    assert.ok(Math.abs(sw.fs[0] - 1) < 1e-9, `curves must start at the plot start, got ${sw.fs[0]} Hz`);
    assert.ok(Math.abs(sw.fs[sw.fs.length - 1] - 5000) < 1e-6, `curves must end at the plot end, got ${sw.fs[sw.fs.length - 1]} Hz`);
    assert.ok(Math.abs(mx.fs[0] - 1) < 1e-9, `max curves must start at the plot start, got ${mx.fs[0]} Hz`);
  });

  it('the default global range sweeps WinISD\'s 10 Hz–20 kHz window', async () => {
    presentationState.sweepRange = {min: 10, max: 20000};
    aSimulatableSealedProject();
    await awaitSweepThrottle();

    const sw = curvesData.value;
    assert.ok(sw, 'a sized sealed box with a complete driver must produce curves');
    assert.ok(Math.abs(sw.fs[0] - 10) < 1e-9, `got ${sw.fs[0]} Hz`);
    assert.ok(Math.abs(sw.fs[sw.fs.length - 1] - 20000) < 1e-6, `got ${sw.fs[sw.fs.length - 1]} Hz`);
  });
});
