import {describe, expect, it} from 'vitest';
import {LossMode} from '@openisd/design/fields';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {specSection, driverFrom} from '../fixtures/domainBuilders.js';

describe('OpenISDProject.lossMode — project-scoped, not a UI singleton (S10/QO130)', () => {
  const project = () => new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), createEngine()).sealed().volume_m3(0.03).build();

  it('defaults to WinisdLossy — the saved record states no lossMode yet', () => {
    expect(project().lossMode.value).toBe(LossMode.Default);
  });

  it('round-trips a stated mode through the project record', () => {
    const p = project();
    p.lossMode.set(LossMode.Lossless);
    expect(p.lossMode.value).toBe(LossMode.Lossless);
  });

  it('drives the sealed box\'s own resonance readout — two projects can disagree', () => {
    // The bug S10/QO130 fixes: a global `presentationState.lossMode` singleton meant two open
    // projects could not disagree about their own loss model. Each project's `box.sealed`
    // readout must follow THAT project's own stated mode.
    const lossy = project();
    const lossless = project();
    lossless.lossMode.set(LossMode.Lossless);

    expect(lossy.box.sealed.resonance_hz.value).not.toBeCloseTo(lossless.box.sealed.resonance_hz.value!, 6);
  });
});
