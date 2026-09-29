// OpenISD's side of the chart review (docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md).
// Reads the SAME .wpr WinISD ran, imports it through OpenISDProject.fromWprText, applies the
// equivalence settings, writes the project out as .owpr and sweeps what reads back — so the
// numbers compared against WinISD are the saved project's, not the imported one's.
// Usage: npx tsx scripts/research/w5-openisd-dump.ts <in.wpr> <freqs.json> <out.json> [key=value ...]
// Keys: circuitModel, rgAtDriverSide, winisdDriverModel, Rs_ohm, envUseWinisdAirModel.
import {readFileSync, writeFileSync} from 'node:fs';
import {createEngine} from '../../packages/design/engine/index.ts';
import {defaultAppSettings} from '../../packages/design/engine/appSettings.ts';
import {OpenISDProject} from '../../packages/design/domain/project/openISDProject.ts';

type CircuitModel = 'winisd' | 'gyrator' | 'winisdGyrator';
const CIRCUIT_MODELS: readonly CircuitModel[] = ['winisd', 'gyrator', 'winisdGyrator'];
function circuitModelOf(s: string): CircuitModel {
  const m = CIRCUIT_MODELS.find(c => c === s);
  if (!m) throw new Error(`circuitModel must be one of ${CIRCUIT_MODELS.join('|')}, got ${s}`);
  return m;
}

const [wprPath, freqPath, outPath, ...kv] = process.argv.slice(2);
if (!wprPath || !freqPath || !outPath) throw new Error('usage: <in.wpr> <freqs.json> <out.json> [key=value ...]');
const opts = new Map(kv.map(s => {
  const i = s.indexOf('=');
  if (i < 0) throw new Error(`expected key=value, got ${s}`);
  return [s.slice(0, i), s.slice(i + 1)] as const;
}));

const engine = createEngine(defaultAppSettings);
const {value: project, errors} = OpenISDProject.fromWprText(readFileSync(wprPath, 'utf8'), engine);
if (!project) throw new Error(JSON.stringify(errors));

const circuitModel = opts.get('circuitModel');
if (circuitModel) project.circuitModel.set(circuitModelOf(circuitModel));
const rgAtDriverSide = opts.get('rgAtDriverSide');
if (rgAtDriverSide) project.rgAtDriverSide.set(rgAtDriverSide === 'true');
const winisdDriverModel = opts.get('winisdDriverModel');
if (winisdDriverModel) project.winisdDriverModel.set(winisdDriverModel === 'true');
const Rs_ohm = opts.get('Rs_ohm');
if (Rs_ohm) project.Rs_ohm.set(Number(Rs_ohm));
const envUseWinisdAirModel = opts.get('envUseWinisdAirModel');
if (envUseWinisdAirModel) project.envUseWinisdAirModel.set(envUseWinisdAirModel === 'true');

const owprText = project.toOwprText();
writeFileSync(outPath.replace(/\.json$/, '.owpr'), owprText);
const saved = OpenISDProject.fromOwprText(owprText, engine);
if (Array.isArray(saved)) throw new Error(saved.join('; '));

const fs: number[] = JSON.parse(readFileSync(freqPath, 'utf8'));
const grid = {fmin: fs[0], fmax: fs[fs.length - 1], N: fs.length - 1};
const sw = saved.sweep(grid);
const mx = saved.maxCurves(grid);
writeFileSync(outPath, JSON.stringify({
  importErrors: errors,
  owpr: JSON.parse(owprText),
  appSettings: {envDefaults: defaultAppSettings.envDefaults(), ventedLimits: defaultAppSettings.ventedLimits()},
  sweep: sw.values, sweepIssues: sw.issues, max: mx.values, maxIssues: mx.issues,
}));
console.log('ok', errors.length, 'import errors', sw.values ? sw.values.fs.length : sw.issues);
