import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Engine} from '../../engine/index.js';
import type {OpenISDProject} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDENS_DIR = join(here, '..', '..', 'test', 'winisd', 'fixtures', 'winisd-parity', 'goldens');

/** Two numbers closer than this, relative, count as equal. */
const SAME = 1e-9;
const GRID = {fmin: 10, fmax: 2000, N: 120};

/** One field edited two ways: written into the `.wpr` text and loaded (the file path), and set
 *  through the domain setter on the loaded base project (the hand path the UI takes). */
export interface ConsistencyCase {
  readonly label: string;
  readonly wprFile: string;
  readonly section: string;
  readonly key: string;
  readonly value: number;
  readonly hand: (project: OpenISDProject, value: number) => void;
}

/** A field whose `.wpr` value is text (a filter's `;`-joined params). The hand route gets the
 *  engine to build the edited value. */
export interface TextConsistencyCase {
  readonly label: string;
  readonly wprFile: string;
  readonly section: string;
  readonly key: string;
  readonly rawValue: string;
  readonly hand: (project: OpenISDProject, engine: Engine) => void;
}

/** A field WinISD writes to the `.wpr` as a readout and ignores on load (a port's `len`: WinISD
 *  tunes from [Box] Fr/Ff). Writing the key alone makes a file WinISD never writes, so the file
 *  route is the hand-edited project saved to `.wpr` and loaded back. */
export interface ReadoutConsistencyCase {
  readonly label: string;
  readonly wprFile: string;
  readonly readout: true;
  readonly value: number;
  readonly hand: (project: OpenISDProject, value: number) => void;
}

export interface CompatArea {
  readonly name: string;
  readonly summary: string;
  readonly cases: readonly ConsistencyCase[];
  readonly textCases?: readonly TextConsistencyCase[];
  readonly readoutCases?: readonly ReadoutConsistencyCase[];
}

export interface CaseResult {
  readonly label: string;
  readonly handMoves: boolean;
  readonly loadMoves: boolean;
  readonly handVsLoad: number;
  readonly error: string | null;
}

/** A case agrees when hand and load give the same results: same movement, same numbers. */
export function agrees(r: CaseResult): boolean {
  return r.error === null && r.handMoves === r.loadMoves && r.handVsLoad <= SAME;
}

function withKey(text: string, section: string, key: string, value: number | string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inside = false;
  let done = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('[')) inside = lines[i] === `[${section}]`;
    else if (inside && lines[i].split('=')[0] === key) { lines[i] = `${key}=${value}`; done = true; }
  }
  if (!done) throw new Error(`${section}.${key} is not in the file`);
  return lines.join('\n');
}

function loadProject(engine: Engine, text: string): OpenISDProject {
  const result = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (result.value === null) throw new Error(result.errors.map(e => e.message).join('; '));
  return result.value;
}

function collectNumbers(node: unknown, out: number[]): void {
  if (typeof node === 'number') out.push(node);
  else if (Array.isArray(node)) for (const item of node) collectNumbers(item, out);
  else if (typeof node === 'object' && node !== null) for (const item of Object.values(node)) collectNumbers(item, out);
}

function numbersOf(project: OpenISDProject): readonly number[] {
  const out: number[] = [];
  collectNumbers(project.sweep(GRID).values, out);
  collectNumbers(project.maxCurves(GRID).values, out);
  return out;
}

function worstRelative(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Infinity;
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i]) && Number.isNaN(b[i])) continue;
    worst = Math.max(worst, Math.abs(a[i] - b[i]) / Math.max(1e-12, Math.abs(a[i]), Math.abs(b[i])));
  }
  return worst;
}

function savedAndLoaded(engine: Engine, project: OpenISDProject): OpenISDProject {
  const saved = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
  if (saved.value === null) throw new Error(saved.errors.map(e => e.message).join('; '));
  return loadProject(engine, saved.value.toWpr());
}

export function runCase(engine: Engine, c: ConsistencyCase | TextConsistencyCase | ReadoutConsistencyCase): CaseResult {
  try {
    const text = readFileSync(join(GOLDENS_DIR, c.wprFile), 'utf8');
    const base = numbersOf(loadProject(engine, text));
    const handProject = loadProject(engine, text);
    if ('rawValue' in c) c.hand(handProject, engine); else c.hand(handProject, c.value);
    const hand = numbersOf(handProject);
    const loaded = numbersOf('readout' in c
      ? savedAndLoaded(engine, handProject)
      : loadProject(engine, withKey(text, c.section, c.key, 'rawValue' in c ? c.rawValue : c.value)));
    return {
      label: c.label, error: null,
      handMoves: worstRelative(base, hand) > SAME,
      loadMoves: worstRelative(base, loaded) > SAME,
      handVsLoad: worstRelative(hand, loaded),
    };
  } catch (e) {
    return {label: c.label, handMoves: false, loadMoves: false, handVsLoad: NaN, error: e instanceof Error ? e.message : String(e)};
  }
}
