/**
 * Two drivers, matched to WinISD's own plotted curves, one case per box type.
 * Golden data: `../fixtures/winisdTwoDrivers*Capture.ts`, each logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/<box>-w5-nd2.wpr`). bugs/archive/BUG_20260928_driver-count-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import type {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {type CaptureCheck as Check, absolute, assertMatchesCapture, relative} from '../fixtures/winisdCaptureCheck.js';
import {WINISD_TWO_DRIVERS_CAPTURE as SEALED, type WinIsdPlottedPoint} from '../fixtures/winisdTwoDriversCapture.js';
import {WINISD_TWO_DRIVERS_VENTED_CAPTURE as VENTED} from '../fixtures/winisdTwoDriversVentedCapture.js';
import {WINISD_TWO_DRIVERS_BP4_CAPTURE as BP4} from '../fixtures/winisdTwoDriversBp4Capture.js';
import {WINISD_TWO_DRIVERS_BP6_CAPTURE as BP6} from '../fixtures/winisdTwoDriversBp6Capture.js';
import {WINISD_TWO_DRIVERS_ABC_CAPTURE as ABC} from '../fixtures/winisdTwoDriversAbcCapture.js';
import {WINISD_TWO_DRIVERS_PR_CAPTURE as PR} from '../fixtures/winisdTwoDriversPrCapture.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');

type Sweep = NonNullable<ReturnType<OpenISDProject['sweep']>['values']>;
type MaxCurves = NonNullable<ReturnType<OpenISDProject['maxCurves']>['values']>;
type Grid = Parameters<OpenISDProject['sweep']>[0];

interface Case {
  readonly label: string;
  /** The `.wpr` fixture's base name, `<box>-w5-nd2`. */
  readonly wpr: string;
  readonly capture: { readonly grid: Grid; readonly step: number };
  /** The non-default switches the capture was logged with. */
  readonly configure: (project: OpenISDProject) => void;
  readonly checks: (sw: Sweep, mx: MaxCurves) => readonly Check[];
}

const spl = (sw: Sweep, want: readonly WinIsdPlottedPoint[]): Check => ({title: 'SPL (≤1e-12 relative)', name: 'SPL', got: sw.spl, want, bound: relative(1e-12)});
const impedance = (sw: Sweep, want: readonly WinIsdPlottedPoint[]): Check => ({title: 'impedance (≤1e-12 relative)', name: 'impedance', got: sw.zmag, want, bound: relative(1e-12)});
const maxPower = (mx: MaxCurves, want: readonly WinIsdPlottedPoint[]): Check => ({title: 'maximum power (≤1e-12 relative)', name: 'max power', got: mx.maxpwr, want, bound: relative(1e-12)});

const CASES: readonly Case[] = [
  {
    label: 'sealed box', wpr: 'sealed-w5-nd2', capture: SEALED,
    configure: (project) => project.nDrivers.set(2),
    checks: (sw, mx) => [
      spl(sw, SEALED.spl_dB),
      // OpenISD states excursion in mm; the ÷1000 back to m costs ~2e-12 relative.
      {title: 'excursion (≤1e-11 relative)', name: 'excursion', got: sw.exc.map((mm) => mm / 1000), want: SEALED.excursion_m, bound: relative(1e-11)},
      impedance(sw, SEALED.impedance_ohm),
      // TF passes through 0 dB, where a relative bound means nothing.
      {title: 'transfer function (≤1e-12 dB)', name: 'transfer function', got: sw.tfMag, want: SEALED.tfMag_dB, bound: absolute(1e-12)},
      maxPower(mx, SEALED.maxPower_W),
    ],
  },
  {
    label: 'vented box', wpr: 'vented-w5-nd2', capture: VENTED,
    configure: (project) => project.nDrivers.set(2),
    checks: (sw, mx) => [spl(sw, VENTED.spl_dB), maxPower(mx, VENTED.maxPower_W)],
  },
  {
    label: '4th-order bandpass box', wpr: 'bp4-w5-nd2', capture: BP4,
    configure: () => undefined,
    checks: (sw, mx) => [spl(sw, BP4.spl_dB), impedance(sw, BP4.impedance_ohm), maxPower(mx, BP4.maxPower_W)],
  },
  {
    label: '6th-order bandpass box', wpr: 'bp6-w5-nd2', capture: BP6,
    configure: () => undefined,
    checks: (sw, mx) => [spl(sw, BP6.spl_dB), impedance(sw, BP6.impedance_ohm), maxPower(mx, BP6.maxPower_W)],
  },
  {
    label: 'ABC box', wpr: 'abc-w5-nd2', capture: ABC,
    configure: () => undefined,
    checks: (sw, mx) => [spl(sw, ABC.spl_dB), impedance(sw, ABC.impedance_ohm), maxPower(mx, ABC.maxPower_W)],
  },
  {
    label: 'passive-radiator box', wpr: 'pr-w5-nd2', capture: PR,
    // WinISD's own fixed-loss frequency (Npr times below the tuning) is what these captures show.
    configure: (project) => project.winisdPrNprResonance.set(true),
    checks: (sw, mx) => [spl(sw, PR.spl_dB), impedance(sw, PR.impedance_ohm), maxPower(mx, PR.maxPower_W)],
  },
];

