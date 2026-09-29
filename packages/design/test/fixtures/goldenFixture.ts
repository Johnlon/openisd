/**
 * The golden-master fixture shape (`test/fixtures/golden/*.json`) and its boundary parser.
 *
 * `JSON.parse` returns `any`; every field golden.test.ts/gen-golden.ts read off it used to
 * inherit that `any` past the read. This module is the one place that untyped JSON is turned
 * into a typed value — a runtime type guard checks the shape once, here, and every caller gets
 * `GoldenFixture` back instead of `any`.
 */
import {readFileSync} from 'node:fs';
import type {BoxType, SweepParams} from '../../engine/index.js';

/** The fixed driver every golden fixture states, in RECORD names (matches WinISD/`.wdr` field
 *  names, not the engine's own `_hz`/`_ohm`-suffixed ones — golden.test.ts/gen-golden.ts convert).
 *  `Dd`/`BL`/`Mms`/`Cms`/`Rms` are optional: the committed fixtures never state them (the
 *  driver is fully described by the other 11), but golden.test.ts reads them into the same
 *  solver call every other suite uses, so they stay part of the shape. */
export interface GoldenDriverRaw {
  Fs: number; Qts: number; Qes: number; Qms: number; Vas: number; Sd: number;
  Re: number; Le: number; Xmax: number; Pe: number; Znom: number;
  Dd?: number; BL?: number; Mms?: number; Cms?: number; Rms?: number;
}

export interface GoldenDesign {
  driverRaw: GoldenDriverRaw;
  box: BoxType;
  P: SweepParams;
}

/** Only the `SweepResult` fields golden.test.ts actually compares. */
export interface GoldenSweep {
  fs: number[]; spl: number[]; phase: number[]; exc: number[]; excPR: number[];
  pv: number[]; zmag: number[]; zph: number[]; gd: number[];
}

/** Only the `MaxCurvesResult` fields golden.test.ts actually compares. */
export interface GoldenMaxCurves {
  maxspl: number[]; maxpwr: number[]; xlim: boolean[];
}

export interface GoldenFixture {
  design: GoldenDesign;
  sweep: GoldenSweep;
  maxCurves: GoldenMaxCurves;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(x => typeof x === 'number');
}

function isBooleanArray(v: unknown): v is boolean[] {
  return Array.isArray(v) && v.every(x => typeof x === 'boolean');
}

const DRIVER_RAW_KEYS = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Le', 'Xmax', 'Pe', 'Znom'] as const;
const DRIVER_RAW_OPTIONAL_KEYS = ['Dd', 'BL', 'Mms', 'Cms', 'Rms'] as const;

function isGoldenDriverRaw(v: unknown): v is GoldenDriverRaw {
  return isRecord(v)
    && DRIVER_RAW_KEYS.every(k => typeof v[k] === 'number')
    && DRIVER_RAW_OPTIONAL_KEYS.every(k => v[k] === undefined || typeof v[k] === 'number');
}

const BOX_TYPES: BoxType[] = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'box-passive-radiator', 'abc'];

function isBoxType(v: unknown): v is BoxType {
  return typeof v === 'string' && BOX_TYPES.some(b => b === v);
}

/** `SweepParams` has one required pair, `Vb`/`eg`; every other member is optional, so a record
 *  stating those two is a valid `SweepParams` regardless of which optional members it carries —
 *  checking more would duplicate the type instead of trusting it. */
function isSweepParams(v: unknown): v is SweepParams {
  return isRecord(v) && typeof v['Vb'] === 'number' && typeof v['eg'] === 'number';
}

function isGoldenDesign(v: unknown): v is GoldenDesign {
  return isRecord(v)
    && isGoldenDriverRaw(v['driverRaw'])
    && isBoxType(v['box'])
    && isSweepParams(v['P']);
}

function isGoldenSweep(v: unknown): v is GoldenSweep {
  return isRecord(v)
    && isNumberArray(v['fs']) && isNumberArray(v['spl']) && isNumberArray(v['phase'])
    && isNumberArray(v['exc']) && isNumberArray(v['excPR']) && isNumberArray(v['pv'])
    && isNumberArray(v['zmag']) && isNumberArray(v['zph']) && isNumberArray(v['gd']);
}

function isGoldenMaxCurves(v: unknown): v is GoldenMaxCurves {
  return isRecord(v)
    && isNumberArray(v['maxspl']) && isNumberArray(v['maxpwr']) && isBooleanArray(v['xlim']);
}

function isGoldenFixture(v: unknown): v is GoldenFixture {
  return isRecord(v)
    && isGoldenDesign(v['design'])
    && isGoldenSweep(v['sweep'])
    && isGoldenMaxCurves(v['maxCurves']);
}

/** Reads and validates one `golden/<name>.json` fixture. Throws, naming the file, on a shape
 *  that does not match `GoldenFixture` — a stale or hand-edited fixture reports itself here
 *  instead of reading back as `any` and failing an assertion three lines further down. */
export function readGoldenFixture(filePath: string): GoldenFixture {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isGoldenFixture(parsed))
    throw new Error(`${filePath}: not a golden fixture (design/sweep/maxCurves missing or mistyped)`);
  return parsed;
}
