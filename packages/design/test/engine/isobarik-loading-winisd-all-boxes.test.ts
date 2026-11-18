/**
 * Iso-barik loading, one case per box type, matched to WinISD's own plotted SPL, excursion and impedance.
 * Golden data: `../fixtures/winisdIsobarik<Box>Capture.ts`, each logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/<box>-w5-isobarik.wpr`, [Box] Isobarik=1; the loader must read it, the test does not set it).
 * Tolerances are those of driver-count-winisd.test.ts: 1e-12 relative, excursion 1e-11 relative (mm back to m).
 * The sealed box is in isobarik-loading-winisd.test.ts. T919, QO953.c38 "A: turn on isobaric".
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {type CaptureCheck as Check, assertMatchesCapture, relative} from '../fixtures/winisdCaptureCheck.js';
import {WINISD_ISOBARIK_VENTED_CAPTURE as VENTED} from '../fixtures/winisdIsobarikVentedCapture.js';
import {WINISD_ISOBARIK_PR_CAPTURE as PR} from '../fixtures/winisdIsobarikPrCapture.js';
import {WINISD_ISOBARIK_BP4_CAPTURE as BP4} from '../fixtures/winisdIsobarikBp4Capture.js';
import {WINISD_ISOBARIK_BP6_CAPTURE as BP6} from '../fixtures/winisdIsobarikBp6Capture.js';
import {WINISD_ISOBARIK_ABC_CAPTURE as ABC} from '../fixtures/winisdIsobarikAbcCapture.js';
import type {WinIsdPlottedPoint} from '../fixtures/winisdTwoDriversCapture.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');

type Sweep = NonNullable<ReturnType<OpenISDProject['sweep']>['values']>;
type Grid = Parameters<OpenISDProject['sweep']>[0];

interface Case {
  readonly label: string;
  readonly wpr: string;
  readonly capture: {
    readonly grid: Grid; readonly step: number;
    readonly spl_dB: readonly WinIsdPlottedPoint[];
    readonly excursion_m: readonly WinIsdPlottedPoint[];
    readonly impedance_ohm: readonly WinIsdPlottedPoint[];
  };
  readonly configure: (project: OpenISDProject) => void;
}

const CASES: readonly Case[] = [
  {label: 'vented box', wpr: 'vented-w5-isobarik', capture: VENTED, configure: () => undefined},
  // WinISD's own fixed-loss frequency (Npr times below the tuning) is what the captures show.
  {label: 'passive-radiator box', wpr: 'pr-w5-isobarik', capture: PR, configure: (project) => project.winisdPrNprResonance.set(true)},
  {label: '4th-order bandpass box', wpr: 'bp4-w5-isobarik', capture: BP4, configure: () => undefined},
  {label: '6th-order bandpass box', wpr: 'bp6-w5-isobarik', capture: BP6, configure: () => undefined},
  {label: 'ABC box', wpr: 'abc-w5-isobarik', capture: ABC, configure: () => undefined},
];

function setUpProject(c: Case): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, `${c.wpr}.wpr`), 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  c.configure(project);
  return project;
}

function checks(c: Case, sw: Sweep): readonly Check[] {
  return [
    {title: 'SPL (≤1e-12 relative)', name: 'SPL', got: sw.spl, want: c.capture.spl_dB, bound: relative(1e-12)},
    // OpenISD states excursion in mm; the ÷1000 back to m costs ~2e-12 relative.
    {title: 'excursion (≤1e-11 relative)', name: 'excursion', got: sw.exc.map((mm) => mm / 1000), want: c.capture.excursion_m, bound: relative(1e-11)},
    {title: 'impedance (≤1e-12 relative)', name: 'impedance', got: sw.zmag, want: c.capture.impedance_ohm, bound: relative(1e-12)},
  ];
}

describe('iso-barik loading matches WinISD for every box type', () => {
  for (const c of CASES) {
    describe(`${c.label} (${c.wpr})`, () => {
      const project = setUpProject(c);
      it('the .wpr loads as isobaric', () => expect(project.loading.value).toBe('isobaric'));
      const sw = project.sweep(c.capture.grid).values!;
      for (const check of checks(c, sw)) {
        it(check.title, () => assertMatchesCapture(check, c.capture.step));
      }
    });
  }
});