function setUpProject(c: Case): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, `${c.wpr}.wpr`), 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.winisdDriverCountModel.set(true);   // WinISD's per-driver impedance: a WinISD bug, off by default
  project.rgAtDriverSide.set(false);
  c.configure(project);
  return project;
}

describe('two drivers match WinISD with the per-driver impedance bug ticked', () => {
  for (const c of CASES) {
    describe(`${c.label} (${c.wpr})`, () => {
      const project = setUpProject(c);
      const sw = project.sweep(c.capture.grid).values!;
      const mx = project.maxCurves(c.capture.grid).values!;

      for (const check of c.checks(sw, mx)) {
        it(check.title, () => assertMatchesCapture(check, c.capture.step));
      }
    });
  }
});

/** W5-1138SMF sealed, Rg 0.1 Ω, as WinISD showed it by hand (winisd_research runs/nd-1,
 *  bugs/BUG_20261005_winisd_multi_driver_impedance_is_one_drivers.md): SPL at 1 kHz, cursor
 *  readout to 3 dp. N drivers each in 4.48 L and fed P/N.
 *  BUG_20261005_drive-voltage-each-stale-with-driver-count. */
describe('driver count and drive level (W5-1138SMF sealed, 4.48 L per driver)', () => {
  const grid = {fmin: 10, fmax: 1000, N: 100};
  const project = (n: number): OpenISDProject => {
    const p = setUpProject(CASES[0]);
    p.nDrivers.set(n);
    p.box.sealed.volume_m3.set(0.00448 * n);
    return p;
  };
  const splAt1k = (p: OpenISDProject): number => {
    const sw = p.sweep(grid).values!;
    return sw.spl[sw.spl.length - 1];
  };

  it('1 W: 80.532 dB at 1 driver, 86.552 dB at 4 (+6.02)', () => {
    const one = project(1);
    one.powerDrive_W.set(1);
    const four = project(4);
    four.powerDrive_W.set(1);
    expect(splAt1k(one)).toBeCloseTo(80.532, 2);
    expect(splAt1k(four)).toBeCloseTo(86.552, 2);
    expect(splAt1k(four) - splAt1k(one)).toBeCloseTo(20 * Math.log10(2), 9);
  });

  it('1 W at 4 drivers: each driver reads √(0.25·(Re+Rg)) V, not √(1·(Re+Rg))', () => {
    const one = project(1);
    one.powerDrive_W.set(1);
    const four = project(4);
    four.powerDrive_W.set(1);
    expect(four.driveVoltage_V.value).toBeCloseTo(one.driveVoltage_V.value / 2, 12);
  });

  it('1.85 V each: P 4× at 4 drivers, SPL +12.04 dB over 1 driver', () => {
    const one = project(1);
    one.driveVoltage_V.set(1.85);
    const four = project(4);
    four.driveVoltage_V.set(1.85);
    expect(four.powerDrive_W.value!).toBeCloseTo(4 * one.powerDrive_W.value!, 12);
    expect(splAt1k(four) - splAt1k(one)).toBeCloseTo(20 * Math.log10(4), 9);
  });
});
