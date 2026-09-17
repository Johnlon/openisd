import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import { OpenISDProject } from '@openisd/design/domain';

describe('store-path repro', () => {
  it('builds via OpenISDProject.empty, switches to vented, clears tuning', () => {
    const p = OpenISDProject.empty(new Engine());
    p.box.boxType.set('vented');
    const w = p.driver.spec.woofer;
    w.Fs_hz.set(37); w.Qts.set(0.378); w.Qes.set(0.40); w.Qms.set(7.0);
    w.Vas_m3.set(0.0300); w.Sd_m2.set(0.0133); w.Re_ohm.set(5.6); w.Le_H.set(0.70e-3);
    w.Xmax_m.set(0.0050); w.Pe_W.set(60);
    p.box.vented.volume_m3.set(0.030);
    p.box.vented.vent.diameter_m.set(0.102);
    p.box.vented.tuning_hz.set(37);
    p.box.vented.tuning_hz.clear();
    const r = p.sweep({ fmin: 10, fmax: 1e3 });
    console.log('REPRO sweep issues:', JSON.stringify(r.issues), 'values null?', r.values === null);
    expect(r.issues).toHaveLength(1);
  });
});
