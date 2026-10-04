/**
 * Transmission-line port model, matched to WinISD's own plotted curves, one case per box type.
 * Golden data: `../fixtures/winisd*TlPortsCapture.ts`, each logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/<box>-w5-tlports.wpr`). bugs/archive/BUG_20260928_tl-port-model-not-winisd.md,
 * bugs/archive/BUG_20260929_bp6-abc-tl-ports-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import type {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {type CaptureCheck as Check, absolute, assertMatchesCapture, relative} from '../fixtures/winisdCaptureCheck.js';
import {WINISD_TL_PORTS_CAPTURE as VENTED, type WinIsdPlottedPoint} from '../fixtures/winisdTlPortsCapture.js';
import {WINISD_BP4_TL_PORTS_CAPTURE as BP4} from '../fixtures/winisdBp4TlPortsCapture.js';
import {WINISD_BP6_TL_PORTS_CAPTURE as BP6} from '../fixtures/winisdBp6TlPortsCapture.js';
import {WINISD_ABC_TL_PORTS_CAPTURE as ABC} from '../fixtures/winisdAbcTlPortsCapture.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');

type Sweep = NonNullable<ReturnType<OpenISDProject['sweep']>['values']>;
type Grid = Parameters<OpenISDProject['sweep']>[0];

/** The curves a bandpass or ABC capture carries; the vented capture adds port velocity. */
interface BoxCapture {
  readonly grid: Grid;
  readonly step: number;
  readonly spl_dB: readonly WinIsdPlottedPoint[];
  readonly impedance_ohm: readonly WinIsdPlottedPoint[];
  readonly tfMag_dB: readonly WinIsdPlottedPoint[];
}

interface Case {
  readonly label: string;
  /** The `.wpr` fixture's base name, `<box>-w5-tlports`. */
  readonly wpr: string;
  readonly capture: BoxCapture;
  readonly configure: (project: OpenISDProject) => void;
  readonly checks: (sw: Sweep) => readonly Check[];
}

const spl = (sw: Sweep, c: BoxCapture): Check => ({title: 'SPL (≤1e-12 relative)', name: 'SPL', got: sw.spl, want: c.spl_dB, bound: relative(1e-12)});
const impedance = (sw: Sweep, c: BoxCapture): Check => ({title: 'impedance (≤1e-12 relative)', name: 'impedance', got: sw.zmag, want: c.impedance_ohm, bound: relative(1e-12)});

/** The bandpass and ABC captures: SPL, impedance, and a transfer function whose bound is looser near the line's first
 *  resonance (~10.6 kHz), where the rebuilt line length's last-bit rounding reaches 1.5e-12 dB. */
const bandpassChecks = (capture: BoxCapture) => (sw: Sweep): readonly Check[] => [
  spl(sw, capture),
  impedance(sw, capture),
  // TF passes through 0 dB, where a relative bound means nothing.
  {title: 'transfer function (≤1e-11 dB)', name: 'transfer function', got: sw.tfMag, want: capture.tfMag_dB, bound: absolute(1e-11)},
];

const CASES: readonly Case[] = [
  {
    label: 'vented box', wpr: 'vented-w5-tlports', capture: VENTED,
    configure: (project) => project.useTransmissionLinePortModel.set(true),
    checks: (sw) => [
      spl(sw, VENTED),
      // The line length is rebuilt from Fb; its last-bit rounding reaches the port flow at ~4e-11
      // (the closed-form fit, toys/w5_tl_port_model_check.py, bottoms out there too).
      {title: 'port velocity (≤1e-10 relative)', name: 'port velocity', got: sw.pv, want: VENTED.portVelocity_m_per_s, bound: relative(1e-10)},
      impedance(sw, VENTED),
      // TF passes through 0 dB, where a relative bound means nothing.
      {title: 'transfer function (≤1e-12 dB)', name: 'transfer function', got: sw.tfMag, want: VENTED.tfMag_dB, bound: absolute(1e-12)},
    ],
  },
  {label: '4th-order bandpass box', wpr: 'bp4-w5-tlports', capture: BP4, configure: () => undefined, checks: bandpassChecks(BP4)},
  {label: '6th-order bandpass box', wpr: 'bp6-w5-tlports', capture: BP6, configure: () => undefined, checks: bandpassChecks(BP6)},
  {label: 'ABC box', wpr: 'abc-w5-tlports', capture: ABC, configure: () => undefined, checks: bandpassChecks(ABC)},
];

function setUpProject(c: Case): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, `${c.wpr}.wpr`), 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  c.configure(project);
  return project;
}

describe('transmission-line ports match WinISD', () => {
  for (const c of CASES) {
    describe(`${c.label} (${c.wpr})`, () => {
      const project = setUpProject(c);
      const sw = project.sweep(c.capture.grid).values!;

      for (const check of c.checks(sw)) {
        it(check.title, () => assertMatchesCapture(check, c.capture.step));
      }
    });
  }
});
