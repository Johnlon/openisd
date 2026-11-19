/**
 * bugs/BUG_20261118_winisd-sealed-picker-ignores-driver-count.md: with the "Sealed picker volume" WinISD bug switch
 * ticked, the sealed alignment picker counts the drivers, as the unticked picker does since T901 (PR 230).
 *
 * WinISD: the picker `0x45c140` divides `[ESI+0x4b0]` (winisd_research/archive/GHIDRA_FINDINGS.md "SEALED (CLOSED) ALIGNMENT
 * PICKER FORMULA FOUND"), and `fr_45e090`, which the wizard dispatcher `0x44e9b0` runs after copying the wizard's
 * driver count and Iso-barik radio into the design object, writes `0x4b0 = Nd·Vas`, halved for Iso-barik
 * (GHIDRA_FINDINGS.md "Number of drivers and placement"; spec/S04_sealed_box.md section 2, 0x45e0ad-0x45e0f2).
 * One driver: the W5-1138SMF at Qtc 0.800 gives WinISD's captured 3.1338 L (runs/sealed_picker_formula.jsonl).
 * Four drivers, OBSERVED: WinISD's wizard saved Vr 0.0125353494668224 m3, four times the one-driver volume
 * (winisd_research/runs/s04-picker-nd-20261118/results.jsonl, nd 4, 18 Nov 2026).
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';
import type {DriveLoad} from '../../engine/index.js';
import {DEFAULT_ALFAVC_PER_K, DEFAULT_VC_TEMP_RISE_K} from '../../fields/index.js';

const engine = createEngine();
const LOSSES = {Ql: 10, Qa: 100};
/** WinISD's own picker volume for the W5-1138SMF at Qtc 0.800, one driver (runs/sealed_picker_formula.jsonl). */
const WINISD_ONE_DRIVER_M3 = 0.00313383736670561;
/** WinISD's own picker volume for four W5-1138SMF at Qtc 0.800 (runs/s04-picker-nd-20261118/results.jsonl). */
const WINISD_FOUR_DRIVERS_M3 = 0.0125353494668224;

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

describe('the WinISD-bug sealed picker counts the drivers', () => {
  it.each([1, 2, 4])('ticked, %i W5-1138SMF at Qtc 0.800 give that many times WinISD\'s one-driver 3.1338 L', (n) => {
    const vb = w5().sealedPickerVolume(0.8, load(n, 'standard'), LOSSES, true)!;
    expect(vb * 1000).toBeCloseTo(n * WINISD_ONE_DRIVER_M3 * 1000, 6);
  });

  it('ticked, 4 W5-1138SMF at Qtc 0.800 give the 12.5353 L WinISD\'s wizard saved', () => {
    const vb = w5().sealedPickerVolume(0.8, load(4, 'standard'), LOSSES, true)!;
    expect(Math.abs(vb / WINISD_FOUR_DRIVERS_M3 - 1)).toBeLessThan(1e-9);
  });

  it('ticked, an isobaric pair gives half the one-driver volume', () => {
    const vb = w5().sealedPickerVolume(0.8, load(1, 'isobaric'), LOSSES, true)!;
    expect(vb * 1000).toBeCloseTo(WINISD_ONE_DRIVER_M3 / 2 * 1000, 6);
  });

  it.each([1, 2, 4])('ticked, %i driver(s): the Box tab then shows WinISD\'s 0.787, as for one driver', (n) => {
    const d = w5();
    const vb = d.sealedPickerVolume(0.8, load(n, 'standard'), LOSSES, true)!;
    expect(d.sealedQtc(vb, load(n, 'standard'), LOSSES)).toBeCloseTo(0.7873, 3);
  });
});
