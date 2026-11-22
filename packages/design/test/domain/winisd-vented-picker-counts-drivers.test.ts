/**
 * bugs/BUG_20261118_vented-picker-ignores-driver-count.md: the vented alignment picker counts the drivers and Iso-barik,
 * as WinISD's does. WinISD 0.7.0 (winisd_research/runs/vented-picker-ndrivers-20261118/RESULT.md, results.jsonl, the saved
 * .wpr [Box] Vr and Fr): the proposed volume is proportional to Nd and halved for Iso-barik; the tuning does not change.
 * Same driver and tolerance as the sealed picker test (winisd-sealed-picker-counts-drivers.test.ts): relative 1e-9.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';
import type {DriveLoad, VentedAlignment} from '../../engine/index.js';
import {DEFAULT_ALFAVC_PER_K, DEFAULT_VC_TEMP_RISE_K} from '../../fields/index.js';

const engine = createEngine();
const Ql = 10;

function w5(): OpenISDDriver {
  const d = OpenISDDriver.empty(engine);
  d.specs.Fs_hz.set(45);
  d.specs.Qts.set(0.49);
  d.specs.Qes.set(0.57);
  d.specs.Qms.set(3.56);
  d.specs.Re_ohm.set(3.4);
  d.specs.Vas_m3.set(0.00485);
  return d;
}

function load(nDrivers: number, loading: 'standard' | 'isobaric'): DriveLoad {
  return {Rs_ohm: 0.1, nDrivers, loading, alfaVC_per_K: DEFAULT_ALFAVC_PER_K, vcTempRise_K: DEFAULT_VC_TEMP_RISE_K};
}

interface Case {readonly name: string; readonly n: number; readonly loading: 'standard' | 'isobaric'; readonly Vb_m3: number}

/** WinISD's saved Vr (m3) and Fr (Hz) per alignment, from results.jsonl. */
const WINISD: readonly {readonly alignment: VentedAlignment; readonly Fb_hz: number; readonly cases: readonly Case[]}[] = [
  {alignment: 'c4', Fb_hz: 35.9002461074499, cases: [
    {name: 'Nd 1', n: 1, loading: 'standard', Vb_m3: 0.0106965893843364},
    {name: 'Nd 2', n: 2, loading: 'standard', Vb_m3: 0.0213931787686728},
    {name: 'Nd 4', n: 4, loading: 'standard', Vb_m3: 0.0427863575373455},
    {name: 'Nd 1 Iso-Barik', n: 1, loading: 'isobaric', Vb_m3: 0.00534829469216819},
    {name: 'Nd 2 Iso-Barik', n: 2, loading: 'isobaric', Vb_m3: 0.0106965893843364},
  ]},
  {alignment: 'qb3', Fb_hz: 36.1337961937311, cases: [
    {name: 'Nd 1', n: 1, loading: 'standard', Vb_m3: 0.0106942599109645},
    {name: 'Nd 2', n: 2, loading: 'standard', Vb_m3: 0.021388519821929},
    {name: 'Nd 4', n: 4, loading: 'standard', Vb_m3: 0.042777039643858},
    {name: 'Nd 1 Iso-Barik', n: 1, loading: 'isobaric', Vb_m3: 0.00534712995548225},
    {name: 'Nd 2 Iso-Barik', n: 2, loading: 'isobaric', Vb_m3: 0.0106942599109645},
  ]},
];

describe('the vented alignment picker counts the drivers as WinISD does', () => {
  for (const {alignment, Fb_hz, cases} of WINISD) {
    it.each(cases)(`${alignment}, $name: WinISD's Vb and Fb`, ({n, loading, Vb_m3}) => {
      const design = w5().ventedDesign(alignment, load(n, loading), Ql)!;
      expect(Math.abs(design.Vb / Vb_m3 - 1)).toBeLessThan(1e-9);
      expect(Math.abs(design.Fb / Fb_hz - 1)).toBeLessThan(1e-9);
    });
  }
});
